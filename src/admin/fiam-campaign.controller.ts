import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import type { RequestWithAdmin } from './guards/admin-auth.guard';
import { FiamCampaignService } from './services/fiam-campaign.service';
import { FiamCampaignBroadcastService } from './services/fiam-campaign-broadcast.service';
import {
  CreateFiamCampaignDto,
  UpdateFiamCampaignDto,
  GetFiamCampaignsDto,
  FiamCampaignResponseDto,
  FiamCampaignListResponseDto,
  CampaignAnalyticsDto,
  UpdateCampaignStatusDto,
} from './dto/fiam-campaign.dto';
import { CampaignStatus } from '../shared/models/fiam-campaign.model';
import { S3Service } from '../shared/s3.service';

// ============================================================================
// ADMIN CONTROLLER
// ============================================================================

@ApiTags('Admin - FIAM Campaigns')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/fiam-campaigns')
export class FiamCampaignController {
  constructor(
    private readonly fiamCampaignService: FiamCampaignService,
    private readonly fiamCampaignBroadcastService: FiamCampaignBroadcastService,
    private readonly s3Service: S3Service,
  ) {}

  // ============================================================================
  // CREATE
  // ============================================================================

  @Post()
  @ApiOperation({
    summary: 'Create new FIAM campaign',
    description: `Create Firebase In-App Messaging campaigns with two delivery methods:

**🚀 BROADCAST (Options 1-4):** Push FCM notifications immediately - Use POST /:id/broadcast after creation
**📲 EVENT-TRIGGERED (Options 5-6):** Mobile app fetches when user performs actions - Cannot use /broadcast
**📅 DRAFT (Option 7):** Prepare campaigns for later activation

Select an example from dropdown below to auto-fill the request body.`,
  })
  @ApiBody({
    type: CreateFiamCampaignDto,
    description: `**📋 SELECT EXAMPLE FROM DROPDOWN ABOVE**

Each example is pre-configured for a specific use case. Choose based on your needs:

**IMMEDIATE BROADCAST** (Options 1-4) - When you need to send NOW:
→ Flash sales, announcements, feature launches
→ After creation, call: POST /admin/fiam-campaigns/:id/broadcast
→ Users receive FCM push notification immediately

**EVENT-TRIGGERED** (Options 5-6) - When popup should appear on user action:
→ Welcome messages, screen-specific tips, contextual promotions
→ Mobile app fetches automatically when event occurs
→ Cannot use /broadcast endpoint

**DRAFT** (Option 7) - Prepare without activating:
→ Schedule for future, team review, seasonal campaigns
→ Activate later via: PATCH /admin/fiam-campaigns/:id/status`,
    examples: {
      'Simple Broadcast (Recommended)': {
        summary: '🚀 Option 1: Broadcast - Send Now to All Users (MOST COMMON)',
        description: `**WHEN TO USE:**
✅ Send notification RIGHT NOW to all users
✅ Time-sensitive: Flash sales, urgent updates, feature launches
✅ Immediate delivery via FCM push

**HOW IT WORKS:**
1. Create campaign (status: active)
2. Call POST /admin/fiam-campaigns/:id/broadcast
3. Backend sends FCM to ALL eligible users
4. Users receive popup immediately

**EXAMPLE USE CASES:**
🔥 Flash Sale: 50% off - Today only!
🎉 New Feature: Post Boost is live!
📢 System Maintenance alert
🎁 Limited time: 1000 free credits

**WORKFLOW:**
Create → Get ID → Broadcast → Users receive in seconds

**AFTER CREATION:**
→ Call: POST /admin/fiam-campaigns/{id}/broadcast
→ Check analytics: GET /admin/fiam-campaigns/{id}/analytics`,
        value: {
          name: 'Flash Sale Announcement',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: '🔥 Flash Sale - 50% OFF!',
            body: 'Limited time offer on MAX subscription. Subscribe now!',
            imageUrl: 'https://yourdomain.com/images/flash-sale.jpg',
            buttonConfig: {
              text: 'Get Offer',
              actionUrl: 'app://maxx',
              backgroundColor: '#FF5722',
              textColor: '#FFFFFF',
            },
          },
          triggerType: 'scheduled',
          scheduledAt: '2026-03-30T10:00:00Z',
          targetUserTypes: ['influencer'],
          targetIsPanIndia: true,
        },
      },
      'Broadcast with Video': {
        summary: '🎬 Option 2: Broadcast - With Video Media',
        description: `**WHEN TO USE:**
✅ Show video tutorial or demo
✅ Product demonstration, feature walkthrough
✅ Visual storytelling campaigns

**HOW IT WORKS:**
Same as Option 1, but with video that auto-plays or can be played in popup

**EXAMPLE USE CASES:**
📹 Tutorial: How to use Post Boost in 30 seconds
🎥 Setup Guide: Setting up your Hype Store
🎬 Story: Meet our influencer community

**WORKFLOW:**
1. Upload video: POST /admin/fiam-campaigns/upload-media
   → Response: { url: "https://s3.../video.mp4", mediaType: "video" }
2. Create campaign with returned URL in imageUrl field
   → Backend auto-detects .mp4 extension → sets mediaType: "video"
3. Broadcast: POST /admin/fiam-campaigns/{id}/broadcast
   → Mobile receives mediaType: "video" → Displays video player

**SUPPORTED FORMATS:**
→ .mp4, .mov, .avi, .webm (max 50MB)
→ Auto-detected from file extension`,
        value: {
          name: 'Feature Tutorial Video',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: 'New Feature: Boost Your Posts!',
            body: 'Watch how to boost your posts and get 10x more reach',
            imageUrl: 'https://yourdomain.com/videos/tutorial.mp4',
            buttonConfig: {
              text: 'Try Now',
              actionUrl: 'app://post-boost',
              backgroundColor: '#4CAF50',
              textColor: '#FFFFFF',
            },
          },
          triggerType: 'scheduled',
          scheduledAt: '2026-03-30T10:00:00Z',
          targetUserTypes: ['influencer'],
          targetIsPanIndia: true,
        },
      },
      'Broadcast with Two Buttons': {
        summary: '🔄 Option 3: Broadcast - Primary + Secondary Buttons',
        description: `**WHEN TO USE:**
✅ Give users TWO choices in one popup
✅ Primary action + Secondary option
✅ "Take Action" vs "Learn More" scenarios

**EXAMPLE USE CASES:**
Primary: "Shop Now" → app://hype-store
Secondary: "Learn More" → app://hype-store/info

OR

Primary: "Subscribe" → app://maxx
Secondary: "Maybe Later" → dismiss

**BUTTON HIERARCHY:**
→ Primary: Solid background, prominent color (call-to-action)
→ Secondary: Transparent background, text only (alternative option)

**WORKFLOW:**
Same as Option 1, but popup shows two buttons side-by-side`,
        value: {
          name: 'Hype Store Launch',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: 'New: Hype Store is Live!',
            body: 'Shop exclusive products and earn cashback',
            imageUrl: 'https://yourdomain.com/images/hype-store.jpg',
            buttonConfig: {
              text: 'Shop Now',
              actionUrl: 'app://hype-store',
              backgroundColor: '#4CAF50',
              textColor: '#FFFFFF',
            },
            secondaryButtonConfig: {
              text: 'Learn More',
              actionUrl: 'app://hype-store/info',
              backgroundColor: 'transparent',
              textColor: '#4CAF50',
            },
          },
          triggerType: 'scheduled',
          scheduledAt: '2026-03-30T10:00:00Z',
          targetUserTypes: ['influencer'],
          targetIsPanIndia: true,
        },
      },
      'Targeted Broadcast': {
        summary: '🎯 Option 4: Broadcast - Targeted (Cities + Behaviors)',
        description: `**WHEN TO USE:**
✅ Geo-targeted campaigns (specific cities only)
✅ Behavior-based targeting (Pro vs non-Pro users)
✅ Niche/demographic targeting (age, gender, followers)

**TARGETING OPTIONS:**
→ Cities: ["Mumbai", "Delhi"] - Only these locations
→ Behaviors: hasProSubscription: false - Only non-Pro users
→ Followers: min/max follower count ranges
→ Credits: requiresZeroCredits: true - Only users with 0 credits
→ Activity: minCampaignApplications - Active users only
→ Niches: [1, 5, 8] - Specific interest categories
→ Demographics: Gender, age ranges

**EXAMPLE USE CASES:**
📍 Mumbai Meetup: Join us on Saturday!
🎯 Non-Pro Users: Special upgrade offer
📊 Micro-influencers (5K-50K): Exclusive campaign
🔥 Zero credits users: Get free credits now!

**WORKFLOW:**
Create with filters → Backend filters 119 users → 25 match criteria → Broadcast to 25 only

**THIS EXAMPLE:**
Targets only non-Pro users in Mumbai/Delhi`,
        value: {
          name: 'Mumbai/Delhi MAX Promo',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: 'Exclusive Offer for You!',
            body: 'Get MAX subscription at 30% discount',
            imageUrl: 'https://yourdomain.com/images/promo.png',
            buttonConfig: {
              text: 'Subscribe Now',
              actionUrl: 'app://maxx',
              backgroundColor: '#FF5722',
              textColor: '#FFFFFF',
            },
          },
          triggerType: 'scheduled',
          scheduledAt: '2026-03-30T10:00:00Z',
          targetUserTypes: ['influencer'],
          targetLocations: ['Mumbai', 'Delhi'],
          targetBehaviorFilters: {
            hasProSubscription: false,
          },
        },
      },
      'Event: Show on App Open': {
        summary: '📲 Option 5: Event-Triggered - Show on App Open',
        description: `**WHEN TO USE:**
✅ Welcome back messages
✅ Reminders to complete actions
✅ Show popup EVERY TIME user opens app (within date range)
✅ You DON'T need immediate broadcast

**HOW IT WORKS:**
1. Create campaign: triggerType: "event" + triggerEvents: ["app_open"]
2. Campaign active between startDate and endDate
3. User opens app → Mobile calls: GET /api/fiam/campaigns/eligible?triggerEvent=app_open
4. Backend returns eligible campaigns → Mobile displays popup

**EXAMPLE USE CASES:**
👋 Welcome back! You have 5 new campaign invites
🔔 Don't forget to complete your profile
💡 Tip: Apply to campaigns to earn credits

**KEY DIFFERENCES FROM BROADCAST:**
❌ CANNOT use /broadcast endpoint
✅ Mobile app PULLS data (not pushed)
✅ Shows EVERY TIME user opens app (subject to frequency limits)
✅ Active during entire date range (e.g., all of April)

**⚠️ IMPORTANT:**
Without frequency limits, this shows EVERY SINGLE TIME user opens app!
Add frequencyConfig to prevent spam.

**AFTER CREATION:**
→ No broadcast needed - mobile app fetches automatically
→ Active from startDate to endDate`,
        value: {
          name: 'Welcome Back Popup',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: 'Welcome Back!',
            body: 'Check out new campaigns waiting for you',
            imageUrl: 'https://yourdomain.com/welcome.jpg',
            buttonConfig: {
              text: 'View Campaigns',
              actionUrl: 'app://campaigns',
              backgroundColor: '#4CAF50',
              textColor: '#FFFFFF',
            },
          },
          triggerType: 'event',
          triggerEvents: ['app_open'],
          targetUserTypes: ['influencer'],
          targetIsPanIndia: true,
          startDate: '2026-04-01T00:00:00Z',
          endDate: '2026-04-30T23:59:59Z',
        },
      },
      'Event: Show on Screen View': {
        summary: '📲 Option 6: Event-Triggered - Specific Screen with Frequency Control',
        description: `**WHEN TO USE:**
✅ Show popup on SPECIFIC SCREENS (home, campaigns, profile)
✅ Contextual promotions based on where user is
✅ Feature discovery ("New feature available here!")

**AVAILABLE TRIGGER EVENTS:**
→ app_open - User opens the app
→ screen_view_home - User views home screen
→ screen_view_campaigns - User views campaigns screen
→ screen_view_profile - User views their profile
→ campaign_applied - User applies to a campaign
→ credits_earned - User earns credits
→ low_credits - User has low credits

**EXAMPLE USE CASES:**
🏠 On Home: "New: Hype Store is now available!"
📋 On Campaigns: "Pro Tip: Apply to 3+ campaigns for better approval"
👤 On Profile: "Complete your bio to get 2x more invites"

**WHY FREQUENCY CONTROL MATTERS:**
Without limits, popup shows EVERY TIME they view that screen = ANNOYING!

**FREQUENCY CONFIG (REQUIRED):**
→ maxImpressionsPerDay: 1 - Once per day max
→ maxImpressionsPerUser: 3 - 3 times lifetime
→ cooldownHours: 24 - Wait 24h after dismiss

**WORKFLOW:**
User opens app → Goes to Home screen
→ Mobile: GET /api/fiam/campaigns/eligible?triggerEvent=screen_view_home
→ Backend checks: User saw this today? No
→ Backend returns campaign → Mobile shows popup
→ Backend logs: impression count++

**THIS EXAMPLE:**
Shows on home screen, max 1/day, 3 total, 24h cooldown after dismiss`,
        value: {
          name: 'Hype Store Promo on Home',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: 'New: Hype Store is Live!',
            body: 'Shop exclusive products and earn cashback',
            imageUrl: 'https://yourdomain.com/hype-store.jpg',
            buttonConfig: {
              text: 'Shop Now',
              actionUrl: 'app://hype-store',
              backgroundColor: '#FF5722',
              textColor: '#FFFFFF',
            },
          },
          triggerType: 'event',
          triggerEvents: ['screen_view_home'],
          targetUserTypes: ['influencer'],
          targetIsPanIndia: true,
          frequencyConfig: {
            maxImpressionsPerUser: 3,
            maxImpressionsPerDay: 1,
            cooldownHours: 24,
          },
          startDate: '2026-03-30T00:00:00Z',
          endDate: '2026-12-31T23:59:59Z',
        },
      },
      'Draft for Later': {
        summary: '📅 Option 7: Draft - Prepare Without Activating',
        description: `**WHEN TO USE:**
✅ Schedule campaigns for future (prepare now, activate later)
✅ Review campaigns before going live
✅ Team collaboration (create → review → approve → activate)
✅ Seasonal campaigns (create in advance)

**HOW IT WORKS:**
1. Create campaign with status: "draft"
2. Campaign is NOT active yet (won't appear to users)
3. When ready, activate: PATCH /admin/fiam-campaigns/:id/status → status: "active"
4. Now you can broadcast it

**EXAMPLE USE CASES:**
📅 Weekend Sale - Create Monday, activate Friday
🎄 Christmas Sale - Prepare in November, activate Dec 20
👥 Reviewed Campaign - Create → Manager reviews → Manager activates

**WORKFLOW:**
Create as draft → Review/Edit multiple times → Activate when ready → Broadcast

**BEST FOR:**
→ Campaigns with future scheduledAt dates
→ Campaigns needing approval before going live
→ Bulk-preparing multiple campaigns

**ACTIVATION:**
→ Call: PATCH /admin/fiam-campaigns/{id}/status
→ Body: { "status": "active" }
→ Then broadcast: POST /admin/fiam-campaigns/{id}/broadcast

**THIS EXAMPLE:**
Scheduled for April 5th, created as draft for later activation`,
        value: {
          name: 'Weekend Flash Sale',
          uiConfig: {
            layoutType: 'card',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            title: 'Weekend Special - Coming Soon!',
            body: 'Get ready for massive discounts this Saturday',
            imageUrl: 'https://yourdomain.com/images/weekend-sale.jpg',
            buttonConfig: {
              text: 'Remind Me',
              actionUrl: 'app://reminders',
              backgroundColor: '#FF9800',
              textColor: '#FFFFFF',
            },
          },
          triggerType: 'scheduled',
          scheduledAt: '2026-04-05T00:00:00Z',
          targetUserTypes: ['influencer'],
          targetIsPanIndia: true,
          status: 'draft',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Campaign created successfully',
    type: FiamCampaignResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input or validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async createCampaign(
    @Body() dto: CreateFiamCampaignDto,
    @Req() req: RequestWithAdmin,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.createCampaign(dto, req.admin.id);
  }

  @Post('upload-media')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload media file for FIAM campaign',
    description: `Upload an image, video, or GIF for use in FIAM campaigns.

**Supported formats:**
- Images: .jpg, .jpeg, .png, .webp (max 5MB)
- Videos: .mp4, .mov, .avi, .webm (max 50MB)
- GIFs: .gif (max 10MB)

**Returns:** Public URL that can be used in the \`uiConfig.imageUrl\` field when creating campaigns.

**Alternative:** You can also paste external URLs directly instead of uploading.`,
  })
  @ApiResponse({
    status: 200,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        url: { type: 'string', example: 'https://your-bucket.s3.amazonaws.com/fiam-campaigns/media-1234567890.jpg' },
        mediaType: { type: 'string', example: 'image', enum: ['image', 'video', 'gif'] },
        message: { type: 'string', example: 'Media uploaded successfully' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'No file provided or invalid file type' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; url: string; mediaType: string; message: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/webm',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: images (.jpg, .jpeg, .png, .webp), videos (.mp4, .mov, .avi, .webm), gifs (.gif)`,
      );
    }

    // Validate file size
    const maxSizes = {
      image: 5 * 1024 * 1024, // 5MB for images
      video: 50 * 1024 * 1024, // 50MB for videos
      gif: 10 * 1024 * 1024, // 10MB for gifs
    };

    let mediaType: 'image' | 'video' | 'gif' = 'image';
    let maxSize = maxSizes.image;

    if (file.mimetype === 'image/gif') {
      mediaType = 'gif';
      maxSize = maxSizes.gif;
    } else if (file.mimetype.startsWith('video/')) {
      mediaType = 'video';
      maxSize = maxSizes.video;
    }

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size for ${mediaType}: ${maxSize / (1024 * 1024)}MB`,
      );
    }

    // Upload to S3
    const url = await this.s3Service.uploadFileToS3(
      file,
      'fiam-campaigns',
      `media-${mediaType}`,
    );

    return {
      success: true,
      url,
      mediaType,
      message: 'Media uploaded successfully',
    };
  }

  // ============================================================================
  // READ
  // ============================================================================

  @Get()
  @ApiOperation({
    summary: 'List all FIAM campaigns',
    description: 'Get paginated list of campaigns with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of campaigns',
    type: FiamCampaignListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getCampaigns(
    @Query() query: GetFiamCampaignsDto,
  ): Promise<FiamCampaignListResponseDto> {
    return this.fiamCampaignService.getCampaigns(query);
  }

  @Get('analytics/summary')
  @ApiOperation({
    summary: 'Get all campaigns analytics summary',
    description: 'Get aggregated analytics across all campaigns',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getAllCampaignsAnalytics(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageConversionRate: number;
    averageClickThroughRate: number;
  }> {
    return this.fiamCampaignService.getAllCampaignsAnalytics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get campaign by ID',
    description: 'Get detailed information about a specific campaign',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign details',
    type: FiamCampaignResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getCampaignById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.getCampaignById(id);
  }

  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get campaign analytics',
    description: 'Get detailed analytics for a specific campaign',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign analytics',
    type: CampaignAnalyticsDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getCampaignAnalytics(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignAnalyticsDto> {
    return this.fiamCampaignService.getCampaignAnalytics(id);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  @Patch(':id')
  @ApiOperation({
    summary: 'Update campaign',
    description: 'Update campaign configuration',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign updated successfully',
    type: FiamCampaignResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiBadRequestResponse({ description: 'Invalid input or validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async updateCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFiamCampaignDto,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.updateCampaign(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update campaign status',
    description: 'Activate, pause, complete, or expire a campaign',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiBody({ type: UpdateCampaignStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Campaign status updated successfully',
    type: FiamCampaignResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async updateCampaignStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: CampaignStatus,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.updateCampaignStatus(id, status);
  }

  // ============================================================================
  // BROADCAST
  // ============================================================================

  @Post(':id/broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Broadcast campaign via FCM',
    description: 'Send campaign to eligible users via Firebase Cloud Messaging push notifications',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Broadcast initiated successfully',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async broadcastCampaign(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{
    success: boolean;
    totalSent: number;
    eligibleUsers: number;
    errors: number;
    message: string;
  }> {
    const result = await this.fiamCampaignBroadcastService.broadcastCampaign(id);
    return {
      ...result,
      message: `Broadcast complete: ${result.totalSent} notifications sent to ${result.eligibleUsers} users`,
    };
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete campaign',
    description: 'Soft delete campaign (marks as completed)',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async deleteCampaign(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.fiamCampaignService.deleteCampaign(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete campaign',
    description: 'Hard delete campaign from database (use with caution)',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign permanently deleted',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async permanentlyDeleteCampaign(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.fiamCampaignService.permanentlyDeleteCampaign(id);
  }
}
