import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Transaction, Op } from 'sequelize';
import { Wallet, UserType } from './models/wallet.model';
import {
  WalletTransaction,
  TransactionType,
  TransactionStatus,
} from './models/wallet-transaction.model';
import { WalletRechargeLimit } from './models/wallet-recharge-limit.model';
import { RazorpayService } from '../shared/razorpay.service';
import { ConfigService } from '@nestjs/config';
import {
  RechargeWalletDto,
  VerifyRechargePaymentDto,
  PayInfluencerDto,
  AddCashbackDto,
  RequestRedemptionDto,
  ProcessRedemptionDto,
  GetTransactionsDto,
} from './dto/wallet.dto';
import { Influencer } from '../auth/model/influencer.model';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(WalletTransaction)
    private walletTransactionModel: typeof WalletTransaction,
    @InjectModel(WalletRechargeLimit)
    private walletRechargeLimitModel: typeof WalletRechargeLimit,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    private sequelize: Sequelize,
    private razorpayService: RazorpayService,
    private configService: ConfigService,
  ) {}

  /**
   * Get or create wallet for a user
   */
  async getOrCreateWallet(
    userId: number,
    userType: UserType,
  ): Promise<Wallet> {
    let wallet = await this.walletModel.findOne({
      where: { userId, userType },
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        userId,
        userType,
        balance: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    return wallet;
  }

  /**
   * Get wallet balance and stats
   */
  async getWalletBalance(userId: number, userType: UserType) {
    const wallet = await this.getOrCreateWallet(userId, userType);

    return {
      balance: parseFloat(wallet.balance.toString()),
      totalCredited: parseFloat(wallet.totalCredited.toString()),
      totalDebited: parseFloat(wallet.totalDebited.toString()),
      totalCashbackReceived: parseFloat(wallet.totalCashbackReceived.toString()),
      totalRedeemed: parseFloat(wallet.totalRedeemed.toString()),
      isActive: wallet.isActive,
    };
  }

  /**
   * Initiate wallet recharge (create Razorpay order)
   */
  async initiateRecharge(
    userId: number,
    userType: UserType,
    dto: RechargeWalletDto,
  ) {
    // Only brands can recharge
    if (userType !== UserType.BRAND) {
      throw new ForbiddenException('Only brands can recharge wallet');
    }

    // Convert paise to rupees for validation
    const amountInRupees = dto.amount / 100;

    // Check recharge limits
    const limits = await this.walletRechargeLimitModel.findOne({
      where: { userType: 'brand' },
    });

    if (!limits) {
      throw new BadRequestException('Recharge limits not configured');
    }

    if (amountInRupees < limits.minRechargeAmount) {
      throw new BadRequestException(
        `Minimum recharge amount is ₹${limits.minRechargeAmount}`,
      );
    }

    if (limits.maxRechargeAmount && amountInRupees > limits.maxRechargeAmount) {
      throw new BadRequestException(
        `Maximum recharge amount is ₹${limits.maxRechargeAmount}`,
      );
    }

    // Get or create wallet
    const wallet = await this.getOrCreateWallet(userId, userType);

    // Create Razorpay order (send amount in rupees, not paise)
    const receipt = `wallet_recharge_${userId}_${Date.now()}`;
    const razorpayOrder = await this.razorpayService.createOrder(
      amountInRupees,
      'INR',
      receipt,
      {
        userId,
        userType,
        walletId: wallet.id,
        purpose: 'wallet_recharge',
      },
    );

    if (!razorpayOrder.success) {
      throw new BadRequestException('Failed to create payment order');
    }

    // Create pending transaction (store in rupees)
    await this.walletTransactionModel.create({
      walletId: wallet.id,
      transactionType: TransactionType.RECHARGE,
      amount: amountInRupees,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance, // Will be updated after verification
      status: TransactionStatus.PENDING,
      paymentGateway: 'razorpay',
      paymentOrderId: razorpayOrder.orderId,
      description: `Wallet recharge of ₹${amountInRupees}`,
      notes: dto.notes,
    } as any);

    return {
      id: receipt,
      payment: {
        orderId: razorpayOrder.orderId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: this.configService.get<string>('RAZORPAY_KEY_ID'),
      },
    };
  }

  /**
   * Verify Razorpay payment and credit wallet
   */
  async verifyAndCreditRecharge(
    userId: number,
    userType: UserType,
    dto: VerifyRechargePaymentDto,
  ) {
    // Verify payment signature
    const isValid = await this.razorpayService.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Find pending transaction
    const transaction = await this.walletTransactionModel.findOne({
      where: {
        paymentOrderId: dto.razorpayOrderId,
        status: TransactionStatus.PENDING,
      },
      include: [{ model: this.walletModel, as: 'wallet' }],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify wallet ownership
    if (
      transaction.wallet.userId !== userId ||
      transaction.wallet.userType !== userType
    ) {
      throw new ForbiddenException('Unauthorized');
    }

    // Credit wallet in a transaction
    const result = await this.sequelize.transaction(async (t: Transaction) => {
      const wallet = transaction.wallet;
      const amount = parseFloat(transaction.amount.toString());

      // Update wallet balance
      const newBalance = parseFloat(wallet.balance.toString()) + amount;
      const newTotalCredited = parseFloat(wallet.totalCredited.toString()) + amount;

      await wallet.update(
        {
          balance: newBalance,
          totalCredited: newTotalCredited,
        },
        { transaction: t },
      );

      // Update transaction
      await transaction.update(
        {
          status: TransactionStatus.COMPLETED,
          balanceAfter: newBalance,
          paymentTransactionId: dto.razorpayPaymentId,
          processedAt: new Date(),
        },
        { transaction: t },
      );

      return {
        wallet,
        transaction,
        newBalance,
      };
    });

    return {
      success: true,
      message: 'Wallet recharged successfully',
      amountCredited: parseFloat(transaction.amount.toString()),
      newBalance: result.newBalance,
      transactionId: transaction.id,
    };
  }

  /**
   * Pay influencer from brand wallet (deduct money)
   */
  async payInfluencer(
    brandId: number,
    dto: PayInfluencerDto,
  ) {
    // Get brand wallet
    const brandWallet = await this.walletModel.findOne({
      where: { userId: brandId, userType: UserType.BRAND },
    });

    if (!brandWallet) {
      throw new NotFoundException('Brand wallet not found');
    }

    // Check sufficient balance
    const currentBalance = parseFloat(brandWallet.balance.toString());
    if (currentBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₹${currentBalance}, Required: ₹${dto.amount}`,
      );
    }

    // Get or create influencer wallet
    const influencerWallet = await this.getOrCreateWallet(
      dto.influencerId,
      UserType.INFLUENCER,
    );

    // Execute payment in transaction
    const result = await this.sequelize.transaction(async (t: Transaction) => {
      // Deduct from brand wallet
      const newBrandBalance = currentBalance - dto.amount;
      const newBrandDebited = parseFloat(brandWallet.totalDebited.toString()) + dto.amount;

      await brandWallet.update(
        {
          balance: newBrandBalance,
          totalDebited: newBrandDebited,
        },
        { transaction: t },
      );

      // Create debit transaction for brand
      const debitTransaction = await this.walletTransactionModel.create(
        {
          walletId: brandWallet.id,
          transactionType: TransactionType.DEBIT,
          amount: dto.amount,
          balanceBefore: currentBalance,
          balanceAfter: newBrandBalance,
          status: TransactionStatus.COMPLETED,
          relatedUserId: dto.influencerId,
          relatedUserType: 'influencer',
          campaignId: dto.campaignId,
          description: dto.description,
          notes: dto.notes,
          processedAt: new Date(),
        } as any,
        { transaction: t },
      );

      // Credit influencer wallet (as cashback for now - can be separated later)
      const influencerBalance = parseFloat(influencerWallet.balance.toString());
      const newInfluencerBalance = influencerBalance + dto.amount;
      const newCashbackReceived = parseFloat(influencerWallet.totalCashbackReceived.toString()) + dto.amount;

      await influencerWallet.update(
        {
          balance: newInfluencerBalance,
          totalCashbackReceived: newCashbackReceived,
          totalCredited: parseFloat(influencerWallet.totalCredited.toString()) + dto.amount,
        },
        { transaction: t },
      );

      // Create cashback transaction for influencer
      const cashbackTransaction = await this.walletTransactionModel.create(
        {
          walletId: influencerWallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: dto.amount,
          balanceBefore: influencerBalance,
          balanceAfter: newInfluencerBalance,
          status: TransactionStatus.COMPLETED,
          relatedUserId: brandId,
          relatedUserType: 'brand',
          campaignId: dto.campaignId,
          description: dto.description,
          processedAt: new Date(),
        } as any,
        { transaction: t },
      );

      return {
        debitTransaction,
        cashbackTransaction,
        newBrandBalance,
        newInfluencerBalance,
      };
    });

    return {
      success: true,
      message: 'Payment completed successfully',
      amountPaid: dto.amount,
      newBrandBalance: result.newBrandBalance,
      transactionId: result.debitTransaction.id,
    };
  }

  /**
   * Add cashback to influencer wallet
   */
  async addCashback(dto: AddCashbackDto) {
    const wallet = await this.getOrCreateWallet(
      dto.influencerId,
      UserType.INFLUENCER,
    );

    const result = await this.sequelize.transaction(async (t: Transaction) => {
      const currentBalance = parseFloat(wallet.balance.toString());
      const newBalance = currentBalance + dto.amount;
      const newCashbackReceived = parseFloat(wallet.totalCashbackReceived.toString()) + dto.amount;

      await wallet.update(
        {
          balance: newBalance,
          totalCashbackReceived: newCashbackReceived,
          totalCredited: parseFloat(wallet.totalCredited.toString()) + dto.amount,
        },
        { transaction: t },
      );

      const transaction = await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: dto.amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          status: TransactionStatus.COMPLETED,
          hypeStoreId: dto.hypeStoreId,
          description: dto.description,
          processedAt: new Date(),
        } as any,
        { transaction: t },
      );

      return { transaction, newBalance };
    });

    return {
      success: true,
      message: 'Cashback added successfully',
      amountCredited: dto.amount,
      newBalance: result.newBalance,
      transactionId: result.transaction.id,
    };
  }

  /**
   * Request redemption (influencer withdraws money)
   */
  async requestRedemption(influencerId: number, dto: RequestRedemptionDto) {
    const wallet = await this.walletModel.findOne({
      where: { userId: influencerId, userType: UserType.INFLUENCER },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const currentBalance = parseFloat(wallet.balance.toString());

    // Determine redemption amount
    const redemptionAmount = dto.amount || currentBalance;

    if (redemptionAmount <= 0) {
      throw new BadRequestException('Invalid redemption amount');
    }

    if (redemptionAmount > currentBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₹${currentBalance}`,
      );
    }

    if (redemptionAmount < 100) {
      throw new BadRequestException('Minimum redemption amount is ₹100');
    }

    // Get UPI ID
    let upiId = dto.upiId;
    if (!upiId) {
      // Get default UPI from influencer
      const influencer = await this.influencerModel.findByPk(influencerId, {
        attributes: ['upiId'],
      });
      if (!influencer?.upiId) {
        throw new BadRequestException('UPI ID not found. Please provide one.');
      }
      upiId = influencer.upiId;
    }

    // Create redemption transaction
    const transaction = await this.walletTransactionModel.create({
      walletId: wallet.id,
      transactionType: TransactionType.REDEMPTION,
      amount: redemptionAmount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance, // Will be updated when processed
      status: TransactionStatus.PENDING,
      upiId,
      description: `Redemption request of ₹${redemptionAmount}`,
    } as any);

    return {
      success: true,
      message:
        'Redemption request submitted successfully. You will receive the payment within 24-48 hours.',
      amountRequested: redemptionAmount,
      upiId,
      transactionId: transaction.id,
    };
  }

  /**
   * Process redemption (admin approves/rejects)
   */
  async processRedemption(adminId: number, dto: ProcessRedemptionDto) {
    const transaction = await this.walletTransactionModel.findByPk(
      dto.transactionId,
      {
        include: [{ model: this.walletModel, as: 'wallet' }],
      },
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.transactionType !== TransactionType.REDEMPTION) {
      throw new BadRequestException('Not a redemption transaction');
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        `Transaction already ${transaction.status}`,
      );
    }

    if (dto.action === 'reject') {
      // Simply mark as cancelled
      await transaction.update({
        status: TransactionStatus.CANCELLED,
        processedBy: adminId,
        processedAt: new Date(),
        notes: dto.adminNotes,
        failedReason: 'Rejected by admin',
      });

      return {
        success: true,
        message: 'Redemption request rejected',
        transactionId: transaction.id,
      };
    }

    // Approve - process payout
    const result = await this.sequelize.transaction(async (t: Transaction) => {
      const wallet = transaction.wallet;
      const amount = parseFloat(transaction.amount.toString());
      const currentBalance = parseFloat(wallet.balance.toString());

      // Check balance again
      if (currentBalance < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Create Razorpay payout
      const payoutResult = await this.razorpayService.createPayout(
        amount,
        transaction.upiId,
        `redemption_${transaction.id}`,
        {
          influencerId: wallet.userId,
          transactionId: transaction.id,
          description: transaction.description,
        },
      );

      if (!payoutResult.success) {
        throw new BadRequestException(
          `Payout failed: ${payoutResult.error}`,
        );
      }

      // Deduct from wallet
      const newBalance = currentBalance - amount;
      const newTotalRedeemed = parseFloat(wallet.totalRedeemed.toString()) + amount;
      const newTotalDebited = parseFloat(wallet.totalDebited.toString()) + amount;

      await wallet.update(
        {
          balance: newBalance,
          totalRedeemed: newTotalRedeemed,
          totalDebited: newTotalDebited,
        },
        { transaction: t },
      );

      // Update transaction
      await transaction.update(
        {
          status: TransactionStatus.COMPLETED,
          balanceAfter: newBalance,
          paymentGateway: 'razorpay',
          paymentReferenceId: payoutResult.payoutId,
          processedBy: adminId,
          processedAt: new Date(),
          notes: dto.adminNotes,
          metadata: payoutResult.data,
        },
        { transaction: t },
      );

      return { newBalance, payoutId: payoutResult.payoutId };
    });

    return {
      success: true,
      message: 'Redemption processed successfully',
      amountPaid: parseFloat(transaction.amount.toString()),
      payoutId: result.payoutId,
      transactionId: transaction.id,
    };
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(
    userId: number,
    userType: UserType,
    dto: GetTransactionsDto,
  ) {
    const { page = 1, limit = 20, type, status } = dto;
    const offset = (page - 1) * limit;

    const wallet = await this.walletModel.findOne({
      where: { userId, userType },
    });

    if (!wallet) {
      return {
        transactions: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const where: any = { walletId: wallet.id };
    if (type) where.transactionType = type;
    if (status) where.status = status;

    const { count, rows } = await this.walletTransactionModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      transactions: rows.map((t) => ({
        id: t.id,
        transactionType: t.transactionType,
        amount: parseFloat(t.amount.toString()),
        balanceBefore: parseFloat(t.balanceBefore.toString()),
        balanceAfter: parseFloat(t.balanceAfter.toString()),
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Get pending redemption requests (admin)
   */
  async getPendingRedemptions(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { count, rows } = await this.walletTransactionModel.findAndCountAll({
      where: {
        transactionType: TransactionType.REDEMPTION,
        status: TransactionStatus.PENDING,
      },
      include: [{ model: this.walletModel, as: 'wallet' }],
      limit,
      offset,
      order: [['createdAt', 'ASC']],
    });

    return {
      redemptions: rows.map((t) => ({
        id: t.id,
        influencerId: t.wallet.userId,
        amount: parseFloat(t.amount.toString()),
        upiId: t.upiId,
        description: t.description,
        createdAt: t.createdAt,
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }
}
