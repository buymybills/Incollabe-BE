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

  @ApiProperty({
    description: 'Additional metadata',
    required: false,
    example: { imageUrl: 'https://...', actionUrl: '/top-influencers' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
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

  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
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
