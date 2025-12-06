import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
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
}
