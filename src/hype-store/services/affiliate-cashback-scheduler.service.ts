import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction } from 'sequelize';
import { HypeStoreOrder, CashbackStatus, OrderStatus } from '../../wallet/models/hype-store-order.model';
import { HypeStore } from '../../wallet/models/hype-store.model';
import { Wallet, UserType } from '../../wallet/models/wallet.model';
import { WalletTransaction, TransactionType, TransactionStatus } from '../../wallet/models/wallet-transaction.model';

@Injectable()
export class AffiliateCashbackSchedulerService {
  private readonly logger = new Logger(AffiliateCashbackSchedulerService.name);

  constructor(
    @InjectModel(HypeStoreOrder)
    private orderModel: typeof HypeStoreOrder,
    @InjectModel(HypeStore)
    private hypeStoreModel: typeof HypeStore,
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(WalletTransaction)
    private walletTransactionModel: typeof WalletTransaction,
    private sequelize: Sequelize,
  ) {}

  /**
   * Runs every hour to find affiliate orders whose return period has ended
   * and automatically credits cashback to the influencer's wallet.
   * No proof submission required for affiliate purchases.
   */
  @Cron('0 0 * * *') // Daily at midnight
  async processAffiliateCashback() {
    this.logger.log('Starting affiliate cashback processing...');

    try {
      const pendingOrders = await this.orderModel.findAll({
        where: {
          contentType: 'affiliate',
          cashbackStatus: CashbackStatus.PENDING,
          isReturned: false,
          returnPeriodEndsAt: { [Op.lte]: new Date() },
          orderStatus: {
            [Op.notIn]: [
              OrderStatus.CANCELLED,
              OrderStatus.REFUNDED,
              OrderStatus.RETURNED,
            ],
          },
          cashbackAmount: { [Op.gt]: 0 },
        },
      });

      if (pendingOrders.length === 0) {
        this.logger.log('No affiliate orders ready for cashback release');
        return;
      }

      this.logger.log(`Found ${pendingOrders.length} affiliate order(s) ready for cashback`);

      let successCount = 0;
      let failCount = 0;

      for (const order of pendingOrders) {
        try {
          await this.creditAffiliateCashback(order);
          successCount++;
        } catch (error) {
          failCount++;
          this.logger.error(
            `Failed to credit affiliate cashback for order #${order.id} (${order.externalOrderId}):`,
            error,
          );
        }
      }

      this.logger.log(
        `Affiliate cashback processing complete. Success: ${successCount}, Failed: ${failCount}`,
      );
    } catch (error) {
      this.logger.error('Error during affiliate cashback processing:', error);
    }
  }

  // Split constants
  private static readonly INFLUENCER_SHARE = 0.60;
  private static readonly PLATFORM_SHARE = 0.40;

  /**
   * Credits cashback for a single affiliate order.
   * Debits full cashback from brand wallet.
   * 60% goes to influencer wallet, 40% goes to platform wallet.
   */
  private async creditAffiliateCashback(order: HypeStoreOrder): Promise<void> {
    const hypeStore = await this.hypeStoreModel.findByPk(order.hypeStoreId);
    if (!hypeStore) {
      this.logger.warn(`HypeStore #${order.hypeStoreId} not found for order #${order.id}`);
      return;
    }

    const [influencerWallet, brandWallet, platformWallet] = await Promise.all([
      this.walletModel.findOne({ where: { userId: order.influencerId, userType: UserType.INFLUENCER } }),
      this.walletModel.findOne({ where: { userId: hypeStore.brandId, userType: UserType.BRAND } }),
      this.walletModel.findOne({ where: { userType: UserType.PLATFORM } }),
    ]);

    if (!influencerWallet) {
      this.logger.warn(`Influencer wallet not found for influencer #${order.influencerId}`);
      return;
    }

    if (!brandWallet) {
      this.logger.warn(`Brand wallet not found for brand #${hypeStore.brandId}`);
      return;
    }

    if (!platformWallet) {
      this.logger.error(`Platform wallet not found. Cannot process affiliate cashback for order #${order.id}`);
      return;
    }

    const totalCashback = parseFloat(order.cashbackAmount.toString());
    const influencerAmount = Math.round(totalCashback * AffiliateCashbackSchedulerService.INFLUENCER_SHARE * 100) / 100;
    const platformAmount = Math.round((totalCashback - influencerAmount) * 100) / 100; // Remainder to avoid rounding gaps

    const brandBalance = parseFloat(brandWallet.balance.toString());

    if (brandBalance < totalCashback) {
      this.logger.warn(
        `Insufficient brand wallet balance for order #${order.id}. ` +
        `Required: ₹${totalCashback}, Available: ₹${brandBalance}`,
      );
      return;
    }

    const t: Transaction = await this.sequelize.transaction();

    try {
      // 1. Credit influencer wallet (60%)
      const influencerBalance = parseFloat(influencerWallet.balance.toString());
      const newInfluencerBalance = influencerBalance + influencerAmount;

      await influencerWallet.update(
        {
          balance: newInfluencerBalance,
          totalCashbackReceived: parseFloat(influencerWallet.totalCashbackReceived.toString()) + influencerAmount,
          totalCredited: parseFloat((influencerWallet as any).totalCredited?.toString() || '0') + influencerAmount,
        },
        { transaction: t },
      );

      const cashbackTx = await this.walletTransactionModel.create(
        {
          walletId: influencerWallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: influencerAmount,
          balanceBefore: influencerBalance,
          balanceAfter: newInfluencerBalance,
          status: TransactionStatus.COMPLETED,
          isLocked: false,
          hypeStoreId: order.hypeStoreId,
          hypeStoreOrderId: order.id,
          description: `Affiliate cashback for order ${order.externalOrderId}`,
          notes: `60% of ₹${totalCashback} total cashback. Return period ended: ${order.returnPeriodEndsAt?.toISOString()}`,
        } as any,
        { transaction: t },
      );

      // 2. Credit platform wallet (40%)
      const platformBalance = parseFloat(platformWallet.balance.toString());
      const newPlatformBalance = platformBalance + platformAmount;

      await platformWallet.update(
        {
          balance: newPlatformBalance,
          totalCredited: parseFloat((platformWallet as any).totalCredited?.toString() || '0') + platformAmount,
        },
        { transaction: t },
      );

      await this.walletTransactionModel.create(
        {
          walletId: platformWallet.id,
          transactionType: TransactionType.PLATFORM_COMMISSION,
          amount: platformAmount,
          balanceBefore: platformBalance,
          balanceAfter: newPlatformBalance,
          status: TransactionStatus.COMPLETED,
          hypeStoreId: order.hypeStoreId,
          hypeStoreOrderId: order.id,
          description: `Platform commission for affiliate order ${order.externalOrderId}`,
          notes: `40% of ₹${totalCashback} total cashback from influencer #${order.influencerId}`,
        } as any,
        { transaction: t },
      );

      // 3. Debit brand wallet (full 100%)
      const newBrandBalance = brandBalance - totalCashback;
      await brandWallet.update(
        {
          balance: newBrandBalance,
          totalDebited: parseFloat(brandWallet.totalDebited.toString()) + totalCashback,
        },
        { transaction: t },
      );

      await this.walletTransactionModel.create(
        {
          walletId: brandWallet.id,
          transactionType: TransactionType.DEBIT,
          amount: totalCashback,
          balanceBefore: brandBalance,
          balanceAfter: newBrandBalance,
          status: TransactionStatus.COMPLETED,
          hypeStoreId: order.hypeStoreId,
          hypeStoreOrderId: order.id,
          description: `Affiliate cashback paid for order ${order.externalOrderId}`,
          notes: `₹${influencerAmount} to influencer, ₹${platformAmount} platform commission`,
        } as any,
        { transaction: t },
      );

      // 4. Update order with split details
      await order.update(
        {
          cashbackStatus: CashbackStatus.CREDITED,
          cashbackCreditedAt: new Date(),
          walletTransactionId: cashbackTx.id,
          platformCommissionAmount: platformAmount,
        },
        { transaction: t },
      );

      await t.commit();

      this.logger.log(
        `Affiliate cashback processed for order #${order.id} (${order.externalOrderId}): ` +
        `Total ₹${totalCashback} | Influencer ₹${influencerAmount} | Platform ₹${platformAmount}`,
      );
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Manual trigger — can be called from admin endpoints for immediate processing.
   */
  async processNow(): Promise<{ processed: number; failed: number }> {
    this.logger.log('Manual affiliate cashback processing triggered');

    const pendingOrders = await this.orderModel.findAll({
      where: {
        contentType: 'affiliate',
        cashbackStatus: CashbackStatus.PENDING,
        isReturned: false,
        returnPeriodEndsAt: { [Op.lte]: new Date() },
        orderStatus: {
          [Op.notIn]: [
            OrderStatus.CANCELLED,
            OrderStatus.REFUNDED,
            OrderStatus.RETURNED,
          ],
        },
        cashbackAmount: { [Op.gt]: 0 },
      },
    });

    let processed = 0;
    let failed = 0;

    for (const order of pendingOrders) {
      try {
        await this.creditAffiliateCashback(order);
        processed++;
      } catch {
        failed++;
      }
    }

    return { processed, failed };
  }
}
