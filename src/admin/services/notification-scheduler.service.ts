import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  PushNotification,
  NotificationStatus,
} from '../models/push-notification.model';
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    @InjectModel(PushNotification)
    private readonly pushNotificationModel: typeof PushNotification,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Check for scheduled notifications every minute
   * This runs automatically in the background
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNotifications() {
    try {
      const now = new Date();

      // Find all scheduled notifications whose time has come
      const dueNotifications = await this.pushNotificationModel.findAll({
        where: {
          status: NotificationStatus.SCHEDULED,
          scheduledAt: {
            [Op.lte]: now,
          },
        },
      });

      if (dueNotifications.length === 0) {
        return;
      }

      this.logger.log(
        `📅 Found ${dueNotifications.length} scheduled notification(s) ready to send`,
      );

      // Send each notification
      for (const notification of dueNotifications) {
        try {
          this.logger.log(
            `📤 Sending scheduled notification ID: ${notification.id} - "${notification.title}"`,
          );

          await this.pushNotificationService.sendNotification(notification.id);

          this.logger.log(
            `✅ Successfully sent scheduled notification ID: ${notification.id}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Failed to send scheduled notification ID: ${notification.id}`,
            error.stack,
          );

          // Mark as failed
          await notification.update({
            status: NotificationStatus.FAILED,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        '❌ Error in notification scheduler:',
        error.stack,
      );
    }
  }

  /**
   * Get scheduler status (for monitoring)
   */
  getStatus() {
    return {
      service: 'NotificationScheduler',
      status: 'active',
      interval: 'every minute',
      description: 'Automatically sends scheduled push notifications',
    };
  }
}
