import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import axios, { AxiosError } from 'axios';
import {
  InstagramTokenDto,
  InstagramTokenResponseDto,
  InstagramRefreshTokenDto,
  InstagramRefreshTokenResponseDto,
  InstagramUserProfileDto,
} from '../dto/instagram.dto';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { InstagramMedia } from '../models/instagram-media.model';
import { InstagramMediaInsight } from '../models/instagram-media-insight.model';

export type UserType = 'influencer' | 'brand';

@Injectable()
export class InstagramService {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private configService: ConfigService,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(InstagramMedia)
    private instagramMediaModel: typeof InstagramMedia,
    @InjectModel(InstagramMediaInsight)
    private instagramMediaInsightModel: typeof InstagramMediaInsight,
  ) {
    const clientId = this.configService.get<string>('INSTAGRAM_APP_ID');
    const clientSecret = this.configService.get<string>('INSTAGRAM_APP_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Instagram credentials not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in environment variables.');
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Exchange authorization code for long-lived access token
   * @param tokenDto - Contains authorization code and redirect URI
   * @returns Long-lived access token and user information
   */
  async exchangeCodeForToken(tokenDto: InstagramTokenDto): Promise<InstagramTokenResponseDto> {
    const { code, redirect_uri } = tokenDto;

    try {
      // Debug logging
      console.log('Instagram OAuth Exchange:', {
        client_id: this.clientId,
        has_client_secret: !!this.clientSecret,
        redirect_uri,
        code_length: code?.length,
      });

      // Step 1: Exchange code for short-lived token
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri,
        code,
      });

      const shortTokenResponse = await axios.post(
        'https://api.instagram.com/oauth/access_token',
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const shortToken = shortTokenResponse.data.access_token;
      const userId = shortTokenResponse.data.user_id;

      // Step 2: Exchange short-lived token for long-lived token
      const longTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.clientSecret,
          access_token: shortToken,
        },
      });

      const longToken = longTokenResponse.data.access_token;
      const expiresIn = longTokenResponse.data.expires_in;

      return {
        access_token: longToken,
        user_id: userId,
        expires_in: expiresIn,
      };
    } catch (error) {
      this.handleInstagramError(error, 'Failed to exchange code for token');
    }
  }

  /**
   * Refresh an existing long-lived access token
   * @param refreshDto - Contains the current access token
   * @returns Refreshed access token
   */
  async refreshAccessToken(refreshDto: InstagramRefreshTokenDto): Promise<InstagramRefreshTokenResponseDto> {
    const { access_token } = refreshDto;

    try {
      const response = await axios.get('https://graph.instagram.com/refresh_access_token', {
        params: {
          grant_type: 'ig_refresh_token',
          access_token,
        },
      });

      return {
        access_token: response.data.access_token,
        token_type: response.data.token_type || 'bearer',
        expires_in: response.data.expires_in,
      };
    } catch (error) {
      this.handleInstagramError(error, 'Failed to refresh access token');
    }
  }

  /**
   * Get Instagram user profile information
   * @param accessToken - Valid Instagram access token
   * @param fields - Optional fields to retrieve (comma-separated)
   * @returns User profile information
   */
  async getUserProfile(
    accessToken: string,
    fields: string = 'id,username,account_type,followers_count,follows_count,media_count,profile_picture_url,biography,website,name'
  ): Promise<InstagramUserProfileDto> {
    try {
      const response = await axios.get('https://graph.instagram.com/me', {
        params: {
          fields,
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      this.handleInstagramError(error, 'Failed to fetch user profile');
    }
  }

  /**
   * Connect Instagram account using access token directly
   * Fetches profile data from Instagram and saves token + profile to DB
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param accessToken - Instagram access token from OAuth flow
   * @returns User instance with updated Instagram data
   */
  async connectWithAccessToken(
    userId: number,
    userType: UserType,
    accessToken: string,
  ): Promise<Influencer | Brand> {
    // Step 1: Fetch user profile from Instagram
    const profile = await this.getUserProfile(accessToken);

    // Step 2: Long-lived tokens typically expire in 60 days
    // We'll set a conservative expiry of 59 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 59);

    // Step 3: Save to database
    const updateData = {
      instagramAccessToken: accessToken,
      instagramUserId: profile.id,
      instagramUsername: profile.username,
      instagramAccountType: profile.account_type || undefined,
      instagramFollowersCount: profile.followers_count || undefined,
      instagramFollowsCount: profile.follows_count || undefined,
      instagramMediaCount: profile.media_count || undefined,
      instagramProfilePictureUrl: profile.profile_picture_url || undefined,
      instagramBio: profile.biography || undefined,
      instagramTokenExpiresAt: expiresAt,
      instagramConnectedAt: new Date(),
    };

    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId);
      if (!influencer) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
      await influencer.update(updateData);
      return influencer.reload();
    } else {
      const brand = await this.brandModel.findByPk(userId);
      if (!brand) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
      await brand.update(updateData);
      return brand.reload();
    }
  }

  /**
   * Get stored Instagram profile from database
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns User instance with Instagram data
   */
  async getStoredInstagramProfile(
    userId: number,
    userType: UserType,
  ): Promise<Influencer | Brand> {
    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId);
      if (!influencer) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
      return influencer;
    } else {
      const brand = await this.brandModel.findByPk(userId);
      if (!brand) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
      return brand;
    }
  }

  /**
   * Refresh Instagram access token for a user
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Updated user instance
   */
  async refreshUserInstagramToken(
    userId: number,
    userType: UserType,
  ): Promise<Influencer | Brand> {
    // Get user and current token
    let user: Influencer | Brand | null;
    if (userType === 'influencer') {
      user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
    } else {
      user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
    }

    if (!user.instagramAccessToken) {
      throw new BadRequestException('No Instagram account connected');
    }

    // Refresh token
    const refreshResponse = await this.refreshAccessToken({
      access_token: user.instagramAccessToken,
    });

    // Calculate new expiry date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + refreshResponse.expires_in);

    // Update database
    await user.update({
      instagramAccessToken: refreshResponse.access_token,
      instagramTokenExpiresAt: expiresAt,
    });

    return user.reload();
  }

  /**
   * Sync Instagram profile data for a user
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Updated user instance with fresh Instagram data
   */
  async syncInstagramProfile(
    userId: number,
    userType: UserType,
  ): Promise<Influencer | Brand> {
    // Get user
    let user: Influencer | Brand | null;
    if (userType === 'influencer') {
      user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
    } else {
      user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
    }

    if (!user.instagramAccessToken) {
      throw new BadRequestException('No Instagram account connected');
    }

    // Fetch fresh profile data
    const profile = await this.getUserProfile(user.instagramAccessToken);

    // Update database with fresh data
    await user.update({
      instagramUsername: profile.username,
      instagramAccountType: profile.account_type || undefined,
      instagramFollowersCount: profile.followers_count || undefined,
      instagramFollowsCount: profile.follows_count || undefined,
      instagramMediaCount: profile.media_count || undefined,
      instagramProfilePictureUrl: profile.profile_picture_url || undefined,
      instagramBio: profile.biography || undefined,
    });

    return user.reload();
  }

  /**
   * Disconnect Instagram account from a user
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Updated user instance
   */
  async disconnectInstagramAccount(
    userId: number,
    userType: UserType,
  ): Promise<Influencer | Brand> {
    // Get user
    let user: Influencer | Brand | null;
    if (userType === 'influencer') {
      user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
    } else {
      user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
    }

    // Clear Instagram data
    await user.update({
      instagramAccessToken: undefined,
      instagramUserId: undefined,
      instagramUsername: undefined,
      instagramAccountType: undefined,
      instagramFollowersCount: undefined,
      instagramFollowsCount: undefined,
      instagramMediaCount: undefined,
      instagramProfilePictureUrl: undefined,
      instagramBio: undefined,
      instagramTokenExpiresAt: undefined,
      instagramConnectedAt: undefined,
      instagramAccessTokenHash: undefined,
    });

    return user.reload();
  }

  /**
   * Handle Instagram API errors
   * @param error - The error object
   * @param defaultMessage - Default error message
   */
  private handleInstagramError(error: any, defaultMessage: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as any;

      const errorMessage = errorData?.error?.message ||
                          errorData?.error_message ||
                          errorData?.message ||
                          defaultMessage;

      const errorType = errorData?.error?.type ||
                       errorData?.error ||
                       'instagram_api_error';

      throw new BadRequestException({
        error: errorType,
        message: errorMessage,
        details: errorData,
      });
    }

    throw new InternalServerErrorException({
      error: 'internal_server_error',
      message: defaultMessage,
      details: error.message,
    });
  }

  /**
   * Connect Instagram Business account using Facebook access token (Graph API)
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param facebookAccessToken - Facebook access token from OAuth
   * @returns User instance with updated Instagram data
   */
  async connectWithFacebookToken(
    userId: number,
    userType: UserType,
    facebookAccessToken: string,
  ): Promise<Influencer | Brand> {
    try {
      // Step 1: Get Facebook Pages
      const pagesResponse = await axios.get(
        'https://graph.facebook.com/v18.0/me/accounts',
        {
          params: {
            fields: 'id,name,access_token,instagram_business_account',
            access_token: facebookAccessToken,
          },
        }
      );

      if (!pagesResponse.data.data || pagesResponse.data.data.length === 0) {
        throw new BadRequestException('No Facebook Pages found. Please create a Facebook Page and connect your Instagram Business account to it.');
      }

      // Step 2: Find page with Instagram Business Account
      const pageWithIG = pagesResponse.data.data.find(
        (page: any) => page.instagram_business_account
      );

      if (!pageWithIG) {
        throw new BadRequestException('No Instagram Business Account found. Please connect your Instagram Business account to a Facebook Page.');
      }

      const instagramAccountId = pageWithIG.instagram_business_account.id;
      const pageAccessToken = pageWithIG.access_token;

      // Step 3: Get Instagram profile data
      const fields = 'id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url';
      const profileResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${instagramAccountId}`,
        {
          params: {
            fields,
            access_token: pageAccessToken,
          },
        }
      );

      const profile = profileResponse.data;

      // Step 4: Token expires in 60 days for long-lived tokens
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 59);

      // Step 5: Save to database
      const updateData = {
        instagramAccessToken: pageAccessToken, // Use page access token for API calls
        instagramUserId: profile.id,
        instagramUsername: profile.username,
        instagramAccountType: 'BUSINESS', // Graph API only works with business accounts
        instagramFollowersCount: profile.followers_count || undefined,
        instagramFollowsCount: profile.follows_count || undefined,
        instagramMediaCount: profile.media_count || undefined,
        instagramProfilePictureUrl: profile.profile_picture_url || undefined,
        instagramBio: profile.biography || undefined,
        instagramTokenExpiresAt: expiresAt,
        instagramConnectedAt: new Date(),
      };

      if (userType === 'influencer') {
        const influencer = await this.influencerModel.findByPk(userId);
        if (!influencer) {
          throw new NotFoundException(`Influencer with ID ${userId} not found`);
        }
        await influencer.update(updateData);
        return influencer.reload();
      } else {
        const brand = await this.brandModel.findByPk(userId);
        if (!brand) {
          throw new NotFoundException(`Brand with ID ${userId} not found`);
        }
        await brand.update(updateData);
        return brand.reload();
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleInstagramError(error, 'Failed to connect Instagram account with Facebook token');
      }
      throw error;
    }
  }

  /**
   * Get Instagram media/posts for a user
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param limit - Number of posts to fetch (default: 25)
   * @returns List of media items
   */
  async getInstagramMedia(
    userId: number,
    userType: UserType,
    limit: number = 25,
  ): Promise<any> {
    // Get user
    let user: Influencer | Brand | null;
    if (userType === 'influencer') {
      user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
    } else {
      user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
    }

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    try {
      // Media endpoints use graph.instagram.com
      const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
      const response = await axios.get(
        `https://graph.instagram.com/${user.instagramUserId}/media`,
        {
          params: {
            fields,
            limit,
            access_token: user.instagramAccessToken,
          },
        }
      );

      return response.data;
    } catch (error) {
      this.handleInstagramError(error, 'Failed to fetch Instagram media');
    }
  }

  /**
   * Get insights for a specific Instagram post
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param mediaId - Instagram media ID
   * @returns Post insights
   */
  async getMediaInsights(
    userId: number,
    userType: UserType,
    mediaId: string,
  ): Promise<any> {
    // Get user
    let user: Influencer | Brand | null;
    if (userType === 'influencer') {
      user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
    } else {
      user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
    }

    if (!user.instagramAccessToken) {
      throw new BadRequestException('No Instagram account connected');
    }

    try {
      // Step 1: Fetch media details to determine media type
      const mediaResponse = await axios.get(
        `https://graph.instagram.com/v24.0/${mediaId}`,
        {
          params: {
            fields: 'id,media_type,media_product_type',
            access_token: user.instagramAccessToken,
          },
        }
      );

      const mediaType = mediaResponse.data.media_type;
      const mediaProductType = mediaResponse.data.media_product_type;

      // Step 2: Select appropriate metrics based on media type
      let metrics: string;

      if (mediaProductType === 'REELS' || mediaType === 'REELS') {
        // Metrics for Reels
        metrics = 'plays,reach,total_interactions,saved,shares,comments,likes';
      } else if (mediaType === 'VIDEO') {
        // Metrics for regular videos (not reels)
        metrics = 'reach,saved,plays,likes,comments,shares';
      } else if (mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM') {
        // Metrics for images and carousels (impressions not supported for FEED posts)
        metrics = 'reach,saved,likes,comments,shares';
      } else {
        // Default fallback metrics
        metrics = 'reach,saved,shares';
      }

      // Step 3: Fetch insights with appropriate metrics
      // Use Instagram Graph API v24.0 for better compatibility
      const response = await axios.get(
        `https://graph.instagram.com/v24.0/${mediaId}/insights`,
        {
          params: {
            metric: metrics,
            access_token: user.instagramAccessToken,
          },
        }
      );

      // Step 4: Save/update the post in instagram_media table
      const [instagramMediaRecord] = await this.instagramMediaModel.findOrCreate({
        where: { mediaId },
        defaults: {
          influencerId: userType === 'influencer' ? userId : undefined,
          brandId: userType === 'brand' ? userId : undefined,
          mediaId,
          mediaType,
          mediaProductType,
          firstFetchedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });

      // Update last synced time if record already existed
      if (instagramMediaRecord) {
        await instagramMediaRecord.update({
          lastSyncedAt: new Date(),
          mediaType,
          mediaProductType,
        });
      }

      // Step 5: Store insights in database linked to the post
      const insightsData: any = {};
      response.data.data.forEach((metric: any) => {
        const value = metric.values[0]?.value;
        if (value !== undefined) {
          if (metric.name === 'reach') insightsData.reach = value;
          if (metric.name === 'saved') insightsData.saved = value;
          if (metric.name === 'likes') insightsData.likes = value;
          if (metric.name === 'comments') insightsData.comments = value;
          if (metric.name === 'plays') insightsData.plays = value;
          if (metric.name === 'shares') insightsData.shares = value;
          if (metric.name === 'total_interactions') insightsData.totalInteractions = value;
        }
      });

      // Use upsert to update if exists today, or insert if new
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Build where clause conditionally
      const whereClause: any = {
        mediaId,
        fetchedAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      };

      if (userType === 'influencer') { 
        whereClause.influencerId = userId;
      } else {
        whereClause.brandId = userId;
      }

      // Try to find today's insight record
      const existingInsight = await this.instagramMediaInsightModel.findOne({
        where: whereClause,
      });

      if (existingInsight) {
        // Update existing record with latest insights
        await existingInsight.update({
          ...insightsData,
          fetchedAt: new Date(),
        });
      } else {
        // Create new record for today
        await this.instagramMediaInsightModel.create({
          influencerId: userType === 'influencer' ? userId : null,
          brandId: userType === 'brand' ? userId : null,
          instagramMediaId: instagramMediaRecord.id,
          mediaId,
          mediaType,
          mediaProductType,
          ...insightsData,
          fetchedAt: new Date(),
        });
      }

      return {
        ...response.data,
        media_type: mediaType,
        media_product_type: mediaProductType,
      };
    } catch (error) {
      // Log the actual error for debugging
      console.error('❌ Error in getMediaInsights:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      // Enhanced error handling for permission issues
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const errorData = axiosError.response?.data as any;

        if (errorData?.error?.message?.includes('permission')) {
          throw new BadRequestException({
            error: 'instagram_permission_error',
            message: 'Instagram app does not have permission to access insights. Please ensure: 1) The Instagram account is a Business or Creator account, 2) Your app has instagram_manage_insights permission, 3) The permission is approved by Meta for production use.',
            details: errorData,
            requiredPermissions: ['instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'],
          });
        }
      }

      this.handleInstagramError(error, 'Failed to fetch media insights');
    }
  }

  /**
   * Get stored media insights from database with post data
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param mediaId - Optional media ID to filter by
   * @param limit - Number of records to return (default: 100)
   * @returns Stored insights with post data
   */
  async getStoredMediaInsights(
    userId: number,
    userType: UserType,
    mediaId?: string,
    limit: number = 100,
  ): Promise<any> {
    const whereClause: any = {};

    if (userType === 'influencer') {
      whereClause.influencerId = userId;
    } else {
      whereClause.brandId = userId;
    }

    if (mediaId) {
      whereClause.mediaId = mediaId;
    }

    const insights = await this.instagramMediaInsightModel.findAll({
      where: whereClause,
      include: [
        {
          model: this.instagramMediaModel,
          as: 'instagramMedia',
          required: false,
        },
      ],
      limit,
      order: [['fetchedAt', 'DESC']],
    });

    return {
      count: insights.length,
      data: insights,
    };
  }

  /**
   * Check if user's Instagram account has insights permissions
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Permission check results
   */
  async checkInsightsPermissions(
    userId: number,
    userType: UserType,
  ): Promise<any> {
    // Get user
    let user: Influencer | Brand | null;
    if (userType === 'influencer') {
      user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
    } else {
      user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
    }

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    try {
      // Check account type
      const profileResponse = await axios.get(
        `https://graph.instagram.com/${user.instagramUserId}`,
        {
          params: {
            fields: 'id,username,account_type',
            access_token: user.instagramAccessToken,
          },
        }
      );

      const accountType = profileResponse.data.account_type;
      const isBusinessOrCreator = accountType === 'BUSINESS' || accountType === 'CREATOR';

      return {
        hasInsightsAccess: isBusinessOrCreator,
        accountType: accountType,
        username: profileResponse.data.username,
        message: isBusinessOrCreator
          ? 'Account has Business/Creator access and can request insights'
          : 'Account must be converted to Business or Creator account to access insights',
        requiredPermissions: [
          'instagram_basic',
          'instagram_manage_insights',
          'pages_show_list',
          'pages_read_engagement',
        ],
      };
    } catch (error) {
      this.handleInstagramError(error, 'Failed to check insights permissions');
    }
  }

}
