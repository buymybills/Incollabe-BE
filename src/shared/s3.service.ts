import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import 'multer';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;
  private cloudFrontDomain: string | null;
  private cloudFrontKeyPairId: string | null;
  private cloudFrontPrivateKey: string | null;
  private cloudFrontSigner: AWS.CloudFront.Signer | null;

  constructor(private configService: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME')!;
    this.cloudFrontDomain = this.configService.get('CLOUDFRONT_DOMAIN') || null;
    this.cloudFrontKeyPairId = this.configService.get('CLOUDFRONT_KEY_PAIR_ID') || null;

    // Load private key from either direct value or file path
    const privateKeyPath = this.configService.get('CLOUDFRONT_PRIVATE_KEY_PATH');
    if (privateKeyPath) {
      try {
        this.cloudFrontPrivateKey = fs.readFileSync(privateKeyPath, 'utf8');
      } catch (error) {
        console.error('Failed to load CloudFront private key from file:', error);
        this.cloudFrontPrivateKey = null;
      }
    } else {
      this.cloudFrontPrivateKey = this.configService.get('CLOUDFRONT_PRIVATE_KEY') || null;
    }

    // Initialize CloudFront signer if credentials are available
    if (this.cloudFrontKeyPairId && this.cloudFrontPrivateKey) {
      this.cloudFrontSigner = new AWS.CloudFront.Signer(
        this.cloudFrontKeyPairId,
        this.cloudFrontPrivateKey,
      );
    } else {
      this.cloudFrontSigner = null;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    key: string,
  ): Promise<AWS.S3.ManagedUpload.SendData> {
    // Detect if the file is a video
    const isVideo = file.mimetype.startsWith('video/') ||
                    key.includes('/videos/') ||
                    key.match(/\.(mp4|mov|avi|quicktime|webm|mkv)$/i);

    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // For videos and images, set ContentDisposition to 'inline' so they open in browser
      // instead of downloading (important for iOS Safari)
      ContentDisposition: isVideo || file.mimetype.startsWith('image/') ? 'inline' : undefined,
    };

    return this.s3.upload(uploadParams).promise();
  }

  async deleteFile(key: string): Promise<void> {
    const deleteParams = {
      Bucket: this.bucketName,
      Key: key,
    };

    await this.s3.deleteObject(deleteParams).promise();
  }

  getFileUrl(key: string): string {
    // Serve via CloudFront CDN when configured — reduces S3 data transfer costs
    if (this.cloudFrontDomain) {
      return `https://${this.cloudFrontDomain}/${key}`;
    }
    return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
  }

  /**
   * Generate a signed URL for temporary access to a private S3 object
   * @param key - S3 object key
   * @param expiresIn - Expiration time in seconds (default: 2 minutes)
   * @returns Signed URL string
   */
  getSignedUrl(key: string, expiresIn: number = 120): string {
    // Use CloudFront if configured, otherwise fall back to S3
    if (this.cloudFrontDomain && this.cloudFrontKeyPairId && this.cloudFrontPrivateKey) {
      return this.getCloudFrontSignedUrl(key, expiresIn);
    }
    
    // Fallback to S3 signed URL
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn, // URL expires in 2 minutes by default
    };

    return this.s3.getSignedUrl('getObject', params);
  }

  /**
   * Generate a CloudFront signed URL for temporary access to a file
   * Uses AWS SDK's built-in CloudFront signer for proper URL generation
   * @param key - S3 object key (path)
   * @param expiresIn - Expiration time in seconds (default: 2 minutes)
   * @returns CloudFront signed URL string
   */
  private getCloudFrontSignedUrl(key: string, expiresIn: number = 120): string {
    if (!this.cloudFrontSigner || !this.cloudFrontDomain) {
      throw new Error('CloudFront signing attempted without required configuration');
    }

    const url = `https://${this.cloudFrontDomain}/${key}`;

    // CloudFront Signer expects expires in seconds (Unix timestamp), not milliseconds
    const expiresAt = Math.floor((Date.now() + expiresIn * 1000) / 1000);

    // Use AWS SDK's CloudFront signer
    // CloudFront will serve files with their stored Content-Type from S3 metadata
    const signedUrl = this.cloudFrontSigner.getSignedUrl({
      url,
      expires: expiresAt,
    });

    return signedUrl;
  }

  /**
   * Extract S3 key from a full S3 URL
   * @param url - Full S3 URL
   * @returns S3 key or null if URL is invalid
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Handle all formats:
      // https://bucket.s3.region.amazonaws.com/key
      // https://s3.region.amazonaws.com/bucket/key
      // https://xxxxx.cloudfront.net/key  (with or without query params)
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

      // CloudFront format: domain.cloudfront.net/key
      if (this.cloudFrontDomain && hostname === this.cloudFrontDomain) {
        return pathname.startsWith('/') ? pathname.substring(1) : pathname;
      }

      // Format: bucket.s3.region.amazonaws.com/key
      if (hostname.startsWith(this.bucketName)) {
        return pathname.startsWith('/') ? pathname.substring(1) : pathname;
      }

      // Format: s3.region.amazonaws.com/bucket/key
      if (hostname.includes('s3') && pathname.startsWith(`/${this.bucketName}/`)) {
        return pathname.substring(this.bucketName.length + 2);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert a public S3 URL to a signed URL
   * @param url - Public S3 URL
   * @param expiresIn - Expiration time in seconds (default: 2 minutes)
   * @returns Signed URL or original URL if conversion fails
   */
  convertToSignedUrl(url: string | null, expiresIn: number = 120): string | null {
    if (!url) return null;

    const key = this.extractKeyFromUrl(url);
    if (!key) return url; // Return original URL if we can't extract the key

    // Use CloudFront if configured, otherwise use S3 signed URL
    if (this.cloudFrontDomain && this.cloudFrontKeyPairId && this.cloudFrontPrivateKey) {
      return this.getCloudFrontSignedUrl(key, expiresIn);
    }

    return this.getSignedUrl(key, expiresIn);
  }

  async uploadFileToS3(
    file: Express.Multer.File,
    folder: string,
    prefix: string,
  ): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split('.').pop();
    const s3Key = `${folder}/${prefix}-${uniqueSuffix}.${fileExtension}`;

    await this.uploadFile(file, s3Key);
    return this.getFileUrl(s3Key);
  }

  /**
   * Download a file from a remote URL and upload it directly to S3.
   * Used to archive Instagram story media before it expires.
   */
  async uploadFromUrl(
    url: string,
    s3Key: string,
    contentType: string,
  ): Promise<string> {
    const response = await require('axios').default.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    const buffer = Buffer.from(response.data);

    const isVideo = contentType.startsWith('video/');
    await this.s3.upload({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: isVideo || contentType.startsWith('image/') ? 'inline' : undefined,
    }).promise();

    return this.getFileUrl(s3Key);
  }

  // ============================================================================
  // Multipart Upload Methods (Instagram-style chunked uploads for large files)
  // ============================================================================

  /**
   * Initiate a multipart upload session
   * @param key - S3 object key (path/filename)
   * @param mimeType - File MIME type
   * @returns Upload ID and key
   */
  async initiateMultipartUpload(
    key: string,
    mimeType: string,
  ): Promise<{ uploadId: string; key: string }> {
    const isVideo = mimeType.startsWith('video/') || key.includes('/videos/');

    const params: AWS.S3.CreateMultipartUploadRequest = {
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
      // For videos and images, set ContentDisposition to 'inline'
      ContentDisposition: isVideo || mimeType.startsWith('image/') ? 'inline' : undefined,
    };

    const result = await this.s3.createMultipartUpload(params).promise();

    if (!result.UploadId) {
      throw new Error('Failed to initiate multipart upload: No UploadId returned');
    }

    return {
      uploadId: result.UploadId,
      key: result.Key!,
    };
  }

  /**
   * Generate presigned URLs for uploading parts
   * @param key - S3 object key
   * @param uploadId - Upload ID from initiate
   * @param parts - Number of parts to generate URLs for
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns Array of presigned URLs
   */
  async getPresignedUrlsForParts(
    key: string,
    uploadId: string,
    parts: number,
    expiresIn: number = 3600,
  ): Promise<Array<{ partNumber: number; url: string }>> {
    const presignedUrls: Array<{ partNumber: number; url: string }> = [];

    for (let partNumber = 1; partNumber <= parts; partNumber++) {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Expires: expiresIn,
      };

      const url = await this.s3.getSignedUrlPromise('uploadPart', params);
      presignedUrls.push({ partNumber, url });
    }

    return presignedUrls;
  }

  /**
   * Complete a multipart upload
   * @param key - S3 object key
   * @param uploadId - Upload ID from initiate
   * @param parts - Array of uploaded parts with ETags
   * @returns Completed upload location
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<{ location: string; bucket: string; key: string }> {
    const params: AWS.S3.CompleteMultipartUploadRequest = {
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    };

    const result = await this.s3.completeMultipartUpload(params).promise();

    return {
      location: result.Location!,
      bucket: result.Bucket!,
      key: result.Key!,
    };
  }

  /**
   * Abort a multipart upload (cleanup incomplete upload)
   * @param key - S3 object key
   * @param uploadId - Upload ID from initiate
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const params: AWS.S3.AbortMultipartUploadRequest = {
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    };

    await this.s3.abortMultipartUpload(params).promise();
  }

  /**
   * List uploaded parts for a multipart upload (for resume functionality)
   * @param key - S3 object key
   * @param uploadId - Upload ID from initiate
   * @returns Array of uploaded parts with part numbers and ETags
   */
  async listUploadedParts(
    key: string,
    uploadId: string,
  ): Promise<Array<{ PartNumber: number; ETag: string; Size: number }>> {
    const params: AWS.S3.ListPartsRequest = {
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    };

    try {
      const result = await this.s3.listParts(params).promise();

      if (!result.Parts || result.Parts.length === 0) {
        return [];
      }

      return result.Parts.map((part) => ({
        PartNumber: part.PartNumber!,
        ETag: part.ETag!,
        Size: part.Size!,
      }));
    } catch (error) {
      // If upload doesn't exist or was aborted, return empty array
      if ((error as any).code === 'NoSuchUpload') {
        return [];
      }
      throw error;
    }
  }
}
