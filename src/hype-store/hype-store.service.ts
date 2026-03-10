import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { HypeStore } from './models/hype-store.model';
import { HypeStoreCashbackConfig } from './models/hype-store-cashback-config.model';
import { Wallet, UserType } from '../wallet/models/wallet.model';
import { WalletTransaction, TransactionType, TransactionStatus } from '../wallet/models/wallet-transaction.model';
import { HypeStoreCreatorPreference } from './models/hype-store-creator-preference.model';
import { HypeStoreOrder as HypeStoreOrderOld } from './models/hype-store-order.model';
import { HypeStoreOrder } from '../wallet/models/hype-store-order.model';
import { CreateHypeStoreDto, UpdateHypeStoreDto } from './dto/create-hype-store.dto';
import { UpdateCashbackConfigDto } from './dto/cashback-config.dto';
import { AddMoneyToWalletDto } from './dto/wallet.dto';
import { UpdateCreatorPreferenceDto } from './dto/creator-preference.dto';
import { Sequelize } from 'sequelize-typescript';
import { getStrategyForClaimCount } from './constants/cashback-strategies';
import { RazorpayService } from '../shared/razorpay.service';
import { Brand } from '../brand/model/brand.model';
import { S3Service } from '../shared/s3.service';
import { HypeStoreCouponCode } from '../wallet/models/hype-store-coupon-code.model';
import { HypeStoreCashbackTier, CashbackType } from '../wallet/models/hype-store-cashback-tier.model';
import { HypeStoreWebhookLog } from '../wallet/models/hype-store-webhook-log.model';
import { HypeStoreWebhookSecret } from '../wallet/models/hype-store-webhook-secret.model';
import { OrderStatus, CashbackStatus } from '../wallet/models/hype-store-order.model';
import { PurchaseWebhookDto, ReturnWebhookDto } from '../wallet/dto/hype-store-webhook.dto';
import { Influencer } from '../auth/model/influencer.model';
import * as crypto from 'crypto';

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
    @InjectModel(HypeStoreOrderOld)
    private orderModelOld: typeof HypeStoreOrderOld,
    @InjectModel(HypeStoreOrder)
    private orderModel: typeof HypeStoreOrder,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(HypeStoreCouponCode)
    private couponCodeModel: typeof HypeStoreCouponCode,
    @InjectModel(HypeStoreCashbackTier)
    private cashbackTierModel: typeof HypeStoreCashbackTier,
    @InjectModel(HypeStoreWebhookLog)
    private webhookLogModel: typeof HypeStoreWebhookLog,
    @InjectModel(HypeStoreWebhookSecret)
    private webhookSecretModel: typeof HypeStoreWebhookSecret,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
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
    const totalOrders = await this.orderModelOld.count({
      where: { storeId },
    });

    const totalSales = await this.orderModelOld.sum('orderAmount', {
      where: { storeId },
    });

    const totalCashbackSent = await this.orderModelOld.sum('cashbackAmount', {
      where: { storeId },
    });

    // Get orders from last month for comparison
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    const lastMonthOrders = await this.orderModelOld.count({
      where: {
        storeId,
        createdAt: { [require('sequelize').Op.gte]: lastMonthDate },
      },
    });

    const lastMonthSales = await this.orderModelOld.sum('orderAmount', {
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
  ): Promise<{ orders: HypeStoreOrderOld[]; total: number }> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const { count, rows } = await this.orderModelOld.findAndCountAll({
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
  async getOrderDetails(storeId: number, brandId: number, orderId: string): Promise<HypeStoreOrderOld> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const order = await this.orderModelOld.findOne({
      where: { storeId, orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Process purchase webhook from brand
   * Called when a customer makes a purchase using an influencer's coupon
   */
  async processPurchaseWebhook(
    apiKey: string,
    webhookDto: PurchaseWebhookDto,
    signature: string,
    ipAddress: string,
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    cashbackAmount?: number;
    cashbackStatus?: string;
  }> {
    const startTime = Date.now();
    let webhookSecret: HypeStoreWebhookSecret | null = null;
    let responseStatus = 200;
    let responseBody: any = { success: false, message: 'Processing failed' };
    let processedOrderId: number | null = null;

    try {
      // 1. Find store by API key
      webhookSecret = await this.webhookSecretModel.findOne({
        where: { apiKey, isActive: true },
        include: [{ model: this.hypeStoreModel }],
      });

      if (!webhookSecret) {
        responseStatus = 401;
        responseBody = { success: false, message: 'Invalid API key' };
        throw new UnauthorizedException('Invalid API key');
      }

      const hypeStore = webhookSecret.hypeStore;

      // 2. Verify webhook signature
      const isValidSignature = this.verifyWebhookSignature(
        JSON.stringify(webhookDto),
        signature,
        webhookSecret.webhookSecret,
      );

      if (!isValidSignature) {
        responseStatus = 401;
        responseBody = { success: false, message: 'Invalid webhook signature' };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/purchase',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: false,
          errorMessage: 'Invalid webhook signature',
        });
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // 3. Check for duplicate order (idempotency)
      const existingOrder = await this.orderModel.findOne({
        where: { externalOrderId: webhookDto.externalOrderId },
      });

      if (existingOrder) {
        responseStatus = 200;
        responseBody = {
          success: true,
          message: 'Order already processed',
          orderId: existingOrder.id,
          cashbackAmount: parseFloat(existingOrder.cashbackAmount.toString()),
          cashbackStatus: existingOrder.cashbackStatus,
        };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/purchase',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          processedOrderId: existingOrder.id,
        });
        return responseBody;
      }

      // 4. Find coupon code
      const couponCode = await this.couponCodeModel.findOne({
        where: { couponCode: webhookDto.couponCode, isActive: true },
        include: [{ model: this.influencerModel }],
      });

      if (!couponCode) {
        responseStatus = 400;
        responseBody = { success: false, message: 'Invalid or inactive coupon code' };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/purchase',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          errorMessage: 'Coupon code not found',
        });
        throw new BadRequestException('Invalid or inactive coupon code');
      }

      // Validate coupon belongs to this store OR is a universal coupon
      // Universal coupons have hypeStoreId = null and work for all stores
      const isUniversalCoupon = couponCode.hypeStoreId === null || (couponCode as any).isUniversal === true;
      if (!isUniversalCoupon && couponCode.hypeStoreId !== hypeStore.id) {
        responseStatus = 400;
        responseBody = { success: false, message: 'Coupon does not belong to this store' };
        throw new BadRequestException('Coupon does not belong to this store');
      }

      // 5. Calculate cashback
      const { cashbackAmount, tierId } = await this.calculateCashbackAmount(
        webhookDto.orderAmount,
        couponCode.influencerId,
        hypeStore.id,
      );

      // 6. Create order in transaction
      const transaction: Transaction = await this.sequelize.transaction();

      try {
        // Calculate return period end date (30 days from order date)
        const orderDate = new Date(webhookDto.orderDate);
        const returnPeriodDays = 30;
        const returnPeriodEndsAt = new Date(orderDate);
        returnPeriodEndsAt.setDate(returnPeriodEndsAt.getDate() + returnPeriodDays);

        const order = await this.orderModel.create(
          {
            hypeStoreId: hypeStore.id,
            couponCodeId: couponCode.id,
            influencerId: couponCode.influencerId,
            externalOrderId: webhookDto.externalOrderId,
            orderAmount: webhookDto.orderAmount,
            orderCurrency: webhookDto.orderCurrency || 'INR',
            orderDate: orderDate,
            customerEmail: webhookDto.customerEmail,
            customerPhone: webhookDto.customerPhone,
            customerName: webhookDto.customerName,
            orderStatus: webhookDto.orderStatus || OrderStatus.PENDING,
            cashbackAmount,
            cashbackStatus: CashbackStatus.PENDING,
            cashbackTierId: tierId,
            webhookReceivedAt: new Date(),
            webhookSignature: signature,
            webhookIpAddress: ipAddress,
            metadata: webhookDto.metadata,
            // Return period tracking fields
            returnPeriodDays: returnPeriodDays,
            returnPeriodEndsAt: returnPeriodEndsAt,
            visibleToInfluencer: false, // Hidden until return period ends
          } as any,
          { transaction },
        );

        processedOrderId = order.id;

        // Update coupon usage count
        await couponCode.increment('totalUses', { by: 1, transaction });

        // Update webhook secret last used timestamp
        await webhookSecret.update({ lastUsedAt: new Date() }, { transaction });

        await transaction.commit();

        responseStatus = 200;
        responseBody = {
          success: true,
          message: 'Order processed successfully',
          orderId: order.id,
          cashbackAmount,
          cashbackStatus: CashbackStatus.PENDING,
        };

        // Log successful webhook
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/purchase',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          processedOrderId: order.id,
        });

        return responseBody;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      responseStatus = responseStatus === 200 ? 500 : responseStatus;
      responseBody = {
        success: false,
        message: error.message || 'Internal server error',
      };

      // Log failed webhook
      if (webhookSecret) {
        await this.logWebhookRequest({
          hypeStoreId: webhookSecret.hypeStoreId,
          method: 'POST',
          path: '/webhooks/purchase',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: false,
          errorMessage: error.message,
          processedOrderId,
        });
      }

      throw error;
    }
  }

  /**
   * Process return/refund webhook from brand
   * Called when a customer returns a product or gets a refund
   */
  async processReturnWebhook(
    apiKey: string,
    webhookDto: ReturnWebhookDto,
    signature: string,
    ipAddress: string,
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    cashbackReversed?: boolean;
  }> {
    let webhookSecret: HypeStoreWebhookSecret | null = null;
    let responseStatus = 200;
    let responseBody: any = { success: false, message: 'Processing failed' };
    let processedOrderId: number | null = null;

    try {
      // 1. Find store by API key
      webhookSecret = await this.webhookSecretModel.findOne({
        where: { apiKey, isActive: true },
        include: [{ model: this.hypeStoreModel }],
      });

      if (!webhookSecret) {
        responseStatus = 401;
        responseBody = { success: false, message: 'Invalid API key' };
        throw new UnauthorizedException('Invalid API key');
      }

      const hypeStore = webhookSecret.hypeStore;

      // 2. Verify webhook signature
      const isValidSignature = this.verifyWebhookSignature(
        JSON.stringify(webhookDto),
        signature,
        webhookSecret.webhookSecret,
      );

      if (!isValidSignature) {
        responseStatus = 401;
        responseBody = { success: false, message: 'Invalid webhook signature' };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/return',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: false,
          errorMessage: 'Invalid webhook signature',
        });
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // 3. Find existing order
      const order = await this.orderModel.findOne({
        where: {
          hypeStoreId: hypeStore.id,
          externalOrderId: webhookDto.externalOrderId,
        },
      });

      if (!order) {
        responseStatus = 404;
        responseBody = { success: false, message: 'Order not found' };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/return',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          errorMessage: 'Order not found',
        });
        throw new NotFoundException('Order not found');
      }

      processedOrderId = order.id;

      // 4. Update order status and reverse cashback if needed
      const transaction: Transaction = await this.sequelize.transaction();
      let cashbackReversed = false;

      try {
        // Update order status to returned/refunded
        await order.update(
          {
            orderStatus: OrderStatus.RETURNED,
            cashbackStatus:
              order.cashbackStatus === CashbackStatus.CREDITED
                ? CashbackStatus.CANCELLED
                : order.cashbackStatus,
            visibleToInfluencer: false, // Ensure order stays hidden from influencer
            notes: `Return processed on ${new Date(webhookDto.returnDate).toISOString()}. Reason: ${webhookDto.returnReason || 'Not specified'}`,
          },
          { transaction },
        );

        // If cashback was already credited, reverse it
        if (
          order.cashbackStatus === CashbackStatus.CREDITED &&
          order.walletTransactionId
        ) {
          const influencerWallet = await this.walletModel.findOne({
            where: {
              userId: order.influencerId,
              userType: UserType.INFLUENCER,
            },
            transaction,
          });

          if (influencerWallet) {
            const previousBalance = parseFloat(influencerWallet.balance.toString());
            const cashbackAmount = parseFloat(order.cashbackAmount.toString());
            const newBalance = previousBalance - cashbackAmount;

            // Deduct cashback from influencer wallet
            await influencerWallet.update(
              {
                balance: newBalance,
                totalDebited: parseFloat(influencerWallet.totalDebited.toString()) + cashbackAmount,
              },
              { transaction },
            );

            // Create reversal transaction
            await this.walletTransactionModel.create(
              {
                walletId: influencerWallet.id,
                transactionType: TransactionType.DEBIT,
                amount: cashbackAmount,
                balanceBefore: previousBalance,
                balanceAfter: newBalance,
                status: TransactionStatus.COMPLETED,
                description: `Cashback reversal for returned order ${order.externalOrderId}`,
                storeId: hypeStore.id,
              } as any,
              { transaction },
            );

            cashbackReversed = true;
          }
        }

        // Update webhook secret last used timestamp
        await webhookSecret.update({ lastUsedAt: new Date() }, { transaction });

        await transaction.commit();

        responseStatus = 200;
        responseBody = {
          success: true,
          message: 'Return processed successfully',
          orderId: order.id,
          cashbackReversed,
        };

        // Log successful webhook
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/return',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          processedOrderId: order.id,
        });

        return responseBody;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      responseStatus = responseStatus === 200 ? 500 : responseStatus;
      responseBody = {
        success: false,
        message: error.message || 'Internal server error',
      };

      // Log failed webhook
      if (webhookSecret) {
        await this.logWebhookRequest({
          hypeStoreId: webhookSecret.hypeStoreId,
          method: 'POST',
          path: '/webhooks/return',
          headers: { 'x-webhook-signature': signature },
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: false,
          errorMessage: error.message,
          processedOrderId,
        });
      }

      throw error;
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  private verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      const expectedSignature = hmac.update(payload).digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate cashback amount based on influencer's follower tier
   */
  private async calculateCashbackAmount(
    orderAmount: number,
    influencerId: number,
    hypeStoreId: number,
  ): Promise<{ cashbackAmount: number; tierId: number | null }> {
    // Get influencer details to determine follower count
    const influencer = await this.influencerModel.findByPk(influencerId);

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    const followerCount = influencer.instagramFollowersCount || 0;

    // Find applicable cashback tier
    const tier = await this.cashbackTierModel.findOne({
      where: {
        hypeStoreId,
        isActive: true,
        minFollowers: { [require('sequelize').Op.lte]: followerCount },
        ...(followerCount > 0
          ? {
              [require('sequelize').Op.or]: [
                { maxFollowers: { [require('sequelize').Op.gte]: followerCount } },
                { maxFollowers: null },
              ],
            }
          : {}),
      },
      order: [['priority', 'DESC']],
    });

    if (!tier) {
      // No tier found, return minimum default
      return { cashbackAmount: 0, tierId: null };
    }

    let cashbackAmount = 0;

    // Calculate based on tier type
    if (tier.cashbackType === CashbackType.PERCENTAGE) {
      cashbackAmount = (orderAmount * parseFloat(tier.cashbackValue.toString())) / 100;
    } else {
      // Fixed amount
      cashbackAmount = parseFloat(tier.cashbackValue.toString());
    }

    // Apply min/max limits
    const minCashback = parseFloat(tier.minCashbackAmount.toString());
    const maxCashback = parseFloat(tier.maxCashbackAmount.toString());

    cashbackAmount = Math.max(minCashback, Math.min(maxCashback, cashbackAmount));

    return { cashbackAmount, tierId: tier.id };
  }

  /**
   * Credit cashback to influencer wallet (called separately, e.g., after order confirmation)
   */
  async creditCashbackToInfluencer(orderId: number): Promise<void> {
    const order = await this.orderModel.findByPk(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.cashbackStatus === CashbackStatus.CREDITED) {
      throw new BadRequestException('Cashback already credited');
    }

    // Find or create influencer wallet
    let influencerWallet = await this.walletModel.findOne({
      where: {
        userId: order.influencerId,
        userType: UserType.INFLUENCER,
      },
    });

    if (!influencerWallet) {
      influencerWallet = await this.walletModel.create({
        userId: order.influencerId,
        userType: UserType.INFLUENCER,
        balance: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const previousBalance = parseFloat(influencerWallet.balance.toString());
      const cashbackAmount = parseFloat(order.cashbackAmount.toString());
      const newBalance = previousBalance + cashbackAmount;

      // Update wallet
      await influencerWallet.update(
        {
          balance: newBalance,
          totalCredited: parseFloat(influencerWallet.totalCredited.toString()) + cashbackAmount,
          totalCashbackReceived:
            parseFloat(influencerWallet.totalCashbackReceived.toString()) + cashbackAmount,
        },
        { transaction },
      );

      // Create transaction record
      const walletTransaction = await this.walletTransactionModel.create(
        {
          walletId: influencerWallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: cashbackAmount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          status: TransactionStatus.COMPLETED,
          description: `Cashback for order ${order.externalOrderId}`,
          storeId: order.hypeStoreId,
        } as any,
        { transaction },
      );

      // Update order
      await order.update(
        {
          cashbackStatus: CashbackStatus.CREDITED,
          cashbackCreditedAt: new Date(),
          walletTransactionId: walletTransaction.id,
        },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Log webhook request for audit trail
   */
  private async logWebhookRequest(data: {
    hypeStoreId: number;
    method: string;
    path: string;
    headers: Record<string, any>;
    body: any;
    ipAddress: string;
    status: number;
    responseBody: any;
    isValid: boolean;
    errorMessage?: string;
    processedOrderId?: number | null;
  }): Promise<void> {
    try {
      await this.webhookLogModel.create({
        hypeStoreId: data.hypeStoreId,
        requestMethod: data.method,
        requestPath: data.path,
        requestHeaders: data.headers,
        requestBody: data.body,
        requestIp: data.ipAddress,
        responseStatus: data.status,
        responseBody: data.responseBody,
        isValid: data.isValid,
        errorMessage: data.errorMessage,
        processedOrderId: data.processedOrderId,
      } as any);
    } catch (error) {
      // Don't throw on logging errors
      console.error('Failed to log webhook request:', error);
    }
  }
}
