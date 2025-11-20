import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
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
      'Conversation ID (either conversationId OR otherPartyId+otherPartyType required)',
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  conversationId?: number;

  @ApiProperty({
    description:
      'ID of the other party (required if conversationId not provided)',
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  otherPartyId?: number;

  @ApiProperty({
    description:
      'Type of other party (required if conversationId not provided)',
    enum: ['influencer', 'brand'],
    required: false,
  })
  @IsString()
  @IsOptional()
  otherPartyType?: 'influencer' | 'brand';

  @ApiProperty({ description: 'Message content', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
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
