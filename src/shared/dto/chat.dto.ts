import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '../models/message.model';

export class PollOptionDto {
  @ApiProperty({ description: 'Option text', example: 'Option A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text: string;
}

export class CreatePollDto {
  @ApiProperty({ description: 'The poll question', example: 'Which feature should we prioritize?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @ApiProperty({ description: 'Poll options (2–10)', type: [PollOptionDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options: PollOptionDto[];

  @ApiProperty({ description: 'Allow members to vote for multiple options', default: false })
  @IsBoolean()
  @IsOptional()
  allowMultiple?: boolean;

  @ApiProperty({ description: 'Optional poll expiry (ISO date string)', required: false, example: '2026-05-20T00:00:00Z' })
  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class VotePollDto {
  @ApiProperty({ description: 'Option ID to vote for', example: 'opt_1' })
  @IsString()
  @IsNotEmpty()
  optionId: string;
}

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
    description: 'Plaintext version of the message for server-side search. Required when sending E2EE encrypted content so the server can index the message without decrypting it.',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  searchableContent?: string;

  @ApiProperty({
    description: 'Encrypted AES keys per recipient, keyed as "recipientId:recipientType". Used for group E2EE messages instead of embedding keys in content.',
    required: false,
    example: { '6:influencer': 'base64...', '1:brand': 'base64...' },
  })
  @IsObject()
  @IsOptional()
  encryptedKeys?: Record<string, string>;

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

  @ApiProperty({
    description: 'Post ID to share as a message card (messageType must be "post")',
    required: false,
    example: 42,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  postId?: number;

  @ApiProperty({
    description: 'Duration of voice note in seconds (only for messageType "audio")',
    required: false,
    example: 23,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  audioDuration?: number;

  @ApiProperty({
    description: 'Poll data — required when messageType is "poll". Only valid in group chats.',
    required: false,
    type: CreatePollDto,
  })
  @ValidateNested()
  @Type(() => CreatePollDto)
  @IsOptional()
  pollData?: CreatePollDto;
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

  @ApiProperty({
    description: 'Exclude conversations with blocked users (both directions). Useful when picking recipients e.g. share-post flow.',
    required: false,
    default: false,
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  excludeBlocked?: boolean;
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

  @ApiProperty({
    description: 'Search within messages (only searches plaintext — encrypted messages are excluded)',
    required: false,
    example: 'hello',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  search?: string;
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

export class SearchMessagesDto {
  @ApiProperty({ description: 'Search query (minimum 1 character)', example: 'hello' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  search: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: 'Results per page', required: false, default: 20 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number;

  @ApiProperty({
    description: 'Filter by message type',
    enum: MessageType,
    required: false,
  })
  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType;

  @ApiProperty({ description: 'Minimum Instagram followers of the message sender', required: false, example: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minFollowers?: number;

  @ApiProperty({ description: 'Maximum Instagram followers of the message sender', required: false, example: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxFollowers?: number;
}
