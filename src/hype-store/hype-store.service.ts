import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { HypeStore } from './models/hype-store.model';
import { HypeStoreCashbackConfig } from './models/hype-store-cashback-config.model';
import { Wallet, UserType } from '../wallet/models/wallet.model';
import { WalletTransaction, TransactionType, TransactionStatus } from '../wallet/models/wallet-transaction.model';
import { HypeStoreCreatorPreference } from './models/hype-store-creator-preference.model';
import { HypeStoreOrder } from './models/hype-store-order.model';
import { CreateHypeStoreDto, UpdateHypeStoreDto } from './dto/create-hype-store.dto';
import { UpdateCashbackConfigDto } from './dto/cashback-config.dto';
import { AddMoneyToWalletDto } from './dto/wallet.dto';
import { UpdateCreatorPreferenceDto } from './dto/creator-preference.dto';
import { Sequelize } from 'sequelize-typescript';
import { getStrategyForClaimCount } from './constants/cashback-strategies';
import { RazorpayService } from '../shared/razorpay.service';
import { Brand } from '../brand/model/brand.model';
import { S3Service } from '../shared/s3.service';

@Injectable()
export class HypeStoreService {
  constructor(
    @InjectModel(HypeStore)
    private hypeStoreModel: typeof HypeStore,
    @InjectModel(HypeStoreCashbackConfig)
    private cashbackConfigModel: typeof HypeStoreCashbackConfig,
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(WalletTransaction)
    private walletTransactionModel: typeof WalletTransaction,
    @InjectModel(HypeStoreCreatorPreference)
    private creatorPreferenceModel: typeof HypeStoreCreatorPreference,
    @InjectModel(HypeStoreOrder)
    private orderModel: typeof HypeStoreOrder,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    private sequelize: Sequelize,
    private razorpayService: RazorpayService,
    private s3Service: S3Service,
  ) {}

  /**
   * Create a new Hype Store for a brand
   */
  async createStore(
    brandId: number,
    createDto: CreateHypeStoreDto,
    bannerImage?: Express.Multer.File,
  ): Promise<HypeStore> {
    // Use transaction to ensure all related records are created atomically
    const transaction: Transaction = await this.sequelize.transaction();

    try {
      // Fetch brand profile to get banner and logo
      const brand = await this.brandModel.findByPk(brandId);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }

      // Upload banner image to S3 if provided
      let bannerImageUrl: string | undefined = undefined;
      if (bannerImage) {
        bannerImageUrl = await this.s3Service.uploadFileToS3(
          bannerImage,
          'hype-store/banners',
          `brand-${brandId}-store`,
        );
      }

      // Auto-generate store name (Store 1, Store 2, etc.)
      // Count existing stores for this brand to determine the next number
      const storeCount = await this.hypeStoreModel.count({ where: { brandId } });
      const storeName = `Store ${storeCount + 1}`;

      // Create the main store
      // Use uploaded banner, or auto-populate from brand profile if not provided
      const store = await this.hypeStoreModel.create(
        {
          brandId,
          storeName,
          bannerImageUrl: bannerImageUrl || brand.profileBanner || undefined,
          logoUrl: brand.profileImage || undefined,
          storeDescription: brand.brandBio || undefined,
          isActive: createDto.isActive ?? true,
          monthlyCreatorLimit: createDto.monthlyCreatorLimit ?? 5,
        },
        { transaction },
      );

      // Create cashback configuration
      // Use provided monthlyClaimCount or default to 3, then derive the strategy
      const monthlyClaimCount = createDto.monthlyClaimCount ?? 3;
      const claimStrategy = getStrategyForClaimCount(monthlyClaimCount);

      await this.cashbackConfigModel.create(
        {
          storeId: store.id,
          reelPostMinCashback: createDto.reelPostMinCashback ?? 100,
          reelPostMaxCashback: createDto.reelPostMaxCashback,
          storyMinCashback: createDto.storyMinCashback ?? 100,
          storyMaxCashback: createDto.storyMaxCashback,
          monthlyClaimCount,
          claimStrategy,
        },
        { transaction },
      );

      // Create wallet only if it doesn't exist (one wallet per brand, shared across stores)
      const existingWallet = await this.walletModel.findOne({
        where: {
          userId: brandId,
          userType: UserType.BRAND
        },
        transaction,
      });

      if (!existingWallet) {
        await this.walletModel.create(
          {
            userId: brandId,
            userType: UserType.BRAND,
            balance: 0,
            totalCredited: 0,
            totalDebited: 0,
            totalCashbackReceived: 0,
            totalRedeemed: 0,
            isActive: true,
          } as any,
          { transaction },
        );
      }

      // Create default creator preferences
      await this.creatorPreferenceModel.create(
        {
          storeId: store.id,
          influencerTypes: [],
          minAge: 18,
          maxAge: 60,
          genderPreference: [],
          nicheCategories: [],
          preferredLocations: [],
          isPanIndia: false,
        },
        { transaction },
      );

      await transaction.commit();

      // Return store with only cashbackConfig (not creatorPreference which is just defaults)
      const createdStore = await this.hypeStoreModel.findOne({
        where: { id: store.id },
        include: [{ model: HypeStoreCashbackConfig }],
      });

      if (!createdStore) {
        throw new NotFoundException('Failed to retrieve created store');
      }

      return createdStore;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get all stores by brand ID with all associations
   */
  async getStoresByBrandId(brandId: number): Promise<HypeStore[]> {
    const stores = await this.hypeStoreModel.findAll({
      where: { brandId },
      include: [
        { model: HypeStoreCashbackConfig },
        { model: HypeStoreCreatorPreference },
      ],
      order: [['createdAt', 'ASC']],
    });

    return stores;
  }

  /**
   * Get store by ID with all associations (with brand ownership verification)
   */
  async getStoreById(storeId: number, brandId?: number): Promise<HypeStore> {
    const whereClause: any = { id: storeId };
    if (brandId) {
      whereClause.brandId = brandId;
    }

    const store = await this.hypeStoreModel.findOne({
      where: whereClause,
      include: [
        { model: HypeStoreCashbackConfig },
        { model: HypeStoreCreatorPreference },
      ],
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    return store;
  }

  /**
   * Update store details
   */
  async updateStore(
    storeId: number,
    brandId: number,
    updateDto: UpdateHypeStoreDto,
  ): Promise<HypeStore> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    await store.update(updateDto);
    return this.getStoreById(storeId, brandId);
  }

  /**
   * Update cashback configuration
   */
  async updateCashbackConfig(
    storeId: number,
    brandId: number,
    updateDto: UpdateCashbackConfigDto,
  ): Promise<HypeStoreCashbackConfig> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const config = await this.cashbackConfigModel.findOne({
      where: { storeId },
    });

    if (!config) {
      throw new NotFoundException('Cashback configuration not found');
    }

    // If monthlyClaimCount is provided, derive and update the strategy
    const updateData: any = { ...updateDto };
    if (updateDto.monthlyClaimCount) {
      updateData.claimStrategy = getStrategyForClaimCount(updateDto.monthlyClaimCount);
    }

    await config.update(updateData);
    return config;
  }

  /**
   * Get cashback configuration
   */
  async getCashbackConfig(storeId: number, brandId: number): Promise<HypeStoreCashbackConfig> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const config = await this.cashbackConfigModel.findOne({
      where: { storeId },
    });

    if (!config) {
      throw new NotFoundException('Cashback configuration not found');
    }

    return config;
  }

  /**
   * Create Razorpay order for wallet recharge
   */
  async createWalletRechargeOrder(brandId: number, amount: number) {
    if (amount < 5000) {
      throw new BadRequestException('Minimum wallet recharge is ₹5000');
    }

    const wallet = await this.walletModel.findOne({
      where: {
        userId: brandId,
        userType: UserType.BRAND
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this brand');
    }

    // Create Razorpay order
    const receipt = `WALLET_${brandId}_${Date.now()}`;
    const razorpayOrder = await this.razorpayService.createOrder(
      amount,
      'INR',
      receipt,
      {
        brandId,
        walletId: wallet.id,
        purpose: 'wallet_recharge',
      },
    );

    if (!razorpayOrder.success) {
      throw new BadRequestException('Failed to create Razorpay order');
    }

    return {
      orderId: razorpayOrder.orderId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt,
    };
  }

  /**
   * Verify Razorpay payment and add money to wallet
   */
  async verifyAndAddMoneyToWallet(
    brandId: number,
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<Wallet> {
    // Verify payment signature
    const isValid = this.razorpayService.verifyPaymentSignature(
      orderId,
      paymentId,
      signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Get payment details from Razorpay
    const paymentDetails = await this.razorpayService.getPaymentDetails(paymentId);
    if (!paymentDetails.success) {
      throw new BadRequestException('Failed to fetch payment details');
    }

    const payment = paymentDetails.data;
    const amount = payment.amount / 100; // Convert paise to rupees

    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new BadRequestException('Payment not successful');
    }

    const wallet = await this.walletModel.findOne({
      where: {
        userId: brandId,
        userType: UserType.BRAND
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this brand');
    }

    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const previousBalance = parseFloat(wallet.balance.toString());
      const newBalance = previousBalance + amount;

      // Update wallet
      await wallet.update(
        {
          balance: newBalance,
          totalCredited: parseFloat(wallet.totalCredited.toString()) + amount,
        },
        { transaction },
      );

      // Create transaction record (no storeId since this is brand-level)
      await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.RECHARGE,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          status: TransactionStatus.COMPLETED,
          paymentGateway: payment.method || 'razorpay',
          paymentTransactionId: paymentId,
          description: 'Wallet recharge via Razorpay',
        } as any,
        { transaction },
      );

      await transaction.commit();

      return wallet.reload();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Add money to wallet (Legacy method - for manual/admin additions)
   */
  async addMoneyToWallet(
    brandId: number,
    addMoneyDto: AddMoneyToWalletDto,
  ): Promise<Wallet> {
    if (addMoneyDto.amount < 5000) {
      throw new BadRequestException('Minimum wallet recharge is ₹5000');
    }

    const wallet = await this.walletModel.findOne({
      where: {
        userId: brandId,
        userType: UserType.BRAND
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this brand');
    }

    const transaction: Transaction = await this.sequelize.transaction();

    try{
      const previousBalance = parseFloat(wallet.balance.toString());
      const newBalance = previousBalance + addMoneyDto.amount;

      // Update wallet
      await wallet.update(
        {
          balance: newBalance,
          totalCredited: parseFloat(wallet.totalCredited.toString()) + addMoneyDto.amount,
        },
        { transaction },
      );

      // Create transaction record (no storeId for manual additions)
      await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.RECHARGE,
          amount: addMoneyDto.amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          status: TransactionStatus.COMPLETED,
          description: addMoneyDto.description || 'Wallet recharge',
          paymentGateway: addMoneyDto.paymentMethod || undefined,
          paymentReferenceId: addMoneyDto.paymentReferenceId || undefined,
        } as any,
        { transaction },
      );

      await transaction.commit();

      return wallet.reload();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(brandId: number): Promise<Wallet> {
    const wallet = await this.walletModel.findOne({
      where: {
        userId: brandId,
        userType: UserType.BRAND
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this brand');
    }

    return wallet;
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(
    brandId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const wallet = await this.walletModel.findOne({
      where: {
        userId: brandId,
        userType: UserType.BRAND
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this brand');
    }

    const { count, rows } = await this.walletTransactionModel.findAndCountAll({
      where: { walletId: wallet.id },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      transactions: rows,
      total: count,
    };
  }

  /**
   * Update creator preferences
   */
  async updateCreatorPreferences(
    storeId: number,
    brandId: number,
    updateDto: UpdateCreatorPreferenceDto,
  ): Promise<HypeStoreCreatorPreference> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const preferences = await this.creatorPreferenceModel.findOne({
      where: { storeId },
    });

    if (!preferences) {
      throw new NotFoundException('Creator preferences not found');
    }

    await preferences.update(updateDto);
    return preferences;
  }

  /**
   * Get creator preferences
   */
  async getCreatorPreferences(
    storeId: number,
    brandId: number,
  ): Promise<HypeStoreCreatorPreference> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const preferences = await this.creatorPreferenceModel.findOne({
      where: { storeId },
    });

    if (!preferences) {
      throw new NotFoundException('Creator preferences not found');
    }

    return preferences;
  }

  /**
   * Get store dashboard analytics
   */
  async getStoreDashboard(storeId: number, brandId: number) {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
      include: [
        { model: HypeStoreCashbackConfig },
      ],
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    // Get brand wallet
    const wallet = await this.walletModel.findOne({
      where: {
        userId: brandId,
        userType: UserType.BRAND
      },
    });

    // Get order statistics
    const totalOrders = await this.orderModel.count({
      where: { storeId },
    });

    const totalSales = await this.orderModel.sum('orderAmount', {
      where: { storeId },
    });

    const totalCashbackSent = await this.orderModel.sum('cashbackAmount', {
      where: { storeId },
    });

    // Get orders from last month for comparison
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    const lastMonthOrders = await this.orderModel.count({
      where: {
        storeId,
        createdAt: { [require('sequelize').Op.gte]: lastMonthDate },
      },
    });

    const lastMonthSales = await this.orderModel.sum('orderAmount', {
      where: {
        storeId,
        createdAt: { [require('sequelize').Op.gte]: lastMonthDate },
      },
    });

    return {
      store,
      wallet,
      cashbackConfig: store.cashbackConfig,
      analytics: {
        totalOrders,
        totalSales: totalSales || 0,
        totalCashbackSent: totalCashbackSent || 0,
        lastMonthOrders,
        lastMonthSales: lastMonthSales || 0,
        orderGrowth:
          totalOrders > 0
            ? ((lastMonthOrders / totalOrders) * 100).toFixed(2)
            : 0,
        salesGrowth:
          totalSales > 0 ? ((lastMonthSales / totalSales) * 100).toFixed(2) : 0,
      },
    };
  }

  /**
   * Get all orders for a store
   */
  async getStoreOrders(
    storeId: number,
    brandId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ orders: HypeStoreOrder[]; total: number }> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const { count, rows } = await this.orderModel.findAndCountAll({
      where: { storeId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      orders: rows,
      total: count,
    };
  }

  /**
   * Get order details
   */
  async getOrderDetails(storeId: number, brandId: number, orderId: string): Promise<HypeStoreOrder> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const order = await this.orderModel.findOne({
      where: { storeId, orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
