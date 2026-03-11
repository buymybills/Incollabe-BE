import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { WalletTransaction, TransactionType, TransactionStatus } from '../models/wallet-transaction.model';
import { Wallet } from '../models/wallet.model';
import { HypeStoreOrder } from '../models/hype-store-order.model';

/**
 * Service to handle automatic unlocking of locked cashback when return window closes
 * Also handles deducting cashback when items are returned
 */
@Injectable()
export class CashbackLockUnlockService {
  private readonly logger = new Logger(CashbackLockUnlockService.name);

  constructor(
    @InjectModel(WalletTransaction)
    private walletTransactionModel: typeof WalletTransaction,
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(HypeStoreOrder)
    private hypeStoreOrderModel: typeof HypeStoreOrder,
    private sequelize: Sequelize,
  ) {}

  /**
   * Run every 5 minutes to unlock cashback that has expired
   * This converts locked amount to available balance once return window closes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processLockedCashbackUnlock() {
    this.logger.log('🔓 Starting cashback unlock process...');
    
    try {
      // Find all locked transactions that have expired
      const expiredTransactions = await this.walletTransactionModel.findAll({
        where: {
          isLocked: true,
          lockExpiresAt: {
            [Op.lte]: new Date(),
          },
          status: TransactionStatus.COMPLETED,
        },
        include: [
          {
            model: this.walletModel,
            as: 'wallet',
          },
        ],
      });

      if (expiredTransactions.length === 0) {
        this.logger.debug('No expired locked transactions found');
        return;
      }

      this.logger.log(`Found ${expiredTransactions.length} expired locked transactions to unlock`);

      // Process each expired transaction
      for (const lockedTx of expiredTransactions) {
        await this.unlockCashbackTransaction(lockedTx);
      }

      this.logger.log(`✅ Successfully unlocked ${expiredTransactions.length} transactions`);
    } catch (error) {
      this.logger.error('❌ Error during cashback unlock process:', error);
    }
  }

  /**
   * Unlock a specific locked cashback transaction
   * Converts locked amount to available balance
   */
  private async unlockCashbackTransaction(lockedTx: WalletTransaction) {
    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const wallet = lockedTx.wallet;
      const cashbackAmount = parseFloat(lockedTx.amount.toString());
      const previousBalance = parseFloat(wallet.balance.toString());
      const previousLockedAmount = parseFloat(wallet.lockedAmount.toString());
      
      const newBalance = previousBalance + cashbackAmount;
      const newLockedAmount = Math.max(0, previousLockedAmount - cashbackAmount);

      // Update wallet: move from locked to available balance
      await wallet.update(
        {
          balance: newBalance,
          lockedAmount: newLockedAmount,
          totalCredited: parseFloat(wallet.totalCredited.toString()) + cashbackAmount,
        },
        { transaction },
      );

      // Create a new transaction record marking the unlock
      await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: cashbackAmount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          status: TransactionStatus.COMPLETED,
          isLocked: false,
          description: `Cashback unlocked from previous locked transaction #${lockedTx.id}`,
          hypeStoreOrderId: lockedTx.hypeStoreOrderId,
          hypeStoreId: lockedTx.hypeStoreId,
          notes: `Automatic unlock after return window closed on ${new Date().toISOString()}`,
        } as any,
        { transaction },
      );

      // Mark the locked transaction as unlocked
      const updateData: any = {
        isLocked: false,
      };
      if (lockedTx.lockExpiresAt) {
        updateData.lockExpiresAt = undefined;
      }
      
      await lockedTx.update(updateData, { transaction });

      // Update the hype store order to reflect unlocked status
      if (lockedTx.hypeStoreOrderId) {
        await this.hypeStoreOrderModel.update(
          {
            notes: `Cashback unlocked after return window closed on ${new Date().toISOString()}`,
          },
          {
            where: { id: lockedTx.hypeStoreOrderId },
            transaction,
          },
        );
      }

      await transaction.commit();

      this.logger.log(
        `✅ Unlocked ₹${cashbackAmount.toFixed(2)} for wallet ${wallet.id} (Order: ${lockedTx.hypeStoreOrderId})`,
      );
    } catch (error) {
      await transaction.rollback();
      this.logger.error(
        `❌ Failed to unlock transaction #${lockedTx.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle item return - deduct the locked cashback from wallet
   * Called when customer initiates a return
   */
  async handleItemReturn(orderId: number) {
    this.logger.log(`📦 Processing return for order ${orderId}`);

    const order = await this.hypeStoreOrderModel.findByPk(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.isReturned) {
      this.logger.warn(`Order ${orderId} already marked as returned`);
      return { success: false, message: 'Order already marked as returned' };
    }

    if (!order.lockedCashbackTransactionId) {
      this.logger.warn(`Order ${orderId} has no locked cashback transaction`);
      return { success: false, message: 'No locked cashback found for this order' };
    }

    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const lockedCashbackTx = await this.walletTransactionModel.findByPk(
        order.lockedCashbackTransactionId,
      );

      if (!lockedCashbackTx) {
        throw new Error(`Locked cashback transaction #${order.lockedCashbackTransactionId} not found`);
      }

      const wallet = await this.walletModel.findByPk(lockedCashbackTx.walletId);
      if (!wallet) {
        throw new Error(`Wallet not found for transaction`);
      }

      const cashbackAmount = parseFloat(lockedCashbackTx.amount.toString());
      const previousLockedAmount = parseFloat(wallet.lockedAmount.toString());
      const newLockedAmount = Math.max(0, previousLockedAmount - cashbackAmount);

      // Deduct from locked amount
      await wallet.update(
        {
          lockedAmount: newLockedAmount,
          totalCashbackReceived: Math.max(
            0,
            parseFloat(wallet.totalCashbackReceived.toString()) - cashbackAmount,
          ),
        },
        { transaction },
      );

      // Create a refund transaction record
      await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.REFUND,
          amount: -cashbackAmount, // Negative amount for refund
          balanceBefore: parseFloat(wallet.balance.toString()),
          balanceAfter: parseFloat(wallet.balance.toString()), // Balance unchanged, only locked amount decreased
          status: TransactionStatus.COMPLETED,
          isLocked: false,
          description: `Cashback refunded for returned order ${order.externalOrderId}`,
          hypeStoreOrderId: order.id,
          hypeStoreId: order.hypeStoreId,
          notes: `Item was returned by customer on ${new Date().toISOString()}`,
        } as any,
        { transaction },
      );

      // Mark order as returned
      await order.update(
        {
          isReturned: true,
          returnedAt: new Date(),
          notes: `${order.notes ? order.notes + '\n' : ''}Item returned. Cashback of ₹${cashbackAmount.toFixed(2)} has been removed from wallet.`,
        },
        { transaction },
      );

      await transaction.commit();

      this.logger.log(
        `✅ Return processed for order ${orderId}. Removed ₹${cashbackAmount.toFixed(2)} cashback`,
      );

      return {
        success: true,
        message: `Return processed successfully. Cashback of ₹${cashbackAmount.toFixed(2)} has been removed from your wallet.`,
        data: {
          orderId: order.id,
          removedCashback: cashbackAmount,
          walletLockedAmount: parseFloat(newLockedAmount.toString()),
        },
      };
    } catch (error) {
      await transaction.rollback();
      this.logger.error(`❌ Failed to process return for order ${orderId}:`, error);
      throw error;
    }
  }
}
