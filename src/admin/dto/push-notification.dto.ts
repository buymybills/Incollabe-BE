import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsNumber,
  MaxLength,
  MinLength,
  IsNotEmpty,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReceiverType,
  NotificationStatus,
  GenderFilter,
  InterruptionLevel,
} from '../models/push-notification.model';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'Weekly Top Influencers',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Notification body/message',
    example: 'New Top Influencer List is live, Tap to view Now',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  body: string;

  @ApiProperty({
    description: 'Internal reference name (not shown to users)',
    example: 'Top Influencers Campaign Oct 2024',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  internalName?: string;

  @ApiProperty({
    description: 'Banner/Big Picture URL for rich notifications (HTTPS only, 2:1 ratio recommended)',
    example: 'https://plus.unsplash.com/premium_photo-1683865776032-07bf70b0add1?q=80&w=3132&auto=format',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Deep link URL to open specific screen in app (e.g., app://campaigns/123, app://influencers/me)',
    example: 'app://influencers/me',
    required: false,
  })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiProperty({
    description: 'Android notification channel ID for categorization',
    example: 'promotions',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  androidChannelId?: string;

  @ApiProperty({
    description: 'Notification sound: default, custom, or silent',
    example: 'default',
    enum: ['default', 'custom', 'silent'],
    required: false,
  })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiProperty({
    description: 'Notification priority: high, normal, or low',
    example: 'high',
    enum: ['high', 'normal', 'low'],
    required: false,
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({
    description: 'Hours before notification expires (1-168 hours)',
    example: 24,
    minimum: 1,
    maximum: 168,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  expirationHours?: number;

  // iOS-specific fields
  @ApiProperty({
    description: 'Badge count (red number on iOS app icon). Set to 0 to clear badge.',
    example: 5,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  badge?: number;

  @ApiProperty({
    description: 'Thread identifier for grouping related notifications on iOS (e.g., campaign ID)',
    example: 'campaign-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiProperty({
    description: 'iOS interruption level: passive (silent), active (default), timeSensitive (bypasses Focus), critical (always plays sound)',
    example: 'active',
    enum: InterruptionLevel,
    required: false,
  })
  @IsOptional()
  @IsEnum(InterruptionLevel)
  interruptionLevel?: InterruptionLevel;

  @ApiProperty({
    description: 'Custom key-value data for deep linking and app navigation',
    example: { campaignId: '123', tab: 'featured' },
    required: false,
  })
  @IsOptional()
  customData?: Record<string, any>;

  @ApiProperty({
    description: 'Type of receivers',
    enum: ReceiverType,
    example: ReceiverType.ALL_USERS,
  })
  @IsEnum(ReceiverType)
  receiverType: ReceiverType;

  @ApiProperty({
    description:
      'Specific receiver IDs (required if receiverType is SPECIFIC_USERS, BRANDS, or INFLUENCERS)',
    type: [Number],
    required: false,
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  specificReceivers?: number[];

  @ApiProperty({
    description: 'Target locations/cities',
    type: [String],
    required: false,
    example: ['Navi Mumbai', 'Bangalor', '+2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiProperty({
    description: 'Gender filter for recipients',
    enum: GenderFilter,
    required: false,
    example: GenderFilter.ALL,
  })
  @IsOptional()
  @IsEnum(GenderFilter)
  genderFilter?: GenderFilter;

  @ApiProperty({
    description: 'Minimum age for recipients',
    required: false,
    example: 18,
    minimum: 13,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @ApiProperty({
    description: 'Maximum age for recipients',
    required: false,
    example: 35,
    minimum: 13,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @ApiProperty({
    description: 'Niche IDs for targeting specific niches',
    type: [Number],
    required: false,
    example: [1, 5, 8],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @ApiProperty({
    description: 'Whether to target all of India',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPanIndia?: boolean;

  @ApiProperty({
    description: 'Scheduled date and time (ISO 8601 format)',
    example: '2025-10-02T12:28:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'Weekly Top Influencers',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiProperty({
    description: 'Notification body/message',
    example: 'New Top Influencer List is live, Tap to view Now',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body?: string;

  @ApiProperty({
    description: 'Internal reference name (not shown to users)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  internalName?: string;

  @ApiProperty({
    description: 'Banner/Big Picture URL for rich notifications',
    example: 'https://plus.unsplash.com/premium_photo-1683865776032-07bf70b0add1?q=80&w=3132&auto=format',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Deep link URL to open specific screen in app',
    example: 'app://influencers/me',
    required: false,
  })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiProperty({
    description: 'Android notification channel ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  androidChannelId?: string;

  @ApiProperty({
    description: 'Notification sound: default, custom, or silent',
    enum: ['default', 'custom', 'silent'],
    required: false,
  })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiProperty({
    description: 'Notification priority: high, normal, or low',
    enum: ['high', 'normal', 'low'],
    required: false,
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({
    description: 'Hours before notification expires (1-168 hours)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  expirationHours?: number;

  @ApiProperty({
    description: 'Badge count (red number on iOS app icon)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  badge?: number;

  @ApiProperty({
    description: 'Thread identifier for grouping related notifications on iOS',
    required: false,
  })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiProperty({
    description: 'iOS interruption level',
    enum: InterruptionLevel,
    required: false,
  })
  @IsOptional()
  @IsEnum(InterruptionLevel)
  interruptionLevel?: InterruptionLevel;

  @ApiProperty({
    description: 'Custom key-value data for deep linking and app navigation',
    required: false,
  })
  @IsOptional()
  customData?: Record<string, any>;

  @ApiProperty({
    description: 'Type of receivers',
    enum: ReceiverType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReceiverType)
  receiverType?: ReceiverType;

  @ApiProperty({
    description: 'Specific receiver IDs',
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  specificReceivers?: number[];

  @ApiProperty({
    description: 'Target locations/cities',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiProperty({
    description: 'Gender filter for recipients',
    enum: GenderFilter,
    required: false,
  })
  @IsOptional()
  @IsEnum(GenderFilter)
  genderFilter?: GenderFilter;

  @ApiProperty({
    description: 'Minimum age for recipients',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @ApiProperty({
    description: 'Maximum age for recipients',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @ApiProperty({
    description: 'Niche IDs for targeting',
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @ApiProperty({
    description: 'Whether to target all of India',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPanIndia?: boolean;

  @ApiProperty({
    description: 'Scheduled date and time (ISO 8601 format)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class GetNotificationsDto {
  @ApiProperty({
    description: 'Filter by status',
    enum: NotificationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiProperty({
    description: 'Filter by receiver type',
    enum: ReceiverType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReceiverType)
  receiverType?: ReceiverType;

  @ApiProperty({
    description: 'Start date filter (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date filter (ISO 8601)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID', example: 1 })
  id: number;

  @ApiProperty({
    description: 'Notification title',
    example: 'Weekly Top Influencers',
  })
  title: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'New Top Influencer List is live, Tap to view Now',
  })
  body: string;

  @ApiProperty({
    description: 'Internal reference name',
    example: 'Top Influencers Campaign Oct 2024',
    required: false,
  })
  internalName?: string | null;

  @ApiProperty({
    description: 'Banner/Big Picture URL',
    example: 'https://example.com/banner.jpg',
    required: false,
  })
  imageUrl?: string | null;

  @ApiProperty({
    description: 'Deep link URL',
    example: 'app://top-influencers',
    required: false,
  })
  actionUrl?: string | null;

  @ApiProperty({
    description: 'Android notification channel ID',
    example: 'promotions',
    required: false,
  })
  androidChannelId?: string | null;

  @ApiProperty({
    description: 'Notification sound',
    example: 'default',
    required: false,
  })
  sound?: string | null;

  @ApiProperty({
    description: 'Notification priority',
    example: 'high',
    required: false,
  })
  priority?: string | null;

  @ApiProperty({
    description: 'Hours before notification expires',
    example: 24,
    required: false,
  })
  expirationHours?: number | null;

  @ApiProperty({
    description: 'Badge count (red number on iOS app icon)',
    example: 5,
    required: false,
  })
  badge?: number | null;

  @ApiProperty({
    description: 'Thread identifier for grouping related notifications on iOS',
    example: 'campaign-123',
    required: false,
  })
  threadId?: string | null;

  @ApiProperty({
    description: 'iOS interruption level',
    enum: InterruptionLevel,
    example: 'active',
    required: false,
  })
  interruptionLevel?: InterruptionLevel | null;

  @ApiProperty({
    description: 'Custom key-value data',
    example: { campaignId: '123', tab: 'featured' },
    required: false,
  })
  customData?: Record<string, any> | null;

  @ApiProperty({
    description: 'Receiver type',
    enum: ReceiverType,
    example: ReceiverType.BRANDS,
  })
  receiverType: ReceiverType;

  @ApiProperty({
    description: 'Target locations',
    type: [String],
    example: ['Navi Mumbai', 'Bangalor', '+2'],
  })
  locations: string[];

  @ApiProperty({
    description: 'Notification status',
    enum: NotificationStatus,
    example: NotificationStatus.SENT,
  })
  status: NotificationStatus;

  @ApiProperty({
    description: 'Scheduled time',
    example: '2025-10-02T12:28:00Z',
    required: false,
  })
  scheduledAt?: Date | null;

  @ApiProperty({
    description: 'Sent time',
    example: '2025-10-02T12:28:00Z',
    required: false,
  })
  sentAt?: Date | null;

  @ApiProperty({
    description: 'Total recipients count',
    example: 150,
    required: false,
  })
  totalRecipients?: number | null;

  @ApiProperty({
    description: 'Success count',
    example: 148,
    required: false,
  })
  successCount?: number | null;

  @ApiProperty({
    description: 'Failure count',
    example: 2,
    required: false,
  })
  failureCount?: number | null;

  @ApiProperty({
    description: 'Created by admin',
    example: {
      id: 1,
      name: 'Admin User',
      email: 'admin@example.com',
    },
  })
  creator: {
    id: number;
    name: string;
    email: string;
  };

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class NotificationListResponseDto {
  @ApiProperty({
    description: 'List of notifications',
    type: [NotificationResponseDto],
  })
  notifications: NotificationResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      page: 1,
      limit: 20,
      total: 150,
      totalPages: 8,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class SendNotificationResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Notification sent successfully to 150 recipients',
  })
  message: string;

  @ApiProperty({
    description: 'Notification details',
    type: NotificationResponseDto,
  })
  notification: NotificationResponseDto;
}

// Bulk notification DTOs
export class BulkNotificationRecipient {
  name?: string;
  email?: string;
  phone?: string;
}

export class BulkNotificationUploadDto {
  @ApiProperty({
    description: 'Notification title',
    example: 'Special Campaign Invitation',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'You have been selected for our exclusive campaign',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    description: 'Image URL for rich notification',
    example: 'https://plus.unsplash.com/premium_photo-1683865776032-07bf70b0add1?q=80&w=3132&auto=format',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Deep link action URL',
    example: 'app://influencers/me',
    required: false,
  })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiProperty({
    description: 'Android channel ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  androidChannelId?: string;

  @ApiProperty({
    description: 'Sound (default/custom/silent)',
    required: false,
  })
  @IsOptional()
  @IsString()
  sound?: string;

  @ApiProperty({
    description: 'Priority (high/normal/low)',
    required: false,
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({
    description: 'Badge count for iOS',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  badge?: number;

  @ApiProperty({
    description: 'Thread ID for iOS grouping',
    required: false,
  })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiProperty({
    description: 'iOS interruption level',
    enum: InterruptionLevel,
    required: false,
  })
  @IsOptional()
  @IsEnum(InterruptionLevel)
  interruptionLevel?: InterruptionLevel;

  @ApiProperty({
    description: 'User type (influencer/brand)',
    enum: ['influencer', 'brand'],
  })
  @IsEnum(['influencer', 'brand'])
  userType: 'influencer' | 'brand';

  @ApiProperty({
    description: 'Send immediately or save as draft',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  sendImmediately?: boolean;
}

export class BulkNotificationResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Created notification ID' })
  notificationId: number;

  @ApiProperty({ description: 'Total recipients in Excel' })
  totalInFile: number;

  @ApiProperty({ description: 'Successfully matched users' })
  matchedUsers: number;

  @ApiProperty({ description: 'Users not found in database' })
  notFoundUsers: number;

  @ApiProperty({ description: 'List of not found users', type: [Object] })
  notFoundList: BulkNotificationRecipient[];

  @ApiProperty({ description: 'Notification status' })
  status: string;

  @ApiProperty({ description: 'Send results if sent immediately', required: false })
  sendResults?: {
    successCount: number;
    failureCount: number;
  };
}

// DTO for parsing Excel without creating notification
export class ParseExcelDto {
  @ApiProperty({
    description: 'User type (influencer/brand)',
    enum: ['influencer', 'brand'],
  })
  @IsEnum(['influencer', 'brand'])
  userType: 'influencer' | 'brand';
}

export class ParseExcelResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Total recipients in Excel' })
  totalInFile: number;

  @ApiProperty({ description: 'Successfully matched users count' })
  matchedUsersCount: number;

  @ApiProperty({ description: 'Matched user IDs', type: [Number] })
  matchedUserIds: number[];

  @ApiProperty({ description: 'Users not found in database count' })
  notFoundUsersCount: number;

  @ApiProperty({ description: 'List of not found users', type: [Object] })
  notFoundList: BulkNotificationRecipient[];
}
