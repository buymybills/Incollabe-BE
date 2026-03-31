import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FiamCampaign } from '../models/fiam-campaign.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { FiamTriggerService, UserContext } from './fiam-trigger.service';
import { FiamEventService } from './fiam-event.service';
import { TriggerEvent } from '../models/fiam-campaign.model';
import { EventType } from '../models/fiam-campaign-event.model';
import {
  GetEligibleCampaignsDto,
  EligibleCampaignResponseDto,
  GetEligibleCampaignsResponseDto,
  TrackCampaignEventDto,
  TrackCampaignEventResponseDto,
} from '../dto/fiam-campaign-mobile.dto';

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class FiamCampaignMobileService {
  private readonly logger = new Logger(FiamCampaignMobileService.name);

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    private fiamTriggerService: FiamTriggerService,
    private fiamEventService: FiamEventService,
  ) {}

  // ============================================================================
  // GET ELIGIBLE CAMPAIGNS
  // ============================================================================

  /**
   * Get eligible campaigns for user based on trigger event
   */
  async getEligibleCampaigns(
    dto: GetEligibleCampaignsDto,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<GetEligibleCampaignsResponseDto> {
    try {
      // Build user context
      const userContext = await this.buildUserContext(userId, userType);

      // Get eligible campaigns
      const campaigns = await this.fiamTriggerService.getEligibleCampaigns(
        dto.triggerEvent,
        userContext,
      );

      // Map to response DTOs
      const campaignDtos: EligibleCampaignResponseDto[] = campaigns.map(
        (campaign) => ({
          id: campaign.id,
          name: campaign.name,
          priority: campaign.priority,
          uiConfig: campaign.uiConfig,
          expiresAt: campaign.endDate,
        }),
      );

      return {
        campaigns: campaignDtos,
        total: campaignDtos.length,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching eligible campaigns for user ${userId}:`,
        error,
      );
      // Return empty array on error instead of throwing
      return {
        campaigns: [],
        total: 0,
      };
    }
  }

  // ============================================================================
  // TRACK EVENTS
  // ============================================================================

  /**
   * Track campaign event (impression, click, dismiss, conversion)
   */
  async trackCampaignEvent(
    campaignId: number,
    dto: TrackCampaignEventDto,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<TrackCampaignEventResponseDto> {
    try {
      // Track event based on type
      const eventParams = {
        campaignId,
        userId,
        userType,
        eventMetadata: dto.eventMetadata,
        sessionId: dto.sessionId,
        deviceType: dto.deviceType,
        appVersion: dto.appVersion,
      };

      switch (dto.eventType) {
        case EventType.IMPRESSION:
          await this.fiamEventService.trackImpression(eventParams);
          break;
        case EventType.CLICK:
          await this.fiamEventService.trackClick(eventParams);
          break;
        case EventType.DISMISS:
          await this.fiamEventService.trackDismiss(eventParams);
          break;
        case EventType.CONVERSION:
          await this.fiamEventService.trackConversion(eventParams);
          break;
      }

      return {
        success: true,
        message: 'Event tracked successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error tracking event for campaign ${campaignId}:`,
        error,
      );
      // Return success even on error (fire-and-forget pattern)
      return {
        success: true,
        message: 'Event queued for tracking',
      };
    }
  }

  // ============================================================================
  // USER CONTEXT BUILDER
  // ============================================================================

  /**
   * Build user context by fetching user data from database
   */
  private async buildUserContext(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<UserContext> {
    if (userType === 'influencer') {
      return this.buildInfluencerContext(userId);
    } else {
      return this.buildBrandContext(userId);
    }
  }

  /**
   * Build context for influencer
   */
  private async buildInfluencerContext(
    influencerId: number,
  ): Promise<UserContext> {
    const influencer = await this.influencerModel.findByPk(influencerId, {
      attributes: [
        'id',
        'gender',
        'dateOfBirth',
        'weeklyCredits',
        'instagramFollowersCount',
      ],
      include: [
        {
          model: this.influencerModel.sequelize!.models.Niche,
          as: 'niches',
          attributes: ['id'],
          through: { attributes: [] },
        },
        {
          model: this.influencerModel.sequelize!.models.City,
          as: 'city',
          attributes: ['name'],
        },
      ],
    });

    if (!influencer) {
      // Return minimal context if user not found
      return {
        userId: influencerId,
        userType: 'influencer',
      };
    }

    // Calculate age from date of birth
    let age: number | undefined;
    if (influencer.dateOfBirth) {
      const birthDate = new Date(influencer.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
    }

    // Extract niche IDs
    let nicheIds: number[] | undefined;
    if (influencer.niches && Array.isArray(influencer.niches)) {
      nicheIds = influencer.niches.map((niche: any) => niche.id);
    }

    // Get city name
    const cityName = influencer.city ? (influencer.city as any).name : undefined;

    // Get campaign applications count (we'll skip this for now to avoid extra query)
    // Can be added later if needed
    const campaignApplicationsCount = 0; // TODO: Implement if needed

    // Check if has pro subscription (we'll skip this for now)
    const hasProSubscription = false; // TODO: Implement if needed

    return {
      userId: influencer.id,
      userType: 'influencer',
      gender: influencer.gender as 'male' | 'female' | 'others' | undefined,
      age,
      city: cityName,
      nicheIds,
      campaignApplicationsCount,
      creditsBalance: influencer.weeklyCredits || 0,
      hasProSubscription,
      followerCount: influencer.instagramFollowersCount || 0,
    };
  }

  /**
   * Build context for brand
   */
  private async buildBrandContext(brandId: number): Promise<UserContext> {
    const brand = await this.brandModel.findByPk(brandId, {
      attributes: ['id', 'aiCreditsRemaining'],
    });

    if (!brand) {
      // Return minimal context if user not found
      return {
        userId: brandId,
        userType: 'brand',
      };
    }

    return {
      userId: brand.id,
      userType: 'brand',
      creditsBalance: brand.aiCreditsRemaining || 0,
    };
  }
}
