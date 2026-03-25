import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import { ProSubscription, SubscriptionStatus } from '../models/pro-subscription.model';
import { Influencer } from '../../auth/model/influencer.model';
import { ProSubscriptionPromotion } from '../models/pro-subscription-promotion.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { DeviceToken, UserType } from '../../shared/models/device-token.model';
import { NotificationService } from '../../shared/notification.service';
import { InAppNotificationService } from '../../shared/in-app-notification.service';
import { NotificationType, NotificationPriority } from '../../shared/models/in-app-notification.model';

@Injectable()
export class SubscriptionMarketingService {
  private readonly logger = new Logger(SubscriptionMarketingService.name);

  constructor(
    @InjectModel(ProSubscription)
    private proSubscriptionModel: typeof ProSubscription,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(ProSubscriptionPromotion)
    private proSubscriptionPromotionModel: typeof ProSubscriptionPromotion,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(DeviceToken)
    private deviceTokenModel: typeof DeviceToken,
    private notificationService: NotificationService,
    private inAppNotificationService: InAppNotificationService,
  ) {}

  // ==================== DROP-OFF TRACKING ====================

  /**
   * Cron job: Check for abandoned payments and send reminders
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handlePaymentDropoffReminders() {
    this.logger.log('🔍 Checking for abandoned payment subscriptions...');

    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Find payment_pending subscriptions
      const pendingSubscriptions = await this.proSubscriptionModel.findAll({
        where: {
          status: SubscriptionStatus.PAYMENT_PENDING,
          createdAt: {
            [Op.lte]: oneHourAgo, // Created at least 1 hour ago
          },
        },
        include: [
          {
            model: Influencer,
            attributes: ['id', 'firstName', 'lastName', 'fcmToken', 'weeklyCredits'],
          },
        ],
      });

      this.logger.log(`📊 Found ${pendingSubscriptions.length} pending subscription(s)`);

      let reminders1h = 0;
      let reminders6h = 0;
      let abandoned24h = 0;

      for (const subscription of pendingSubscriptions) {
        const createdAt = new Date(subscription.createdAt);
        const timeSinceCreation = now.getTime() - createdAt.getTime();
        const hoursSinceCreation = timeSinceCreation / (1000 * 60 * 60);

        // Mark as ABANDONED if more than 24 hours
        if (hoursSinceCreation >= 24) {
          await subscription.update({ status: SubscriptionStatus.ABANDONED });
          this.logger.log(`❌ Marked subscription ${subscription.id} as ABANDONED (influencer: ${subscription.influencerId})`);
          abandoned24h++;
          continue;
        }

        // Send reminders based on time elapsed
        const influencer = subscription.influencer;
        if (!influencer?.fcmToken) {
          this.logger.debug(`⚠️ No FCM token for influencer ${subscription.influencerId}, skipping notification`);
          continue;
        }

        // 6-hour reminder (if no reminder sent yet)
        if (hoursSinceCreation >= 6 && !subscription.reminderSentAt) {
          await this.sendPaymentReminder(subscription, influencer, '6hour');
          reminders6h++;
        }
        // 1-hour reminder (if no reminder sent yet)
        else if (hoursSinceCreation >= 1 && !subscription.reminderSentAt) {
          await this.sendPaymentReminder(subscription, influencer, '1hour');
          reminders1h++;
        }
      }

      this.logger.log(`✅ Drop-off tracking complete: ${reminders1h} reminders (1h), ${reminders6h} reminders (6h), ${abandoned24h} abandoned`);
    } catch (error) {
      this.logger.error(`❌ Error in payment drop-off tracking: ${error.message}`, error.stack);
    }
  }

  private async sendPaymentReminder(
    subscription: ProSubscription,
    influencer: Influencer,
    timing: '1hour' | '6hour',
  ) {
    const messages = {
      '1hour': {
        title: "You're just one step away! 🎯",
        body: "Complete your MAX subscription and unlock unlimited campaign applications for just ₹199/month",
      },
      '6hour': {
        title: "Still thinking? 🤔",
        body: "Your exclusive MAX offer is waiting! Unlock unlimited applications + premium features",
      },
    };

    const message = messages[timing];

    try {
      // Get FCM tokens from device_tokens table
      const deviceTokens = await this.deviceTokenModel.findAll({
        where: {
          userId: influencer.id,
          userType: UserType.INFLUENCER,
        },
        attributes: ['fcmToken'],
      });

      if (deviceTokens.length === 0) {
        this.logger.debug(`⚠️ No FCM tokens found for influencer ${influencer.id}, skipping push notification`);
      } else {
        const fcmTokens = deviceTokens.map(dt => dt.fcmToken);

        // Send push notification
        await this.notificationService.sendCustomNotification(
          fcmTokens,
          message.title,
          message.body,
          {
            type: 'subscription_reminder',
            action: 'resume_payment',
            subscriptionId: subscription.id.toString(),
            timing,
          },
        );
      }

      // Create in-app notification
      await this.inAppNotificationService.createNotification({
        userId: influencer.id,
        userType: 'influencer',
        title: message.title,
        body: message.body,
        type: NotificationType.PRO_SUBSCRIPTION_EXPIRING,
        actionType: 'resume_payment',
        actionUrl: `app://subscription/payment?subscriptionId=${subscription.id}`,
        relatedEntityType: 'subscription',
        relatedEntityId: subscription.id,
        priority: NotificationPriority.HIGH,
        metadata: {
          subscriptionId: subscription.id,
          subscriptionAmount: subscription.subscriptionAmount,
          timing,
          reminderType: 'payment_drop_off',
        },
      } as any);

      await subscription.update({ reminderSentAt: new Date() });
      this.logger.log(`📱 Sent ${timing} reminder to influencer ${influencer.id} (subscription: ${subscription.id})`);
    } catch (error) {
      this.logger.error(`❌ Failed to send reminder: ${error.message}`);
    }
  }

  // ==================== DAILY NUDGES ====================

  /**
   * Cron job: Send daily subscription nudges to non-Pro users
   * Runs every day at 10:00 AM
   */
  @Cron('0 10 * * *') // 10:00 AM daily
  async sendDailySubscriptionNudges() {
    this.logger.log('🔍 Starting daily subscription nudges...');

    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Find eligible influencers: non-Pro, verified, active, haven't received nudge in last 24h
      const eligibleInfluencers = await this.influencerModel.findAll({
        where: {
          isPro: false,
          isVerified: true,
          isActive: true,
          [Op.or]: [
            { lastNudgeSentAt: null }, // Never received nudge
            { lastNudgeSentAt: { [Op.lt]: twentyFourHoursAgo } }, // Last nudge > 24h ago
          ],
          createdAt: { [Op.lt]: thirtyDaysAgo }, // Don't spam new users too early
        },
        limit: 1000, // Batch limit to avoid overwhelming the system
      });

      this.logger.log(`📊 Found ${eligibleInfluencers.length} eligible influencer(s) for nudges`);

      let sentCount = 0;
      let skippedCount = 0;

      for (const influencer of eligibleInfluencers) {
        try {
          // Get FCM tokens for this influencer
          const deviceTokens = await this.deviceTokenModel.findAll({
            where: {
              userId: influencer.id,
              userType: UserType.INFLUENCER,
            },
            attributes: ['fcmToken'],
          });

          if (deviceTokens.length === 0) {
            this.logger.debug(`⚠️ No FCM tokens found for influencer ${influencer.id}, skipping`);
            skippedCount++;
            continue;
          }

          const fcmTokens = deviceTokens.map(dt => dt.fcmToken);

          // Get user behavior data for personalization
          const campaignApplications = await this.campaignApplicationModel.count({
            where: { influencerId: influencer.id },
          });

          // Determine message based on behavior
          const message = this.getPersonalizedNudgeMessage(
            influencer.weeklyCredits,
            campaignApplications,
          );

          // Send push notification to all user's devices
          await this.notificationService.sendCustomNotification(
            fcmTokens,
            message.title,
            message.body,
            {
              type: 'subscription_marketing',
              action: 'view_subscription',
              cta: 'Join MAX',
            },
          );

          // Create in-app notification
          await this.inAppNotificationService.createNotification({
            userId: influencer.id,
            userType: 'influencer',
            title: message.title,
            body: message.body,
            type: NotificationType.SYSTEM_ANNOUNCEMENT,
            actionType: 'view_subscription',
            actionUrl: 'app://subscription',
            priority: NotificationPriority.NORMAL,
            metadata: {
              weeklyCredits: influencer.weeklyCredits,
              campaignApplications,
              nudgeType: 'daily_subscription_nudge',
            },
          } as any);

          // Update last nudge timestamp
          await influencer.update({ lastNudgeSentAt: now });

          sentCount++;
          this.logger.debug(`📱 Sent nudge to influencer ${influencer.id} (${fcmTokens.length} device(s))`);
        } catch (error) {
          this.logger.error(`❌ Failed to send nudge to influencer ${influencer.id}: ${error.message}`);
          skippedCount++;
        }
      }

      this.logger.log(`✅ Daily nudges complete: ${sentCount} sent, ${skippedCount} skipped`);
    } catch (error) {
      this.logger.error(`❌ Error in daily subscription nudges: ${error.message}`, error.stack);
    }
  }

  private getPersonalizedNudgeMessage(weeklyCredits: number, campaignApplications: number): { title: string; body: string } {
    // Scenario A: User has no weekly credits left
    if (weeklyCredits === 0) {
      return {
        title: "Out of credits? 😔",
        body: "Upgrade to MAX for unlimited campaign applications + ₹100 joining bonus! Only ₹199/month",
      };
    }

    // Scenario B: User has applied to many campaigns (active user)
    if (campaignApplications >= 5) {
      return {
        title: "You're active! 🚀",
        body: `You've applied to ${campaignApplications} campaigns. MAX members get unlimited applications + higher priority. Join for ₹199/month`,
      };
    }

    // Scenario C: New or less active user
    return {
      title: "Unlock your potential 💫",
      body: "MAX members earn 3x more on average. Get unlimited applications, priority in campaigns & exclusive perks for ₹199/month",
    };
  }

  // ==================== FLASH SALE ANNOUNCEMENTS ====================

  /**
   * Send flash sale announcement to all non-Pro users
   */
  async announceFlashSale(promotionId: number): Promise<void> {
    this.logger.log(`🎉 Announcing flash sale (promotion: ${promotionId})...`);

    try {
      const promotion = await this.proSubscriptionPromotionModel.findByPk(promotionId);
      if (!promotion) {
        throw new Error(`Promotion ${promotionId} not found`);
      }

      // Find all non-Pro users
      const nonProUsers = await this.influencerModel.findAll({
        where: {
          isPro: false,
          isVerified: true,
          isActive: true,
        },
        attributes: ['id'],
      });

      // Get FCM tokens for these users from device_tokens table
      const userIds = nonProUsers.map(u => u.id);
      const deviceTokens = await this.deviceTokenModel.findAll({
        where: {
          userId: { [Op.in]: userIds },
          userType: UserType.INFLUENCER,
        },
        attributes: ['fcmToken'],
        group: ['fcmToken'], // Deduplicate tokens
      });

      const fcmTokens = deviceTokens.map(dt => dt.fcmToken);

      this.logger.log(`📊 Sending flash sale announcement to ${fcmTokens.length} device(s) for ${nonProUsers.length} user(s)`);

      if (fcmTokens.length === 0) {
        this.logger.warn('⚠️ No FCM tokens found for non-Pro users');
        return;
      }

      const originalPrice = promotion.originalPrice / 100;
      const discountedPrice = promotion.discountedPrice / 100;
      const savings = originalPrice - discountedPrice;

      const message = {
        title: "⚡ FLASH SALE! ⚡",
        body: `MAX at ₹${discountedPrice} (was ₹${originalPrice}) - Save ₹${savings}! Limited time only! 🔥`,
      };

      // Send in batches of 500 to avoid rate limits
      const batchSize = 500;
      let sentCount = 0;

      for (let i = 0; i < fcmTokens.length; i += batchSize) {
        const batch = fcmTokens.slice(i, i + batchSize);

        await this.notificationService.sendCustomNotification(
          batch,
          message.title,
          message.body,
          {
            type: 'flash_sale',
            promotionId: promotionId.toString(),
            action: 'subscribe_now',
            originalPrice: originalPrice.toString(),
            discountedPrice: discountedPrice.toString(),
            savings: savings.toString(),
          },
        );

        sentCount += batch.length;
        this.logger.debug(`📱 Sent flash sale notification to ${sentCount}/${fcmTokens.length} users`);
      }

      // Create in-app notifications for all non-Pro users
      const inAppNotifications = userIds.map(userId => ({
        userId,
        userType: 'influencer' as const,
        title: message.title,
        body: message.body,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        actionType: 'subscribe_now',
        actionUrl: `app://subscription?promotionId=${promotionId}`, // Deep link to subscription page
        relatedEntityType: 'promotion',
        relatedEntityId: promotionId,
        priority: NotificationPriority.HIGH,
        metadata: {
          promotionId: promotionId,
          originalPrice: originalPrice,
          discountedPrice: discountedPrice,
          savings: savings,
          saleType: 'flash_sale_announcement',
        },
      }));

      await this.inAppNotificationService.createBulkNotifications(inAppNotifications);
      this.logger.log(`✅ Flash sale announcement complete: ${sentCount} push notifications + ${inAppNotifications.length} in-app notifications sent`);
    } catch (error) {
      this.logger.error(`❌ Error announcing flash sale: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send flash sale reminder to users who engaged but didn't subscribe
   * Call this 6 hours after sale starts
   */
  async sendFlashSaleReminder(promotionId: number): Promise<void> {
    this.logger.log(`⏰ Sending flash sale reminder (promotion: ${promotionId})...`);

    try {
      const promotion = await this.proSubscriptionPromotionModel.findByPk(promotionId);
      if (!promotion) {
        throw new Error(`Promotion ${promotionId} not found`);
      }

      const timeRemaining = promotion.getTimeRemaining();
      const spotsLeft = promotion.getSpotsLeft();

      // Find non-Pro users who haven't subscribed yet
      const nonProUsers = await this.influencerModel.findAll({
        where: {
          isPro: false,
          isVerified: true,
          isActive: true,
        },
        attributes: ['id'],
        limit: 1000,
      });

      // Get FCM tokens for these users from device_tokens table
      const userIds = nonProUsers.map(u => u.id);
      const deviceTokens = await this.deviceTokenModel.findAll({
        where: {
          userId: { [Op.in]: userIds },
          userType: UserType.INFLUENCER,
        },
        attributes: ['fcmToken'],
        group: ['fcmToken'], // Deduplicate tokens
      });

      const fcmTokens = deviceTokens.map(dt => dt.fcmToken);

      this.logger.log(`⏰ Sending reminder to ${fcmTokens.length} device(s) for ${nonProUsers.length} user(s)`);

      if (fcmTokens.length === 0) {
        this.logger.warn('⚠️ No FCM tokens found for non-Pro users');
        return;
      }

      const discountedPrice = promotion.discountedPrice / 100;

      let message: { title: string; body: string };

      if (spotsLeft && spotsLeft < 100) {
        message = {
          title: "🚨 Last Chance!",
          body: `Only ${spotsLeft} spots left for ₹${discountedPrice} MAX offer! Ends in ${timeRemaining}`,
        };
      } else {
        message = {
          title: `⏰ ${timeRemaining} left!`,
          body: `Don't miss ₹${discountedPrice} MAX offer - limited time only!`,
        };
      }

      await this.notificationService.sendCustomNotification(
        fcmTokens,
        message.title,
        message.body,
        {
          type: 'flash_sale_reminder',
          promotionId: promotionId.toString(),
          action: 'subscribe_now',
          timeRemaining,
          spotsLeft: spotsLeft?.toString() || 'unlimited',
        },
      );

      // Create in-app notifications for all non-Pro users
      const inAppNotifications = userIds.map(userId => ({
        userId,
        userType: 'influencer' as const,
        title: message.title,
        body: message.body,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        actionType: 'subscribe_now',
        actionUrl: `app://subscription?promotionId=${promotionId}`,
        relatedEntityType: 'promotion',
        relatedEntityId: promotionId,
        priority: NotificationPriority.HIGH,
        metadata: {
          promotionId: promotionId,
          discountedPrice: discountedPrice,
          timeRemaining: timeRemaining,
          spotsLeft: spotsLeft,
          saleType: 'flash_sale_reminder',
        },
      }));

      await this.inAppNotificationService.createBulkNotifications(inAppNotifications);
      this.logger.log(`✅ Flash sale reminder sent: ${fcmTokens.length} push notifications + ${inAppNotifications.length} in-app notifications`);
    } catch (error) {
      this.logger.error(`❌ Error sending flash sale reminder: ${error.message}`, error.stack);
    }
  }
}
