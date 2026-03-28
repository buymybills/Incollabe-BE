import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';
import {
  TriggerEvent,
} from '../models/fiam-campaign.model';
import type {
  UIConfig,
} from '../models/fiam-campaign.model';
import { EventType } from '../models/fiam-campaign-event.model';

// ============================================================================
// Request DTOs
// ============================================================================

export class GetEligibleCampaignsDto {
  @ApiProperty({
    enum: TriggerEvent,
    example: TriggerEvent.APP_OPEN,
    description: 'The event that triggered the campaign request'
  })
  @IsEnum(TriggerEvent)
  triggerEvent: TriggerEvent;

  @ApiPropertyOptional({
    example: 'home',
    description: 'Screen name (for analytics)'
  })
  @IsOptional()
  @IsString()
  screenName?: string;

  @ApiPropertyOptional({
    example: 'session-12345',
    description: 'User session ID (for analytics)'
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class TrackCampaignEventDto {
  @ApiProperty({
    enum: EventType,
    example: EventType.IMPRESSION,
    description: 'Type of event to track'
  })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiPropertyOptional({
    example: { buttonClicked: 'primary', screenName: 'home' },
    description: 'Additional event metadata'
  })
  @IsOptional()
  @IsObject()
  eventMetadata?: Record<string, any>;

  @ApiPropertyOptional({
    example: 'session-12345',
    description: 'User session ID'
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    example: 'android',
    enum: ['android', 'ios'],
    description: 'Device type'
  })
  @IsOptional()
  @IsString()
  deviceType?: 'android' | 'ios';

  @ApiPropertyOptional({
    example: '1.2.3',
    description: 'App version'
  })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class EligibleCampaignResponseDto {
  @ApiProperty({
    example: 123,
    description: 'Campaign ID'
  })
  id: number;

  @ApiProperty({
    example: 'MAX Subscription Promo',
    description: 'Campaign name'
  })
  name: string;

  @ApiProperty({
    example: 10,
    description: 'Campaign priority (higher = more important)'
  })
  priority: number;

  @ApiProperty({
    type: Object,
    description: 'UI configuration for rendering the campaign',
    example: {
      layoutType: 'card',
      backgroundColor: '#FF5722',
      textColor: '#FFFFFF',
      title: 'Unlock Premium Features',
      body: 'Get 3x more campaigns with MAX subscription',
      imageUrl: 'https://example.com/image.jpg',
      buttonConfig: {
        text: 'Subscribe Now',
        actionUrl: 'app://maxx',
        backgroundColor: '#FFFFFF',
        textColor: '#FF5722'
      }
    }
  })
  uiConfig: UIConfig;

  @ApiProperty({
    example: '2026-04-30T23:59:59Z',
    description: 'Campaign expiration date (if any)',
    required: false
  })
  expiresAt: Date | null;
}

export class GetEligibleCampaignsResponseDto {
  @ApiProperty({
    type: [EligibleCampaignResponseDto],
    description: 'List of eligible campaigns sorted by priority'
  })
  campaigns: EligibleCampaignResponseDto[];

  @ApiProperty({
    example: 3,
    description: 'Total number of eligible campaigns'
  })
  total: number;
}

export class TrackCampaignEventResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the event was tracked successfully'
  })
  success: boolean;

  @ApiProperty({
    example: 'Event tracked successfully',
    description: 'Response message'
  })
  message: string;
}
