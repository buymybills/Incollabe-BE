import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '../models/message.model';

export class CreateConversationDto {
  @ApiProperty({ description: 'ID of the other party (influencer or brand)' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  otherPartyId: number;

  @ApiProperty({
    description: 'Type of other party',
    enum: ['influencer', 'brand'],
  })
  @IsString()
  @IsNotEmpty()
  otherPartyType: 'influencer' | 'brand';
}

export class SendMessageDto {
  @ApiProperty({
    description:
      'Conversation ID - REQUIRED for CAMPAIGN chats. Optional for personal chats (can use otherPartyId+otherPartyType instead). ' +
      'Get campaign conversation IDs from GET /api/chat/conversations?type=campaign',
    required: false,
    example: 129,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  conversationId?: number;

  @ApiProperty({
    description:
      'ID of the other party - ONLY for PERSONAL conversations. Backend will auto-create/find personal conversation. ' +
      'DO NOT use for campaign chats! Campaign chats must use conversationId.',
    required: false,
    example: 92,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  otherPartyId?: number;

  @ApiProperty({
    description:
      'Type of other party - ONLY for PERSONAL conversations. Required when using otherPartyId. ' +
      'DO NOT use for campaign chats!',
    enum: ['influencer', 'brand'],
    required: false,
    example: 'brand',
  })
  @IsString()
  @IsOptional()
  otherPartyType?: 'influencer' | 'brand';

  @ApiProperty({ description: 'Message content', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  content?: string;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType;

  @ApiProperty({ description: 'Attachment URL', required: false })
  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @ApiProperty({ description: 'Attachment name', required: false })
  @IsString()
  @IsOptional()
  attachmentName?: string;

  @ApiProperty({ description: 'MIME type of the media attachment e.g. image/jpeg, video/mp4', required: false })
  @IsString()
  @IsOptional()
  mediaType?: string;

  @ApiProperty({
    description: 'ID of the message being replied to (WhatsApp-style reply)',
    required: false,
    example: 123,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  replyToMessageId?: number;
}

export class GetConversationsDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number;

  @ApiProperty({ description: 'Search by name', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Filter by conversation type',
    enum: ['personal', 'campaign', 'group'],
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: 'personal' | 'campaign' | 'group';
}

export class SubmitReviewDto {
  @ApiProperty({ description: 'Rating from 1 to 5', minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Optional review text', required: false, example: 'Great collaboration!' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reviewText?: string;
}

export class GetMessagesDto {
  // conversationId comes from path parameter, not query
  // Hidden from Swagger documentation
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  conversationId?: number;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiProperty({
    description: 'Messages per page',
    required: false,
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Load messages before this message ID (for pagination)',
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  beforeMessageId?: number;
}

export class MarkAsReadDto {
  @ApiProperty({ description: 'Conversation ID' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  conversationId: number;

  @ApiProperty({
    description: 'Mark all messages as read up to this message ID',
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  messageId?: number;
}

export class MarkAsReadBodyDto {
  @ApiProperty({
    description:
      'Optional message ID. If provided, marks all messages up to and including this ID as read. If omitted, marks all unread messages as read.',
    required: false,
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  messageId?: number;
}

export class TypingDto {
  @ApiProperty({ description: 'Conversation ID' })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  conversationId: number;
}

// Multipart Upload DTOs for chunked large file uploads (Instagram-style)
export class InitiateMultipartUploadDto {
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

  @ApiProperty({ description: 'File type category', enum: ['image', 'video', 'audio', 'document'] })
  @IsString()
  @IsNotEmpty()
  fileType: 'image' | 'video' | 'audio' | 'document';
}

export class GetPresignedUrlsDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Number of parts to upload', example: 10, minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  parts: number;
}

export class CompleteMultipartUploadDto {
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

export class AbortMultipartUploadDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;
}

export class UpdateUploadProgressDto {
  @ApiProperty({ description: 'Upload ID' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'Upload progress percentage (0-100)', minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress: number;

  @ApiProperty({ description: 'Bytes uploaded so far' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bytesUploaded: number;

  @ApiProperty({ description: 'Total file size in bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalBytes: number;
}

export class GetUploadStatusDto {
  @ApiProperty({ description: 'Upload ID from initiate response' })
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty({ description: 'S3 file key from initiate response' })
  @IsString()
  @IsNotEmpty()
  key: string;
}
