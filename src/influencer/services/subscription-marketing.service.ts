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
import { NudgeMessageTemplate, NudgeMessageType } from '../../shared/models/nudge-message-template.model';

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
    @InjectModel(NudgeMessageTemplate)
    private nudgeMessageTemplateModel: typeof NudgeMessageTemplate,
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

        // Send 6-hour reminder (if not sent yet and at least 6 hours have passed)
        if (hoursSinceCreation >= 6 && hoursSinceCreation < 24 && !subscription.reminder6hSentAt) {
          await this.sendPaymentReminder(subscription, influencer, '6hour');
          reminders6h++;
        }

        // Send 1-hour reminder (if not sent yet and at least 1 hour has passed)
        if (hoursSinceCreation >= 1 && hoursSinceCreation < 6 && !subscription.reminder1hSentAt) {
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

      // Update the appropriate reminder timestamp based on timing
      const updateField = timing === '1hour' ? { reminder1hSentAt: new Date() } : { reminder6hSentAt: new Date() };
      await subscription.update(updateField);
      this.logger.log(`📱 Sent ${timing} reminder to influencer ${influencer.id} (subscription: ${subscription.id})`);
    } catch (error) {
      this.logger.error(`❌ Failed to send reminder: ${error.message}`);
    }
  }

  // ==================== DAILY NUDGES ====================

  /**
   * Cron job: Send daily subscription nudges to non-Pro users
   * Uses smart frequency based on user journey:
   * - Days 1-3: Grace period (no nudges)
   * - Days 4-10: Every 2 days
   * - Days 11-17: Every 3 days
   * - Days 18-30: Weekly
   * - After 30 days: Stop (user not interested)
   */
  @Cron('0 10 * * *') // 10:00 AM daily
  async sendDailySubscriptionNudges() {
    this.logger.log('🔍 Starting smart frequency subscription nudges...');

    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Find potential candidates: non-Pro, verified, active, joined >3 days ago
      const candidates = await this.influencerModel.findAll({
        where: {
          isPro: false,
          isVerified: true,
          isActive: true,
          createdAt: { [Op.lt]: threeDaysAgo }, // Joined more than 3 days ago
        },
        limit: 2000, // Batch limit
      });

      this.logger.log(`📊 Found ${candidates.length} candidate(s) for nudge evaluation`);

      let sentCount = 0;
      let skippedCount = 0;
      let stoppedCount = 0;

      for (const influencer of candidates) {
        try {
          // Check if user should receive nudge based on smart frequency
          const shouldSendNudge = this.shouldSendNudge(influencer, now);

          if (!shouldSendNudge.send) {
            if (shouldSendNudge.reason === 'stopped') {
              stoppedCount++;
            } else {
              skippedCount++;
            }
            this.logger.debug(`⏭️ Skip influencer ${influencer.id}: ${shouldSendNudge.reason}`);
            continue;
          }

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

          // Get rotated message from database templates
          const message = await this.getRotatedNudgeMessage(
            influencer.weeklyCredits,
            campaignApplications,
            influencer.lastNudgeMessageIndex || 0,
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
              messageIndex: message.index,
              templateId: message.templateId,
            },
          } as any);

          // Track template usage (increment timesSent counter)
          if (message.templateId > 0) {
            await this.nudgeMessageTemplateModel.increment('timesSent', {
              by: 1,
              where: { id: message.templateId },
            });
          }

          // Update nudge tracking fields
          await influencer.update({
            lastNudgeSentAt: now,
            firstNudgeSentAt: influencer.firstNudgeSentAt || now, // Set if first nudge
            nudgeCount: (influencer.nudgeCount || 0) + 1,
            lastNudgeMessageIndex: message.index,
          });

          sentCount++;
          this.logger.debug(
            `📱 Sent nudge #${(influencer.nudgeCount || 0) + 1} to influencer ${influencer.id} (${fcmTokens.length} device(s), interval: ${shouldSendNudge.interval} days)`,
          );
        } catch (error) {
          this.logger.error(`❌ Failed to send nudge to influencer ${influencer.id}: ${error.message}`);
          skippedCount++;
        }
      }

      this.logger.log(
        `✅ Smart nudges complete: ${sentCount} sent, ${skippedCount} skipped (too soon), ${stoppedCount} stopped (>30 days)`,
      );
    } catch (error) {
      this.logger.error(`❌ Error in daily subscription nudges: ${error.message}`, error.stack);
    }
  }

  /**
   * Determine if user should receive a nudge based on smart frequency rules
   */
  private shouldSendNudge(
    influencer: Influencer,
    now: Date,
  ): { send: boolean; reason?: string; interval?: number } {
    const accountAge = this.getDaysSince(influencer.createdAt, now);

    // Rule 1: Stop after 30 days (user not interested)
    if (influencer.firstNudgeSentAt) {
      const daysSinceFirstNudge = this.getDaysSince(influencer.firstNudgeSentAt, now);
      if (daysSinceFirstNudge >= 30) {
        return { send: false, reason: 'stopped' };
      }
    }

    // Rule 2: Grace period - don't send to users who joined <3 days ago
    if (accountAge < 3) {
      return { send: false, reason: 'grace_period' };
    }

    // Determine required interval based on days since first nudge
    let requiredInterval: number;
    const daysSinceFirstNudge = influencer.firstNudgeSentAt
      ? this.getDaysSince(influencer.firstNudgeSentAt, now)
      : 0;

    if (daysSinceFirstNudge < 7 || !influencer.firstNudgeSentAt) {
      // Days 1-7 of nudge campaign: Every 2 days
      requiredInterval = 2;
    } else if (daysSinceFirstNudge < 14) {
      // Days 8-14: Every 3 days
      requiredInterval = 3;
    } else {
      // Days 15-30: Weekly
      requiredInterval = 7;
    }

    // Rule 3: Check if enough time has passed since last nudge
    if (influencer.lastNudgeSentAt) {
      const daysSinceLastNudge = this.getDaysSince(influencer.lastNudgeSentAt, now);
      if (daysSinceLastNudge < requiredInterval) {
        return {
          send: false,
          reason: `too_soon (needs ${requiredInterval} days, only ${daysSinceLastNudge.toFixed(1)} days)`,
          interval: requiredInterval,
        };
      }
    }

    // All checks passed
    return { send: true, interval: requiredInterval };
  }

  /**
   * Calculate days between two dates
   */
  private getDaysSince(pastDate: Date, now: Date): number {
    const diffMs = now.getTime() - new Date(pastDate).getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }

  /**
   * Get rotated nudge message from database templates
   * Priority: Behavior-based messages > Rotated generic messages
   * Fetches templates from admin-configured database instead of hard-coded messages
   */
  private async getRotatedNudgeMessage(
    weeklyCredits: number,
    campaignApplications: number,
    lastMessageIndex: number,
  ): Promise<{ title: string; body: string; index: number; templateId: number }> {
    const now = new Date();

    // Priority 1: Try to find behavior-based templates (high priority)
    // Check "out_of_credits" template first (highest urgency)
    if (weeklyCredits === 0) {
      const template = await this.nudgeMessageTemplateModel.findOne({
        where: {
          messageType: NudgeMessageType.OUT_OF_CREDITS,
          isActive: true,
          [Op.or]: [
            { validFrom: null, validUntil: null }, // No date restrictions
            {
              validFrom: { [Op.lte]: now },
              validUntil: { [Op.gte]: now },
            }, // Within valid date range
            { validFrom: { [Op.lte]: now }, validUntil: null }, // Started, no end
            { validFrom: null, validUntil: { [Op.gte]: now } }, // No start, not expired
          ],
        },
        order: [['priority', 'DESC']],
      });

      if (template && template.matchesUserBehavior(weeklyCredits, campaignApplications)) {
        return {
          title: template.title,
          body: template.body,
          index: 0, // Reset to 0 for urgent messages
          templateId: template.id,
        };
      }
    }

    // Check "active_user" template
    if (campaignApplications >= 5) {
      const template = await this.nudgeMessageTemplateModel.findOne({
        where: {
          messageType: NudgeMessageType.ACTIVE_USER,
          isActive: true,
          [Op.or]: [
            { validFrom: null, validUntil: null },
            {
              validFrom: { [Op.lte]: now },
              validUntil: { [Op.gte]: now },
            },
            { validFrom: { [Op.lte]: now }, validUntil: null },
            { validFrom: null, validUntil: { [Op.gte]: now } },
          ],
        },
        order: [['priority', 'DESC']],
      });

      if (template && template.matchesUserBehavior(weeklyCredits, campaignApplications)) {
        // Optionally customize body with application count
        const customBody = template.body.includes('{campaignApplications}')
          ? template.body.replace('{campaignApplications}', campaignApplications.toString())
          : template.body;

        return {
          title: template.title,
          body: customBody,
          index: 0, // Reset to 0 for behavior-based messages
          templateId: template.id,
        };
      }
    }

    // Priority 2: Rotation messages (generic templates)
    const rotationTemplates = await this.nudgeMessageTemplateModel.findAll({
      where: {
        messageType: NudgeMessageType.ROTATION,
        isActive: true,
        [Op.or]: [
          { validFrom: null, validUntil: null },
          {
            validFrom: { [Op.lte]: now },
            validUntil: { [Op.gte]: now },
          },
          { validFrom: { [Op.lte]: now }, validUntil: null },
          { validFrom: null, validUntil: { [Op.gte]: now } },
        ],
      },
      order: [['rotationOrder', 'ASC']],
    });

    if (rotationTemplates.length === 0) {
      // Fallback: If no templates in DB, use a default message
      this.logger.warn('⚠️ No rotation templates found in database, using fallback message');
      return {
        title: 'Unlock your potential 💫',
        body: 'MAX members earn 3x more on average. Get unlimited applications, priority in campaigns & exclusive perks for ₹199/month',
        index: 0,
        templateId: 0, // No template ID (fallback)
      };
    }

    // Calculate next template index (rotate)
    const nextIndex = (lastMessageIndex + 1) % rotationTemplates.length;
    const template = rotationTemplates[nextIndex];

    return {
      title: template.title,
      body: template.body,
      index: nextIndex,
      templateId: template.id,
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
