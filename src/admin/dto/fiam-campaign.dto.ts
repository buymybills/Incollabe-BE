import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsNumber,
  IsNotEmpty,
  IsBoolean,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CampaignStatus,
  TriggerType,
  LayoutType,
  TriggerEvent,
} from '../../shared/models/fiam-campaign.model';
import type {
  UIConfig,
  FrequencyConfig,
  BehaviorFilters,
  ButtonConfig,
} from '../../shared/models/fiam-campaign.model';

// ============================================================================
// UI Configuration DTOs
// ============================================================================

export class ButtonConfigDto implements ButtonConfig {
  @ApiProperty({ example: 'Shop Now', description: 'Button text' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ example: 'app://hype-store', description: 'Deep link action URL' })
  @IsString()
  @IsNotEmpty()
  actionUrl: string;

  @ApiProperty({ example: '#FF5722', description: 'Button background color (hex)' })
  @IsString()
  @IsNotEmpty()
  backgroundColor: string;

  @ApiProperty({ example: '#FFFFFF', description: 'Button text color (hex)' })
  @IsString()
  @IsNotEmpty()
  textColor: string;
}

export class UIConfigDto implements UIConfig {
  @ApiProperty({
    enum: LayoutType,
    example: LayoutType.CARD,
    description: 'Layout type for the campaign'
  })
  @IsEnum(LayoutType)
  layoutType: LayoutType;

  @ApiProperty({ example: '#FFFFFF', description: 'Background color (hex)' })
  @IsString()
  @IsNotEmpty()
  backgroundColor: string;

  @ApiProperty({ example: '#000000', description: 'Text color (hex)' })
  @IsString()
  @IsNotEmpty()
  textColor: string;

  @ApiProperty({ example: 'Unlock Premium Features', description: 'Campaign title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Get 3x more campaigns with MAX subscription',
    description: 'Campaign body text'
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    example: 'https://example.com/image.jpg',
    description: 'Image URL for the campaign'
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'app://maxx',
    description: 'Direct action URL for banner/image_only layouts (entire element is clickable)'
  })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({
    type: ButtonConfigDto,
    description: 'Primary button configuration (for modal/card layouts)'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ButtonConfigDto)
  buttonConfig?: ButtonConfigDto;

  @ApiPropertyOptional({
    type: ButtonConfigDto,
    description: 'Secondary button configuration'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ButtonConfigDto)
  secondaryButtonConfig?: ButtonConfigDto;
}

// ============================================================================
// Targeting Configuration DTOs
// ============================================================================

export class FrequencyConfigDto implements FrequencyConfig {
  @ApiPropertyOptional({
    example: 3,
    description: 'Maximum lifetime impressions per user'
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxImpressionsPerUser?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Maximum impressions in 24 hours'
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxImpressionsPerDay?: number;

  @ApiPropertyOptional({
    example: 24,
    description: 'Hours to wait after dismiss before showing again'
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownHours?: number;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Stop campaign after total impressions'
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  globalMaxImpressions?: number;
}

export class BehaviorFiltersDto implements BehaviorFilters {
  @ApiPropertyOptional({
    example: 5,
    description: 'Minimum campaign applications required'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minCampaignApplications?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Target users with zero credits'
  })
  @IsOptional()
  @IsBoolean()
  requiresZeroCredits?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Target users with/without Pro subscription'
  })
  @IsOptional()
  @IsBoolean()
  hasProSubscription?: boolean;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Minimum follower count'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minFollowerCount?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: 'Maximum follower count'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxFollowerCount?: number;
}

// ============================================================================
// Main Create DTO
// ============================================================================

export class CreateFiamCampaignDto {
  @ApiProperty({
    example: 'MAX Subscription Promo',
    description: 'Campaign name (user-facing)'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Q1 2026 MAX Promo - High Priority Users',
    description: 'Internal name for admin reference'
  })
  @IsOptional()
  @IsString()
  internalName?: string;

  @ApiPropertyOptional({
    example: 'Campaign to promote MAX subscription to active users',
    description: 'Campaign description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Priority (higher = shown first)',
    default: 0
  })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({
    type: UIConfigDto,
    description: 'UI configuration for campaign display'
  })
  @ValidateNested()
  @Type(() => UIConfigDto)
  uiConfig: UIConfigDto;

  @ApiProperty({
    enum: TriggerType,
    example: TriggerType.EVENT,
    description: 'How the campaign is triggered'
  })
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @ApiPropertyOptional({
    enum: TriggerEvent,
    isArray: true,
    example: [TriggerEvent.APP_OPEN, TriggerEvent.SCREEN_VIEW_HOME],
    description: 'Events that trigger this campaign (for event-triggered campaigns)'
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TriggerEvent, { each: true })
  triggerEvents?: TriggerEvent[];

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00Z',
    description: 'Scheduled time for broadcast (for scheduled campaigns)'
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['influencer', 'brand'],
    description: 'Target user types (null = all users)'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserTypes?: ('influencer' | 'brand')[];

  @ApiPropertyOptional({
    example: 'all',
    enum: ['male', 'female', 'others', 'all'],
    description: 'Target gender'
  })
  @IsOptional()
  @IsString()
  targetGender?: 'male' | 'female' | 'others' | 'all';

  @ApiPropertyOptional({
    example: 18,
    description: 'Minimum age (13-100)'
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  targetMinAge?: number;

  @ApiPropertyOptional({
    example: 35,
    description: 'Maximum age (13-100)'
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  targetMaxAge?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['Mumbai', 'Delhi'],
    description: 'Target cities'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLocations?: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'Target all of India',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  targetIsPanIndia?: boolean;

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 5, 8],
    description: 'Target niche IDs'
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetNicheIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [123, 456],
    description: 'Target specific user IDs'
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetSpecificUserIds?: number[];

  @ApiPropertyOptional({
    type: BehaviorFiltersDto,
    description: 'Behavior-based targeting filters'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BehaviorFiltersDto)
  targetBehaviorFilters?: BehaviorFiltersDto;

  @ApiPropertyOptional({
    type: FrequencyConfigDto,
    description: 'Frequency capping configuration'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FrequencyConfigDto)
  frequencyConfig?: FrequencyConfigDto;

  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00Z',
    description: 'Campaign start date'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59Z',
    description: 'Campaign end date'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'button_click',
    description: 'What counts as a conversion'
  })
  @IsOptional()
  @IsString()
  conversionEvent?: string;

  @ApiPropertyOptional({
    example: 24,
    description: 'Track conversions within X hours of impression',
    default: 24
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  conversionWindowHours?: number;

  @ApiPropertyOptional({
    example: 'Internal note for team',
    description: 'Admin notes (not visible to users)'
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

// ============================================================================
// Update DTO
// ============================================================================

export class UpdateFiamCampaignDto {
  @ApiPropertyOptional({ example: 'MAX Subscription Promo' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Q1 2026 MAX Promo - High Priority Users' })
  @IsOptional()
  @IsString()
  internalName?: string;

  @ApiPropertyOptional({ example: 'Campaign to promote MAX subscription to active users' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ type: UIConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UIConfigDto)
  uiConfig?: UIConfigDto;

  @ApiPropertyOptional({ enum: TriggerType })
  @IsOptional()
  @IsEnum(TriggerType)
  triggerType?: TriggerType;

  @ApiPropertyOptional({ enum: TriggerEvent, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TriggerEvent, { each: true })
  triggerEvents?: TriggerEvent[];

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ type: [String], example: ['influencer', 'brand'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserTypes?: ('influencer' | 'brand')[];

  @ApiPropertyOptional({ example: 'all' })
  @IsOptional()
  @IsString()
  targetGender?: 'male' | 'female' | 'others' | 'all';

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  targetMinAge?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  targetMaxAge?: number;

  @ApiPropertyOptional({ type: [String], example: ['Mumbai', 'Delhi'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLocations?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  targetIsPanIndia?: boolean;

  @ApiPropertyOptional({ type: [Number], example: [1, 5, 8] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetNicheIds?: number[];

  @ApiPropertyOptional({ type: [Number], example: [123, 456] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetSpecificUserIds?: number[];

  @ApiPropertyOptional({ type: BehaviorFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BehaviorFiltersDto)
  targetBehaviorFilters?: BehaviorFiltersDto;

  @ApiPropertyOptional({ type: FrequencyConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FrequencyConfigDto)
  frequencyConfig?: FrequencyConfigDto;

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-04-30T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'button_click' })
  @IsOptional()
  @IsString()
  conversionEvent?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  conversionWindowHours?: number;

  @ApiPropertyOptional({ example: 'Internal note for team' })
  @IsOptional()
  @IsString()
  internalNotes?: string;
}

// ============================================================================
// Query/Filter DTOs
// ============================================================================

export class GetFiamCampaignsDto {
  @ApiPropertyOptional({ enum: CampaignStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ enum: TriggerType, description: 'Filter by trigger type' })
  @IsOptional()
  @IsEnum(TriggerType)
  triggerType?: TriggerType;

  @ApiPropertyOptional({ example: 1, description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ============================================================================
// Response DTOs
// ============================================================================

export class CampaignAnalyticsDto {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({ example: 'MAX Subscription Promo' })
  name: string;

  @ApiProperty({ example: 1250 })
  totalImpressions: number;

  @ApiProperty({ example: 320 })
  totalClicks: number;

  @ApiProperty({ example: 180 })
  totalDismissals: number;

  @ApiProperty({ example: 45 })
  totalConversions: number;

  @ApiProperty({ example: 3.6 })
  conversionRate: number;

  @ApiProperty({ example: 25.6 })
  clickThroughRate: number;

  @ApiProperty({ example: 14.4 })
  dismissalRate: number;
}

export class FiamCampaignResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  internalName: string | null;

  @ApiProperty({ required: false })
  description: string | null;

  @ApiProperty({ enum: CampaignStatus })
  status: CampaignStatus;

  @ApiProperty()
  priority: number;

  @ApiProperty({ type: Object })
  uiConfig: UIConfig;

  @ApiProperty({ enum: TriggerType })
  triggerType: TriggerType;

  @ApiProperty({ enum: TriggerEvent, isArray: true, required: false })
  triggerEvents: TriggerEvent[] | null;

  @ApiProperty({ required: false })
  scheduledAt: Date | null;

  @ApiProperty({ type: [String], required: false })
  targetUserTypes: ('influencer' | 'brand')[] | null;

  @ApiProperty({ required: false })
  targetGender: string | null;

  @ApiProperty({ required: false })
  targetMinAge: number | null;

  @ApiProperty({ required: false })
  targetMaxAge: number | null;

  @ApiProperty({ type: [String], required: false })
  targetLocations: string[] | null;

  @ApiProperty()
  targetIsPanIndia: boolean;

  @ApiProperty({ type: [Number], required: false })
  targetNicheIds: number[] | null;

  @ApiProperty({ type: [Number], required: false })
  targetSpecificUserIds: number[] | null;

  @ApiProperty({ type: Object, required: false })
  targetBehaviorFilters: BehaviorFilters | null;

  @ApiProperty({ type: Object, required: false })
  frequencyConfig: FrequencyConfig | null;

  @ApiProperty({ required: false })
  startDate: Date | null;

  @ApiProperty({ required: false })
  endDate: Date | null;

  @ApiProperty()
  totalImpressions: number;

  @ApiProperty()
  totalClicks: number;

  @ApiProperty()
  totalDismissals: number;

  @ApiProperty()
  totalConversions: number;

  @ApiProperty({ required: false })
  conversionEvent: string | null;

  @ApiProperty()
  conversionWindowHours: number;

  @ApiProperty()
  createdBy: number;

  @ApiProperty({ required: false })
  internalNotes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: CampaignAnalyticsDto })
  analytics: CampaignAnalyticsDto;
}

export class FiamCampaignListResponseDto {
  @ApiProperty({ type: [FiamCampaignResponseDto] })
  campaigns: FiamCampaignResponseDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
