import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as AWS from "aws-sdk";
import "multer";

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get("AWS_ACCESS_KEY_ID"),
      secretAccessKey: this.configService.get("AWS_SECRET_ACCESS_KEY"),
      region: this.configService.get("AWS_REGION"),
    });
    this.bucketName = this.configService.get("AWS_S3_BUCKET_NAME")!;
  }

  async uploadFile(file: Express.Multer.File, key: string): Promise<AWS.S3.ManagedUpload.SendData> {
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
    return `https://${this.bucketName}.s3.${this.configService.get("AWS_REGION")}.amazonaws.com/${key}`;
  }
}
