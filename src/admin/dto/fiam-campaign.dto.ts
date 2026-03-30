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
    description: `Media URL for the campaign (image, video, or GIF).

**Option 1 - Upload file:**
Use POST /admin/fiam-campaigns/upload-media to upload a file and get the URL.

**Option 2 - Paste URL:**
Directly paste any public URL (supports images, videos, GIFs).

**Auto-detection:**
Backend detects media type from file extension (.jpg → image, .mp4 → video, .gif → gif)`
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

/**
 * ## FIAM Campaign Creation - Choose Your Delivery Method
 *
 * ### 🚀 DELIVERY METHOD 1: BROADCAST (Push-Based - Recommended)
 * **Use when:** You want to send notifications immediately to all users
 * **How it works:** Backend sends FCM push → Users receive popup
 * **Required:** `triggerType: "scheduled"` + Call `/broadcast` endpoint
 *
 * ### 📲 DELIVERY METHOD 2: EVENT-TRIGGERED (Pull-Based)
 * **Use when:** You want popups to appear when users perform specific actions
 * **How it works:** User opens app → Mobile fetches eligible campaigns → Shows popup
 * **Required:** `triggerType: "event"` + `triggerEvents: ["app_open"]`
 * **Note:** Cannot use `/broadcast` endpoint - mobile app handles display
 *
 * ---
 *
 * ## 📋 BROADCAST EXAMPLES (Most Common)
 *
 * ### 📱 Simple Broadcast - Send Now to All Users
 *
 * ```json
 * {
 *   "name": "Flash Sale Announcement",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "🔥 Flash Sale - 50% OFF!",
 *     "body": "Limited time offer on MAX subscription. Subscribe now!",
 *     "imageUrl": "https://yourdomain.com/images/flash-sale.jpg",
 *     "buttonConfig": {
 *       "text": "Get Offer",
 *       "actionUrl": "app://maxx",
 *       "backgroundColor": "#FF5722",
 *       "textColor": "#FFFFFF"
 *     }
 *   },
 *   "triggerType": "scheduled",
 *   "scheduledAt": "2026-03-30T10:00:00Z",
 *   "targetUserTypes": ["influencer"],
 *   "targetIsPanIndia": true
 * }
 * ```
 * ☝️ **DEFAULT BEHAVIOR**: Creates as 'active' and broadcasts immediately to all influencers in India.
 * After creation, call `POST /admin/fiam-campaigns/:id/broadcast` to send.
 *
 * ---
 *
 * ### 🎬 VIDEO CAMPAIGN (Auto-detected media type)
 *
 * ```json
 * {
 *   "name": "MAX Feature Tutorial",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "New Feature: Boost Your Posts!",
 *     "body": "Watch how to boost your posts and get 10x more reach",
 *     "imageUrl": "https://yourdomain.com/videos/tutorial.mp4",
 *     "buttonConfig": {
 *       "text": "Try Now",
 *       "actionUrl": "app://post-boost",
 *       "backgroundColor": "#4CAF50",
 *       "textColor": "#FFFFFF"
 *     }
 *   },
 *   "triggerType": "scheduled",
 *   "scheduledAt": "2026-03-30T10:00:00Z",
 *   "targetUserTypes": ["influencer"],
 *   "targetIsPanIndia": true
 * }
 * ```
 * ☝️ Backend auto-detects `.mp4` extension and sets `mediaType: "video"` in the FCM payload.
 * Supported video formats: `.mp4`, `.mov`, `.avi`, `.webm`
 *
 * ---
 *
 * ### 🎉 GIF CAMPAIGN (Animated content)
 *
 * ```json
 * {
 *   "name": "Celebration Campaign",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "🎉 You've Reached 10K Followers!",
 *     "body": "Celebrate your milestone with exclusive rewards",
 *     "imageUrl": "https://yourdomain.com/animations/celebration.gif",
 *     "buttonConfig": {
 *       "text": "Claim Reward",
 *       "actionUrl": "app://rewards",
 *       "backgroundColor": "#FFD700",
 *       "textColor": "#000000"
 *     }
 *   },
 *   "triggerType": "scheduled",
 *   "scheduledAt": "2026-03-30T10:00:00Z",
 *   "targetUserTypes": ["influencer"],
 *   "targetBehaviorFilters": {
 *     "minFollowerCount": 10000
 *   }
 * }
 * ```
 * ☝️ Backend auto-detects `.gif` extension and sets `mediaType: "gif"`.
 *
 * ---
 *
 * ### 🎯 TARGETED CAMPAIGN (Non-Pro users in specific cities)
 *
 * ```json
 * {
 *   "name": "Mumbai/Delhi MAX Promo",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "Exclusive Offer for You!",
 *     "body": "Get MAX subscription at 30% discount",
 *     "imageUrl": "https://yourdomain.com/images/promo.png",
 *     "buttonConfig": {
 *       "text": "Subscribe Now",
 *       "actionUrl": "app://maxx",
 *       "backgroundColor": "#FF5722",
 *       "textColor": "#FFFFFF"
 *     }
 *   },
 *   "triggerType": "scheduled",
 *   "scheduledAt": "2026-03-30T10:00:00Z",
 *   "targetUserTypes": ["influencer"],
 *   "targetLocations": ["Mumbai", "Delhi"],
 *   "targetBehaviorFilters": {
 *     "hasProSubscription": false
 *   }
 * }
 * ```
 * ☝️ Only sends to influencers in Mumbai/Delhi who don't have MAX subscription.
 *
 * ---
 *
 * ### 🔄 BANNER WITH TWO BUTTONS
 *
 * ```json
 * {
 *   "name": "Hype Store Launch",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "New: Hype Store is Live!",
 *     "body": "Shop exclusive products and earn cashback",
 *     "imageUrl": "https://yourdomain.com/images/hype-store.jpg",
 *     "buttonConfig": {
 *       "text": "Shop Now",
 *       "actionUrl": "app://hype-store",
 *       "backgroundColor": "#4CAF50",
 *       "textColor": "#FFFFFF"
 *     },
 *     "secondaryButtonConfig": {
 *       "text": "Learn More",
 *       "actionUrl": "app://hype-store/info",
 *       "backgroundColor": "transparent",
 *       "textColor": "#4CAF50"
 *     }
 *   },
 *   "triggerType": "scheduled",
 *   "scheduledAt": "2026-03-30T10:00:00Z",
 *   "targetUserTypes": ["influencer"],
 *   "targetIsPanIndia": true
 * }
 * ```
 * ☝️ Shows two buttons: primary (Shop Now) and secondary (Learn More).
 *
 * ---
 *
 * ### 📅 SCHEDULED FOR LATER (Create as Draft)
 *
 * ```json
 * {
 *   "name": "Weekend Flash Sale",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "Weekend Special - Coming Soon!",
 *     "body": "Get ready for massive discounts this Saturday",
 *     "imageUrl": "https://yourdomain.com/images/weekend-sale.jpg",
 *     "buttonConfig": {
 *       "text": "Remind Me",
 *       "actionUrl": "app://reminders",
 *       "backgroundColor": "#FF9800",
 *       "textColor": "#FFFFFF"
 *     }
 *   },
 *   "triggerType": "scheduled",
 *   "scheduledAt": "2026-04-05T00:00:00Z",
 *   "targetUserTypes": ["influencer"],
 *   "targetIsPanIndia": true,
 *   "status": "draft"
 * }
 * ```
 * ☝️ **DRAFT MODE**: Creates campaign but doesn't activate. Activate later via `PATCH /admin/fiam-campaigns/:id/status`.
 *
 * ---
 *
 * ### 🎨 SUPPORTED MEDIA TYPES
 *
 * - **Images**: `.jpg`, `.jpeg`, `.png`, `.webp` → `mediaType: "image"`
 * - **Videos**: `.mp4`, `.mov`, `.avi`, `.webm` → `mediaType: "video"`
 * - **GIFs**: `.gif` → `mediaType: "gif"`
 *
 * Backend auto-detects media type from `imageUrl` extension and includes both `mediaUrl` and `mediaType` in FCM payload.
 *
 * ---
 *
 * ### 📊 PAYLOAD SENT TO MOBILE APP
 *
 * When you broadcast, the mobile app receives a data-only FCM message:
 * ```json
 * {
 *   "type": "in_app_message",
 *   "campaignId": "5",
 *   "layoutType": "card",
 *   "backgroundColor": "#FFFFFF",
 *   "textColor": "#000000",
 *   "title": "Your Title",
 *   "body": "Your message",
 *   "mediaUrl": "https://yourdomain.com/media.mp4",
 *   "mediaType": "video",
 *   "buttonText": "Get Offer",
 *   "buttonActionUrl": "app://maxx",
 *   "buttonBackgroundColor": "#FF5722",
 *   "buttonTextColor": "#FFFFFF",
 *   "secondaryButtonText": "",
 *   "secondaryButtonActionUrl": ""
 * }
 * ```
 *
 * ---
 *
 * ## 📲 EVENT-TRIGGERED EXAMPLES (Pull-Based)
 *
 * ### Event: Show on App Open
 *
 * ```json
 * {
 *   "name": "Welcome Back Popup",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "Welcome Back!",
 *     "body": "Check out new campaigns waiting for you",
 *     "imageUrl": "https://yourdomain.com/welcome.jpg",
 *     "buttonConfig": {
 *       "text": "View Campaigns",
 *       "actionUrl": "app://campaigns",
 *       "backgroundColor": "#4CAF50",
 *       "textColor": "#FFFFFF"
 *     }
 *   },
 *   "triggerType": "event",
 *   "triggerEvents": ["app_open"],
 *   "targetUserTypes": ["influencer"],
 *   "targetIsPanIndia": true,
 *   "startDate": "2026-04-01T00:00:00Z",
 *   "endDate": "2026-04-30T23:59:59Z"
 * }
 * ```
 * ☝️ **Event-triggered:** Shows popup when user opens app between April 1-30. Mobile app fetches via GET /api/fiam/campaigns/eligible?triggerEvent=app_open
 *
 * **⚠️ CANNOT use `/broadcast` endpoint** - Mobile app handles display when event occurs.
 *
 * ---
 *
 * ### Event: Show on Specific Screen View
 *
 * ```json
 * {
 *   "name": "Hype Store Promo on Home Screen",
 *   "uiConfig": {
 *     "layoutType": "card",
 *     "backgroundColor": "#FFFFFF",
 *     "textColor": "#000000",
 *     "title": "New: Hype Store is Live!",
 *     "body": "Shop exclusive products and earn cashback",
 *     "imageUrl": "https://yourdomain.com/hype-store.jpg",
 *     "buttonConfig": {
 *       "text": "Shop Now",
 *       "actionUrl": "app://hype-store",
 *       "backgroundColor": "#FF5722",
 *       "textColor": "#FFFFFF"
 *     }
 *   },
 *   "triggerType": "event",
 *   "triggerEvents": ["screen_view_home"],
 *   "targetUserTypes": ["influencer"],
 *   "targetIsPanIndia": true,
 *   "frequencyConfig": {
 *     "maxImpressionsPerUser": 3,
 *     "maxImpressionsPerDay": 1,
 *     "cooldownHours": 24
 *   },
 *   "startDate": "2026-03-30T00:00:00Z",
 *   "endDate": "2026-12-31T23:59:59Z"
 * }
 * ```
 * ☝️ Shows popup when user views home screen. Frequency limits prevent spam (max 1/day, 3 total, 24h cooldown after dismiss).
 *
 * ---
 *
 * ### ⚡ QUICK TIPS
 *
 * 1. **Delivery Method:**
 *    - `triggerType: "scheduled"` → Use `/broadcast` endpoint to push FCM notifications ✅ RECOMMENDED
 *    - `triggerType: "event"` → Mobile app fetches and displays (no broadcast endpoint)
 *
 * 2. **Default Status**: Campaigns are created as `active` by default. Use `status: "draft"` only if you want to prepare without activating.
 *
 * 3. **Broadcast Campaigns**: After creating with `triggerType: "scheduled"`, call `POST /admin/fiam-campaigns/:id/broadcast` to send to all eligible users.
 *
 * 4. **Event Campaigns**: After creating with `triggerType: "event"`, mobile app automatically fetches when users trigger the event (app_open, screen_view_home, etc).
 *
 * 5. **Background Color**: Always sent as `#FFFFFF` (white) to mobile app, regardless of what you set in uiConfig.
 *
 * 6. **Targeting**: Use `targetIsPanIndia: true` for all India, or specify `targetLocations: ["Mumbai", "Delhi"]` for specific cities.
 *
 * 7. **Media Auto-detection**: Just provide the URL in `imageUrl` - backend detects if it's image/video/gif from file extension.
 *
 * 8. **Upload Media**: Use `POST /admin/fiam-campaigns/upload-media` to upload files, or paste external URLs directly.
 */
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
    example: TriggerType.SCHEDULED,
    description: `Campaign delivery method:

**"scheduled"** (RECOMMENDED) - Broadcast via FCM push notifications
  → Use POST /admin/fiam-campaigns/:id/broadcast to send immediately
  → Backend pushes FCM data messages to all eligible users
  → Users receive popup notification

**"event"** - Pull-based, mobile app fetches when events occur
  → Mobile calls GET /api/fiam/campaigns/eligible?triggerEvent=app_open
  → Shows popup when user triggers event (app_open, screen_view_home, etc)
  → Cannot use /broadcast endpoint
  → Requires: triggerEvents field`
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
    description: `When to broadcast the campaign (REQUIRED for triggerType: "scheduled")

**For immediate broadcast:** Set to current time or past time
**For future broadcast:** Set to future time (campaign will wait until then)

**Not used** for triggerType: "event" (event-triggered campaigns)`
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

  @ApiPropertyOptional({
    enum: CampaignStatus,
    example: CampaignStatus.ACTIVE,
    description: `Campaign status (default: active)

    - active: Create and activate immediately (default) - will auto-broadcast if scheduledAt <= NOW
    - draft: Create but don't activate - use this to prepare campaigns for later activation

    DEFAULT BEHAVIOR: Campaigns are created as 'active' and will broadcast immediately if scheduledAt <= NOW.
    Use 'draft' only if you want to prepare a campaign without broadcasting it yet.`,
    default: CampaignStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
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

export class UpdateCampaignStatusDto {
  @ApiProperty({
    enum: CampaignStatus,
    example: CampaignStatus.ACTIVE,
    description: 'New campaign status'
  })
  @IsEnum(CampaignStatus)
  @IsNotEmpty()
  status: CampaignStatus;
}
