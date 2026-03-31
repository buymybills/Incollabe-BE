import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  FiamCampaign,
  TriggerType,
  TriggerEvent,
  CampaignStatus,
} from '../models/fiam-campaign.model';
import { FiamEventService } from './fiam-event.service';
import { Op } from 'sequelize';

// ============================================================================
// INTERFACES
// ============================================================================

export interface UserContext {
  userId: number;
  userType: 'influencer' | 'brand';

  // Demographics (for influencers)
  gender?: 'male' | 'female' | 'others';
  age?: number;
  city?: string;
  nicheIds?: number[];

  // Behavior data
  campaignApplicationsCount?: number;
  creditsBalance?: number;
  hasProSubscription?: boolean;
  followerCount?: number;
}

export interface EligibleCampaign {
  campaign: FiamCampaign;
  priority: number;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class FiamTriggerService {
  private readonly logger = new Logger(FiamTriggerService.name);

  constructor(
    @InjectModel(FiamCampaign)
    private fiamCampaignModel: typeof FiamCampaign,
    private fiamEventService: FiamEventService,
  ) {}

  // ============================================================================
  // MAIN ELIGIBILITY ENGINE
  // ============================================================================

  /**
   * Get all eligible campaigns for a user based on trigger event and targeting filters
   * Returns campaigns sorted by priority (highest first)
   */
  async getEligibleCampaigns(
    triggerEvent: TriggerEvent,
    userContext: UserContext,
  ): Promise<FiamCampaign[]> {
    try {
      // Step 1: Fetch all potentially eligible campaigns
      const candidates = await this.getCandidateCampaigns(triggerEvent);

      if (candidates.length === 0) {
        return [];
      }

      // Step 2: Filter by targeting rules and frequency caps
      const eligible: EligibleCampaign[] = [];

      for (const campaign of candidates) {
        // Check if campaign passes all filters
        const passes = await this.checkCampaignEligibility(
          campaign,
          userContext,
        );

        if (passes) {
          eligible.push({
            campaign,
            priority: campaign.priority || 0,
          });
        }
      }

      // Step 3: Sort by priority (highest first) and return
      eligible.sort((a, b) => b.priority - a.priority);

      return eligible.map((item) => item.campaign);
    } catch (error) {
      this.logger.error(
        `Error fetching eligible campaigns for trigger ${triggerEvent}:`,
        error,
      );
      return [];
    }
  }

  // ============================================================================
  // CANDIDATE SELECTION
  // ============================================================================

  /**
   * Fetch all campaigns that match the basic criteria
   * - Active status
   * - Event-triggered type
   * - Matching trigger event
   * - Within date range
   * - Not reached global impression limit
   */
  private async getCandidateCampaigns(
    triggerEvent: TriggerEvent,
  ): Promise<FiamCampaign[]> {
    const now = new Date();

    return this.fiamCampaignModel.findAll({
      where: {
        status: CampaignStatus.ACTIVE,
        triggerType: TriggerType.EVENT,
        triggerEvents: {
          [Op.contains]: [triggerEvent], // JSONB array contains
        },
        [Op.and]: [
          {
            [Op.or]: [
              { startDate: null },
              { startDate: { [Op.lte]: now } },
            ],
          },
          {
            [Op.or]: [
              { endDate: null },
              { endDate: { [Op.gte]: now } },
            ],
          },
        ],
      },
      order: [['priority', 'DESC']],
    });
  }

  // ============================================================================
  // ELIGIBILITY CHECKS
  // ============================================================================

  /**
   * Check if a campaign is eligible for a user
   * Returns true if all targeting rules pass
   */
  private async checkCampaignEligibility(
    campaign: FiamCampaign,
    userContext: UserContext,
  ): Promise<boolean> {
    // Check 1: Global impression limit
    if (campaign.hasReachedGlobalLimit()) {
      return false;
    }

    // Check 2: User type targeting
    if (!this.checkUserTypeTargeting(campaign, userContext)) {
      return false;
    }

    // Check 3: Specific user IDs (allowlist/blocklist)
    if (!this.checkSpecificUserTargeting(campaign, userContext)) {
      return false;
    }

    // Check 4: Demographics (gender, age, location, niches)
    if (!this.checkDemographicTargeting(campaign, userContext)) {
      return false;
    }

    // Check 5: Behavior filters
    if (!this.checkBehaviorTargeting(campaign, userContext)) {
      return false;
    }

    // Check 6: Frequency capping
    const frequencyCheck = await this.fiamEventService.checkFrequencyCap(
      campaign.id,
      userContext.userId,
      userContext.userType,
    );

    if (!frequencyCheck.canShow) {
      return false;
    }

    return true;
  }

  /**
   * Check user type targeting (influencer vs brand)
   */
  private checkUserTypeTargeting(
    campaign: FiamCampaign,
    userContext: UserContext,
  ): boolean {
    // No targeting = show to all
    if (!campaign.targetUserTypes || campaign.targetUserTypes.length === 0) {
      return true;
    }

    return campaign.targetUserTypes.includes(userContext.userType);
  }

  /**
   * Check specific user IDs targeting
   */
  private checkSpecificUserTargeting(
    campaign: FiamCampaign,
    userContext: UserContext,
  ): boolean {
    // No specific targeting = show to all
    if (
      !campaign.targetSpecificUserIds ||
      campaign.targetSpecificUserIds.length === 0
    ) {
      return true;
    }

    return campaign.targetSpecificUserIds.includes(userContext.userId);
  }

  /**
   * Check demographic targeting (gender, age, location, niches)
   */
  private checkDemographicTargeting(
    campaign: FiamCampaign,
    userContext: UserContext,
  ): boolean {
    // Gender check
    if (
      campaign.targetGender &&
      campaign.targetGender !== 'all' &&
      userContext.gender
    ) {
      if (campaign.targetGender !== userContext.gender) {
        return false;
      }
    }

    // Age check
    if (userContext.age !== undefined) {
      if (
        campaign.targetMinAge !== null &&
        campaign.targetMinAge !== undefined
      ) {
        if (userContext.age < campaign.targetMinAge) {
          return false;
        }
      }

      if (
        campaign.targetMaxAge !== null &&
        campaign.targetMaxAge !== undefined
      ) {
        if (userContext.age > campaign.targetMaxAge) {
          return false;
        }
      }
    }

    // Location check (city-based or pan-India)
    if (
      !campaign.targetIsPanIndia &&
      campaign.targetLocations &&
      campaign.targetLocations.length > 0
    ) {
      if (!userContext.city) {
        return false; // User has no city, but campaign targets specific cities
      }

      const cityMatch = campaign.targetLocations.some(
        (location) =>
          location.toLowerCase() === userContext.city!.toLowerCase(),
      );

      if (!cityMatch) {
        return false;
      }
    }

    // Niche check (for influencers)
    if (campaign.targetNicheIds && campaign.targetNicheIds.length > 0) {
      if (!userContext.nicheIds || userContext.nicheIds.length === 0) {
        return false; // User has no niches, but campaign targets specific niches
      }

      // Check if user has at least one matching niche
      const nicheMatch = campaign.targetNicheIds.some((nicheId) =>
        userContext.nicheIds!.includes(nicheId),
      );

      if (!nicheMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check behavior-based targeting filters
   */
  private checkBehaviorTargeting(
    campaign: FiamCampaign,
    userContext: UserContext,
  ): boolean {
    const filters = campaign.targetBehaviorFilters;

    if (!filters) {
      return true; // No behavior filters = show to all
    }

    // Minimum campaign applications
    if (
      filters.minCampaignApplications !== null &&
      filters.minCampaignApplications !== undefined
    ) {
      if (
        userContext.campaignApplicationsCount === undefined ||
        userContext.campaignApplicationsCount < filters.minCampaignApplications
      ) {
        return false;
      }
    }

    // Requires zero credits (out of credits targeting)
    if (filters.requiresZeroCredits) {
      if (
        userContext.creditsBalance === undefined ||
        userContext.creditsBalance > 0
      ) {
        return false;
      }
    }

    // Pro subscription status
    if (
      filters.hasProSubscription !== null &&
      filters.hasProSubscription !== undefined
    ) {
      if (userContext.hasProSubscription !== filters.hasProSubscription) {
        return false;
      }
    }

    // Follower count range
    if (userContext.followerCount !== undefined) {
      if (
        filters.minFollowerCount !== null &&
        filters.minFollowerCount !== undefined
      ) {
        if (userContext.followerCount < filters.minFollowerCount) {
          return false;
        }
      }

      if (
        filters.maxFollowerCount !== null &&
        filters.maxFollowerCount !== undefined
      ) {
        if (userContext.followerCount > filters.maxFollowerCount) {
          return false;
        }
      }
    }

    return true;
  }

  // ============================================================================
  // SCHEDULED CAMPAIGNS
  // ============================================================================

  /**
   * Get scheduled campaigns that are ready to broadcast
   * Used by scheduler service
   */
  async getScheduledCampaignsReadyToBroadcast(): Promise<FiamCampaign[]> {
    const now = new Date();

    return this.fiamCampaignModel.findAll({
      where: {
        status: CampaignStatus.ACTIVE,
        triggerType: TriggerType.SCHEDULED,
        scheduledAt: {
          [Op.lte]: now,
        },
        [Op.and]: [
          {
            [Op.or]: [
              { startDate: null },
              { startDate: { [Op.lte]: now } },
            ],
          },
          {
            [Op.or]: [
              { endDate: null },
              { endDate: { [Op.gte]: now } },
            ],
          },
        ],
      },
    });
  }

  // ============================================================================
  // ANALYTICS HELPERS
  // ============================================================================

  /**
   * Get total number of active campaigns
   */
  async getActiveCampaignCount(): Promise<number> {
    return this.fiamCampaignModel.count({
      where: { status: CampaignStatus.ACTIVE },
    });
  }

  /**
   * Get campaigns by trigger event
   */
  async getCampaignsByTriggerEvent(
    triggerEvent: TriggerEvent,
  ): Promise<FiamCampaign[]> {
    return this.fiamCampaignModel.findAll({
      where: {
        status: CampaignStatus.ACTIVE,
        triggerType: TriggerType.EVENT,
        triggerEvents: {
          [Op.contains]: [triggerEvent],
        },
      },
    });
  }
}
