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
import { InstagramProfileAnalysis } from '../models/instagram-profile-analysis.model';
import { InstagramProfileGrowth } from '../models/instagram-profile-growth.model';
import { GeminiAIService } from './gemini-ai.service';
import { CampusAmbassadorService } from './campus-ambassador.service';
import { InstagramSyncGateway } from '../instagram-sync.gateway';
import { InfluencerReferralUsage } from '../../auth/model/influencer-referral-usage.model';
import { CreditTransaction, CreditTransactionType, PaymentStatus } from '../../admin/models/credit-transaction.model';
import { ProfileReview, ReviewStatus, ProfileType } from '../../admin/models/profile-review.model';

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
    @InjectModel(InstagramProfileAnalysis)
    private instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    @InjectModel(InstagramProfileGrowth)
    private instagramProfileGrowthModel: typeof InstagramProfileGrowth,
    @InjectModel(InfluencerReferralUsage)
    private influencerReferralUsageModel: typeof InfluencerReferralUsage,
    @InjectModel(CreditTransaction)
    private creditTransactionModel: typeof CreditTransaction,
    @InjectModel(ProfileReview)
    private profileReviewModel: typeof ProfileReview,
    private geminiAIService: GeminiAIService,
    private campusAmbassadorService: CampusAmbassadorService,
    private instagramSyncGateway: InstagramSyncGateway,
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
      console.log('Instagram OAuth Exchange - Starting:', {
        client_id: this.clientId,
        has_client_secret: !!this.clientSecret,
        redirect_uri,
        code_length: code?.length,
        code_preview: code?.substring(0, 20) + '...',
      });

      // Step 1: Exchange code for short-lived token
      console.log('Step 1: Exchanging authorization code for short-lived token...');
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
      console.log('Step 1: Success - Received short-lived token for user:', userId);

      // Step 2: Exchange short-lived token for long-lived token
      console.log('Step 2: Exchanging short-lived token for long-lived token...');
      const longTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.clientSecret,
          access_token: shortToken,
        },
      });

      const longToken = longTokenResponse.data.access_token;
      const expiresIn = longTokenResponse.data.expires_in;
      console.log('Step 2: Success - Received long-lived token, expires in:', expiresIn, 'seconds');

      return {
        access_token: longToken,
        user_id: userId,
        expires_in: expiresIn,
      };
    } catch (error) {
      console.error('Token exchange failed at some step - see detailed error below');
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

    // Step 1.5: Validate account eligibility - check all conditions and return detailed response
    const mediaCountValid = profile.media_count && profile.media_count >= 5;
    const followersValid = profile.followers_count && profile.followers_count >= 100;
    const accountTypeValid = profile.account_type === 'MEDIA_CREATOR' || profile.account_type === 'BUSINESS';

    // If any validation fails, throw error with all validation details
    if (!mediaCountValid || !followersValid || !accountTypeValid) {
      throw new BadRequestException({
        error: 'account_not_eligible',
        message: 'Your Instagram account does not meet the requirements to connect',
        validationDetails: {
          mediaCount: {
            valid: mediaCountValid,
            current: profile.media_count || 0,
            required: 5,
            message: mediaCountValid ? 'Sufficient posts' : 'Your account must have at least 5 posts',
          },
          followers: {
            valid: followersValid,
            current: profile.followers_count || 0,
            required: 100,
            message: followersValid ? 'Sufficient followers' : 'Your account must have at least 100 followers',
          },
          accountType: {
            valid: accountTypeValid,
            current: profile.account_type || 'PERSONAL',
            required: ['MEDIA_CREATOR', 'BUSINESS'],
            message: accountTypeValid ? 'Valid account type' : 'Your account must be a Creator or Business account. Please switch your account type in Instagram settings.',
          },
        },
      });
    }

    // Step 2: Check if this Instagram account is already connected to another user
    const existingInfluencer = await this.influencerModel.findOne({
      where: {
        instagramUserId: profile.id,
        id: { [Op.ne]: userType === 'influencer' ? userId : -1 }, // Exclude current user
      },
    });

    const existingBrand = await this.brandModel.findOne({
      where: {
        instagramUserId: profile.id,
        id: { [Op.ne]: userType === 'brand' ? userId : -1 }, // Exclude current user
      },
    });

    // if (existingInfluencer) {
    //   throw new BadRequestException({
    //     error: 'instagram_account_already_connected',
    //     message: `@${profile.username} is already connected to another account`,
    //     instagramUsername: profile.username,
    //     connectedTo: 'influencer',
    //   });
    // }

    // if (existingBrand) {
    //   throw new BadRequestException({
    //     error: 'instagram_account_already_connected',
    //     message: `@${profile.username} is already connected to another account`,
    //     instagramUsername: profile.username,
    //     connectedTo: 'brand',
    //   });
    // }

    // Step 3: Long-lived tokens typically expire in 60 days
    // We'll set a conservative expiry of 59 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 59);

    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId);
      if (!influencer) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }

      // Step 4: Save to database
      const updateData: any = {
        instagramAccessToken: accessToken,
        instagramUserId: profile.id,
        instagramUsername: profile.username,
        instagramAccountType: profile.account_type || undefined,
        instagramFollowersCount: profile.followers_count || undefined,
        instagramFollowsCount: profile.follows_count || undefined,
        instagramMediaCount: profile.media_count || undefined,
        instagramProfilePictureUrl: profile.profile_picture_url || undefined,
        instagramBio: profile.biography || undefined,
        instagramIsVerified: true, // Set to true when Instagram is connected
        instagramTokenExpiresAt: expiresAt,
        instagramConnectedAt: new Date(),
        isVerified: true, // Automatically verify Instagram-connected influencers
        verifiedAt: new Date(), // Set verification timestamp when Instagram is connected
      };

      await influencer.update(updateData);

      // Auto-approve any pending profile review since Instagram connection verifies the influencer
      try {
        const pendingReview = await this.profileReviewModel.findOne({
          where: {
            profileId: influencer.id,
            profileType: ProfileType.INFLUENCER,
            status: ReviewStatus.PENDING,
          },
        });
        if (pendingReview) {
          await pendingReview.update({
            status: ReviewStatus.APPROVED,
            reviewedAt: new Date(),
            adminComments: 'Auto-approved via Instagram connection',
          });
        }
      } catch (error) {
        console.error('Failed to auto-approve profile review on Instagram connect:', error);
        // Don't throw - allow Instagram connection to succeed
      }

      // Track campus ambassador verified signup
      // Wrap in try-catch to prevent Instagram connection failure if tracking fails
      try {
        if (influencer.campusAmbassadorId) {
          await this.campusAmbassadorService.incrementVerifiedSignups(influencer.campusAmbassadorId);
          console.log(
            `✅ CAMPUS AMBASSADOR VERIFIED SIGNUP TRACKED (Instagram Connect) ✅`,
          );
          console.log(
            `├─ Campus Ambassador ID: ${influencer.campusAmbassadorId}`,
          );
          console.log(
            `├─ Verified Influencer ID: ${influencer.id} (${influencer.name})`,
          );
          console.log(
            `└─ Timestamp: ${new Date().toISOString()}`,
          );
        }
      } catch (error) {
        console.error(
          'Failed to track campus ambassador verified signup for influencer:',
          influencer.id,
          error,
        );
        // Don't throw - allow Instagram connection to succeed even if tracking fails
      }

      // Award referral credit if this influencer was referred by someone
      // Wrap in try-catch to prevent Instagram connection failure if referral fails
      try {
        const referralUsage = await this.influencerReferralUsageModel.findOne({
          where: {
            referredUserId: influencer.id,
            creditAwarded: false,
          },
        });

        if (referralUsage) {
          // Update the referral usage record
          await referralUsage.update({
            creditAwarded: true,
            creditAwardedAt: new Date(),
          });

          // Get the referrer influencer
          const referrer = await this.influencerModel.findByPk(
            referralUsage.influencerId,
          );

          if (referrer) {
            // Update referrer's credits (₹25 per referral)
            const currentCredits = referrer.referralCredits || 0;
            const creditAmount = 25;
            const newCredits = currentCredits + creditAmount;

            await this.influencerModel.update(
              { referralCredits: newCredits },
              { where: { id: referrer.id } },
            );

            // Log credit transaction for admin records
            await this.creditTransactionModel.create({
              influencerId: referrer.id,
              transactionType: CreditTransactionType.REFERRAL_BONUS,
              amount: creditAmount,
              paymentStatus: PaymentStatus.PENDING,
              description: `Referral bonus for referring ${influencer.name} (ID ${influencer.id})`,
              referredUserId: influencer.id,
              upiId: referrer.upiId || null,
            });

            console.log(
              `✅ REFERRAL CREDIT AWARDED (Instagram Connect) ✅`,
            );
            console.log(
              `├─ Referrer ID: ${referrer.id} (${referrer.name})`,
            );
            console.log(
              `├─ Referee ID: ${influencer.id} (${influencer.name})`,
            );
            console.log(
              `├─ Amount Earned: Rs ${creditAmount}`,
            );
            console.log(
              `├─ Total Credits Now: Rs ${newCredits}`,
            );
            console.log(
              `└─ Timestamp: ${new Date().toISOString()}`,
            );
          }
        }
      } catch (error) {
        console.error(
          'Failed to award referral credit for influencer:',
          influencer.id,
          error,
        );
        // Don't throw - allow Instagram connection to succeed even if referral credit fails
      }

      return influencer.reload();
    } else {
      const brand = await this.brandModel.findByPk(userId);
      if (!brand) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }

      // Step 4: Save to database
      const updateData: any = {
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

    // Check if last sync was less than 15 days ago (only for influencers)
    if (userType === 'influencer') {
      const latestAnalysis = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: userId },
        order: [['syncDate', 'DESC']],
      });

      if (latestAnalysis && latestAnalysis.syncDate) {
        const now = new Date();
        const lastSync = new Date(latestAnalysis.syncDate);
        const diffInMs = now.getTime() - lastSync.getTime();
        const daysSinceLastSync = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (daysSinceLastSync < 15) {
          const daysRemaining = 15 - daysSinceLastSync;
          const nextSyncDate = new Date(lastSync.getTime() + (15 * 24 * 60 * 60 * 1000));

          throw new BadRequestException({
            error: 'sync_throttled',
            message: `Instagram profile sync is limited to once every 15 days. Please wait ${daysRemaining} more day(s).`,
            details: {
              lastSyncDate: lastSync.toISOString(),
              nextAllowedSyncDate: nextSyncDate.toISOString(),
              daysSinceLastSync,
              daysRemaining,
            },
          });
        }
      }
    }

    // Fetch fresh profile data
    const profile = await this.getUserProfile(user.instagramAccessToken);

    // Update database with fresh data
    const updateData: any = {
      instagramUsername: profile.username,
      instagramAccountType: profile.account_type || undefined,
      instagramFollowersCount: profile.followers_count || undefined,
      instagramFollowsCount: profile.follows_count || undefined,
      instagramMediaCount: profile.media_count || undefined,
      instagramProfilePictureUrl: profile.profile_picture_url || undefined,
      instagramBio: profile.biography || undefined,
    };

    // Don't update instagramIsVerified during sync - it was set during initial connection
    // instagramIsVerified means "verified via Instagram connection on our platform"

    await user.update(updateData);

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

      // Enhanced logging for debugging
      console.error('Instagram API Error:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        errorData,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
      });

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

    // Log non-Axios errors
    console.error('Non-Axios Error in Instagram Service:', {
      message: error?.message,
      stack: error?.stack,
      defaultMessage,
    });

    throw new InternalServerErrorException({
      error: 'internal_server_error',
      message: defaultMessage,
      details: error.message,
    });
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
    mediaData?: any, // Optional: full media data from getInstagramMedia()
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

    // Check if account is Business or Creator account
    // Instagram API returns: BUSINESS, MEDIA_CREATOR, or PERSONAL
    const validAccountTypes = ['BUSINESS', 'MEDIA_CREATOR', 'CREATOR'];
    if (!user.instagramAccountType || !validAccountTypes.includes(user.instagramAccountType)) {
      throw new BadRequestException({
        error: 'invalid_account_type',
        message: 'Instagram insights are only available for Business or Creator accounts. Please convert your Instagram account to a Professional account.',
        details: {
          currentAccountType: user.instagramAccountType || 'PERSONAL',
          requiredAccountTypes: validAccountTypes,
          instructions: 'To convert your account: 1) Go to Instagram app Settings, 2) Tap "Account", 3) Tap "Switch to Professional Account", 4) Choose Business or Creator account type',
        },
      });
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

      // NOTE: Instagram's plays metric is inconsistently supported across different media types
      // Even for Reels with product_type="REELS", plays often fails with permission errors
      // So we exclude it entirely and use only reliably supported metrics
      if (mediaProductType === 'REELS' || mediaProductType === 'CLIPS' || mediaType === 'REELS' || mediaType === 'VIDEO') {
        // Metrics for videos and Reels (using updated Instagram API metric names)
        // Note: Instagram deprecated total_video_views, avg_time_watched, total_video_view_total_time
        // Replaced with: ig_reels_aggregated_all_plays_count, ig_reels_avg_watch_time, ig_reels_video_view_total_time
        metrics = 'reach,total_interactions,saved,shares,comments,likes,ig_reels_aggregated_all_plays_count,ig_reels_avg_watch_time,ig_reels_video_view_total_time,clips_replays_count';
      } else if (mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM') {
        // Metrics for images and carousels
        metrics = 'reach,saved,likes,comments,shares';
      } else {
        // Default fallback metrics
        metrics = 'reach,saved,shares';
      }

      // Step 3: Fetch insights with appropriate metrics
      // Use Instagram Graph API v24.0 for better compatibility
      let response;
      try {
        response = await axios.get(
          `https://graph.instagram.com/v24.0/${mediaId}/insights`,
          {
            params: {
              metric: metrics,
              access_token: user.instagramAccessToken,
            },
          }
        );
      } catch (error) {
        // Fallback: If reel metrics fail, retry with basic metrics only
        if (error.response?.status === 400 &&
            (metrics.includes('ig_reels') || metrics.includes('clips_replays_count'))) {
          console.warn(`⚠️  Reel metrics not supported for media ${mediaId}, retrying with basic metrics...`);
          metrics = 'reach,saved,likes,comments,shares';
          response = await axios.get(
            `https://graph.instagram.com/v24.0/${mediaId}/insights`,
            {
              params: {
                metric: metrics,
                access_token: user.instagramAccessToken,
              },
            }
          );
        } else {
          throw error;
        }
      }

      // Step 4: Save/update the post in instagram_media table
      // Use media_url if available, otherwise fallback to thumbnail_url for Reels/Videos
      const resolvedMediaUrl = mediaData?.media_url || mediaData?.thumbnail_url || undefined;

      // Build where clause to find media for specific user (not just by mediaId)
      const whereClause: any = { mediaId };
      if (userType === 'influencer') {
        whereClause.influencerId = userId;
      } else {
        whereClause.brandId = userId;
      }

      const [instagramMediaRecord, created] = await this.instagramMediaModel.findOrCreate({
        where: whereClause,
        defaults: {
          influencerId: userType === 'influencer' ? userId : undefined,
          brandId: userType === 'brand' ? userId : undefined,
          mediaId,
          mediaType,
          mediaProductType,
          // Save caption, timestamp, and URLs if provided in mediaData
          caption: mediaData?.caption || undefined,
          timestamp: mediaData?.timestamp ? new Date(mediaData.timestamp) : undefined,
          mediaUrl: resolvedMediaUrl,
          thumbnailUrl: mediaData?.thumbnail_url || undefined,
          permalink: mediaData?.permalink || undefined,
          firstFetchedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });

      // Update existing record with latest data
      if (!created) {
        const updatedMediaUrl = mediaData?.media_url || mediaData?.thumbnail_url || instagramMediaRecord.mediaUrl;

        await instagramMediaRecord.update({
          lastSyncedAt: new Date(),
          mediaType,
          mediaProductType,
          // Update caption, timestamp, and URLs if provided
          caption: mediaData?.caption || instagramMediaRecord.caption,
          timestamp: mediaData?.timestamp ? new Date(mediaData.timestamp) : instagramMediaRecord.timestamp,
          mediaUrl: updatedMediaUrl,
          thumbnailUrl: mediaData?.thumbnail_url || instagramMediaRecord.thumbnailUrl,
          permalink: mediaData?.permalink || instagramMediaRecord.permalink,
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
          // Handle both old and new Instagram API metric names
          if (metric.name === 'total_video_views' || metric.name === 'ig_reels_aggregated_all_plays_count') insightsData.totalVideoViews = value;
          if (metric.name === 'total_video_complete_views') insightsData.totalVideoCompleteViews = value;
          if (metric.name === 'avg_time_watched' || metric.name === 'ig_reels_avg_watch_time') insightsData.avgTimeWatched = value;
          if (metric.name === 'total_video_view_total_time' || metric.name === 'ig_reels_video_view_total_time') insightsData.totalVideoViewTotalTime = value;
          if (metric.name === 'clips_replays_count') insightsData.clipsReplaysCount = value;
        }
      });

      // Use upsert to update if exists today, or insert if new
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Build where clause conditionally for insights
      const insightWhereClause: any = {
        mediaId,
        fetchedAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      };

      if (userType === 'influencer') {
        insightWhereClause.influencerId = userId;
      } else {
        insightWhereClause.brandId = userId;
      }

      // Try to find today's insight record
      const existingInsight = await this.instagramMediaInsightModel.findOne({
        where: insightWhereClause,
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
      // Enhanced error handling
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const errorData = axiosError.response?.data as any;
        const wwwAuthHeader = axiosError.response?.headers?.['www-authenticate'] || '';

        // Check for "media posted before business account conversion" error
        if (
          axiosError.response?.status === 400 &&
          wwwAuthHeader.includes('posted before the most recent time')
        ) {
          // This is an expected error - media was posted before account became business account
          // Instagram API cannot provide insights for such media
          throw new BadRequestException({
            error: 'media_posted_before_business_conversion',
            message: 'This media was posted before the Instagram account was converted to a business account. Insights are only available for media posted after the conversion.',
            mediaId,
          });
        }

        // Check for permission issues or account type errors
        if (errorData?.error?.message?.includes('permission') ||
            errorData?.error?.message?.includes('Unsupported get request') ||
            errorData?.error?.message?.includes('Instagram Business Account')) {

          // Log account type for debugging
          console.log(`⚠️ Insights permission error for media ${mediaId}. Account type: ${user.instagramAccountType}`);
          console.log(`Error details: ${errorData?.error?.message}`);

          // If account is already a professional account (BUSINESS, CREATOR, or MEDIA_CREATOR),
          // treat this as a "posted before conversion" error (skip gracefully)
          const isProfessionalAccount = ['BUSINESS', 'CREATOR', 'MEDIA_CREATOR'].includes(user.instagramAccountType?.toUpperCase());

          if (isProfessionalAccount) {
            // This is likely an old post from before conversion - treat as skippable
            throw new BadRequestException({
              error: 'media_posted_before_business_conversion',
              message: 'This media was posted before the Instagram account was converted to a professional account. Insights are only available for media posted after the conversion.',
              mediaId,
            });
          }

          // Account is not professional - this is a real access error
          throw new BadRequestException({
            error: 'instagram_insights_unavailable',
            message: 'Instagram insights are not available. Please ensure your Instagram account is a Business, Creator, or Media Creator account (not Personal account).',
            details: {
              reason: errorData?.error?.message || 'Permission denied',
              accountType: user.instagramAccountType || 'Unknown',
              requiredAccountType: 'BUSINESS, CREATOR, or MEDIA_CREATOR (Professional Account)',
              instructions: 'To enable insights: 1) Open Instagram app, 2) Go to Settings → Account, 3) Switch to Professional Account, 4) Choose Business or Creator',
            },
            technicalDetails: errorData,
          });
        }
      }

      // Log the actual error for debugging (only for unexpected errors)
      console.error('❌ Error in getMediaInsights:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      this.handleInstagramError(error, 'Failed to fetch media insights');
    }
  }

  /**
   * Bulk sync all media insights with progressive growth tracking
   * Fetches all media posts and their insights from Instagram, creates new snapshot, and compares with last snapshot
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param limit - Number of posts to fetch (default: 50, max: 100)
   * @returns Summary of sync operation with snapshots and growth comparison
   */
  async syncAllMediaInsights(
    userId: number,
    userType: UserType,
    limit: number = 50,
    jobId?: string,
  ): Promise<any> {
    console.log(`🔄 Starting bulk media insights sync with progressive growth tracking for ${userType} ${userId}...`);

    // Generate jobId if not provided (for backward compatibility)
    const actualJobId = jobId || `sync-${userId}-${Date.now()}`;

    const syncedAt = new Date();

    // Emit 0% - Starting sync
    if (jobId) {
      this.instagramSyncGateway.emitSyncProgress(
        userId,
        userType,
        actualJobId,
        0,
        'Starting Instagram media sync...'
      );
    }

    console.log(`\n${'#'.repeat(100)}`);
    console.log(`${'#'.repeat(100)}`);
    console.log(`##${' '.repeat(96)}##`);
    console.log(`##  🚀 STARTING MEDIA INSIGHTS SYNC WITH PROGRESSIVE GROWTH TRACKING${' '.repeat(29)}##`);
    console.log(`##${' '.repeat(96)}##`);
    console.log(`${'#'.repeat(100)}`);
    console.log(`${'#'.repeat(100)}\n`);
    console.log(`👤 User: ${userType} ID ${userId}`);
    console.log(`⏰ Sync started at: ${syncedAt.toISOString()}\n`);

    try {
      // STEP 1: Check for existing snapshots and determine if sync is allowed
      console.log(`📂 STEP 1: Checking for existing snapshots...`);

      // Emit 5% - Checking throttle
      if (jobId) {
        this.instagramSyncGateway.emitSyncProgress(
          userId,
          userType,
          actualJobId,
          5,
          'Checking last sync date...'
        );
      }
      const lastSnapshot = await this.instagramProfileAnalysisModel.findOne({
        where: userType === 'influencer'
          ? { influencerId: userId }
          : { brandId: userId },
        order: [['analysisPeriodEnd', 'DESC']],
      });

      if (lastSnapshot) {
        console.log(`   ✅ Found last snapshot: ID ${lastSnapshot.id}, Sync #${lastSnapshot.syncNumber}`);
        console.log(`   📅 Last snapshot period: ${new Date(lastSnapshot.analysisPeriodStart).toISOString().split('T')[0]} to ${new Date(lastSnapshot.analysisPeriodEnd).toISOString().split('T')[0]}`);
      } else {
        console.log(`   ℹ️  No previous snapshots found - this will be the initial sync`);
      }

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Determine date ranges based on last snapshot
      let newSnapshotStart: Date;
      let newSnapshotEnd: Date;
      let syncNumber: number;
      let isInitialSnapshot = false;

      console.log(`\n⏱️  STEP 2: Calculating snapshot date ranges...`);
      if (lastSnapshot && lastSnapshot.analysisPeriodEnd) {
        // Check if 15 days have passed since last snapshot
        const lastSnapshotEnd = new Date(lastSnapshot.analysisPeriodEnd);
        const daysSinceLastSnapshot = Math.floor((today.getTime() - lastSnapshotEnd.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`   📆 Days since last snapshot: ${daysSinceLastSnapshot}`);

        if (daysSinceLastSnapshot < 15) {
          const daysRemaining = 15 - daysSinceLastSnapshot;
          const nextSyncDate = new Date(lastSnapshotEnd.getTime() + (15 * 24 * 60 * 60 * 1000));

          console.log(`   ❌ THROTTLED: Only ${daysSinceLastSnapshot} days passed, need to wait ${daysRemaining} more days`);
          console.log(`   ⏰ Next allowed sync: ${nextSyncDate.toISOString().split('T')[0]}\n`);

          throw new BadRequestException({
            error: 'sync_throttled',
            message: `Instagram profile sync is limited to once every 15 days. Please wait ${daysRemaining} more day(s).`,
            details: {
              lastSnapshotDate: lastSnapshotEnd.toISOString().split('T')[0],
              nextAllowedSyncDate: nextSyncDate.toISOString().split('T')[0],
              daysSinceLastSnapshot,
              daysRemaining,
            },
          });
        }

        // Create new snapshot from last snapshot end + 1 day to today
        newSnapshotStart = new Date(lastSnapshotEnd);
        newSnapshotStart.setDate(newSnapshotStart.getDate() + 1);
        newSnapshotStart.setHours(0, 0, 0, 0);
        newSnapshotEnd = new Date(today);
        syncNumber = (lastSnapshot.syncNumber || 0) + 1;

        const daysCovered = Math.ceil((newSnapshotEnd.getTime() - newSnapshotStart.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ✅ Throttle check passed! Proceeding with sync...`);
        console.log(`   🆕 Creating PROGRESSIVE snapshot #${syncNumber}`);
        console.log(`   📅 New snapshot period: ${newSnapshotStart.toISOString().split('T')[0]} to ${newSnapshotEnd.toISOString().split('T')[0]}`);
        console.log(`   ⏱️  Days covered: ${daysCovered} days (${daysSinceLastSnapshot} days since last snapshot)\n`);
      } else {
        // No previous snapshot - create TWO initial snapshots for growth comparison
        isInitialSnapshot = true;
        syncNumber = 2; // We'll create snapshots 1 and 2

        console.log(`   🆕 INITIAL CONNECT: Creating 2 snapshots for immediate growth comparison`);
        console.log(`   📅 Snapshot 1: 60-30 days ago (for baseline)`);
        console.log(`   📅 Snapshot 2: Last 30 days (current performance)\n`);
      }

      // STEP 3: Fetch all media from Instagram API
      console.log(`📥 STEP 3: Fetching media posts from Instagram API (limit: ${limit})...`);

      // Emit 10% - Fetching media
      if (jobId) {
        this.instagramSyncGateway.emitSyncProgress(
          userId,
          userType,
          actualJobId,
          10,
          `Fetching your posts (limit: ${limit})...`
        );
      }

      const mediaResponse = await this.getInstagramMedia(userId, userType, limit);
      const mediaPosts = mediaResponse.data || [];

      console.log(`   ✅ Found ${mediaPosts.length} media posts from Instagram API\n`);

      if (mediaPosts.length === 0) {
        return {
          success: true,
          message: 'No media posts found',
          syncedAt: syncedAt.toISOString(),
          totalPosts: 0,
          synced: 0,
          failed: 0,
          errors: [],
        };
      }

      // STEP 4: Fetch and store insights for each post
      console.log(`🔍 STEP 4: Fetching insights for ${mediaPosts.length} media posts...`);
      const results = {
        totalPosts: mediaPosts.length,
        synced: 0,
        failed: 0,
        errors: [] as Array<{ mediaId: string; error: string }>,
      };

      for (let i = 0; i < mediaPosts.length; i++) {
        const post = mediaPosts[i];
        const mediaId = post.id;

        try {
          // Fetch and store insights for this specific post (pass full post data)
          await this.getMediaInsights(userId, userType, mediaId, post);
          results.synced++;
          console.log(`✅ Synced insights for media ${mediaId}`);

          // Emit progress every 5 posts or on the last post (15% to 85% range)
          if (jobId && (i % 5 === 0 || i === mediaPosts.length - 1)) {
            const progress = 15 + ((i + 1) / mediaPosts.length) * 70;
            this.instagramSyncGateway.emitSyncProgress(
              userId,
              userType,
              actualJobId,
              Math.floor(progress),
              `Processing post ${i + 1} of ${mediaPosts.length}...`
            );
          }

          // Rate limiting: wait 100ms between requests to avoid API throttling
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          // Check if this is the expected "media posted before business account conversion" error
          const isPreBusinessConversionError =
            error instanceof BadRequestException &&
            (error.getResponse() as any)?.error === 'media_posted_before_business_conversion';

          if (isPreBusinessConversionError) {
            // This is expected - skip counting as failed, just log info
            console.log(`ℹ️  Skipping media ${mediaId}: Posted before business account conversion`);
          } else {
            // This is an actual error we should track
            results.failed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push({ mediaId, error: errorMessage });
            console.log(`❌ Failed to sync media ${mediaId}: ${errorMessage}`);
          }
        }
      }

      console.log(`   ✅ Insights sync completed: ${results.synced} synced, ${results.failed} failed\n`);

      // Emit 90% - Creating snapshot
      if (jobId) {
        this.instagramSyncGateway.emitSyncProgress(
          userId,
          userType,
          actualJobId,
          90,
          'Creating performance snapshot...'
        );
      }

      // STEP 5: Create snapshot(s) from stored data
      console.log(`📊 STEP 5: Creating snapshot(s) from stored media insights...`);
      let snapshot1Data: any = null;
      let snapshot2Data: any = null;

      if (isInitialSnapshot) {
        // Initial connect: Create TWO snapshots
        console.log(`   🔄 Initial connect detected - creating 2 snapshots...\n`);

        // Snapshot 1: 60-30 days ago
        const snapshot1End = new Date(today);
        snapshot1End.setDate(snapshot1End.getDate() - 30);
        snapshot1End.setHours(23, 59, 59, 999);
        const snapshot1Start = new Date(snapshot1End);
        snapshot1Start.setDate(snapshot1Start.getDate() - 29);
        snapshot1Start.setHours(0, 0, 0, 0);

        // Snapshot 2: Last 30 days
        const snapshot2End = new Date(today);
        const snapshot2Start = new Date(today);
        snapshot2Start.setDate(snapshot2Start.getDate() - 30);
        snapshot2Start.setHours(0, 0, 0, 0);

        try {
          snapshot1Data = await this.fetchSnapshotForPeriod(userId, userType, snapshot1Start, snapshot1End, 1);
        } catch (error) {
          console.error('❌ Failed to create snapshot 1:', error.message);
          snapshot1Data = {
            error: 'Failed to create first snapshot',
            message: error.message,
          };
        }

        try {
          snapshot2Data = await this.fetchSnapshotForPeriod(userId, userType, snapshot2Start, snapshot2End, 2);
        } catch (error) {
          console.error('❌ Failed to create snapshot 2:', error.message);
          snapshot2Data = {
            error: 'Failed to create second snapshot',
            message: error.message,
          };
        }
      } else {
        // Progressive sync: Create ONE new snapshot
        // TypeScript: newSnapshotStart and newSnapshotEnd are guaranteed to be set
        // because isInitialSnapshot is false, meaning we went through the
        // lastSnapshot branch above where these are assigned
        try {
          snapshot2Data = await this.fetchSnapshotForPeriod(
            userId,
            userType,
            newSnapshotStart!,
            newSnapshotEnd!,
            syncNumber
          );
        } catch (error) {
          console.error('❌ Failed to create new snapshot:', error.message);
          throw new InternalServerErrorException({
            error: 'snapshot_creation_failed',
            message: 'Failed to create snapshot from media insights',
            details: error.message,
          });
        }
      }

      // Emit 95% - Calculating growth
      if (jobId) {
        this.instagramSyncGateway.emitSyncProgress(
          userId,
          userType,
          actualJobId,
          95,
          'Analyzing growth metrics...'
        );
      }

      // STEP 6: Calculate growth metrics
      console.log(`\n📈 STEP 6: Calculating growth metrics...`);
      let growthComparison: any = null;

      // Determine which snapshots to compare
      let previousSnapshot: any = null;
      let currentSnapshot: any = null;

      if (isInitialSnapshot) {
        // Initial: Compare snapshot1 vs snapshot2
        if (snapshot1Data?.metrics && snapshot2Data?.metrics) {
          previousSnapshot = snapshot1Data;
          currentSnapshot = snapshot2Data;
          console.log(`   📊 Comparing INITIAL snapshots: #1 vs #2...`);
        }
      } else {
        // Progressive: Compare last snapshot vs new snapshot
        if (lastSnapshot && snapshot2Data?.metrics) {
          previousSnapshot = {
            syncNumber: lastSnapshot.syncNumber,
            metrics: {
              totalFollowers: lastSnapshot.totalFollowers || 0,
              avgEngagementRate: Number(lastSnapshot.avgEngagementRate) || 0,
              avgReach: lastSnapshot.avgReach || 0,
              postsAnalyzed: lastSnapshot.postsAnalyzed || 0,
              activeFollowersPercentage: Number(lastSnapshot.activeFollowersPercentage) || 0,
            },
          };
          currentSnapshot = snapshot2Data;
          console.log(`   📊 Comparing snapshot #${lastSnapshot.syncNumber} vs snapshot #${syncNumber}...`);
        }
      }

      if (previousSnapshot && currentSnapshot) {
        const previous = previousSnapshot.metrics;
        const current = currentSnapshot.metrics;

        const calculateGrowth = (oldVal: number, newVal: number) => {
          if (oldVal === 0) return newVal > 0 ? 100 : 0;
          return Number((((newVal - oldVal) / oldVal) * 100).toFixed(2));
        };

        growthComparison = {
          followers: {
            previous: previous.totalFollowers,
            current: current.totalFollowers,
            change: current.totalFollowers - previous.totalFollowers,
            changePercentage: calculateGrowth(previous.totalFollowers, current.totalFollowers),
          },
          engagement: {
            previous: previous.avgEngagementRate,
            current: current.avgEngagementRate,
            change: Number((current.avgEngagementRate - previous.avgEngagementRate).toFixed(2)),
            changePercentage: calculateGrowth(previous.avgEngagementRate, current.avgEngagementRate),
          },
          reach: {
            previous: previous.avgReach,
            current: current.avgReach,
            change: current.avgReach - previous.avgReach,
            changePercentage: calculateGrowth(previous.avgReach, current.avgReach),
          },
          posts: {
            previous: previous.postsAnalyzed,
            current: current.postsAnalyzed,
            change: current.postsAnalyzed - previous.postsAnalyzed,
          },
          activeFollowers: {
            previous: previous.activeFollowersPercentage,
            current: current.activeFollowersPercentage,
            change: Number((current.activeFollowersPercentage - previous.activeFollowersPercentage).toFixed(2)),
          },
        };

        console.log(`\n   📊 GROWTH COMPARISON RESULTS:`);
        console.log(`   ${'─'.repeat(70)}`);
        console.log(`   📸 Snapshot:      #${previousSnapshot.syncNumber} → #${currentSnapshot.syncNumber}`);
        console.log(`   👥 Followers:     ${previous.totalFollowers} → ${current.totalFollowers} (${growthComparison.followers.change >= 0 ? '+' : ''}${growthComparison.followers.change}, ${growthComparison.followers.changePercentage >= 0 ? '+' : ''}${growthComparison.followers.changePercentage}%)`);
        console.log(`   💬 Engagement:    ${previous.avgEngagementRate}% → ${current.avgEngagementRate}% (${growthComparison.engagement.change >= 0 ? '+' : ''}${growthComparison.engagement.change}%, ${growthComparison.engagement.changePercentage >= 0 ? '+' : ''}${growthComparison.engagement.changePercentage}%)`);
        console.log(`   📡 Reach:         ${previous.avgReach} → ${current.avgReach} (${growthComparison.reach.change >= 0 ? '+' : ''}${growthComparison.reach.change}, ${growthComparison.reach.changePercentage >= 0 ? '+' : ''}${growthComparison.reach.changePercentage}%)`);
        console.log(`   📝 Posts:         ${previous.postsAnalyzed} → ${current.postsAnalyzed} (${growthComparison.posts.change >= 0 ? '+' : ''}${growthComparison.posts.change})`);
        console.log(`   ⚡ Active:        ${previous.activeFollowersPercentage}% → ${current.activeFollowersPercentage}% (${growthComparison.activeFollowers.change >= 0 ? '+' : ''}${growthComparison.activeFollowers.change}%)`);
        console.log(`   ${'─'.repeat(70)}\n`);
      } else {
        console.log(`   ℹ️  No growth comparison available (missing snapshots)\n`);
      }

      console.log(`\n${'#'.repeat(100)}`);
      console.log(`${'#'.repeat(100)}`);
      console.log(`##${' '.repeat(96)}##`);
      console.log(`##  ✅ MEDIA INSIGHTS SYNC COMPLETED SUCCESSFULLY${' '.repeat(48)}##`);
      console.log(`##${' '.repeat(96)}##`);
      console.log(`${'#'.repeat(100)}`);
      console.log(`${'#'.repeat(100)}\n`);

      const response: any = {
        success: true,
        message: isInitialSnapshot
          ? `Initial snapshots created (#1 and #2) with ${results.synced} posts`
          : `Successfully synced ${results.synced} posts and created snapshot #${syncNumber}`,
        syncedAt: syncedAt.toISOString(),
        mediaSync: {
          totalPosts: results.totalPosts,
          synced: results.synced,
          failed: results.failed,
          errors: results.errors,
        },
      };

      // Add snapshots to response
      if (isInitialSnapshot) {
        response.snapshots = {
          baseline: snapshot1Data,
          current: snapshot2Data,
        };
      } else {
        response.currentSnapshot = snapshot2Data;
      }

      // Add growth comparison if available
      if (growthComparison) {
        response.growth = growthComparison;
      }

      // Add previous snapshot info for progressive syncs
      if (!isInitialSnapshot && lastSnapshot) {
        response.previousSnapshot = {
          snapshotId: lastSnapshot.id,
          syncNumber: lastSnapshot.syncNumber,
          period: {
            start: lastSnapshot.analysisPeriodStart ? new Date(lastSnapshot.analysisPeriodStart).toISOString().split('T')[0] : null,
            end: lastSnapshot.analysisPeriodEnd ? new Date(lastSnapshot.analysisPeriodEnd).toISOString().split('T')[0] : null,
          },
          metrics: {
            postsAnalyzed: lastSnapshot.postsAnalyzed,
            totalFollowers: lastSnapshot.totalFollowers,
            activeFollowers: lastSnapshot.activeFollowers,
            activeFollowersPercentage: Number(lastSnapshot.activeFollowersPercentage),
            avgEngagementRate: Number(lastSnapshot.avgEngagementRate),
            avgReach: lastSnapshot.avgReach,
            totalLikes: lastSnapshot.totalLikes,
            totalComments: lastSnapshot.totalComments,
            totalShares: lastSnapshot.totalShares,
            totalSaves: lastSnapshot.totalSaves,
          },
        };
      }

      // Emit 100% - Complete
      if (jobId) {
        this.instagramSyncGateway.emitSyncComplete(
          userId,
          userType,
          actualJobId,
          {
            totalPosts: results.totalPosts,
            synced: results.synced,
            failed: results.failed,
            snapshotId: snapshot2Data?.snapshotId || null,
            syncNumber: isInitialSnapshot ? 2 : syncNumber,
          }
        );
      }

      return response;

    } catch (error) {
      // Emit error event
      if (jobId) {
        this.instagramSyncGateway.emitSyncError(
          userId,
          userType,
          actualJobId,
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof BadRequestException ? (error.getResponse() as any)?.error || 'SYNC_ERROR' : 'SYNC_ERROR',
          }
        );
      }

      // Re-throw BadRequestException (like throttle errors)
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('❌ Bulk media insights sync failed:', error);
      throw new InternalServerErrorException({
        error: 'bulk_sync_failed',
        message: 'Failed to perform bulk media insights sync',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Store active followers snapshot during 30-day sync
   * This creates a historical record for authenticity tracking
   */
  private async storeActiveFollowersSnapshot(
    userId: number,
    userType: UserType,
  ): Promise<any> {
    // Get user
    const user = await this.getUser(userId, userType);

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    const totalFollowers = user.instagramFollowersCount || 0;

    // Fetch online followers data
    let activeFollowers = 0;
    let onlineFollowersData = {};

    try {
      onlineFollowersData = await this.getOnlineFollowers(userId, userType);

      if (onlineFollowersData && Object.keys(onlineFollowersData).length > 0) {
        // Get peak hour (maximum online followers)
        activeFollowers = Math.max(
          ...Object.values(onlineFollowersData).map((v: any) => v || 0)
        );
      }
    } catch (error) {
      console.warn('Could not fetch online followers:', error.message);
      // Store with 0 active followers if API fails
    }

    // Calculate active followers percentage
    const activeFollowersPercentage = totalFollowers > 0
      ? Number(((activeFollowers / totalFollowers) * 100).toFixed(2))
      : 0;

    // Calculate engagement rate and reach from recent media insights (last 30 days)
    let avgEngagementRate = 0;
    let avgReach = 0;
    let totalPosts = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;

    try {
      // Get recent media insights (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentInsights = await this.instagramMediaInsightModel.findAll({
        where: userType === 'influencer'
          ? { influencerId: userId }
          : { brandId: userId },
        include: [{
          model: this.instagramMediaModel,
          required: true,
          where: {
            timestamp: { [Op.gte]: thirtyDaysAgo },
          },
        }],
        order: [['fetchedAt', 'DESC']],
      });

      if (recentInsights.length > 0 && totalFollowers > 0) {
        totalPosts = recentInsights.length;

        // Calculate totals
        let totalReach = 0;

        const totalEngagement = recentInsights.reduce((sum, insight) => {
          totalLikes += insight.likes || 0;
          totalComments += insight.comments || 0;
          totalShares += insight.shares || 0;
          totalSaves += insight.saved || 0;
          totalReach += insight.reach || 0;
          return sum + (insight.likes || 0)
                     + (insight.comments || 0)
                     + (insight.shares || 0)
                     + (insight.saved || 0);
        }, 0);

        const avgEngagement = totalEngagement / recentInsights.length;
        avgEngagementRate = Number(((avgEngagement / totalFollowers) * 100).toFixed(2));
        avgReach = Math.round(totalReach / recentInsights.length);
      }
    } catch (error) {
      console.warn('Could not calculate engagement metrics:', error.message);
      // Continue with 0 values if calculation fails
    }

    // Determine period (last 30 days from today)
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    // Get current sync count for this influencer
    const previousSyncs = await this.instagramProfileAnalysisModel.count({
      where: userType === 'influencer'
        ? { influencerId: userId }
        : { brandId: userId }
    });

    const syncNumber = previousSyncs + 1;

    // Store snapshot with all metrics
    await this.instagramProfileAnalysisModel.create({
      influencerId: userType === 'influencer' ? userId : undefined,
      brandId: userType === 'brand' ? userId : undefined,
      instagramUserId: user.instagramUserId,
      instagramUsername: user.instagramUsername,
      syncNumber,
      syncDate: new Date(),
      analysisPeriodStart: periodStart,
      analysisPeriodEnd: periodEnd,
      postsAnalyzed: totalPosts,
      totalFollowers,
      activeFollowers,
      activeFollowersPercentage,
      onlineFollowersHourlyData: onlineFollowersData,
      avgEngagementRate,
      avgReach,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      analyzedAt: new Date(),
    });

    console.log(`📊 Stored sync #${syncNumber} for ${userType} ${userId}`);

    return {
      syncNumber,
      totalFollowers,
      activeFollowers,
      percentage: activeFollowersPercentage,
      avgEngagementRate,
      avgReach,
      totalPosts,
      periodStart,
      periodEnd,
    };
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
      const isBusinessOrCreator = accountType === 'BUSINESS' || accountType === 'CREATOR' || accountType === 'MEDIA_CREATOR';

      return {
        hasInsightsAccess: isBusinessOrCreator,
        accountType: accountType,
        username: profileResponse.data.username,
        message: isBusinessOrCreator
          ? `Account has ${accountType} access and can request insights`
          : 'Account must be converted to Business, Creator, or Media Creator account to access insights',
        requiredPermissions: [
          'instagram_basic',
          'instagram_manage_insights',
          'pages_read_engagement'
        ],
      };
    } catch (error) {
      this.handleInstagramError(error, 'Failed to check insights permissions');
    }
  }

  /**
   * Get audience demographics (age/gender breakdown)
   * NOTE: This endpoint requires Instagram Business Account connected to a Facebook Page
   * Instagram API does NOT provide demographics without Facebook Page integration
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Audience demographics data or error message
   */
  async getAudienceDemographics(
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
      // Fetch age/gender demographics
      const ageGenderResponse = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'follower_demographics',
            period: 'lifetime',
            metric_type: 'total_value',
            breakdown: 'age,gender',
            access_token: user.instagramAccessToken,
          },
        }
      );

      // Fetch city demographics
      const cityResponse = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'follower_demographics',
            period: 'lifetime',
            metric_type: 'total_value',
            breakdown: 'city',
            access_token: user.instagramAccessToken,
          },
        }
      );

      // Fetch country demographics
      const countryResponse = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'follower_demographics',
            period: 'lifetime',
            metric_type: 'total_value',
            breakdown: 'country',
            access_token: user.instagramAccessToken,
          },
        }
      );

      // Process age/gender data
      const ageGenderData = ageGenderResponse.data.data[0]?.total_value?.breakdowns?.[0]?.results || [];
      const totalFollowers = user.instagramFollowersCount || 1;

      const ageGender = ageGenderData.map((item: any) => ({
        ageRange: item.dimension_values?.[0] || 'unknown',
        gender: item.dimension_values?.[1] || 'unknown',
        count: item.value || 0,
        percentage: Number(((item.value / totalFollowers) * 100).toFixed(2)),
      }));

      // Process city data
      const cityData = cityResponse.data.data[0]?.total_value?.breakdowns?.[0]?.results || [];
      const cities = cityData
        .map((item: any) => ({
          name: item.dimension_values?.[0] || 'unknown',
          count: item.value || 0,
          percentage: Number(((item.value / totalFollowers) * 100).toFixed(2)),
        }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      // Process country data
      const countryData = countryResponse.data.data[0]?.total_value?.breakdowns?.[0]?.results || [];
      const countries = countryData
        .map((item: any) => ({
          code: item.dimension_values?.[0] || 'unknown',
          count: item.value || 0,
          percentage: Number(((item.value / totalFollowers) * 100).toFixed(2)),
        }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      // Check if all demographic data is empty (indicates Facebook Page not connected)
      const isAllDataEmpty = ageGender.length === 0 && cities.length === 0 && countries.length === 0;

      if (isAllDataEmpty) {
        console.log(`⚠️  Empty demographics data for ${userType} ${userId} - Facebook Page likely not connected`);
        return {
          ageGender: [],
          cities: [],
          countries: [],
          totalFollowers: user.instagramFollowersCount || 0,
          dataAvailable: false,
          facebookPageConnected: false,
          error: {
            code: 'FACEBOOK_PAGE_REQUIRED',
            message: 'Audience demographics require Instagram Business Account connected to a Facebook Page',
            details: 'Instagram API does not provide follower demographics without Facebook Page integration.',
            instructions: [
              '1. Ensure your Instagram account is a Business account (not Creator or Personal)',
              '2. Create or connect a Facebook Page to your Instagram Business account',
              '3. In Instagram Settings → Account → Linked Accounts → Facebook, link your Facebook Page',
            ],
            alternative: 'Without Facebook Page connection, demographics data will not be available via Instagram API.',
          },
        };
      }

      // Store demographic snapshot for variance tracking
      try {
        const audienceAgeGender = ageGender.map((item: any) => ({
          ageRange: item.ageRange,
          gender: item.gender,
          percentage: item.percentage,
        }));

        const audienceCities = cities.map((item: any) => ({
          location: item.name,
          percentage: item.percentage,
        }));

        const audienceCountries = countries.map((item: any) => ({
          location: item.code,
          percentage: item.percentage,
        }));

        await this.instagramProfileAnalysisModel.create({
          influencerId: userType === 'influencer' ? userId : undefined,
          brandId: userType === 'brand' ? userId : undefined,
          instagramUserId: user.instagramUserId,
          instagramUsername: user.instagramUsername,
          audienceAgeGender,
          audienceCities,
          audienceCountries,
        });

        console.log(`📊 Stored demographic snapshot for ${userType} ${userId}`);
      } catch (snapshotError) {
        console.error('Failed to store demographic snapshot:', snapshotError);
        // Don't throw - continue to return demographics even if storage fails
      }

      return {
        ageGender,
        cities,
        countries,
        totalFollowers,
        dataAvailable: true,
        facebookPageConnected: true,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || '';
        console.error('Demographics API error:', error.response?.data);

        // Check if error is due to missing Facebook Page integration or account type
        const isFacebookPageRequired =
          errorMessage.includes('Unsupported get request') ||
          errorMessage.includes('requires a Facebook Page') ||
          errorMessage.includes('Instagram Business Account') ||
          errorMessage.includes('permission') ||
          error.response?.status === 400;

        if (isFacebookPageRequired) {
          // Return structured response with helpful error message
          return {
            ageGender: [],
            cities: [],
            countries: [],
            totalFollowers: user.instagramFollowersCount || 0,
            dataAvailable: false,
            facebookPageConnected: false,
            error: {
              code: 'FACEBOOK_PAGE_REQUIRED',
              message: 'Audience demographics require Instagram Business Account connected to a Facebook Page',
              details: 'Instagram API does not provide follower demographics without Facebook Page integration.',
              instructions: [
                '1. Ensure your Instagram account is a Business account (not Creator or Personal)',
                '2. Create or connect a Facebook Page to your Instagram Business account',
                '3. In Instagram Settings → Account → Linked Accounts → Facebook, link your Facebook Page',
              ],
              alternative: 'Without Facebook Page connection, demographics data will not be available via Instagram API.',
            },
          };
        }
      }
      throw error;
    }
  }

  /**
   * Get follower count history
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param since - Start timestamp (Unix timestamp)
   * @param until - End timestamp (Unix timestamp)
   * @returns Follower count history
   */
  async getFollowerCountHistory(
    userId: number,
    userType: UserType,
    since: number,
    until: number,
  ): Promise<any> {
    const user = await this.getUser(userId, userType);

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    console.log(`\n📊 Fetching follower count history...`);
    console.log(`   Account: ${user.instagramUsername} (${user.instagramAccountType})`);
    console.log(`   Period: ${new Date(since * 1000).toISOString().split('T')[0]} to ${new Date(until * 1000).toISOString().split('T')[0]}`);

    try {
      const response = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'follower_count',
            period: 'day',
            since,
            until,
            access_token: user.instagramAccessToken,
          },
        }
      );

      console.log(`   ✅ API Response Status: ${response.status}`);
      console.log(`   Response data:`, JSON.stringify(response.data, null, 2));

      const data = response.data.data[0]?.values || [];
      console.log(`   Data points received: ${data.length}`);

      if (data.length > 0) {
        console.log(`   First data point:`, data[0]);
        console.log(`   Last data point:`, data[data.length - 1]);

        // Note: follower_count metric returns DAILY NEW FOLLOWERS, not total count
        const totalNewFollowers = data.reduce((sum, item) => sum + (item.value || 0), 0);
        console.log(`   Total new followers in period: ${totalNewFollowers}`);
      }

      // Return daily new follower counts (these will be summed to calculate historical total)
      return data.map((item: any) => ({
        date: item.end_time,
        count: item.value, // This is NEW followers for that day
      }));
    } catch (error) {
      console.log(`   ❌ API Error:`, error.response?.data || error.message);
      if (error.response?.data) {
        console.log(`   Error details:`, JSON.stringify(error.response.data, null, 2));
      }
      this.handleInstagramError(error, 'Failed to fetch follower count history');
    }
  }

  /**
   * Get daily reach history
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param since - Start timestamp (Unix timestamp)
   * @param until - End timestamp (Unix timestamp)
   * @returns Daily reach history
   */
  async getReachHistory(
    userId: number,
    userType: UserType,
    since: number,
    until: number,
  ): Promise<any> {
    const user = await this.getUser(userId, userType);

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    try {
      const response = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'reach',
            period: 'day',
            since,
            until,
            access_token: user.instagramAccessToken,
          },
        }
      );

      const data = response.data.data[0]?.values || [];
      return data.map((item: any) => ({
        date: item.end_time,
        reach: item.value,
      }));
    } catch (error) {
      this.handleInstagramError(error, 'Failed to fetch reach history');
    }
  }

  /**
   * Get when followers are online
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Online followers data
   */
  async getOnlineFollowers(
    userId: number,
    userType: UserType,
  ): Promise<any> {
    const user = await this.getUser(userId, userType);

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    try {
      const response = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'online_followers',
            period: 'lifetime',
            access_token: user.instagramAccessToken,
          },
        }
      );

      const data = response.data.data[0]?.values?.[0]?.value || {};
      return data;
    } catch (error) {
      this.handleInstagramError(error, 'Failed to fetch online followers');
    }
  }

  /**
   * Helper method to get user
   */
  private async getUser(userId: number, userType: UserType): Promise<Influencer | Brand> {
    if (userType === 'influencer') {
      const user = await this.influencerModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Influencer with ID ${userId} not found`);
      }
      return user;
    } else {
      const user = await this.brandModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException(`Brand with ID ${userId} not found`);
      }
      return user;
    }
  }

  /**
   * Create a placeholder sync record to indicate sync is in progress
   * This prevents syncNeeded from being true while async sync is running
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   */
  async createPlaceholderSyncRecord(userId: number, userType: UserType): Promise<void> {
    const user = await this.getUser(userId, userType);

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    // Create a minimal placeholder record with just syncDate to indicate sync started
    // This will make getInstagramSyncStatus return syncNeeded = false
    await this.instagramProfileAnalysisModel.create({
      influencerId: userType === 'influencer' ? userId : undefined,
      brandId: userType === 'brand' ? userId : undefined,
      instagramUserId: user.instagramUserId,
      instagramUsername: user.instagramUsername,
      syncDate: new Date(), // This is the key field that getInstagramSyncStatus checks
      postsAnalyzed: 0,
      syncNumber: 0, // Placeholder sync number, will be replaced by actual sync
    });
  }

  /**
   * Get comprehensive analytics for influencer/brand
   * Includes all calculated metrics for the UI
   */
  async getComprehensiveAnalytics(
    userId: number,
    userType: UserType,
  ): Promise<any> {
    try {
      // 1. Get profile data
      const profile = await this.getStoredInstagramProfile(userId, userType);

      // 2. Get stored insights with media data
      const insightsData = await this.getStoredMediaInsights(
        userId,
        userType,
        undefined, // No specific mediaId - get all
        1000, // Limit - get up to 1000 posts
      );
      const insights = insightsData.data || [];

      // 3. Get demographics
      const demographics = await this.getAudienceDemographics(userId, userType);

      // 4. Get follower history (last 30 days)
      let growth: any = null;
      try {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        growth = await this.getFollowerCountHistory(userId, userType, thirtyDaysAgo, now);
      } catch (error) {
        console.log('Follower history not available:', error.message);
      }

      // 5. Get online followers
      let activeFollowersData: any = null;
      try {
        activeFollowersData = await this.getOnlineFollowers(userId, userType);
      } catch (error) {
        console.log('Online followers not available:', error.message);
      }

      // Calculate metrics
      const postsAnalyzed = insights.length;
      const followersCount = profile.instagramFollowersCount || 0;
      const followsCount = profile.instagramFollowsCount || 0;

      // Profile Summary
      const profileSummary = {
        username: profile.instagramUsername,
        biography: profile.instagramBio,
        media_count: profile.instagramMediaCount,
        followers_count: followersCount,
        follows_count: followsCount,
        follow_ratio:
          followersCount > 0
            ? Math.round((followsCount / followersCount) * 10000) / 100
            : 0,
        posts_analyzed: postsAnalyzed,
      };

      // Calculate engagement metrics
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let totalSaves = 0;
      let totalReach = 0;

      insights.forEach((insight) => {
        totalLikes += insight.likes || 0;
        totalComments += insight.comments || 0;
        totalShares += insight.shares || 0;
        totalSaves += insight.saved || 0;
        totalReach += insight.reach || 0;
      });

      const totalEngagement =
        totalLikes + totalComments + totalShares + totalSaves;
      const engagementRate =
        postsAnalyzed > 0 && followersCount > 0
          ? Math.round(
              (totalEngagement / postsAnalyzed / followersCount) * 1000000,
            ) / 100
          : 0;

      const avgLikes = postsAnalyzed > 0 ? Math.round(totalLikes / postsAnalyzed) : 0;
      const avgComments =
        postsAnalyzed > 0
          ? Math.round((totalComments / postsAnalyzed) * 10) / 10
          : 0;
      const avgShares =
        postsAnalyzed > 0 ? Math.round((totalShares / postsAnalyzed) * 10) / 10 : 0;
      const avgSaves =
        postsAnalyzed > 0 ? Math.round((totalSaves / postsAnalyzed) * 10) / 10 : 0;
      const saveRate =
        totalReach > 0 ? Math.round((totalSaves / totalReach) * 10000) / 100 : 0;
      const viralityScore =
        totalReach > 0 ? Math.round((totalShares / totalReach) * 10000) / 100 : 0;

      let engagementRating = 'Low';
      if (engagementRate >= 6) engagementRating = 'Excellent';
      else if (engagementRate >= 3) engagementRating = 'Good';
      else if (engagementRate >= 1) engagementRating = 'Average';

      const engagement = {
        engagementRate,
        avgLikes,
        avgComments,
        avgShares,
        avgSaves,
        saveRate,
        viralityScore,
        engagementRating,
      };

      // Content Mix - using mediaProductType to properly identify Reels
      let reelsCount = 0;
      let videosCount = 0;
      let imagesCount = 0;
      let carouselsCount = 0;

      insights.forEach((insight) => {
        const mediaType = insight.instagramMedia?.mediaType;
        const productType = insight.instagramMedia?.mediaProductType;

        if (productType === 'REELS' || productType === 'CLIPS') {
          reelsCount++;
        } else if (mediaType === 'VIDEO') {
          videosCount++;
        } else if (mediaType === 'IMAGE') {
          imagesCount++;
        } else if (mediaType === 'CAROUSEL_ALBUM') {
          carouselsCount++;
        }
      });

      const contentMix = {
        reels: reelsCount,
        videos: videosCount,
        images: imagesCount,
        carousels: carouselsCount,
      };

      // Best and Worst Posts
      const sortedByEngagement = [...insights].sort((a, b) => {
        const engagementA =
          (a.likes || 0) +
          (a.comments || 0) +
          (a.shares || 0) +
          (a.saved || 0);
        const engagementB =
          (b.likes || 0) +
          (b.comments || 0) +
          (b.shares || 0) +
          (b.saved || 0);
        return engagementB - engagementA;
      });

      const bestPost = sortedByEngagement[0] || null;
      const worstPost = sortedByEngagement[sortedByEngagement.length - 1] || null;

      // Format best/worst posts
      const formatPost = (post) => {
        if (!post) return null;
        return {
          mediaId: post.mediaId,
          mediaType: post.mediaType,
          mediaProductType: post.mediaProductType,
          reach: post.reach,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          saved: post.saved,
          totalEngagement:
            (post.likes || 0) +
            (post.comments || 0) +
            (post.shares || 0) +
            (post.saved || 0),
          instagramMedia: post.instagramMedia,
        };
      };

      // Demographics with gender split
      let genderSplit = { male: 0, female: 0, other: 0 };
      if (demographics.dataAvailable && demographics.ageGender) {
        const totalFollowers = demographics.totalFollowers || 1;
        let totalMale = 0;
        let totalFemale = 0;
        let totalOther = 0;

        demographics.ageGender.forEach((ageGroup) => {
          totalMale += ageGroup.male || 0;
          totalFemale += ageGroup.female || 0;
          totalOther += ageGroup.other || 0;
        });

        genderSplit = {
          male: Math.round((totalMale / totalFollowers) * 100),
          female: Math.round((totalFemale / totalFollowers) * 100),
          other: Math.round((totalOther / totalFollowers) * 100),
        };
      }

      const demographicsData = {
        gender_split: genderSplit,
        age_gender: demographics.ageGender || [],
        countries: demographics.countries || [],
        cities: demographics.cities || [],
      };

      // Growth Trend (if available)
      let growthData: any = null;
      if (growth && growth.length > 0) {
        const midpoint = Math.floor(growth.length / 2);
        const firstHalf = growth
          .slice(0, midpoint)
          .reduce((sum, day) => sum + day.count, 0);
        const secondHalf = growth
          .slice(midpoint)
          .reduce((sum, day) => sum + day.count, 0);

        let trendDirection = 'Stable';
        if (secondHalf > firstHalf * 1.1) trendDirection = 'Growing';
        else if (secondHalf < firstHalf * 0.9) trendDirection = 'Declining';

        const totalNewFollowers = growth.reduce((sum, day) => sum + day.count, 0);
        const avgDailyFollowers =
          growth.length > 0
            ? Math.round((totalNewFollowers / growth.length) * 10) / 10
            : 0;

        const growthPercentage =
          firstHalf > 0
            ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
            : 0;

        const peakDay = growth.reduce(
          (max, day) => (day.count > max.count ? day : max),
          { date: '', count: 0 },
        );

        growthData = {
          trendDirection,
          total_new_followers: totalNewFollowers,
          average_daily_followers: avgDailyFollowers,
          growthPercentage,
          peakDay: peakDay.date,
          follower_count_history: growth,
        };
      }

      // Active Followers (if available)
      let activeFollowers: any = null;
      if (activeFollowersData && Object.keys(activeFollowersData).length > 0) {
        const maxOnline = Math.max(
          ...Object.values(activeFollowersData).map((v: any) => v || 0),
        );
        const percentage =
          followersCount > 0
            ? Math.round((maxOnline / followersCount) * 1000) / 10
            : 0;

        activeFollowers = {
          active_followers_count: maxOnline,
          active_followers_percentage: percentage,
        };
      }

      // Return comprehensive analytics
      return {
        success: true,
        data: {
          profile: profileSummary,
          engagement,
          contentMix,
          bestPost: formatPost(bestPost),
          worstPost: formatPost(worstPost),
          demographics: demographicsData,
          growth: growthData,
          activeFollowers,
        },
      };
    } catch (error) {
      console.error('Error fetching comprehensive analytics:', error);
      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to fetch comprehensive analytics',
        error: error.message,
      });
    }
  }

  /**
   * Fetch and store snapshot data for a specific 30-day period
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @param periodStart - Start date of the period
   * @param periodEnd - End date of the period
   * @param syncNumber - Snapshot number (1 or 2)
   * @returns Snapshot data with all metrics
   */
  private async fetchSnapshotForPeriod(
    userId: number,
    userType: UserType,
    periodStart: Date,
    periodEnd: Date,
    syncNumber: number,
  ): Promise<any> {
    const user = await this.getUser(userId, userType);

    const daysCovered = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 SNAPSHOT #${syncNumber} - FETCHING DATA`);
    console.log(`${'='.repeat(80)}`);
    console.log(`👤 User: ${userType} ID ${userId} (@${user.instagramUsername || 'unknown'})`);
    console.log(`📅 Period Start: ${periodStart.toISOString()}`);
    console.log(`📅 Period End:   ${periodEnd.toISOString()}`);
    console.log(`⏱️  Days Covered: ${daysCovered} days`);
    console.log(`${'='.repeat(80)}\n`);

    // Get media insights for this specific period
    const mediaInsights = await this.instagramMediaInsightModel.findAll({
      where: userType === 'influencer'
        ? { influencerId: userId }
        : { brandId: userId },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: {
          timestamp: {
            [Op.gte]: periodStart,
            [Op.lte]: periodEnd,
          },
        },
      }],
      order: [['fetchedAt', 'DESC']],
    });

    // Fetch historical follower count for this period from Instagram Insights API
    // Note: This API is only available for BUSINESS/CREATOR accounts with Facebook Page
    let totalFollowers = user.instagramFollowersCount || 0;
    let usedHistoricalData = false;

    try {
      const since = Math.floor(periodStart.getTime() / 1000);
      const until = Math.floor(periodEnd.getTime() / 1000);
      const followerHistory = await this.getFollowerCountHistory(userId, userType, since, until);

      if (followerHistory && followerHistory.length > 0) {
        // follower_count metric returns DAILY NEW FOLLOWERS, not total count
        // To get the total follower count at the end of this period:
        // Total at period end = Current total - (new followers gained AFTER this period)

        const newFollowersInPeriod = followerHistory.reduce((sum, item) => sum + (item.count || 0), 0);

        // Calculate how many followers were gained AFTER this period ends (from periodEnd to now)
        let newFollowersAfterPeriod = 0;
        try {
          const afterPeriodSince = Math.floor(periodEnd.getTime() / 1000);
          const afterPeriodUntil = Math.floor(new Date().getTime() / 1000);

          if (afterPeriodUntil > afterPeriodSince) {
            const afterHistory = await this.getFollowerCountHistory(userId, userType, afterPeriodSince, afterPeriodUntil);
            if (afterHistory && afterHistory.length > 0) {
              newFollowersAfterPeriod = afterHistory.reduce((sum, item) => sum + (item.count || 0), 0);
              console.log(`   New followers from ${periodEnd.toISOString().split('T')[0]} to now: ${newFollowersAfterPeriod}`);
            }
          }
        } catch (error) {
          console.warn(`   Could not fetch followers after period: ${error.message}`);
        }

        // Total at period end = Current total - new followers gained after period
        const historicalCount = (user.instagramFollowersCount || 0) - newFollowersAfterPeriod;

        if (historicalCount > 10) {
          totalFollowers = historicalCount;
          usedHistoricalData = true;
          console.log(`📊 Calculated historical follower count from API data:`);
          console.log(`   New followers in period (${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}): ${newFollowersInPeriod}`);
          console.log(`   Current total: ${user.instagramFollowersCount}`);
          console.log(`   Followers at end of period: ${totalFollowers}`);
        } else {
          console.log(`⚠️  Historical data calculation resulted in invalid count (${historicalCount})`);
          console.log(`   Attempting to use daily growth snapshots as fallback...`);
        }
      } else {
        console.log(`⚠️  No follower history data available`);
        console.log(`   Attempting to use daily growth snapshots as fallback...`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not fetch follower history: ${error.message}`);
      console.warn(`   Attempting to use daily growth snapshots as fallback...`);
    }

    // Fallback: Use instagram_profile_growth table for MEDIA_CREATOR accounts
    if (!usedHistoricalData) {
      try {
        // Find the closest growth snapshot to the end of this period
        const growthSnapshot = await this.instagramProfileGrowthModel.findOne({
          where: {
            influencerId: user.id,
            snapshotDate: {
              [Op.lte]: periodEnd,
              [Op.gte]: periodStart,
            },
          },
          order: [['snapshotDate', 'DESC']],
        });

        if (growthSnapshot && growthSnapshot.followersCount > 10) {
          totalFollowers = growthSnapshot.followersCount;
          usedHistoricalData = true;
          console.log(`📊 Using growth snapshot from ${growthSnapshot.snapshotDate}: ${totalFollowers} followers`);
        } else {
          console.log(`⚠️  No growth snapshots found for this period`);
          console.log(`   Using current follower count: ${totalFollowers}`);
        }
      } catch (error) {
        console.warn(`⚠️  Could not fetch growth snapshot: ${error.message}`);
        console.warn(`   Using current follower count: ${totalFollowers}`);
      }
    }

    // Log account type limitation for awareness
    if (!usedHistoricalData && user.instagramAccountType === 'MEDIA_CREATOR') {
      console.log(`ℹ️  Account type: MEDIA_CREATOR - historical follower data not available from Instagram API`);
      console.log(`   Growth tracking will use current follower count snapshots from different dates`);
    }

    const postsAnalyzed = mediaInsights.length;

    console.log(`📝 Posts found in this period: ${postsAnalyzed}`);

    // Calculate metrics for this period
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalReach = 0;

    mediaInsights.forEach((insight) => {
      totalLikes += insight.likes || 0;
      totalComments += insight.comments || 0;
      totalShares += insight.shares || 0;
      totalSaves += insight.saved || 0;
      totalReach += insight.reach || 0;
    });

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagementRate = postsAnalyzed > 0 && totalFollowers > 0
      ? Number(((totalEngagement / postsAnalyzed / totalFollowers) * 100).toFixed(2))
      : 0;
    const avgReach = postsAnalyzed > 0 ? Math.round(totalReach / postsAnalyzed) : 0;

    // Get active followers data (current data, as historical data is not available)
    let activeFollowers = 0;
    let onlineFollowersData = {};
    try {
      onlineFollowersData = await this.getOnlineFollowers(userId, userType);
      if (onlineFollowersData && Object.keys(onlineFollowersData).length > 0) {
        activeFollowers = Math.max(...Object.values(onlineFollowersData).map((v: any) => v || 0));
      }
    } catch (error) {
      console.warn('Could not fetch online followers:', error.message);
    }

    const activeFollowersPercentage = totalFollowers > 0
      ? Number(((activeFollowers / totalFollowers) * 100).toFixed(2))
      : 0;

    // Fetch demographics (age/gender, cities, countries)
    let audienceAgeGender: any[] = [];
    let audienceCities: any[] = [];
    let audienceCountries: any[] = [];
    try {
      console.log(`\n📊 Fetching audience demographics...`);
      const demographics = await this.getAudienceDemographics(userId, userType);

      if (demographics && demographics.dataAvailable) {
        audienceAgeGender = demographics.ageGender || [];
        audienceCities = demographics.cities || [];
        audienceCountries = demographics.countries || [];
        console.log(`   ✅ Demographics fetched: ${audienceAgeGender.length} age/gender segments, ${audienceCities.length} cities, ${audienceCountries.length} countries`);
      } else {
        console.log(`   ⚠️  Demographics not available: ${demographics?.message || 'Unknown reason'}`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Could not fetch demographics: ${error.message}`);
      console.warn(`   Continuing without demographics data...`);
    }

    // Generate COMPREHENSIVE AI analysis for this snapshot (only runs once every 30 days)
    let aiGrowthFeedback: string | undefined;
    let aiPostingFeedback: string | undefined;
    let aiEngagementFeedback: string | undefined;
    let aiContentFeedback: string | undefined;
    let aiFeedbackGeneratedAt: Date | undefined;

    // Additional comprehensive AI analysis cache
    let aiNicheAnalysis: any;
    let aiLanguageAnalysis: any;
    let aiVisualAnalysis: any;
    let aiSentimentAnalysis: any;
    let aiHashtagAnalysis: any;
    let aiCtaAnalysis: any;
    let aiColorPaletteAnalysis: any;
    let aiTrendAnalysis: any;
    let aiRetentionCurve: any;
    let aiMonetizationAnalysis: any;
    let aiPayoutPrediction: any;
    let aiAudienceSentiment: any;

    if (this.geminiAIService.isAvailable() && postsAnalyzed > 0) {
      console.log(`\n🤖 Generating AI feedback for snapshot #${syncNumber} (PARALLEL MODE - FAST)...`);

      try {
        // Get captions from media insights for AI analysis
        const captions: string[] = [];
        const mediaUrls: string[] = [];

        for (const insight of mediaInsights) {
          if (insight.instagramMedia?.caption) {
            captions.push(insight.instagramMedia.caption);
          }
          if (insight.instagramMedia?.mediaUrl) {
            mediaUrls.push(insight.instagramMedia.mediaUrl);
          }
        }

        // Get previous snapshot for growth comparison
        const previousSnapshot = await this.instagramProfileAnalysisModel.findOne({
          where: userType === 'influencer'
            ? { influencerId: userId, syncNumber: { [Op.lt]: syncNumber } }
            : { brandId: userId, syncNumber: { [Op.lt]: syncNumber } },
          order: [['syncNumber', 'DESC']],
        });

        // Prepare prompts
        const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        const postsPerWeek = (postsAnalyzed / daysInPeriod) * 7;

        // Build all AI calls to run in parallel
        const aiCalls: Promise<any>[] = [];

        // 1. Growth Feedback (only if previous snapshot exists)
        if (previousSnapshot) {
          const followerGrowth = totalFollowers - (previousSnapshot.totalFollowers || 0);
          const followerGrowthPercentage = previousSnapshot.totalFollowers
            ? ((followerGrowth / previousSnapshot.totalFollowers) * 100).toFixed(1)
            : '0';
          const engagementChange = avgEngagementRate - (previousSnapshot.avgEngagementRate || 0);

          const growthPrompt = `Follower growth: ${followerGrowth >= 0 ? '+' : ''}${followerGrowth} (${followerGrowthPercentage}%), Engagement: ${avgEngagementRate}% (${engagementChange >= 0 ? '+' : ''}${engagementChange.toFixed(2)}%), Posts: ${postsAnalyzed}. Give 4-6 words actionable growth feedback.`;

          aiCalls.push(
            this.geminiAIService.executeWithFallback(async (model) => {
              const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: growthPrompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.3 }
              });
              return { type: 'growth', result: await response.response };
            }, 'generateGrowthFeedback').catch(err => ({ type: 'growth', error: err }))
          );
        }

        // 2. Posting Consistency Feedback
        const postingPrompt = `Posted ${postsAnalyzed} times in ${daysInPeriod} days (${postsPerWeek.toFixed(1)} posts/week). Give 4-6 words actionable posting feedback.`;
        aiCalls.push(
          this.geminiAIService.executeWithFallback(async (model) => {
            const response = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: postingPrompt }] }],
              generationConfig: { response_mime_type: "application/json", temperature: 0.3 }
            });
            return { type: 'posting', result: await response.response };
          }, 'generatePostingFeedback').catch(err => ({ type: 'posting', error: err }))
        );

        // 3. Engagement Feedback
        const engagementPrompt = `Engagement rate: ${avgEngagementRate}%, Avg reach: ${avgReach}, Total engagement: ${totalEngagement} (likes: ${totalLikes}, comments: ${totalComments}, shares: ${totalShares}, saves: ${totalSaves}). Give 4-6 words actionable engagement feedback.`;
        aiCalls.push(
          this.geminiAIService.executeWithFallback(async (model) => {
            const response = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: engagementPrompt }] }],
              generationConfig: { response_mime_type: "application/json", temperature: 0.3 }
            });
            return { type: 'engagement', result: await response.response };
          }, 'generateEngagementFeedback').catch(err => ({ type: 'engagement', error: err }))
        );

        // 4. Content Quality Feedback
        if (captions.length > 0) {
          const sampleCaptions = captions.slice(0, 10).join('\n---\n');
          const contentPrompt = `Sample captions:\n${sampleCaptions}\n\nAnalyze content quality. Give 4-6 words actionable content feedback.`;
          aiCalls.push(
            this.geminiAIService.executeWithFallback(async (model) => {
              const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: contentPrompt }] }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.3 }
              });
              return { type: 'content', result: await response.response };
            }, 'generateContentFeedback').catch(err => ({ type: 'content', error: err }))
          );
        }

        // Execute all basic feedback calls in parallel
        console.log(`   ⚡ Running ${aiCalls.length} basic AI calls in parallel...`);
        const basicResults = await Promise.all(aiCalls);

        // Process results
        for (const item of basicResults) {
          if (item.error) {
            console.warn(`   ⚠️  ${item.type} failed: ${item.error.message}`);
            continue;
          }

          try {
            const parsed = JSON.parse(item.result.text());
            const feedback = parsed.feedback || parsed.message;

            switch (item.type) {
              case 'growth':
                aiGrowthFeedback = feedback || 'Keep up consistent posting.';
                console.log(`   ✅ Growth Feedback: ${aiGrowthFeedback}`);
                break;
              case 'posting':
                aiPostingFeedback = feedback || 'Maintain regular posting schedule.';
                console.log(`   ✅ Posting Feedback: ${aiPostingFeedback}`);
                break;
              case 'engagement':
                aiEngagementFeedback = feedback || 'Boost engagement with CTAs.';
                console.log(`   ✅ Engagement Feedback: ${aiEngagementFeedback}`);
                break;
              case 'content':
                aiContentFeedback = feedback || 'Create more engaging captions.';
                console.log(`   ✅ Content Feedback: ${aiContentFeedback}`);
                break;
            }
          } catch (parseError) {
            console.warn(`   ⚠️  Failed to parse ${item.type} result: ${parseError.message}`);
          }
        }

        // ============================================================
        // COMPREHENSIVE AI ANALYSIS (for profile scoring cache)
        // Run ALL calls in PARALLEL for maximum speed
        // ============================================================
        console.log(`\n   📊 Generating comprehensive AI analysis (PARALLEL MODE - FAST)...`);

        const comprehensiveAICalls: Promise<any>[] = [];

        // 5. Niche Detection
        comprehensiveAICalls.push(
          this.geminiAIService.detectNiche(captions, [])
            .then(result => ({ type: 'niche', result }))
            .catch(err => ({ type: 'niche', error: err }))
        );

        // 6. Language Analysis
        comprehensiveAICalls.push(
          this.geminiAIService.analyzeLanguage(captions)
            .then(result => ({ type: 'language', result }))
            .catch(err => ({ type: 'language', error: err }))
        );

        // 7. Visual Quality Analysis (sample first 5 images in parallel)
        if (mediaUrls.length > 0) {
          const visualCalls = mediaUrls.slice(0, 5).map(url =>
            this.geminiAIService.analyzeVisualQuality(url).catch(() => null)
          );
          comprehensiveAICalls.push(
            Promise.all(visualCalls)
              .then(visualResults => ({
                type: 'visual',
                result: visualResults.filter(v => v !== null)
              }))
              .catch(err => ({ type: 'visual', error: err }))
          );
        }

        // 8. Sentiment Analysis
        comprehensiveAICalls.push(
          this.geminiAIService.analyzeSentiment(captions)
            .then(result => ({ type: 'sentiment', result }))
            .catch(err => ({ type: 'sentiment', error: err }))
        );

        // 9. Hashtag Effectiveness
        comprehensiveAICalls.push(
          this.geminiAIService.analyzeHashtagEffectiveness(captions)
            .then(result => ({ type: 'hashtag', result }))
            .catch(err => ({ type: 'hashtag', error: err }))
        );

        // 10. CTA Usage
        comprehensiveAICalls.push(
          this.geminiAIService.analyzeCTAUsage(captions)
            .then(result => ({ type: 'cta', result }))
            .catch(err => ({ type: 'cta', error: err }))
        );

        // 11. Color Palette/Mood
        if (mediaUrls.length > 0) {
          comprehensiveAICalls.push(
            this.geminiAIService.analyzeColorPaletteMood(mediaUrls.slice(0, 5))
              .then(result => ({ type: 'colorPalette', result }))
              .catch(err => ({ type: 'colorPalette', error: err }))
          );
        }

        // 12. Trend Relevance
        comprehensiveAICalls.push(
          this.geminiAIService.analyzeTrendRelevance(captions)
            .then(result => ({ type: 'trend', result }))
            .catch(err => ({ type: 'trend', error: err }))
        );

        // 13. Monetization Prediction
        comprehensiveAICalls.push(
          this.geminiAIService.predictMonetisationPotential({
            followerCount: totalFollowers,
            engagementRate: avgEngagementRate,
            accountType: user.instagramAccountType || 'PERSONAL',
            captions: captions.slice(0, 8),
          })
            .then(result => ({ type: 'monetization', result }))
            .catch(err => ({ type: 'monetization', error: err }))
        );

        // 14. Payout Prediction
        comprehensiveAICalls.push(
          this.geminiAIService.predictInfluencerPayout({
            activeFollowers,
            avgViews: avgReach,
            engagementRate: avgEngagementRate,
          })
            .then(result => ({ type: 'payout', result }))
            .catch(err => ({ type: 'payout', error: err }))
        );

        // 15. Audience Sentiment
        comprehensiveAICalls.push(
          this.geminiAIService.analyzeAudienceSentiment(captions)
            .then(result => ({ type: 'audienceSentiment', result }))
            .catch(err => ({ type: 'audienceSentiment', error: err }))
        );

        // Execute ALL comprehensive analysis in parallel
        console.log(`   ⚡ Running ${comprehensiveAICalls.length} comprehensive AI calls in parallel...`);
        const comprehensiveResults = await Promise.all(comprehensiveAICalls);

        // Process results
        for (const item of comprehensiveResults) {
          if (item.error) {
            console.warn(`   ⚠️  ${item.type} analysis failed: ${item.error.message}`);
            continue;
          }

          switch (item.type) {
            case 'niche':
              aiNicheAnalysis = item.result;
              console.log(`   ✅ Niche: ${aiNicheAnalysis.primaryNiche} (${aiNicheAnalysis.confidence}% confidence)`);
              break;
            case 'language':
              aiLanguageAnalysis = item.result;
              console.log(`   ✅ Language: ${aiLanguageAnalysis.primaryLanguage}`);
              break;
            case 'visual':
              if (item.result.length > 0) {
                aiVisualAnalysis = {
                  avgQuality: Math.round(item.result.reduce((sum: number, v: any) => sum + v.overallQuality, 0) / item.result.length),
                  avgProfessionalScore: Math.round(item.result.reduce((sum: number, v: any) => sum + v.professionalScore, 0) / item.result.length),
                  avgBrandSafetyScore: Math.round(item.result.reduce((sum: number, v: any) => sum + v.brandSafetyScore, 0) / item.result.length),
                  facesDetected: Math.round(item.result.reduce((sum: number, v: any) => sum + v.faces, 0) / item.result.length),
                };
                console.log(`   ✅ Visual Quality: ${aiVisualAnalysis.avgQuality}/100`);
              }
              break;
            case 'sentiment':
              aiSentimentAnalysis = item.result;
              console.log(`   ✅ Sentiment: ${aiSentimentAnalysis.score}/100`);
              break;
            case 'hashtag':
              aiHashtagAnalysis = item.result;
              console.log(`   ✅ Hashtags: ${aiHashtagAnalysis.rating}`);
              break;
            case 'cta':
              aiCtaAnalysis = item.result;
              console.log(`   ✅ CTA Usage: ${aiCtaAnalysis.rating}`);
              break;
            case 'colorPalette':
              aiColorPaletteAnalysis = item.result;
              console.log(`   ✅ Color Palette: ${aiColorPaletteAnalysis.rating}/20`);
              break;
            case 'trend':
              aiTrendAnalysis = item.result;
              console.log(`   ✅ Trend Relevance: ${aiTrendAnalysis.score}/10`);
              break;
            case 'monetization':
              aiMonetizationAnalysis = item.result;
              console.log(`   ✅ Monetization: ${aiMonetizationAnalysis.rating}/50`);
              break;
            case 'payout':
              aiPayoutPrediction = item.result;
              console.log(`   ✅ Predicted Payout: ₹${aiPayoutPrediction.payout}`);
              break;
            case 'audienceSentiment':
              aiAudienceSentiment = item.result;
              console.log(`   ✅ Audience Sentiment: ${aiAudienceSentiment.rating}/20`);
              break;
          }
        }

        // Generate retention curve (depends on visual analysis, so do it after)
        try {
          aiRetentionCurve = await this.geminiAIService.generateRetentionCurve({
            retentionRate: 70,
            avgDuration: "30 Sec",
            engagementRate: avgEngagementRate,
            contentQuality: aiVisualAnalysis?.avgQuality || 75,
          });
          console.log(`   ✅ Retention curve generated`);
        } catch (error) {
          console.warn(`   ⚠️  Retention curve generation failed: ${error.message}`);
        }

        aiFeedbackGeneratedAt = new Date();
        const totalAICalls = basicResults.length + comprehensiveResults.length + 1; // +1 for retention curve
        console.log(`\n   🎯 COMPREHENSIVE AI analysis completed! (${totalAICalls} analyses generated in PARALLEL)\n`);

      } catch (error) {
        console.warn(`   ⚠️  AI feedback generation failed: ${error.message}`);
        console.warn(`   Continuing without AI feedback...\n`);
      }
    } else {
      console.log(`   ℹ️  AI not available or no posts to analyze - skipping AI feedback generation\n`);
    }

    // Store snapshot with AI feedback AND demographics
    const snapshot = await this.instagramProfileAnalysisModel.create({
      influencerId: userType === 'influencer' ? userId : undefined,
      brandId: userType === 'brand' ? userId : undefined,
      instagramUserId: user.instagramUserId,
      instagramUsername: user.instagramUsername,
      syncNumber,
      syncDate: new Date(),
      analysisPeriodStart: periodStart,
      analysisPeriodEnd: periodEnd,
      postsAnalyzed,
      totalFollowers,
      activeFollowers,
      activeFollowersPercentage,
      onlineFollowersHourlyData: onlineFollowersData,
      avgEngagementRate,
      avgReach,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      // Demographics (age/gender, cities, countries)
      audienceAgeGender,
      audienceCities,
      audienceCountries,
      // AI Feedback (generated once per snapshot, reused by profile scoring)
      aiGrowthFeedback,
      aiPostingFeedback,
      aiEngagementFeedback,
      aiContentFeedback,
      aiFeedbackGeneratedAt,
      aiFeedbackVersion: 1,
      // Comprehensive AI Analysis Cache (eliminates need for repeated AI calls)
      aiNicheAnalysis,
      aiLanguageAnalysis,
      aiVisualAnalysis,
      aiSentimentAnalysis,
      aiHashtagAnalysis,
      aiCtaAnalysis,
      aiColorPaletteAnalysis,
      aiTrendAnalysis,
      aiRetentionCurve,
      aiMonetizationAnalysis,
      aiPayoutPrediction,
      aiAudienceSentiment,
      analyzedAt: new Date(),
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ SNAPSHOT #${syncNumber} - STORED SUCCESSFULLY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`🆔 Snapshot ID: ${snapshot.id}`);
    console.log(`📊 Metrics Stored:`);
    console.log(`   - Posts Analyzed: ${postsAnalyzed}`);
    console.log(`   - Total Followers: ${totalFollowers}`);
    console.log(`   - Active Followers: ${activeFollowers} (${activeFollowersPercentage}%)`);
    console.log(`   - Avg Engagement Rate: ${avgEngagementRate}%`);
    console.log(`   - Avg Reach: ${avgReach}`);
    console.log(`   - Total Likes: ${totalLikes}`);
    console.log(`   - Total Comments: ${totalComments}`);
    console.log(`   - Total Shares: ${totalShares}`);
    console.log(`   - Total Saves: ${totalSaves}`);
    if (audienceAgeGender.length > 0 || audienceCities.length > 0 || audienceCountries.length > 0) {
      console.log(`📊 Demographics Stored:`);
      if (audienceAgeGender.length > 0) console.log(`   - Age/Gender Segments: ${audienceAgeGender.length}`);
      if (audienceCities.length > 0) console.log(`   - Cities: ${audienceCities.length}`);
      if (audienceCountries.length > 0) console.log(`   - Countries: ${audienceCountries.length}`);
    }
    if (aiGrowthFeedback || aiPostingFeedback || aiEngagementFeedback || aiContentFeedback) {
      console.log(`🤖 AI Feedback & Analysis Stored:`);
      if (aiGrowthFeedback) console.log(`   - Growth: ${aiGrowthFeedback}`);
      if (aiPostingFeedback) console.log(`   - Posting: ${aiPostingFeedback}`);
      if (aiEngagementFeedback) console.log(`   - Engagement: ${aiEngagementFeedback}`);
      if (aiContentFeedback) console.log(`   - Content: ${aiContentFeedback}`);
      const cacheCount = [aiNicheAnalysis, aiLanguageAnalysis, aiVisualAnalysis, aiSentimentAnalysis,
                          aiHashtagAnalysis, aiCtaAnalysis, aiColorPaletteAnalysis, aiTrendAnalysis,
                          aiRetentionCurve, aiMonetizationAnalysis, aiPayoutPrediction, aiAudienceSentiment]
                          .filter(Boolean).length;
      if (cacheCount > 0) {
        console.log(`   - Comprehensive Analysis: ${cacheCount} AI results cached`);
      }
    }
    console.log(`⏰ Stored at: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      snapshotId: snapshot.id,
      syncNumber,
      period: {
        start: periodStart.toISOString().split('T')[0],
        end: periodEnd.toISOString().split('T')[0],
        days: Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)),
      },
      metrics: {
        postsAnalyzed,
        totalFollowers,
        activeFollowers,
        activeFollowersPercentage,
        avgEngagementRate,
        avgReach,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
      },
    };
  }

  /**
   * Comprehensive sync of all Instagram insights with progressive growth tracking
   * Creates new snapshot and compares with last snapshot if 30+ days have passed
   * @param userId - The user's ID (brand or influencer)
   * @param userType - Type of user ('brand' or 'influencer')
   * @returns Comprehensive sync result with new snapshot and growth comparison
   */
  async syncAllInsights(
    userId: number,
    userType: UserType,
    jobId?: string,
  ): Promise<any> {
    // Generate jobId if not provided (for backward compatibility)
    const actualJobId = jobId || `sync-${userId}-${Date.now()}`;

    try {
      // Emit: Starting sync (0%)
      if (jobId) {
        this.instagramSyncGateway.emitSyncProgress(
          userId,
          userType,
          actualJobId,
          0,
          'Starting Instagram profile sync...',
        );
      }

      const user = await this.getUser(userId, userType);

    if (!user.instagramAccessToken || !user.instagramUserId) {
      throw new BadRequestException('No Instagram account connected');
    }

    const syncedAt = new Date();
    console.log(`🔄 Starting comprehensive sync with progressive growth tracking for ${userType} ${userId}...`);

    // STEP 1: Check for existing snapshots and determine if sync is allowed
    const lastSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: userType === 'influencer'
        ? { influencerId: userId }
        : { brandId: userId },
      order: [['analysisPeriodEnd', 'DESC']],
    });

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Determine date ranges based on last snapshot
    let newSnapshotStart: Date;
    let newSnapshotEnd: Date;
    let syncNumber: number;
    let isInitialSnapshot = false;

    if (lastSnapshot && lastSnapshot.analysisPeriodEnd) {
      // Check if 15 days have passed since last snapshot
      const lastSnapshotEnd = new Date(lastSnapshot.analysisPeriodEnd);
      const daysSinceLastSnapshot = Math.floor((today.getTime() - lastSnapshotEnd.getTime()) / (1000 * 60 * 60 * 24));

      // Allow sync if snapshots exist but demographics data is missing (grace period for demographics fetch)
      const hasDemographics = lastSnapshot.audienceAgeGender && lastSnapshot.audienceAgeGender.length > 0;
      const allowDemographicsGracePeriod = !hasDemographics && daysSinceLastSnapshot < 15;

      if (daysSinceLastSnapshot < 15 && !allowDemographicsGracePeriod) {
        const daysRemaining = 15 - daysSinceLastSnapshot;
        const nextSyncDate = new Date(lastSnapshotEnd.getTime() + (15 * 24 * 60 * 60 * 1000));

        throw new BadRequestException({
          error: 'sync_throttled',
          message: `Instagram profile sync is limited to once every 15 days. Please wait ${daysRemaining} more day(s).`,
          details: {
            lastSnapshotDate: lastSnapshotEnd.toISOString().split('T')[0],
            nextAllowedSyncDate: nextSyncDate.toISOString().split('T')[0],
            daysSinceLastSnapshot,
            daysRemaining,
          },
        });
      }

      // Create new snapshot from last snapshot end + 1 day to today
      newSnapshotStart = new Date(lastSnapshotEnd);
      newSnapshotStart.setDate(newSnapshotStart.getDate() + 1);
      newSnapshotStart.setHours(0, 0, 0, 0);
      newSnapshotEnd = new Date(today);
      syncNumber = (lastSnapshot.syncNumber || 0) + 1;

      console.log(`📊 Creating snapshot #${syncNumber} from ${newSnapshotStart.toISOString().split('T')[0]} to ${newSnapshotEnd.toISOString().split('T')[0]} (${daysSinceLastSnapshot} days since last snapshot)`);
    } else {
      // No previous snapshot - create TWO initial snapshots for growth comparison
      isInitialSnapshot = true;
      syncNumber = 2; // We'll create snapshots 1 and 2

      console.log(`🆕 INITIAL CONNECT: Creating 2 snapshots for immediate growth comparison`);
      console.log(`📅 Snapshot 1: 60-30 days ago (for baseline)`);
      console.log(`📅 Snapshot 2: Last 30 days (current performance)`);
    }

    // STEP 2: Fetch basic profile first
    let profileData: any = {};
    try {
      const profile = await this.getUserProfile(user.instagramAccessToken);
      await user.update({
        instagramUsername: profile.username,
        instagramAccountType: profile.account_type || undefined,
        instagramFollowersCount: profile.followers_count || undefined,
        instagramFollowsCount: profile.follows_count || undefined,
        instagramMediaCount: profile.media_count || undefined,
        instagramProfilePictureUrl: profile.profile_picture_url || undefined,
        instagramBio: profile.biography || undefined,
      });

      profileData = {
        status: 'success',
        data: {
          username: profile.username,
          followersCount: profile.followers_count,
          followsCount: profile.follows_count,
          mediaCount: profile.media_count,
          accountType: profile.account_type,
        },
      };
    } catch (error) {
      profileData = {
        status: 'error',
        message: 'Failed to fetch basic profile data',
        error: error.message,
      };
    }

    // Emit: Profile fetched (25%)
    if (jobId) {
      this.instagramSyncGateway.emitSyncProgress(
        userId,
        userType,
        actualJobId,
        25,
        'Profile data fetched. Creating snapshots...',
      );
    }

    // STEP 3: Create snapshot(s)
    let snapshot1Data: any = null;
    let snapshot2Data: any = null;

    if (isInitialSnapshot) {
      // Initial connect: Create TWO snapshots
      console.log(`🔄 Creating 2 initial snapshots...`);

      // Snapshot 1: 60-30 days ago (baseline)
      const snapshot1End = new Date(today);
      snapshot1End.setDate(snapshot1End.getDate() - 30);
      snapshot1End.setHours(23, 59, 59, 999);
      const snapshot1Start = new Date(snapshot1End);
      snapshot1Start.setDate(snapshot1Start.getDate() - 29);
      snapshot1Start.setHours(0, 0, 0, 0);

      // Snapshot 2: Last 30 days (current)
      const snapshot2End = new Date(today);
      const snapshot2Start = new Date(today);
      snapshot2Start.setDate(snapshot2Start.getDate() - 30);
      snapshot2Start.setHours(0, 0, 0, 0);

      try {
        snapshot1Data = await this.fetchSnapshotForPeriod(userId, userType, snapshot1Start, snapshot1End, 1);
      } catch (error) {
        console.error('❌ Failed to create snapshot 1:', error.message);
        snapshot1Data = {
          error: 'Failed to create first snapshot',
          message: error.message,
        };
      }

      try {
        snapshot2Data = await this.fetchSnapshotForPeriod(userId, userType, snapshot2Start, snapshot2End, 2);
      } catch (error) {
        console.error('❌ Failed to create snapshot 2:', error.message);
        snapshot2Data = {
          error: 'Failed to create second snapshot',
          message: error.message,
        };
      }
    } else {
      // Progressive sync: Create ONE new snapshot
      // newSnapshotStart and newSnapshotEnd are guaranteed to be set because
      // isInitialSnapshot is false, meaning we went through the lastSnapshot branch above
      try {
        snapshot2Data = await this.fetchSnapshotForPeriod(userId, userType, newSnapshotStart!, newSnapshotEnd!, syncNumber);
      } catch (error) {
        console.error('❌ Failed to create new snapshot:', error.message);
        throw new InternalServerErrorException({
          error: 'snapshot_creation_failed',
          message: 'Failed to create snapshot',
          details: error.message,
        });
      }
    }

    // STEP 4: Calculate growth metrics
    let growthComparison: any = null;
    let previousSnapshot: any = null;
    let currentSnapshot: any = null;

    if (isInitialSnapshot) {
      // Initial: Compare snapshot1 vs snapshot2
      if (snapshot1Data?.metrics && snapshot2Data?.metrics) {
        previousSnapshot = snapshot1Data;
        currentSnapshot = snapshot2Data;
        console.log(`📊 Comparing INITIAL snapshots: #1 vs #2...`);
      }
    } else {
      // Progressive: Compare last snapshot vs new snapshot
      if (lastSnapshot && snapshot2Data?.metrics) {
        previousSnapshot = {
          syncNumber: lastSnapshot.syncNumber,
          metrics: {
            totalFollowers: lastSnapshot.totalFollowers || 0,
            avgEngagementRate: Number(lastSnapshot.avgEngagementRate) || 0,
            avgReach: lastSnapshot.avgReach || 0,
            postsAnalyzed: lastSnapshot.postsAnalyzed || 0,
            activeFollowersPercentage: Number(lastSnapshot.activeFollowersPercentage) || 0,
          },
        };
        currentSnapshot = snapshot2Data;
        console.log(`📊 Comparing snapshot #${lastSnapshot.syncNumber} vs snapshot #${syncNumber}...`);
      }
    }

    if (previousSnapshot && currentSnapshot) {
      const previous = previousSnapshot.metrics;
      const current = currentSnapshot.metrics;

      const calculateGrowth = (oldVal: number, newVal: number) => {
        if (oldVal === 0) return newVal > 0 ? 100 : 0;
        return Number((((newVal - oldVal) / oldVal) * 100).toFixed(2));
      };

      growthComparison = {
        followers: {
          previous: previous.totalFollowers,
          current: current.totalFollowers,
          change: current.totalFollowers - previous.totalFollowers,
          changePercentage: calculateGrowth(previous.totalFollowers, current.totalFollowers),
        },
        engagement: {
          previous: previous.avgEngagementRate,
          current: current.avgEngagementRate,
          change: Number((current.avgEngagementRate - previous.avgEngagementRate).toFixed(2)),
          changePercentage: calculateGrowth(previous.avgEngagementRate, current.avgEngagementRate),
        },
        reach: {
          previous: previous.avgReach,
          current: current.avgReach,
          change: current.avgReach - previous.avgReach,
          changePercentage: calculateGrowth(previous.avgReach, current.avgReach),
        },
        posts: {
          previous: previous.postsAnalyzed,
          current: current.postsAnalyzed,
          change: current.postsAnalyzed - previous.postsAnalyzed,
        },
        activeFollowers: {
          previous: previous.activeFollowersPercentage,
          current: current.activeFollowersPercentage,
          change: Number((current.activeFollowersPercentage - previous.activeFollowersPercentage).toFixed(2)),
        },
      };

      console.log(`📈 Growth: Followers ${growthComparison.followers.changePercentage}%, Engagement ${growthComparison.engagement.changePercentage}%`);
    }

    // Emit: Snapshots created (50%)
    if (jobId) {
      this.instagramSyncGateway.emitSyncProgress(
        userId,
        userType,
        actualJobId,
        50,
        'Fetching audience demographics...',
      );
    }

    // STEP 5: Fetch additional insights (demographics, geographic data, etc.)
    let demographicsData: any = null;
    try {
      const ageGenderResponse = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'follower_demographics',
            period: 'lifetime',
            metric_type: 'total_value',
            breakdown: 'age,gender',
            access_token: user.instagramAccessToken,
          },
        }
      );

      const demographics = ageGenderResponse.data.data[0]?.total_value?.breakdowns?.[0]?.results || [];
      demographicsData = {
        status: 'success',
        data: demographics,
      };
    } catch (error) {
      console.error('❌ Demographics fetch error:', error.response?.data || error.message);
      const isFacebookError = error.response?.data?.error?.message?.toLowerCase().includes('instagram') ||
                             error.response?.data?.error?.message?.toLowerCase().includes('permission');
      demographicsData = {
        status: 'unavailable',
        reason: isFacebookError ? 'facebook_not_connected' : 'api_error',
        message: isFacebookError
          ? 'Connect your Instagram to Facebook to access audience demographics'
          : 'Failed to fetch demographics',
        data: null,
      };
    }

    let geographicData: any = null;
    try {
      const countriesResponse = await axios.get(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: 'follower_demographics',
            period: 'lifetime',
            metric_type: 'total_value',
            breakdown: 'country',
            access_token: user.instagramAccessToken,
          },
        }
      );

      const countries = countriesResponse.data.data[0]?.total_value?.breakdowns?.[0]?.results || [];
      geographicData = {
        status: 'success',
        data: countries,
      };
    } catch (error) {
      console.error('❌ Geographic data fetch error:', error.response?.data || error.message);
      const isFacebookError = error.response?.data?.error?.message?.toLowerCase().includes('instagram') ||
                             error.response?.data?.error?.message?.toLowerCase().includes('permission');
      geographicData = {
        status: 'unavailable',
        reason: isFacebookError ? 'facebook_not_connected' : 'api_error',
        message: isFacebookError
          ? 'Connect your Instagram to Facebook to access geographic data'
          : 'Failed to fetch geographic data',
        data: null,
      };
    }

    // Emit: Demographics and geographic data fetched (75%)
    if (jobId) {
      this.instagramSyncGateway.emitSyncProgress(
        userId,
        userType,
        actualJobId,
        75,
        'Updating snapshots with audience insights...',
      );
    }

    // STEP 5: Update snapshots with demographics and geographic data
    if (demographicsData?.status === 'success' && demographicsData.data) {
      console.log(`📊 Saving demographics to snapshots...`);

      // Parse demographics into the format expected by the database
      const ageGenderData = demographicsData.data.map((item: any) => ({
        ageRange: item.dimension_values[0],
        gender: item.dimension_values[1],
        percentage: (item.value / profileData.data.followersCount * 100).toFixed(2),
      }));

      // Parse geographic data
      let countriesData = [];
      let citiesData = [];

      if (geographicData?.status === 'success' && geographicData.data) {
        countriesData = geographicData.data.map((item: any) => ({
          location: item.dimension_values[0], // Use 'location' field name to match scoring service expectation
          percentage: Number(((item.value / profileData.data.followersCount) * 100).toFixed(2)),
        }));
      }

      // Update snapshot 2 (current snapshot) with demographics
      if (snapshot2Data?.snapshotId) {
        try {
          // Get previous snapshot to copy AI cache (if available)
          const previousSnapshot = await this.instagramProfileAnalysisModel.findOne({
            where: { influencerId: userId, syncNumber: snapshot2Data.syncNumber - 1 },
          });

          const updateData: any = {
            audienceAgeGender: ageGenderData,
            audienceCountries: countriesData,
          };
          if (citiesData.length > 0) {
            updateData.audienceCities = citiesData;
          }

          // Copy AI cache from previous snapshot if available
          if (previousSnapshot) {
            if (previousSnapshot.aiNicheAnalysis) updateData.aiNicheAnalysis = previousSnapshot.aiNicheAnalysis;
            if (previousSnapshot.aiLanguageAnalysis) updateData.aiLanguageAnalysis = previousSnapshot.aiLanguageAnalysis;
            if (previousSnapshot.aiVisualAnalysis) updateData.aiVisualAnalysis = previousSnapshot.aiVisualAnalysis;
            if (previousSnapshot.aiSentimentAnalysis) updateData.aiSentimentAnalysis = previousSnapshot.aiSentimentAnalysis;
            if (previousSnapshot.aiHashtagAnalysis) updateData.aiHashtagAnalysis = previousSnapshot.aiHashtagAnalysis;
            if (previousSnapshot.aiCtaAnalysis) updateData.aiCtaAnalysis = previousSnapshot.aiCtaAnalysis;
            if (previousSnapshot.aiColorPaletteAnalysis) updateData.aiColorPaletteAnalysis = previousSnapshot.aiColorPaletteAnalysis;
            if (previousSnapshot.aiTrendAnalysis) updateData.aiTrendAnalysis = previousSnapshot.aiTrendAnalysis;
            if (previousSnapshot.aiRetentionCurve) updateData.aiRetentionCurve = previousSnapshot.aiRetentionCurve;
            if (previousSnapshot.aiEngagementFeedback) updateData.aiEngagementFeedback = previousSnapshot.aiEngagementFeedback;
            if (previousSnapshot.aiMonetizationAnalysis) updateData.aiMonetizationAnalysis = previousSnapshot.aiMonetizationAnalysis;
            if (previousSnapshot.aiPayoutPrediction) updateData.aiPayoutPrediction = previousSnapshot.aiPayoutPrediction;
            if (previousSnapshot.aiAudienceSentiment) updateData.aiAudienceSentiment = previousSnapshot.aiAudienceSentiment;
            if (previousSnapshot.aiFeedbackGeneratedAt) updateData.aiFeedbackGeneratedAt = previousSnapshot.aiFeedbackGeneratedAt;
            console.log(`📋 Copying AI cache from snapshot #${previousSnapshot.syncNumber} to #${snapshot2Data.syncNumber}`);
          }

          await this.instagramProfileAnalysisModel.update(
            updateData,
            {
              where: { id: snapshot2Data.snapshotId },
            }
          );
          console.log(`✅ Updated snapshot #${snapshot2Data.syncNumber} with demographics`);
        } catch (error) {
          console.error(`❌ Failed to update snapshot #${snapshot2Data.syncNumber} with demographics:`, error.message);
        }
      }

      // Update snapshot 1 (baseline) with same demographics if it exists
      if (isInitialSnapshot && snapshot1Data?.snapshotId) {
        try {
          const updateData: any = {
            audienceAgeGender: ageGenderData,
            audienceCountries: countriesData,
          };
          if (citiesData.length > 0) {
            updateData.audienceCities = citiesData;
          }

          await this.instagramProfileAnalysisModel.update(
            updateData,
            {
              where: { id: snapshot1Data.snapshotId },
            }
          );
          console.log(`✅ Updated snapshot #${snapshot1Data.syncNumber} with demographics`);
        } catch (error) {
          console.error(`❌ Failed to update snapshot #${snapshot1Data.syncNumber} with demographics:`, error.message);
        }
      }
    } else {
      console.log(`⚠️  Skipping demographics save - data not available`);
    }

    console.log(`✅ Comprehensive sync completed for ${userType} ${userId}`);

    const response: any = {
      message: isInitialSnapshot
        ? `Initial Instagram insights snapshots created (#1 and #2)`
        : `Instagram insights snapshot #${syncNumber} created with growth analysis`,
      syncedAt: syncedAt.toISOString(),
      basicProfile: profileData,
      currentSnapshot: snapshot2Data,
      audienceDemographics: demographicsData,
      geographicData: geographicData,
    };

    if (isInitialSnapshot && snapshot1Data) {
      // For initial sync, return both snapshots
      response.snapshots = {
        baseline: snapshot1Data,
        current: snapshot2Data,
      };
    } else if (!isInitialSnapshot && lastSnapshot) {
      response.previousSnapshot = {
        snapshotId: lastSnapshot.id,
        syncNumber: lastSnapshot.syncNumber,
        period: {
          start: lastSnapshot.analysisPeriodStart ? new Date(lastSnapshot.analysisPeriodStart).toISOString().split('T')[0] : null,
          end: lastSnapshot.analysisPeriodEnd ? new Date(lastSnapshot.analysisPeriodEnd).toISOString().split('T')[0] : null,
        },
        metrics: {
          postsAnalyzed: lastSnapshot.postsAnalyzed,
          totalFollowers: lastSnapshot.totalFollowers,
          activeFollowers: lastSnapshot.activeFollowers,
          activeFollowersPercentage: Number(lastSnapshot.activeFollowersPercentage),
          avgEngagementRate: Number(lastSnapshot.avgEngagementRate),
          avgReach: lastSnapshot.avgReach,
          totalLikes: lastSnapshot.totalLikes,
          totalComments: lastSnapshot.totalComments,
          totalShares: lastSnapshot.totalShares,
          totalSaves: lastSnapshot.totalSaves,
        },
      };
      response.growth = growthComparison;
    }

    // Emit: Complete (100%)
    if (jobId) {
      this.instagramSyncGateway.emitSyncComplete(
        userId,
        userType,
        actualJobId,
        {
          snapshotsCreated: isInitialSnapshot ? 2 : 1,
          syncNumber: isInitialSnapshot ? 2 : syncNumber,
          hasDemographics: demographicsData?.status === 'success',
          hasGeographicData: geographicData?.status === 'success',
          hasGrowthComparison: growthComparison !== null,
        },
      );
    }

    return response;
    } catch (error) {
      // Emit error
      if (jobId) {
        this.instagramSyncGateway.emitSyncError(
          userId,
          userType,
          actualJobId,
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error instanceof BadRequestException ?
              (error.getResponse() as any)?.error || 'SYNC_ERROR' : 'SYNC_ERROR',
          },
        );
      }

      throw error;
    }
  }

}
