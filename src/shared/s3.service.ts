import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import 'multer';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;
  private cloudFrontDomain: string | null;
  private cloudFrontKeyPairId: string | null;
  private cloudFrontPrivateKey: string | null;

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
  }

  async uploadFile(
    file: Express.Multer.File,
    key: string,
  ): Promise<AWS.S3.ManagedUpload.SendData> {
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
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
   * @param key - S3 object key (path)
   * @param expiresIn - Expiration time in seconds (default: 2 minutes)
   * @returns CloudFront signed URL string
   */
  private getCloudFrontSignedUrl(key: string, expiresIn: number = 120): string {
    if (!this.cloudFrontPrivateKey || !this.cloudFrontKeyPairId || !this.cloudFrontDomain) {
      throw new Error('CloudFront signing attempted without required configuration');
    }

    const url = `https://${this.cloudFrontDomain}/${key}`;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // Create the policy object
    const policy = {
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': expiresAt,
            },
          },
        },
      ],
    };

    // Encode the policy to URL-safe base64
    const policyString = JSON.stringify(policy);
    const encodedPolicy = this.toUrlSafeBase64(Buffer.from(policyString));

    // Sign the policy with the private key using SHA256
    // Get signature as Buffer directly (no encoding)
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(policyString)
      .sign({
        key: this.cloudFrontPrivateKey,
        format: 'pem',
      });

    // Convert signature Buffer to URL-safe base64
    const encodedSignature = this.toUrlSafeBase64(signature);

    // Build the signed URL with properly encoded parameters
    // Note: encodedPolicy and encodedSignature are already base64url encoded (URL-safe)
    // so we don't need encodeURIComponent() on them
    const signedUrl =
      `${url}?` +
      `Policy=${encodedPolicy}` +
      `&Signature=${encodedSignature}` +
      `&Key-Pair-Id=${this.cloudFrontKeyPairId}`;

    return signedUrl;
  }

  /**
   * Convert base64 string to URL-safe base64
   * Replaces + with -, / with _, and removes = padding
   */
  private toUrlSafeBase64(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Extract S3 key from a full S3 URL
   * @param url - Full S3 URL
   * @returns S3 key or null if URL is invalid
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Handle both formats:
      // https://bucket.s3.region.amazonaws.com/key
      // https://s3.region.amazonaws.com/bucket/key
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

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
}
