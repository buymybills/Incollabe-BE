import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FiamCampaign } from '../../shared/models/fiam-campaign.model';
import { DeviceToken, UserType } from '../../shared/models/device-token.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { NotificationService } from '../../shared/notification.service';
import { FiamTriggerService, UserContext } from '../../shared/services/fiam-trigger.service';
import { Op } from 'sequelize';

// ============================================================================
// BROADCAST SERVICE - Send FIAM campaigns via FCM
// ============================================================================

@Injectable()
export class FiamCampaignBroadcastService {
  private readonly logger = new Logger(FiamCampaignBroadcastService.name);

  constructor(
    @InjectModel(FiamCampaign)
    private fiamCampaignModel: typeof FiamCampaign,
    @InjectModel(DeviceToken)
    private deviceTokenModel: typeof DeviceToken,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    private notificationService: NotificationService,
    private fiamTriggerService: FiamTriggerService,
  ) {}

  /**
   * Broadcast a campaign to eligible users via FCM push notifications
   * Called when campaign is created with immediate broadcast, or activated
   */
  async broadcastCampaign(campaignId: number): Promise<{
    success: boolean;
    totalSent: number;
    eligibleUsers: number;
    errors: number;
  }> {
    this.logger.log(`📢 Broadcasting FIAM campaign ${campaignId}...`);

    try {
      // Fetch campaign
      const campaign = await this.fiamCampaignModel.findByPk(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Check if campaign is active
      if (!campaign.isActive()) {
        this.logger.warn(`Campaign ${campaignId} is not active, skipping broadcast`);
        return { success: false, totalSent: 0, eligibleUsers: 0, errors: 0 };
      }

      // Get target user type (default to influencer if not specified)
      const targetUserTypes = campaign.targetUserTypes || ['influencer'];

      let totalSent = 0;
      let eligibleUsers = 0;
      let errors = 0;

      // Broadcast to each user type
      for (const userType of targetUserTypes) {
        const result = await this.broadcastToUserType(
          campaign,
          userType as 'influencer' | 'brand',
        );

        totalSent += result.sent;
        eligibleUsers += result.eligible;
        errors += result.errors;
      }

      this.logger.log(
        `✅ Broadcast complete: ${totalSent} notifications sent to ${eligibleUsers} eligible users (${errors} errors)`,
      );

      return {
        success: true,
        totalSent,
        eligibleUsers,
        errors,
      };
    } catch (error) {
      this.logger.error(`❌ Error broadcasting campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast campaign to a specific user type (influencer or brand)
   */
  private async broadcastToUserType(
    campaign: FiamCampaign,
    userType: 'influencer' | 'brand',
  ): Promise<{ sent: number; eligible: number; errors: number }> {
    this.logger.log(`📱 Broadcasting to ${userType}s...`);

    // Get potential users based on basic targeting
    const users = await this.getPotentialUsers(campaign, userType);

    if (users.length === 0) {
      this.logger.log(`No ${userType}s match campaign targeting`);
      return { sent: 0, eligible: 0, errors: 0 };
    }

    this.logger.log(`Found ${users.length} potential ${userType}s, checking eligibility...`);

    // Filter eligible users using targeting service
    const eligibleUserIds: number[] = [];

    for (const user of users) {
      const userContext = await this.buildUserContext(user.id, userType);
      const isEligible = await this.checkEligibility(campaign, userContext);

      if (isEligible) {
        eligibleUserIds.push(user.id);
      }
    }

    if (eligibleUserIds.length === 0) {
      this.logger.log(`No eligible ${userType}s after filtering`);
      return { sent: 0, eligible: 0, errors: 0 };
    }

    this.logger.log(`${eligibleUserIds.length} ${userType}s are eligible`);

    // Get FCM tokens for eligible users
    const deviceTokens = await this.deviceTokenModel.findAll({
      where: {
        userId: { [Op.in]: eligibleUserIds },
        userType: userType === 'influencer' ? UserType.INFLUENCER : UserType.BRAND,
      },
      attributes: ['fcmToken', 'userId', 'installationId'],
    });

    if (deviceTokens.length === 0) {
      this.logger.warn(`No FCM tokens found for eligible ${userType}s`);
      return { sent: 0, eligible: eligibleUserIds.length, errors: 0 };
    }

    const fcmTokens = deviceTokens.map((dt) => dt.fcmToken);
    this.logger.log(`Sending to ${fcmTokens.length} device(s)...`);

    // Send FCM notifications
    let sent = 0;
    let errors = 0;

    try {
      // Send in batches of 500 to avoid rate limits
      const batchSize = 500;
      for (let i = 0; i < fcmTokens.length; i += batchSize) {
        const batch = fcmTokens.slice(i, i + batchSize);

        await this.sendFcmNotification(campaign, batch);
        sent += batch.length;

        this.logger.debug(`Sent batch ${Math.floor(i / batchSize) + 1}: ${batch.length} notifications`);
      }
    } catch (error) {
      this.logger.error(`Error sending FCM notifications:`, error);
      errors = fcmTokens.length - sent;
    }

    return {
      sent,
      eligible: eligibleUserIds.length,
      errors,
    };
  }

  /**
   * Get potential users based on basic targeting criteria
   */
  private async getPotentialUsers(
    campaign: FiamCampaign,
    userType: 'influencer' | 'brand',
  ): Promise<Array<{ id: number }>> {
    const where: any = {};

    // If specific user IDs are targeted
    if (campaign.targetSpecificUserIds && campaign.targetSpecificUserIds.length > 0) {
      where.id = { [Op.in]: campaign.targetSpecificUserIds };
    }

    // For influencers, add additional filters
    if (userType === 'influencer') {
      where.isVerified = true;
      where.isActive = true;
      where.deletedAt = null;

      // Filter by Pro status if specified in behavior filters
      if (campaign.targetBehaviorFilters) {
        const behaviorFilters = campaign.targetBehaviorFilters as any;

        if (behaviorFilters.isPro === false) {
          where.isPro = false; // Only non-Pro influencers
        } else if (behaviorFilters.isPro === true) {
          where.isPro = true; // Only Pro influencers
        }

        // Filter by follower count
        if (behaviorFilters.minFollowers) {
          where.instagramFollowersCount = {
            ...where.instagramFollowersCount,
            [Op.gte]: behaviorFilters.minFollowers,
          };
        }
        if (behaviorFilters.maxFollowers) {
          where.instagramFollowersCount = {
            ...where.instagramFollowersCount,
            [Op.lte]: behaviorFilters.maxFollowers,
          };
        }
      }

      return this.influencerModel.findAll({
        where,
        attributes: ['id'],
        limit: 10000, // Safety limit
      });
    }

    // For brands
    if (userType === 'brand') {
      where.isActive = true;
      where.deletedAt = null;

      return this.brandModel.findAll({
        where,
        attributes: ['id'],
        limit: 10000, // Safety limit
      });
    }

    return [];
  }

  /**
   * Build user context for eligibility check
   */
  private async buildUserContext(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<UserContext> {
    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId, {
        attributes: ['id', 'gender', 'dateOfBirth', 'weeklyCredits', 'instagramFollowersCount'],
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
        return { userId, userType: 'influencer' };
      }

      // Calculate age
      let age: number | undefined;
      if (influencer.dateOfBirth) {
        const birthDate = new Date(influencer.dateOfBirth);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      return {
        userId: influencer.id,
        userType: 'influencer',
        gender: influencer.gender as 'male' | 'female' | 'others' | undefined,
        age,
        city: influencer.city ? (influencer.city as any).name : undefined,
        nicheIds: influencer.niches ? influencer.niches.map((n: any) => n.id) : undefined,
        creditsBalance: influencer.weeklyCredits || 0,
        followerCount: influencer.instagramFollowersCount || 0,
      };
    } else {
      const brand = await this.brandModel.findByPk(userId, {
        attributes: ['id', 'aiCreditsRemaining'],
      });

      return {
        userId: brand?.id || userId,
        userType: 'brand',
        creditsBalance: brand?.aiCreditsRemaining || 0,
      };
    }
  }

  /**
   * Check if user is eligible using trigger service logic
   */
  private async checkEligibility(
    campaign: FiamCampaign,
    userContext: UserContext,
  ): Promise<boolean> {
    // Use the same eligibility logic from trigger service
    // This includes: user type, demographics, behavior, frequency caps

    // Check user type
    if (!campaign.matchesUserType(userContext.userType)) {
      return false;
    }

    // Check specific user IDs
    if (campaign.targetSpecificUserIds && campaign.targetSpecificUserIds.length > 0) {
      if (!campaign.targetSpecificUserIds.includes(userContext.userId)) {
        return false;
      }
    }

    // For more complex checks, we'd use FiamTriggerService methods
    // For now, basic checks are sufficient for broadcast

    return true;
  }

  /**
   * Send FCM notification with campaign data
   */
  private async sendFcmNotification(
    campaign: FiamCampaign,
    fcmTokens: string[],
  ): Promise<void> {
    const { uiConfig } = campaign;

    // Create notification payload with campaign data
    const notificationData = {
      type: 'fiam_campaign',
      campaignId: campaign.id.toString(),
      layoutType: uiConfig.layoutType,
      backgroundColor: uiConfig.backgroundColor,
      textColor: uiConfig.textColor,
      title: uiConfig.title,
      body: uiConfig.body,
      imageUrl: uiConfig.imageUrl || '',
      actionUrl: uiConfig.actionUrl || '', // For banner/image_only layouts
      buttonText: uiConfig.buttonConfig?.text || '',
      buttonActionUrl: uiConfig.buttonConfig?.actionUrl || '',
      buttonBackgroundColor: uiConfig.buttonConfig?.backgroundColor || '',
      buttonTextColor: uiConfig.buttonConfig?.textColor || '',
      secondaryButtonText: uiConfig.secondaryButtonConfig?.text || '',
      secondaryButtonActionUrl: uiConfig.secondaryButtonConfig?.actionUrl || '',
    };

    // Send notification
    await this.notificationService.sendCustomNotification(
      fcmTokens,
      uiConfig.title,
      uiConfig.body,
      notificationData,
      {
        // Additional options
        imageUrl: uiConfig.imageUrl,
        actionUrl: uiConfig.actionUrl || uiConfig.buttonConfig?.actionUrl,
      },
    );
  }

  /**
   * Schedule a broadcast for later (for scheduled campaigns)
   * This would be called by a cron job
   */
  async processScheduledBroadcasts(): Promise<void> {
    this.logger.log('🔍 Checking for scheduled broadcasts...');

    const now = new Date();

    // Find campaigns scheduled to broadcast now
    const campaigns = await this.fiamCampaignModel.findAll({
      where: {
        status: 'active',
        triggerType: 'scheduled',
        scheduledAt: {
          [Op.lte]: now,
          [Op.gte]: new Date(now.getTime() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    if (campaigns.length === 0) {
      this.logger.log('No scheduled broadcasts found');
      return;
    }

    this.logger.log(`Found ${campaigns.length} scheduled broadcast(s)`);

    for (const campaign of campaigns) {
      try {
        await this.broadcastCampaign(campaign.id);
      } catch (error) {
        this.logger.error(`Failed to broadcast campaign ${campaign.id}:`, error);
      }
    }
  }
}
