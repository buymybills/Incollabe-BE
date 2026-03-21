import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// Multipart Upload DTOs for chunked large file uploads (Instagram-style) for posts
export class InitiatePostMultipartUploadDto {
  @ApiProperty({ description: 'File name', example: 'video.mp4' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'File MIME type', example: 'video/mp4' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes', example: 524288000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize: number;

  @ApiProperty({
    description: 'File type category',
    enum: ['image', 'video'],
    example: 'video',
  })
  @IsString()
  @IsNotEmpty()
  fileType: 'image' | 'video';
}

export class GetPostPresignedUrlsDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Number of parts to upload',
    example: 10,
    minimum: 1,
    maximum: 10000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  parts: number;
}

export class CompletePostMultipartUploadDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Array of uploaded parts with ETags',
    example: [{ PartNumber: 1, ETag: '"etag-value"' }],
    type: [Object],
  })
  @IsNotEmpty()
  parts: Array<{ PartNumber: number; ETag: string }>;
}

export class AbortPostMultipartUploadDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;
}

export class GetPostUploadStatusDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;
}
