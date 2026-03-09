import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import 'multer';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME')!;
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
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn, // URL expires in 2 minutes by default
    };

    return this.s3.getSignedUrl('getObject', params);
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
