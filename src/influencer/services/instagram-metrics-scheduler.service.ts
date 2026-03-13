import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InfluencerHypeStoreService } from './influencer-hype-store.service';

@Injectable()
export class InstagramMetricsSchedulerService {
  private readonly logger = new Logger(InstagramMetricsSchedulerService.name);

  constructor(
    private readonly influencerHypeStoreService: InfluencerHypeStoreService,
  ) {}

  /**
   * Runs every 6 hours to refresh Instagram metrics for recent orders
   * This keeps view counts and engagement metrics up-to-date
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshInstagramMetrics() {
    this.logger.log('🔄 Starting scheduled Instagram metrics refresh...');

    try {
      // Refresh metrics for orders from the last 30 days
      const result = await this.influencerHypeStoreService.refreshInstagramMetricsForRecentOrders(30);

      if (result.success) {
        this.logger.log(
          `✅ Instagram metrics refresh completed: ${result.data.successfulUpdates} updated, ` +
          `${result.data.noChanges} unchanged, ${result.data.failedUpdates} failed out of ${result.data.totalOrders} orders`
        );

        // Log errors if any
        if (result.data.errors.length > 0) {
          this.logger.warn(`Errors occurred during refresh:`);
          result.data.errors.slice(0, 5).forEach(error => {
            this.logger.warn(`  Order ${error.orderId}: ${error.error}`);
          });
          if (result.data.errors.length > 5) {
            this.logger.warn(`  ... and ${result.data.errors.length - 5} more errors`);
          }
        }
      } else {
        this.logger.error('Instagram metrics refresh failed');
      }
    } catch (error) {
      this.logger.error('Error during scheduled Instagram metrics refresh:', error);
    }
  }

  /**
   * Runs daily at midnight to refresh metrics for orders from the last 7 days
   * This is a more frequent refresh for recent content
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshRecentInstagramMetrics() {
    this.logger.log('🔄 Starting daily Instagram metrics refresh for recent orders...');

    try {
      // Refresh metrics for orders from the last 7 days
      const result = await this.influencerHypeStoreService.refreshInstagramMetricsForRecentOrders(7);

      if (result.success) {
        this.logger.log(
          `✅ Daily metrics refresh completed: ${result.data.successfulUpdates} updated, ` +
          `${result.data.noChanges} unchanged, ${result.data.failedUpdates} failed out of ${result.data.totalOrders} orders`
        );
      }
    } catch (error) {
      this.logger.error('Error during daily Instagram metrics refresh:', error);
    }
  }

  /**
   * Manual method to immediately refresh Instagram metrics
   * Can be called from admin panel or API endpoint
   */
  async refreshMetricsNow(daysBack: number = 30): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    this.logger.log(`Manual Instagram metrics refresh triggered for last ${daysBack} days`);

    try {
      const result = await this.influencerHypeStoreService.refreshInstagramMetricsForRecentOrders(daysBack);
      return result;
    } catch (error) {
      this.logger.error('Error during manual metrics refresh:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * Manual method to refresh metrics for a specific order
   * Can be called from admin panel or API endpoint
   */
  async refreshMetricsForOrder(orderId: number): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    this.logger.log(`Manual Instagram metrics refresh triggered for order ${orderId}`);

    try {
      const result = await this.influencerHypeStoreService.refreshInstagramMetricsForOrder(orderId);
      return result;
    } catch (error) {
      this.logger.error(`Error refreshing metrics for order ${orderId}:`, error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
