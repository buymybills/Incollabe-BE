import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType, NotificationPriority } from '../models/in-app-notification.model';

// DTO for creating a notification (internal use)
export class CreateInAppNotificationDto {
  @ApiProperty({ description: 'User ID' })
  @IsInt()
  userId: number;

  @ApiProperty({ description: 'User type', enum: ['influencer', 'brand'] })
  @IsEnum(['influencer', 'brand'])
  userType: 'influencer' | 'brand';

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body/message' })
  @IsString()
  body: string;

  @ApiProperty({
    description: 'Notification type',
    enum: NotificationType,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ description: 'Deep link URL' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Action type' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Related entity type (e.g., campaign, application)' })
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @ApiPropertyOptional({ description: 'Related entity ID' })
  @IsOptional()
  @IsInt()
  relatedEntityId?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Priority',
    enum: NotificationPriority,
    default: NotificationPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  expiresAt?: Date;
}

// DTO for getting notifications (query params)
export class GetNotificationsDto {
  @ApiPropertyOptional({
    description: 'Return only unread count (no notification list). Set to true for badge display.',
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  countOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by read status: true = read only, false = unread only, undefined = all',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by notification type',
    enum: NotificationType,
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({
    description: 'Filter by multiple notification types',
    type: [String],
    example: ['campaign_invite', 'campaign_selected'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[];

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of notifications per page',
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

// DTO for marking notifications as read
export class MarkNotificationsReadDto {
  @ApiPropertyOptional({
    description: 'Array of notification IDs to mark as read. If not provided, all unread notifications will be marked as read.',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  notificationIds?: number[];
}

// Response DTOs
export class NotificationResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiPropertyOptional()
  actionUrl?: string | null;

  @ApiPropertyOptional()
  actionType?: string | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  relatedEntityType?: string | null;

  @ApiPropertyOptional()
  relatedEntityId?: number | null;

  @ApiPropertyOptional()
  metadata?: Record<string, any> | null;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional()
  readAt?: Date | null;

  @ApiProperty({ enum: NotificationPriority })
  priority: NotificationPriority;

  @ApiPropertyOptional()
  expiresAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class GetNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  notifications: NotificationResponseDto[];

  @ApiProperty({ description: 'Total unread count' })
  unreadCount: number;

  @ApiProperty({ description: 'Total number of notifications matching filters' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class MarkAsReadResponseDto {
  @ApiProperty({ description: 'Number of notifications marked as read' })
  markedCount: number;

  @ApiProperty()
  message: string;
}

export class DeleteNotificationResponseDto {
  @ApiProperty()
  message: string;
}

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Total unread notifications count' })
  unreadCount: number;

  @ApiPropertyOptional({
    description: 'Breakdown by notification type',
    example: {
      campaign_invite: 5,
      new_message: 3,
      payment_received: 1,
    },
  })
  byType?: Record<string, number>;
}
