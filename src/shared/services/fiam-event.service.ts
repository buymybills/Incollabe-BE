import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FiamCampaignEvent, EventType } from '../models/fiam-campaign-event.model';
import { FiamCampaign } from '../models/fiam-campaign.model';
import { Op } from 'sequelize';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FrequencyCheckResult {
  canShow: boolean;
  reason?: string;
}

export interface TrackEventParams {
  campaignId: number;
  userId: number;
  userType: 'influencer' | 'brand';
  eventType: EventType;
  eventMetadata?: Record<string, any>;
  sessionId?: string;
  deviceType?: 'android' | 'ios';
  appVersion?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class FiamEventService {
  private readonly logger = new Logger(FiamEventService.name);

  constructor(
    @InjectModel(FiamCampaignEvent)
    private fiamEventModel: typeof FiamCampaignEvent,
    @InjectModel(FiamCampaign)
    private fiamCampaignModel: typeof FiamCampaign,
  ) {}

  // ============================================================================
  // EVENT TRACKING (Fire-and-Forget)
  // ============================================================================

  /**
   * Track impression event (campaign shown to user)
   * Fire-and-forget pattern - does not block execution
   */
  async trackImpression(params: Omit<TrackEventParams, 'eventType'>): Promise<void> {
    this.trackEvent({
      ...params,
      eventType: EventType.IMPRESSION,
    }).catch((error) => {
      this.logger.error(`Failed to track impression for campaign ${params.campaignId}:`, error);
    });
  }

  /**
   * Track click event (user clicked button)
   * Fire-and-forget pattern - does not block execution
   */
  async trackClick(params: Omit<TrackEventParams, 'eventType'>): Promise<void> {
    this.trackEvent({
      ...params,
      eventType: EventType.CLICK,
    }).catch((error) => {
      this.logger.error(`Failed to track click for campaign ${params.campaignId}:`, error);
    });
  }

  /**
   * Track dismiss event (user closed campaign)
   * Fire-and-forget pattern - does not block execution
   */
  async trackDismiss(params: Omit<TrackEventParams, 'eventType'>): Promise<void> {
    this.trackEvent({
      ...params,
      eventType: EventType.DISMISS,
    }).catch((error) => {
      this.logger.error(`Failed to track dismiss for campaign ${params.campaignId}:`, error);
    });
  }

  /**
   * Track conversion event (user completed goal)
   * Fire-and-forget pattern - does not block execution
   */
  async trackConversion(params: Omit<TrackEventParams, 'eventType'>): Promise<void> {
    this.trackEvent({
      ...params,
      eventType: EventType.CONVERSION,
    }).catch((error) => {
      this.logger.error(`Failed to track conversion for campaign ${params.campaignId}:`, error);
    });
  }

  /**
   * Core event tracking logic
   * Creates event record and updates campaign analytics
   */
  private async trackEvent(params: TrackEventParams): Promise<void> {
    const {
      campaignId,
      userId,
      userType,
      eventType,
      eventMetadata,
      sessionId,
      deviceType,
      appVersion,
    } = params;

    // Create event record
    await this.fiamEventModel.create({
      campaignId,
      userId,
      userType,
      eventType,
      eventMetadata: eventMetadata || null,
      sessionId: sessionId || null,
      deviceType: deviceType || null,
      appVersion: appVersion || null,
    } as any);

    // Update campaign analytics (fire-and-forget)
    this.updateCampaignAnalytics(campaignId, eventType).catch((error) => {
      this.logger.error(
        `Failed to update analytics for campaign ${campaignId}:`,
        error,
      );
    });
  }

  /**
   * Update campaign analytics counters
   */
  private async updateCampaignAnalytics(
    campaignId: number,
    eventType: EventType,
  ): Promise<void> {
    const incrementField: Record<EventType, string> = {
      [EventType.IMPRESSION]: 'totalImpressions',
      [EventType.CLICK]: 'totalClicks',
      [EventType.DISMISS]: 'totalDismissals',
      [EventType.CONVERSION]: 'totalConversions',
    };

    const field = incrementField[eventType];
    if (!field) {
      return;
    }

    await this.fiamCampaignModel.increment(field as any, {
      by: 1,
      where: { id: campaignId },
    } as any);
  }

  // ============================================================================
  // FREQUENCY CAPPING
  // ============================================================================

  /**
   * Check if user has exceeded frequency limits for a campaign
   * Returns whether campaign can be shown and reason if not
   */
  async checkFrequencyCap(
    campaignId: number,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<FrequencyCheckResult> {
    // Fetch campaign with frequency config
    const campaign = await this.fiamCampaignModel.findByPk(campaignId, {
      attributes: ['id', 'frequencyConfig'],
    });

    if (!campaign || !campaign.frequencyConfig) {
      // No frequency config = no limits
      return { canShow: true };
    }

    const config = campaign.frequencyConfig;

    // Check 1: Max impressions per user (lifetime)
    if (config.maxImpressionsPerUser) {
      const totalUserImpressions = await this.getUserImpressionCount(
        campaignId,
        userId,
        userType,
      );

      if (totalUserImpressions >= config.maxImpressionsPerUser) {
        return {
          canShow: false,
          reason: `User exceeded max impressions per user (${config.maxImpressionsPerUser})`,
        };
      }
    }

    // Check 2: Max impressions per day
    if (config.maxImpressionsPerDay) {
      const todayImpressions = await this.getUserImpressionCount(
        campaignId,
        userId,
        userType,
        24, // last 24 hours
      );

      if (todayImpressions >= config.maxImpressionsPerDay) {
        return {
          canShow: false,
          reason: `User exceeded max impressions per day (${config.maxImpressionsPerDay})`,
        };
      }
    }

    // Check 3: Cooldown period after dismiss
    if (config.cooldownHours) {
      const lastDismiss = await this.getLastDismissTime(
        campaignId,
        userId,
        userType,
      );

      if (lastDismiss) {
        const cooldownMs = config.cooldownHours * 60 * 60 * 1000;
        const timeSinceDismiss = Date.now() - lastDismiss.getTime();

        if (timeSinceDismiss < cooldownMs) {
          const hoursRemaining = (
            (cooldownMs - timeSinceDismiss) /
            (60 * 60 * 1000)
          ).toFixed(1);
          return {
            canShow: false,
            reason: `User dismissed campaign recently. Cooldown: ${hoursRemaining}h remaining`,
          };
        }
      }
    }

    return { canShow: true };
  }

  /**
   * Get impression count for a user on a campaign
   * @param hoursWindow - Optional time window in hours (e.g., 24 for last day)
   */
  private async getUserImpressionCount(
    campaignId: number,
    userId: number,
    userType: 'influencer' | 'brand',
    hoursWindow?: number,
  ): Promise<number> {
    const whereClause: any = {
      campaignId,
      userId,
      userType,
      eventType: EventType.IMPRESSION,
    };

    // Add time window filter if specified
    if (hoursWindow) {
      const cutoffTime = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
      whereClause.createdAt = { [Op.gte]: cutoffTime };
    }

    return this.fiamEventModel.count({ where: whereClause });
  }

  /**
   * Get the timestamp of last dismiss event for a user
   */
  private async getLastDismissTime(
    campaignId: number,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<Date | null> {
    const lastDismiss = await this.fiamEventModel.findOne({
      where: {
        campaignId,
        userId,
        userType,
        eventType: EventType.DISMISS,
      },
      order: [['createdAt', 'DESC']],
      attributes: ['createdAt'],
    });

    return lastDismiss ? lastDismiss.createdAt : null;
  }

  // ============================================================================
  // ANALYTICS QUERIES
  // ============================================================================

  /**
   * Get user's event history for a campaign
   */
  async getUserCampaignHistory(
    campaignId: number,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<FiamCampaignEvent[]> {
    return this.fiamEventModel.findAll({
      where: {
        campaignId,
        userId,
        userType,
      },
      order: [['createdAt', 'DESC']],
      limit: 100, // Prevent excessive data
    });
  }

  /**
   * Get event counts by type for a campaign
   */
  async getCampaignEventCounts(campaignId: number): Promise<{
    impressions: number;
    clicks: number;
    dismissals: number;
    conversions: number;
  }> {
    const counts = await this.fiamEventModel.findAll({
      where: { campaignId },
      attributes: [
        'eventType',
        [this.fiamEventModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['eventType'],
      raw: true,
    });

    const result = {
      impressions: 0,
      clicks: 0,
      dismissals: 0,
      conversions: 0,
    };

    counts.forEach((row: any) => {
      const count = parseInt(row.count, 10);
      switch (row.eventType) {
        case EventType.IMPRESSION:
          result.impressions = count;
          break;
        case EventType.CLICK:
          result.clicks = count;
          break;
        case EventType.DISMISS:
          result.dismissals = count;
          break;
        case EventType.CONVERSION:
          result.conversions = count;
          break;
      }
    });

    return result;
  }

  /**
   * Check if user has ever interacted with a campaign
   */
  async hasUserSeenCampaign(
    campaignId: number,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<boolean> {
    const event = await this.fiamEventModel.findOne({
      where: {
        campaignId,
        userId,
        userType,
        eventType: EventType.IMPRESSION,
      },
    });

    return !!event;
  }
}
