import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { InstagramService } from '../services/instagram.service';
import { InstagramSyncCronService } from '../services/instagram-sync.cron';
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
   * Sync authenticated user's Instagram profile data
   * POST /instagram/sync-profile
   */
  @Public()
  @Post('sync-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync authenticated user\'s Instagram profile data',
    description: 'Fetches and updates Instagram profile data for the currently authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile synced successfully'
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
  async syncProfile(
    @Req() req: RequestWithUser,
  ) {
    const { id, userType } = req.user;

    const user = await this.instagramService.syncInstagramProfile(
      id,
      userType,
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
   * Disconnect Instagram account from authenticated user
   * POST /instagram/disconnect
   */
  @Public()
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disconnect Instagram account',
    description: 'Removes Instagram connection and clears all Instagram data from the database for the currently authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Instagram account disconnected successfully'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - no valid JWT token'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  async disconnectAccount(
    @Req() req: RequestWithUser,
  ) {
    const { id, userType } = req.user;

    await this.instagramService.disconnectInstagramAccount(
      id,
      userType,
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
}
