import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { HypeStoreOrder } from '../../wallet/models/hype-store-order.model';
import { Op } from 'sequelize';

@Injectable()
export class OrderVisibilitySchedulerService {
  private readonly logger = new Logger(OrderVisibilitySchedulerService.name);

  constructor(
    @InjectModel(HypeStoreOrder)
    private orderModel: typeof HypeStoreOrder,
  ) {}

  /**
   * Runs every hour to check if any orders' return period has ended
   * and marks them as visible to influencers
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processOrderVisibility() {
    this.logger.log('Starting order visibility check...');

    try {
      // Find all orders where:
      // 1. Return period has ended (return_period_ends_at <= NOW)
      // 2. Not yet visible to influencer
      // 3. Order status is NOT returned/refunded/cancelled
      const ordersToMakeVisible = await this.orderModel.findAll({
        where: {
          visibleToInfluencer: false,
          returnPeriodEndsAt: {
            [Op.lte]: new Date(), // Return period ended
          },
          orderStatus: {
            [Op.notIn]: ['returned', 'refunded', 'cancelled'], // Exclude returned orders
          },
        },
      });

      if (ordersToMakeVisible.length === 0) {
        this.logger.log('No orders ready to be made visible');
        return;
      }

      this.logger.log(`Found ${ordersToMakeVisible.length} orders ready to be made visible`);

      // Update all orders to be visible
      const orderIds = ordersToMakeVisible.map((order) => order.id);

      const [updatedCount] = await this.orderModel.update(
        {
          visibleToInfluencer: true,
          visibilityCheckedAt: new Date(),
        },
        {
          where: {
            id: {
              [Op.in]: orderIds,
            },
          },
        },
      );

      this.logger.log(`Successfully made ${updatedCount} orders visible to influencers`);

      // Log details of each order made visible
      for (const order of ordersToMakeVisible) {
        this.logger.debug(
          `Order #${order.id} (${order.externalOrderId}) now visible to influencer #${order.influencerId}. ` +
          `Cashback: ₹${order.cashbackAmount}`
        );
      }

    } catch (error) {
      this.logger.error('Error processing order visibility:', error);
    }
  }

  /**
   * Manual method to immediately check and update order visibility
   * Can be called from admin panel or API endpoint
   */
  async checkOrderVisibilityNow(): Promise<number> {
    this.logger.log('Manual order visibility check triggered');
    await this.processOrderVisibility();

    const visibleCount = await this.orderModel.count({
      where: { visibleToInfluencer: true },
    });

    return visibleCount;
  }
}
