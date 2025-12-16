import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProSubscriptionService } from './pro-subscription.service';

@Injectable()
export class SubscriptionSchedulerService {
  constructor(private readonly proSubscriptionService: ProSubscriptionService) {}

  /**
   * Check and auto-resume paused subscriptions
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoResumeSubscriptions() {
    console.log('🔄 Running auto-resume check for paused subscriptions...');

    try {
      const result = await this.proSubscriptionService.checkAndAutoResumeSubscriptions();

      if (result.resumedCount > 0) {
        console.log(`✅ Auto-resumed ${result.resumedCount} subscription(s)`);
      }

      if (result.failedCount > 0) {
        console.error(`❌ Failed to resume ${result.failedCount} subscription(s)`);
        console.error('Failed subscriptions:', result.results.filter(r => !r.success));
      }

      if (result.resumedCount === 0 && result.failedCount === 0) {
        console.log('ℹ️ No subscriptions to resume at this time');
      }
    } catch (error) {
      console.error('Error in auto-resume cron job:', error);
    }
  }

  /**
   * Check and expire subscriptions
   * Runs every day at 1:00 AM
   */
  @Cron('0 1 * * *')
  async expireSubscriptions() {
    console.log('🔍 Checking for expired subscriptions...');

    try {
      const result = await this.proSubscriptionService.checkAndExpireSubscriptions();

      if (result.expiredCount > 0) {
        console.log(`⏱️ Expired ${result.expiredCount} subscription(s)`);
      } else {
        console.log('ℹ️ No subscriptions to expire at this time');
      }
    } catch (error) {
      console.error('Error in expire subscriptions cron job:', error);
    }
  }

  /**
   * Manual trigger for testing (can be called via admin endpoint)
   */
  async manualAutoResume() {
    console.log('🔧 Manual trigger: Auto-resume check');
    return await this.proSubscriptionService.checkAndAutoResumeSubscriptions();
  }

  /**
   * Manual trigger for testing (can be called via admin endpoint)
   */
  async manualExpireCheck() {
    console.log('🔧 Manual trigger: Expire check');
    return await this.proSubscriptionService.checkAndExpireSubscriptions();
  }
}
