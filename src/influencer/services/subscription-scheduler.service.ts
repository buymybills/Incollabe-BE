import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProSubscriptionService } from './pro-subscription.service';

@Injectable()
export class SubscriptionSchedulerService implements OnModuleInit {
  constructor(private readonly proSubscriptionService: ProSubscriptionService) {}

  /**
   * Run cleanup on application startup to fix any stuck Pro subscriptions
   */
  async onModuleInit() {
    console.log('🚀 Running Pro subscription cleanup on startup...');
    try {
      await this.expireSubscriptions();
      await this.reconcilePayments();
    } catch (error) {
      console.error('❌ Error in startup subscription cleanup:', error);
    }
  }

  /**
   * Check and auto-resume paused subscriptions
   * Runs every day at 9:10 AM (after expiration and reconciliation)
   */
  @Cron('10 9 * * *')
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
   * Runs every day at 9:00 AM
   */
  @Cron('0 9 * * *')
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
   * Reconcile stuck payments - Fix missed webhooks
   * Runs every day at 9:05 AM (5 minutes after expiration check)
   * This ensures expired subscriptions are handled before reconciling payments
   */
  @Cron('5 9 * * *')
  async reconcilePayments() {
    console.log('💰 Running payment reconciliation...');

    try {
      // Reconcile stuck payments (unpaid invoices with captured payments)
      const result = await this.proSubscriptionService.reconcileStuckPayments();

      if (result.reconciledCount > 0) {
        console.log(`✅ Reconciled ${result.reconciledCount} stuck payment(s)`);
      }

      if (result.failedCount > 0) {
        console.error(`❌ Failed to reconcile ${result.failedCount} payment(s)`);
      }

      if (result.reconciledCount === 0 && result.failedCount === 0) {
        console.log('ℹ️ No stuck payments found');
      }

      // Also check for subscriptions without invoices (missed webhooks)
      console.log('\n🔍 Checking for subscriptions without invoices...');
      const orphanedResult = await this.proSubscriptionService.reconcileSubscriptionsWithoutInvoices();

      if (orphanedResult.reconciledCount > 0) {
        console.log(`✅ Reconciled ${orphanedResult.reconciledCount} orphaned subscription(s)`);
      }

      if (orphanedResult.abandonedCount > 0) {
        console.log(`⚠️ Marked ${orphanedResult.abandonedCount} abandoned subscription(s) as INACTIVE`);
      }
    } catch (error) {
      console.error('Error in payment reconciliation cron job:', error);
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

  /**
   * Manual trigger for testing (can be called via admin endpoint)
   */
  async manualReconcilePayments() {
    console.log('🔧 Manual trigger: Payment reconciliation');

    // Run both reconciliation methods
    const stuckPaymentsResult = await this.proSubscriptionService.reconcileStuckPayments();
    const orphanedSubsResult = await this.proSubscriptionService.reconcileSubscriptionsWithoutInvoices();

    return {
      stuckPayments: stuckPaymentsResult,
      orphanedSubscriptions: orphanedSubsResult,
    };
  }
}
