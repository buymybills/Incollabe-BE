import { Controller, Post, Get, Body, Query, Param, HttpCode, HttpStatus, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { InstagramService } from '../services/instagram.service';
import { InstagramSyncCronService } from '../services/instagram-sync.cron';
//import { InstagramGrowthCronService } from '../services/instagram-growth.cron';
import { InfluencerCredibilityScoringService } from '../services/influencer-credibility-scoring.service';
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
   * Bulk sync all media insights for a user
   * POST /instagram/sync-all-media-insights
   */
  @Public()
  @Post('sync-all-media-insights')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk sync all media insights',
    description: 'Fetches all Instagram posts and their insights, then stores them in the database. This is a comprehensive sync operation that should be used when you need complete data for credibility scoring or analytics.'
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
    description: 'Number of posts to fetch (default: 50, max: 100)',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk sync completed successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid parameters or no Instagram account connected'
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

    return {
      message: result.message,
      ...result,
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

    return {
      message: 'Credibility score calculated successfully',
      score,
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
