import { Controller, Post, Get, Body, Query, Param, HttpCode, HttpStatus, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { InstagramService } from '../services/instagram.service';
import { InstagramSyncCronService } from '../services/instagram-sync.cron';
//import { InstagramGrowthCronService } from '../services/instagram-growth.cron';
import { InfluencerCredibilityScoringService } from '../services/influencer-credibility-scoring.service';
import { InstagramSyncGateway } from '../instagram-sync.gateway';
import {
  InstagramTokenDto,
  InstagramTokenResponseDto,
  InstagramRefreshTokenDto,
  InstagramRefreshTokenResponseDto,
} from '../dto/instagram.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Public } from '../../auth/decorators/public.decorator';
import type { RequestWithUser } from '../../types/request.types';

@ApiTags('Instagram OAuth')
@Controller('instagram')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly instagramSyncCronService: InstagramSyncCronService,
    //private readonly instagramGrowthCronService: InstagramGrowthCronService,
    private readonly credibilityScoringService: InfluencerCredibilityScoringService,
    private readonly instagramSyncGateway: InstagramSyncGateway,
  ) {}

  /**
   * Exchange authorization code for access token
   * POST /instagram/token
   * Note: This is a public endpoint used during OAuth flow
   */
  @Public()
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange authorization code for access token',
    description: 'Exchanges Instagram OAuth authorization code for a long-lived access token. This is a public endpoint for testing OAuth flow.'
  })
  @ApiResponse({
    status: 200,
    description: 'Token exchange successful',
    type: InstagramTokenResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid code or redirect URI'
  })
  @ApiResponse({
    status: 500,
    description: 'Instagram API error'
  })
  async exchangeToken(@Body() tokenDto: InstagramTokenDto): Promise<InstagramTokenResponseDto> {
    return this.instagramService.exchangeCodeForToken(tokenDto);
  }

  /**
   * Refresh access token
   * POST /instagram/refresh
   * Note: This is a public endpoint for testing OAuth flow
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Instagram access token',
    description: 'Refreshes an existing long-lived Instagram access token to extend its validity. This is a public endpoint for testing OAuth flow.'
  })
  @ApiResponse({
    status: 200,
    description: 'Token refresh successful',
    type: InstagramRefreshTokenResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired access token'
  })
  @ApiResponse({
    status: 500,
    description: 'Instagram API error'
  })
  async refreshToken(@Body() refreshDto: InstagramRefreshTokenDto): Promise<InstagramRefreshTokenResponseDto> {
    return this.instagramService.refreshAccessToken(refreshDto);
  }

  /**
   * Get Instagram user profile and store in database
   * GET /instagram/me
   * Fetches Instagram profile using access token, stores token and profile in DB, returns profile
   */
  @Public()
  @Get('me')
  @ApiOperation({
    summary: 'Get Instagram profile and connect account',
    description: 'Retrieves Instagram profile, stores access token and profile data in database, and returns profile information. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'access_token',
    required: true,
    description: 'Valid Instagram access token from OAuth flow'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved and stored successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid access token or missing user_id/user_type'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Instagram API error'
  })
  async getUserProfile(
    @Query('access_token') accessToken: string,
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    // Fetch profile from Instagram and store everything in DB
    const user = await this.instagramService.connectWithAccessToken(
      Number(userId),
      userType as 'influencer' | 'brand',
      accessToken,
    );

    return {
      message: 'Instagram profile retrieved and connected successfully',
      profile: {
        id: user.instagramUserId,
        username: user.instagramUsername,
        accountType: user.instagramAccountType,
        followersCount: user.instagramFollowersCount,
        followsCount: user.instagramFollowsCount,
        mediaCount: user.instagramMediaCount,
        profilePictureUrl: user.instagramProfilePictureUrl,
        bio: user.instagramBio,
      },
    };
  }


  /**
   * Get stored Instagram profile for a user
   * GET /instagram/profile
   */
  @Public()
  @Get('profile')
  @ApiOperation({
    summary: 'Get stored Instagram profile data',
    description: 'Retrieves Instagram profile data stored in database for a user'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Instagram profile data retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found or Instagram not connected'
  })
  async getStoredProfile(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const user = await this.instagramService.getStoredInstagramProfile(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    if (!user.instagramUserId) {
      throw new BadRequestException('Instagram account not connected for this user');
    }

    return {
      message: 'Instagram profile retrieved successfully',
      profile: {
        id: user.instagramUserId,
        username: user.instagramUsername,
        accountType: user.instagramAccountType,
        followersCount: user.instagramFollowersCount,
        followsCount: user.instagramFollowsCount,
        mediaCount: user.instagramMediaCount,
        profilePictureUrl: user.instagramProfilePictureUrl,
        bio: user.instagramBio,
        connectedAt: user.instagramConnectedAt,
        tokenExpiresAt: user.instagramTokenExpiresAt,
      },
    };
  }

  /**
   * Refresh authenticated user's Instagram access token
   * POST /instagram/refresh-user-token
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh authenticated user\'s Instagram access token',
    description: 'Refreshes the Instagram access token stored in the database for the currently authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - no valid JWT token'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 400,
    description: 'No Instagram account connected'
  })
  async refreshUserToken(
    @Req() req: RequestWithUser,
  ) {
    const { id, userType } = req.user;

    const user = await this.instagramService.refreshUserInstagramToken(
      id,
      userType,
    );

    return {
      message: 'Instagram token refreshed successfully',
      expiresAt: user.instagramTokenExpiresAt,
    };
  }

  /**
   * Sync Instagram profile data for a user
   * POST /instagram/sync-profile
   */
  @Public()
  @Post('sync-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync Instagram profile data',
    description: 'Fetches and updates Instagram profile data for a user. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile synced successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 400,
    description: 'No Instagram account connected or invalid parameters'
  })
  async syncProfile(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const user = await this.instagramService.syncInstagramProfile(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    return {
      message: 'Instagram profile synced successfully',
      profile: {
        username: user.instagramUsername,
        followersCount: user.instagramFollowersCount,
        followsCount: user.instagramFollowsCount,
        mediaCount: user.instagramMediaCount,
        accountType: user.instagramAccountType,
      },
    };
  }

  /**
   * Disconnect Instagram account from a user
   * POST /instagram/disconnect
   */
  @Public()
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disconnect Instagram account',
    description: 'Removes Instagram connection and clears all Instagram data from the database for a user. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Instagram account disconnected successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters'
  })
  async disconnectAccount(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    await this.instagramService.disconnectInstagramAccount(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    return {
      message: 'Instagram account disconnected successfully',
    };
  }

  /**
   * Manually trigger Instagram profile sync (for testing)
   * POST /instagram/test-sync
   */
  @Public()
  @Post('test-sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger Instagram profile sync',
    description: 'Triggers the cron job to sync all Instagram profiles immediately. This is for testing purposes.'
  })
  @ApiResponse({
    status: 200,
    description: 'Sync triggered successfully'
  })
  async testSync() {
    await this.instagramSyncCronService.manualSync();
    return {
      message: 'Instagram sync triggered successfully. Check server logs for details.',
    };
  }

  /**
   * Get Instagram media/posts for a user
   * GET /instagram/media
   */
  @Public()
  @Get('media')
  @ApiOperation({
    summary: 'Get Instagram media/posts',
    description: 'Fetches all Instagram posts for a user. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of posts to fetch (default: 25)',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Media fetched successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 400,
    description: 'No Instagram account connected or invalid parameters'
  })
  async getMedia(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const mediaLimit = limit ? parseInt(limit, 10) : 25;

    const media = await this.instagramService.getInstagramMedia(
      Number(userId),
      userType as 'influencer' | 'brand',
      mediaLimit,
    );

    return {
      message: 'Instagram media fetched successfully',
      ...media,
    };
  }

  /**
   * Check if user has insights permissions
   * GET /instagram/check-insights-permissions
   */
  @Public()
  @Get('check-insights-permissions')
  @ApiOperation({
    summary: 'Check insights permissions',
    description: 'Checks if the Instagram account has the necessary permissions and account type to access insights. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Permission check completed'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 400,
    description: 'No Instagram account connected or invalid parameters'
  })
  async checkInsightsPermissions(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const result = await this.instagramService.checkInsightsPermissions(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    return result;
  }

  /**
   * Get insights for a specific Instagram post
   * GET /instagram/media/:mediaId/insights
   */
  @Public()
  @Get('media/:mediaId/insights')
  @ApiOperation({
    summary: 'Get Instagram post insights',
    description: 'Fetches insights for a specific Instagram post from Instagram API and stores them. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Post insights fetched successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 400,
    description: 'No Instagram account connected or invalid parameters'
  })
  async getPostInsights(
    @Param('mediaId') mediaId: string,
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const insights = await this.instagramService.getMediaInsights(
      Number(userId),
      userType as 'influencer' | 'brand',
      mediaId,
    );

    return {
      message: 'Post insights fetched and stored successfully',
      ...insights,
    };
  }

  /**
   * Get stored Instagram media insights from database
   * GET /instagram/stored-insights
   */
  @Public()
  @Get('stored-insights')
  @ApiOperation({
    summary: 'Get stored Instagram insights',
    description: 'Retrieves stored Instagram media insights from database. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiQuery({
    name: 'media_id',
    required: false,
    description: 'Optional: Filter by specific media ID'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records to return (default: 100)',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Stored insights retrieved successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters'
  })
  async getStoredInsights(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
    @Query('media_id') mediaId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const limitNum = limit ? parseInt(limit, 10) : 100;

    const result = await this.instagramService.getStoredMediaInsights(
      Number(userId),
      userType as 'influencer' | 'brand',
      mediaId,
      limitNum,
    );

    return {
      message: 'Stored insights retrieved successfully',
      ...result,
    };
  }

  /**
   * Bulk sync all media insights with progressive growth tracking
   * POST /instagram/sync-all-media-insights
   */
  @Public()
  @Post('sync-all-media-insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk sync media insights with progressive growth tracking',
    description: `Comprehensive media insights sync with intelligent snapshot management:

    **How it works:**
    1. **Checks last snapshot date** - Finds the most recent snapshot for this user
    2. **15-day throttle** - If last snapshot was less than 15 days ago, returns error with days remaining
    3. **Fetches media** - Gets all posts from Instagram API (up to limit)
    4. **Stores insights** - Fetches detailed insights for each post
    5. **Creates new snapshot** - Snapshot period depends on last sync:
       - **First time:** Creates snapshot for last 30 days
       - **Subsequent syncs:** Creates snapshot from (last snapshot end date + 1 day) to today
       - Example: If last snapshot ended on Dec 31 and you sync on Jan 20 (20 days later), new snapshot will cover Jan 1 - Jan 20 (20 days)
    6. **Compares growth** - Calculates growth metrics by comparing new snapshot with previous snapshot

    **Key Features:**
    - Progressive snapshot tracking (keeps all historical snapshots)
    - Dynamic snapshot periods (15, 20, 30+ days based on when user syncs)
    - Prevents sync abuse with 15-day minimum interval
    - Complete growth comparison metrics

    **Growth metrics:**
    - Followers growth (count & percentage)
    - Engagement rate change
    - Average reach change
    - Posts activity comparison
    - Active followers percentage change`
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of posts to fetch from Instagram API (default: 50, max: 100)',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk sync completed successfully with progressive growth tracking',
    schema: {
      examples: {
        'Subsequent Sync (with growth)': {
          value: {
            success: true,
            message: 'Successfully synced 48 posts and created snapshot #3',
            syncedAt: '2025-02-10T10:30:00Z',
            mediaSync: {
              totalPosts: 50,
              synced: 48,
              failed: 2,
              errors: [
                {
                  mediaId: '12345',
                  error: 'Media posted before business account conversion'
                }
              ]
            },
            currentSnapshot: {
              snapshotId: 52,
              syncNumber: 3,
              period: {
                start: '2025-01-01',
                end: '2025-02-10',
                days: 41
              },
              metrics: {
                postsAnalyzed: 25,
                totalFollowers: 15820,
                activeFollowers: 1740,
                activeFollowersPercentage: 11.0,
                avgEngagementRate: 4.12,
                avgReach: 6200,
                totalLikes: 12450,
                totalComments: 628,
                totalShares: 156,
                totalSaves: 412
              }
            },
            previousSnapshot: {
              snapshotId: 51,
              syncNumber: 2,
              period: {
                start: '2024-12-02',
                end: '2024-12-31',
                days: 30
              },
              metrics: {
                postsAnalyzed: 18,
                totalFollowers: 14800,
                activeFollowers: 1480,
                activeFollowersPercentage: 10.0,
                avgEngagementRate: 3.45,
                avgReach: 5200,
                totalLikes: 8640,
                totalComments: 432,
                totalShares: 89,
                totalSaves: 267
              }
            },
            growth: {
              followers: {
                previous: 14800,
                current: 15820,
                change: 1020,
                changePercentage: 6.89
              },
              engagement: {
                previous: 3.45,
                current: 4.12,
                change: 0.67,
                changePercentage: 19.42
              },
              reach: {
                previous: 5200,
                current: 6200,
                change: 1000,
                changePercentage: 19.23
              },
              posts: {
                previous: 18,
                current: 25,
                change: 7
              },
              activeFollowers: {
                previous: 10.0,
                current: 11.0,
                change: 1.0
              }
            }
          }
        },
        'Initial Sync (first time)': {
          value: {
            success: true,
            message: 'Initial snapshot created with 32 posts',
            syncedAt: '2025-01-23T10:30:00Z',
            mediaSync: {
              totalPosts: 35,
              synced: 32,
              failed: 3,
              errors: []
            },
            currentSnapshot: {
              snapshotId: 1,
              syncNumber: 1,
              period: {
                start: '2024-12-24',
                end: '2025-01-23',
                days: 30
              },
              metrics: {
                postsAnalyzed: 15,
                totalFollowers: 12500,
                activeFollowers: 1125,
                activeFollowersPercentage: 9.0,
                avgEngagementRate: 2.85,
                avgReach: 4200,
                totalLikes: 5340,
                totalComments: 267,
                totalShares: 45,
                totalSaves: 178
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters, no Instagram account connected, or sync throttled',
    schema: {
      examples: {
        'Sync Throttled (too soon)': {
          value: {
            error: 'sync_throttled',
            message: 'Instagram profile sync is limited to once every 15 days. Please wait 8 more day(s).',
            details: {
              lastSnapshotDate: '2025-01-10',
              nextAllowedSyncDate: '2025-01-25',
              daysSinceLastSnapshot: 7,
              daysRemaining: 8
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Bulk sync failed'
  })
  async syncAllMediaInsights(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;

    // Ensure limit is within bounds
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }

    const result = await this.instagramService.syncAllMediaInsights(
      Number(userId),
      userType as 'influencer' | 'brand',
      limitNum,
    );

    return result;
  }

  /**
   * Comprehensive sync of all Instagram insights with progressive growth tracking
   * POST /instagram/sync-all-insights
   */
  @Public()
  @Post('sync-all-insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comprehensive sync with progressive growth tracking (MASTER SYNC API)',
    description: `Complete Instagram insights sync with intelligent snapshot management:

    **How it works:**
    1. **Checks last snapshot date** - Finds the most recent snapshot for this user
    2. **15-day throttle** - If last snapshot was less than 15 days ago, returns error with days remaining
    3. **Fetches profile** - Updates basic profile data (username, followers, account type, etc.)
    4. **Creates new snapshot** - Snapshot period depends on last sync:
       - **First time:** Creates snapshot for last 30 days
       - **Subsequent syncs:** Creates snapshot from (last snapshot end date + 1 day) to today
       - Example: If last snapshot ended on Dec 31 and you sync on Jan 20 (20 days later), new snapshot will cover Jan 1 - Jan 20 (20 days)
    5. **Fetches demographics** - Gets audience demographics and geographic data (requires Facebook connection)
    6. **Compares growth** - Calculates growth metrics by comparing new snapshot with previous snapshot

    **Key Features:**
    - Progressive snapshot tracking (keeps all historical snapshots)
    - Dynamic snapshot periods (adapts to when user syncs)
    - Prevents sync abuse with 15-day minimum interval
    - Complete profile + demographics + growth metrics

    **Growth metrics:**
    - Followers growth (count & percentage)
    - Engagement rate change
    - Average reach change
    - Posts activity comparison
    - Active followers percentage change

    **Note:** Demographics and geographic data require Instagram Business Account connected to Facebook Page.`
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Comprehensive sync completed with progressive growth tracking',
    schema: {
      examples: {
        'Subsequent Sync (with growth)': {
          value: {
            message: 'Instagram insights snapshot #3 created with growth analysis',
            syncedAt: '2025-02-10T10:30:00Z',
            basicProfile: {
              status: 'success',
              data: {
                username: 'example_influencer',
                followersCount: 15820,
                followsCount: 530,
                mediaCount: 135,
                accountType: 'BUSINESS'
              }
            },
            currentSnapshot: {
              snapshotId: 53,
              syncNumber: 3,
              period: {
                start: '2025-01-01',
                end: '2025-02-10',
                days: 41
              },
              metrics: {
                postsAnalyzed: 22,
                totalFollowers: 15820,
                activeFollowers: 1740,
                activeFollowersPercentage: 11.0,
                avgEngagementRate: 4.12,
                avgReach: 6200,
                totalLikes: 11250,
                totalComments: 564,
                totalShares: 142,
                totalSaves: 385
              }
            },
            previousSnapshot: {
              snapshotId: 52,
              syncNumber: 2,
              period: {
                start: '2024-12-02',
                end: '2024-12-31',
                days: 30
              },
              metrics: {
                postsAnalyzed: 15,
                totalFollowers: 14800,
                activeFollowers: 1480,
                activeFollowersPercentage: 10.0,
                avgEngagementRate: 3.45,
                avgReach: 5200,
                totalLikes: 6840,
                totalComments: 342,
                totalShares: 72,
                totalSaves: 228
              }
            },
            growth: {
              followers: {
                previous: 14800,
                current: 15820,
                change: 1020,
                changePercentage: 6.89
              },
              engagement: {
                previous: 3.45,
                current: 4.12,
                change: 0.67,
                changePercentage: 19.42
              },
              reach: {
                previous: 5200,
                current: 6200,
                change: 1000,
                changePercentage: 19.23
              },
              posts: {
                previous: 15,
                current: 22,
                change: 7
              },
              activeFollowers: {
                previous: 10.0,
                current: 11.0,
                change: 1.0
              }
            },
            audienceDemographics: {
              status: 'success',
              data: []
            },
            geographicData: {
              status: 'success',
              data: []
            }
          }
        },
        'Initial Sync (first time)': {
          value: {
            message: 'Initial Instagram insights snapshot created',
            syncedAt: '2025-01-23T10:30:00Z',
            basicProfile: {
              status: 'success',
              data: {
                username: 'example_influencer',
                followersCount: 12500,
                followsCount: 485,
                mediaCount: 98,
                accountType: 'BUSINESS'
              }
            },
            currentSnapshot: {
              snapshotId: 1,
              syncNumber: 1,
              period: {
                start: '2024-12-24',
                end: '2025-01-23',
                days: 30
              },
              metrics: {
                postsAnalyzed: 12,
                totalFollowers: 12500,
                activeFollowers: 1125,
                activeFollowersPercentage: 9.0,
                avgEngagementRate: 2.85,
                avgReach: 4200,
                totalLikes: 4260,
                totalComments: 213,
                totalShares: 36,
                totalSaves: 142
              }
            },
            audienceDemographics: {
              status: 'success',
              data: []
            },
            geographicData: {
              status: 'success',
              data: []
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'No Instagram account connected, invalid parameters, or sync throttled',
    schema: {
      examples: {
        'Sync Throttled (too soon)': {
          value: {
            error: 'sync_throttled',
            message: 'Instagram profile sync is limited to once every 15 days. Please wait 8 more day(s).',
            details: {
              lastSnapshotDate: '2025-01-15',
              nextAllowedSyncDate: '2025-01-30',
              daysSinceLastSnapshot: 7,
              daysRemaining: 8
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  async syncAllInsights(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const result = await this.instagramService.syncAllInsights(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    return result;
  }

  /**
   * Async version: Bulk sync all media insights with WebSocket progress
   * POST /instagram/sync-all-media-insights-async
   */
  @Public()
  @Post('sync-all-media-insights-async')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk sync media insights with real-time WebSocket progress (Async)',
    description: `Starts Instagram media sync in the background and returns a jobId immediately.

    **How it works:**
    1. **Returns immediately** - API responds in < 1 second with a jobId
    2. **Connect to WebSocket** - Use the jobId to listen for real-time progress updates
    3. **Receive progress** - Get updates at 0%, 10%, 20%, ..., 100%
    4. **Get completion data** - Final event contains sync summary

    **WebSocket Integration:**
    - Namespace: \`/instagram-sync\`
    - Auth: Include JWT in connection: \`{ auth: { token: "Bearer <jwt>" } }\`
    - Events:
      - \`sync:<jobId>:progress\` - Progress updates (0-100%)
      - \`sync:<jobId>:complete\` - Sync completed successfully
      - \`sync:<jobId>:error\` - Sync failed

    **Benefits:**
    - No timeout issues (API returns immediately)
    - Real-time feedback (user sees progress bar)
    - Better UX (no silent waiting)

    **Example Response:**
    \`\`\`json
    {
      "success": true,
      "jobId": "media-sync-123-1234567890",
      "message": "Sync started. Connect to WebSocket for progress updates.",
      "socketNamespace": "/instagram-sync",
      "events": {
        "progress": "sync:media-sync-123-1234567890:progress",
        "complete": "sync:media-sync-123-1234567890:complete",
        "error": "sync:media-sync-123-1234567890:error"
      }
    }
    \`\`\``
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of posts to fetch from Instagram API (default: 50, max: 100)',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job started successfully. Use jobId with WebSocket to track progress.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters'
  })
  async syncAllMediaInsightsAsync(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
    @Query('limit') limit?: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;

    // Ensure limit is within bounds
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }

    // Generate unique job ID
    const jobId = `media-sync-${userId}-${Date.now()}`;

    // Start sync in background (don't await)
    this.instagramService
      .syncAllMediaInsights(
        Number(userId),
        userType as 'influencer' | 'brand',
        limitNum,
        jobId, // Pass jobId to enable WebSocket emissions
      )
      .catch((error) => {
        console.error(`Background media sync failed for job ${jobId}:`, error);
        // Error will be emitted via WebSocket by the service
      });

    // Return immediately with job info
    return {
      success: true,
      jobId,
      message: 'Media sync started. Connect to WebSocket for progress updates.',
      socketNamespace: '/instagram-sync',
      events: {
        progress: `sync:${jobId}:progress`,
        complete: `sync:${jobId}:complete`,
        error: `sync:${jobId}:error`,
      },
    };
  }

  /**
   * Async version: Comprehensive sync with WebSocket progress
   * POST /instagram/sync-all-insights-async
   */
  @Public()
  @Post('sync-all-insights-async')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comprehensive Instagram sync with real-time WebSocket progress (Async)',
    description: `Starts comprehensive Instagram profile sync in the background and returns a jobId immediately.

    **How it works:**
    1. **Returns immediately** - API responds in < 1 second with a jobId
    2. **Connect to WebSocket** - Use the jobId to listen for real-time progress updates
    3. **Receive progress** - Get updates at 0%, 25%, 50%, 75%, 100%
    4. **Get completion data** - Final event contains sync summary

    **What this syncs:**
    - Basic profile data (username, followers, account type)
    - Profile snapshots with growth tracking
    - Audience demographics (age, gender)
    - Geographic data (countries, cities)

    **WebSocket Integration:**
    - Namespace: \`/instagram-sync\`
    - Auth: Include JWT in connection: \`{ auth: { token: "Bearer <jwt>" } }\`
    - Events:
      - \`sync:<jobId>:progress\` - Progress updates (0%, 25%, 50%, 75%, 100%)
      - \`sync:<jobId>:complete\` - Sync completed successfully
      - \`sync:<jobId>:error\` - Sync failed

    **Benefits:**
    - No timeout issues (API returns immediately)
    - Real-time feedback during sync
    - Better UX for long-running operations

    **Example Response:**
    \`\`\`json
    {
      "success": true,
      "jobId": "profile-sync-123-1234567890",
      "message": "Profile sync started. Connect to WebSocket for progress updates.",
      "socketNamespace": "/instagram-sync",
      "events": {
        "progress": "sync:profile-sync-123-1234567890:progress",
        "complete": "sync:profile-sync-123-1234567890:complete",
        "error": "sync:profile-sync-123-1234567890:error"
      }
    }
    \`\`\``
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Sync job started successfully. Use jobId with WebSocket to track progress.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters'
  })
  async syncAllInsightsAsync(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    // Generate unique job ID
    const jobId = `profile-sync-${userId}-${Date.now()}`;

    // Start sync in background (don't await)
    this.instagramService
      .syncAllInsights(
        Number(userId),
        userType as 'influencer' | 'brand',
        jobId, // Pass jobId to enable WebSocket emissions
      )
      .catch((error) => {
        console.error(`Background profile sync failed for job ${jobId}:`, error);
        // Error will be emitted via WebSocket by the service
      });

    // Return immediately with job info
    return {
      success: true,
      jobId,
      message: 'Profile sync started. Connect to WebSocket for progress updates.',
      socketNamespace: '/instagram-sync',
      events: {
        progress: `sync:${jobId}:progress`,
        complete: `sync:${jobId}:complete`,
        error: `sync:${jobId}:error`,
      },
    };
  }

  /**
   * Get audience demographics
   * GET /instagram/audience-demographics
   *
   * IMPORTANT: This endpoint requires Instagram Business Account connected to a Facebook Page.
   * Without Facebook Page integration, Instagram API does not provide demographic data.
   * Alternative: Use Gemini AI to analyze content and engagement patterns for estimated demographics.
   */
  @Public()
  @Get('audience-demographics')
  @ApiOperation({
    summary: 'Get audience demographics (requires Facebook Page)',
    description: 'Fetches audience demographics including age/gender, cities, and countries. NOTE: Requires Instagram Business Account connected to a Facebook Page. Without Facebook Page integration, returns empty data with error details suggesting AI-based demographic estimation as alternative.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Demographics fetched successfully (or returns empty data with error if Facebook Page not integrated)'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or no Instagram account connected'
  })
  async getAudienceDemographics(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const demographics = await this.instagramService.getAudienceDemographics(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    // Provide different message based on data availability
    const message = demographics.dataAvailable
      ? 'Audience demographics retrieved successfully'
      : 'Demographics not available - Facebook Page integration required';

    return {
      message,
      ...demographics,
    };
  }

  /**
   * Get follower count history
   * GET /instagram/follower-history
   */
  @Public()
  @Get('follower-history')
  @ApiOperation({
    summary: 'Get follower count history',
    description: 'Fetches historical follower count data. Requires user_id, user_type, since and until parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiQuery({
    name: 'since',
    required: true,
    description: 'Start timestamp (Unix timestamp)',
    type: Number
  })
  @ApiQuery({
    name: 'until',
    required: true,
    description: 'End timestamp (Unix timestamp)',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Follower history retrieved successfully'
  })
  async getFollowerHistory(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
    @Query('since') since: string,
    @Query('until') until: string,
  ) {
    if (!userId || !userType || !since || !until) {
      throw new BadRequestException('user_id, user_type, since and until are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const history = await this.instagramService.getFollowerCountHistory(
      Number(userId),
      userType as 'influencer' | 'brand',
      Number(since),
      Number(until),
    );

    return {
      message: 'Follower history retrieved successfully',
      data: history,
    };
  }

  /**
   * Calculate influencer credibility score
   * GET /instagram/calculate-credibility-score
   */
  @Public()
  @Get('calculate-credibility-score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate influencer credibility score',
    description: 'Calculates comprehensive credibility score for an influencer based on 5 key categories: Audience Quality (25pts), Content Performance (25pts), Consistency & Reliability (20pts), Content Intelligence (20pts), and Brand Safety & Trust (10pts). Requires influencer_id parameter.'
  })
  @ApiQuery({
    name: 'influencer_id',
    required: true,
    description: 'Influencer ID',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Credibility score calculated successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid influencer ID or Instagram not connected'
  })
  @ApiResponse({
    status: 404,
    description: 'Influencer not found'
  })
  async calculateCredibilityScore(
    @Query('influencer_id') influencerId: string,
  ) {
    if (!influencerId) {
      throw new BadRequestException('influencer_id is required');
    }

    const score = await this.credibilityScoringService.calculateCredibilityScore(
      Number(influencerId),
    );

    // Get aggregate analytics
    const analytics = await this.credibilityScoringService.getAggregateAnalytics(
      Number(influencerId),
    );

    return {
      message: 'Credibility score calculated successfully',
      score,
      analytics,
    };
  }

  /**
   * Get online followers data
   * GET /instagram/online-followers
   */
  @Public()
  @Get('online-followers')
  @ApiOperation({
    summary: 'Get when followers are online',
    description: 'Fetches data about when followers are most active online. Requires user_id and user_type parameters.'
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID (influencer or brand ID)'
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    enum: ['influencer', 'brand'],
    description: 'User type: influencer or brand'
  })
  @ApiResponse({
    status: 200,
    description: 'Online followers data retrieved successfully'
  })
  async getOnlineFollowers(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException('user_type must be either "influencer" or "brand"');
    }

    const data = await this.instagramService.getOnlineFollowers(
      Number(userId),
      userType as 'influencer' | 'brand',
    );

    return {
      message: 'Online followers data retrieved successfully',
      data,
    };
  }

  /**
   * Get comprehensive analytics for influencer/brand
   * Returns all calculated metrics needed for the UI
   */
  @Public()
  @Get('analytics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get comprehensive analytics',
    description:
      'Returns profile summary, engagement metrics, content mix, best/worst posts, demographics, growth trends, and active followers data',
  })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'ID of the influencer or brand',
    type: Number,
  })
  @ApiQuery({
    name: 'user_type',
    required: true,
    description: 'Type of user',
    enum: ['influencer', 'brand'],
  })
  async getComprehensiveAnalytics(
    @Query('user_id') userId: string,
    @Query('user_type') userType: string,
  ) {
    if (!userId || !userType) {
      throw new BadRequestException('user_id and user_type are required');
    }

    if (!['influencer', 'brand'].includes(userType)) {
      throw new BadRequestException(
        'user_type must be either "influencer" or "brand"',
      );
    }

    return await this.instagramService.getComprehensiveAnalytics(
      Number(userId),
      userType as 'influencer' | 'brand',
    );
  }

  /**
   * Manually trigger growth snapshot cron (for testing/debugging)
   * POST /instagram/trigger-growth-snapshot
   */
  // @Public()
  // @Post('trigger-growth-snapshot')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: 'Manually trigger growth snapshot cron',
  //   description: 'Triggers the daily growth snapshot cron job manually for testing/debugging purposes'
  // })
  // async triggerGrowthSnapshot() {
  //   await this.instagramGrowthCronService.trackFollowerGrowthDaily();
  //   return {
  //     success: true,
  //     message: 'Growth snapshot cron triggered successfully',
  //   };
  // }

}
