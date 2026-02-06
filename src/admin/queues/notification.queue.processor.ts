import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { NotificationService } from '../../shared/notification.service';
import { DeviceTokenService } from '../../shared/device-token.service';
import { InjectModel } from '@nestjs/sequelize';
import { PushNotification, NotificationStatus } from '../models/push-notification.model';
import { UserType as DeviceUserType } from '../../shared/models/device-token.model';

export interface SendNotificationJobData {
  notificationId: number;
  recipients: Array<{
    id: number;
    fcmToken: string;
    userType: 'influencer' | 'brand';
  }>;
  notificationPayload: {
    title: string;
    body: string;
    imageUrl?: string;
    actionUrl?: string;
    androidChannelId?: string;
    sound?: string;
    priority?: string;
    expirationHours?: number;
    badge?: number;
    threadId?: string;
    interruptionLevel?: 'active' | 'passive' | 'timeSensitive' | 'critical';
    metadata?: any;
    customData?: any;
  };
}

@Processor('notifications')
export class NotificationQueueProcessor {
  private readonly logger = new Logger(NotificationQueueProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    @InjectModel(PushNotification)
    private readonly pushNotificationModel: typeof PushNotification,
  ) {}

  @Process('send-bulk-notification')
  async handleSendBulkNotification(job: Job<SendNotificationJobData>) {
    const { notificationId, recipients, notificationPayload } = job.data;

    this.logger.log(
      `Processing bulk notification job for notification ID: ${notificationId}, Recipients: ${recipients.length}`,
    );

    let successCount = 0;
    let failureCount = 0;
    let totalDevicesSent = 0;

    // Process in batches of 100 to avoid overwhelming Firebase
    const batchSize = 100;
    const totalBatches = Math.ceil(recipients.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, recipients.length);
      const batch = recipients.slice(startIdx, endIdx);

      this.logger.log(
        `Processing batch ${i + 1}/${totalBatches} (${batch.length} recipients)`,
      );

      // Update job progress
      const progress = Math.round(((i + 1) / totalBatches) * 100);
      await job.progress(progress);

      // Process each recipient in the batch
      for (const recipient of batch) {
        try {
          // Map recipient userType to DeviceUserType
          const userType =
            recipient.userType === 'influencer'
              ? DeviceUserType.INFLUENCER
              : DeviceUserType.BRAND;

          // Get all device tokens for this user
          const deviceTokens = await this.deviceTokenService.getAllUserTokens(
            recipient.id,
            userType,
          );

          if (deviceTokens.length > 0) {
            this.logger.debug(
              `📱 Sending to ${deviceTokens.length} device(s) for ${userType} ${recipient.id}`,
            );

            // Send to all devices for this user
            await this.notificationService.sendCustomNotification(
              deviceTokens,
              notificationPayload.title,
              notificationPayload.body,
              {
                ...(notificationPayload.metadata || {}),
                ...(notificationPayload.customData || {}),
              },
              {
                imageUrl: notificationPayload.imageUrl,
                actionUrl: notificationPayload.actionUrl,
                androidChannelId: notificationPayload.androidChannelId,
                sound: notificationPayload.sound,
                priority: notificationPayload.priority,
                expirationHours: notificationPayload.expirationHours,
                badge: notificationPayload.badge,
                threadId: notificationPayload.threadId,
                interruptionLevel: notificationPayload.interruptionLevel,
              },
            );

            successCount++;
            totalDevicesSent += deviceTokens.length;
          } else {
            this.logger.warn(
              `⚠️  No device tokens found for ${userType} ${recipient.id}`,
            );
            failureCount++;
          }
        } catch (error) {
          this.logger.error(
            `❌ Failed to send notification to user ${recipient.id}:`,
            error,
          );
          failureCount++;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.log(
      `✅ Notification job completed: ${successCount} users across ${totalDevicesSent} devices`,
    );
    this.logger.log(`❌ Failed: ${failureCount} users`);

    // Update notification record with final results
    const notification =
      await this.pushNotificationModel.findByPk(notificationId);
    if (notification) {
      await notification.update({
        successCount,
        failureCount,
        status:
          failureCount === recipients.length
            ? NotificationStatus.FAILED
            : NotificationStatus.SENT,
      });
    }

    return {
      notificationId,
      successCount,
      failureCount,
      totalDevicesSent,
      totalRecipients: recipients.length,
    };
  }
}
