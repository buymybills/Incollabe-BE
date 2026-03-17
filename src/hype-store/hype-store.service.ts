import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { HypeStore } from '../wallet/models/hype-store.model';
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
import { HypeStoreReferralCode } from '../wallet/models/hype-store-referral-code.model';
import { OrderStatus, CashbackStatus } from '../wallet/models/hype-store-order.model';
import { PurchaseWebhookDto, ReturnWebhookDto } from '../wallet/dto/hype-store-webhook.dto';
import { Influencer } from '../auth/model/influencer.model';
import { InstagramProfileAnalysis } from '../shared/models/instagram-profile-analysis.model';
import { InfluencerProfileScoringService } from '../shared/services/influencer-profile-scoring.service';
import * as crypto from 'crypto';

@Injectable()
export class HypeStoreService {
  private readonly logger = new Logger(HypeStoreService.name);
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
    @InjectModel(HypeStoreReferralCode)
    private referralCodeModel: typeof HypeStoreReferralCode,
    @InjectModel(InstagramProfileAnalysis)
    private instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    private influencerProfileScoringService: InfluencerProfileScoringService,
    private sequelize: Sequelize,
    private razorpayService: RazorpayService,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {}

  /**
   * Generate a secure API key for webhook authentication
   * Format: hs_live_{32_char_random_string} or hs_test_{32_char_random_string}
   */
  private generateApiKey(isTestMode: boolean = false): string {
    const prefix = isTestMode ? 'hs_test' : 'hs_live';
    const randomString = crypto.randomBytes(16).toString('hex'); // 32 characters
    return `${prefix}_${randomString}`;
  }

  /**
   * Generate a secure webhook secret (for future use)
   * Returns a 64-character random hex string
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex'); // 64 characters
  }

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
          storeBanner: bannerImageUrl || brand.profileBanner || null,
          storeLogo: brand.profileImage || null,
          storeDescription: brand.brandBio || null,
          isActive: createDto.isActive ?? true,
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

      // Ensure brand-level creator preferences exist (one per brand)
      const existingPreferences = await this.creatorPreferenceModel.findOne({
        where: { brandId },
        transaction,
      });

      if (!existingPreferences) {
        await this.creatorPreferenceModel.create(
          {
            brandId,
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
      }

      // Auto-create brand-shared coupon code
      // Format: {First 2 letters of brand name}COL{cashback percentage}
      // Example: SNCOL25 (Snitch with 25% cashback), NICOL30, etc.
      const brandPrefix = brand.brandName
        .replace(/[^A-Za-z]/g, '') // Remove non-alphabetic characters
        .substring(0, 2)
        .toUpperCase();

      // Use provided cashback percentage or default to 25
      const cashbackPercentage = createDto.cashbackPercentage || 25;

      // Ensure it's 2 digits (pad with 0 if needed)
      const percentageSuffix = cashbackPercentage.toString().padStart(2, '0');
      const couponCode = `${brandPrefix}COL${percentageSuffix}`;

      // Check if coupon code already exists
      const existingCoupon = await this.couponCodeModel.findOne({
        where: { couponCode },
        transaction,
      });

      if (existingCoupon) {
        throw new BadRequestException(
          `Coupon code ${couponCode} already exists. Please use a different cashback percentage.`,
        );
      }

      // Create the brand-shared coupon
      await this.couponCodeModel.create(
        {
          hypeStoreId: store.id,
          influencerId: null, // NULL for brand-shared coupons
          couponCode: couponCode,
          isBrandShared: true,
          isUniversal: false,
          isActive: true,
          totalUses: 0,
          maxUses: null, // Unlimited uses
          validFrom: null,
          validUntil: null,
        } as any,
        { transaction },
      );

      // Generate and create webhook credentials
      const apiKey = this.generateApiKey(false); // Use live mode by default
      const webhookSecret = this.generateWebhookSecret();

      await this.webhookSecretModel.create(
        {
          hypeStoreId: store.id,
          apiKey,
          webhookSecret,
          isActive: true,
        } as any,
        { transaction },
      );

      await transaction.commit();

      // Return store with cashbackConfig and coupon code
      const createdStore = await this.hypeStoreModel.findOne({
        where: { id: store.id },
        include: [{ model: HypeStoreCashbackConfig }],
      });

      if (!createdStore) {
        throw new NotFoundException('Failed to retrieve created store');
      }

      // Get the brand-shared coupon code we just created
      const brandCoupon = await this.couponCodeModel.findOne({
        where: {
          hypeStoreId: store.id,
          isBrandShared: true,
          isActive: true,
        },
      });

      // Get the webhook credentials we just created
      const webhookCredentials = await this.webhookSecretModel.findOne({
        where: { hypeStoreId: store.id },
      });

      // Build webhook endpoint (unified)
      const baseUrl = this.configService.get<string>('API_BASE_URL') || 'https://api.incollabe.com';
      const webhookUrl = webhookCredentials
        ? `${baseUrl}/webhooks/hype-store/${webhookCredentials.apiKey}`
        : null;

      return {
        ...createdStore.toJSON(),
        brandCouponCode: brandCoupon?.couponCode || null,
        webhookCredentials: webhookCredentials ? {
          apiKey: webhookCredentials.apiKey,
          webhookUrl,
          message: 'POST to this URL with eventType ("purchase" or "return") in the request body. See API docs for examples.',
        } : null,
      } as any;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get all stores by brand ID with all associations
   */
  async getStoresByBrandId(brandId: number): Promise<any[]> {
    const stores = await this.hypeStoreModel.findAll({
      where: { brandId },
      include: [
        { model: HypeStoreCashbackConfig },
        { model: HypeStoreCreatorPreference, required: false },
      ],
      order: [['createdAt', 'ASC']],
    });

    // Enrich each store with its brand-shared coupon code
    const enrichedStores = await Promise.all(
      stores.map(async (store) => {
        // Get the brand-shared coupon code for this store
        const brandCoupon = await this.couponCodeModel.findOne({
          where: {
            hypeStoreId: store.id,
            isBrandShared: true,
            isActive: true,
          },
        });

        return {
          ...store.toJSON(),
          brandCouponCode: brandCoupon?.couponCode || null,
        };
      }),
    );

    return enrichedStores;
  }

  /**
   * Get store by ID with all associations (with brand ownership verification)
   */
  async getStoreById(storeId: number, brandId?: number): Promise<any> {
    const whereClause: any = { id: storeId };
    if (brandId) {
      whereClause.brandId = brandId;
    }

    const store = await this.hypeStoreModel.findOne({
      where: whereClause,
      include: [
        { model: HypeStoreCashbackConfig },
        { model: HypeStoreCreatorPreference, required: false },
      ],
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    // Get the brand-shared coupon code for this store
    const brandCoupon = await this.couponCodeModel.findOne({
      where: {
        hypeStoreId: storeId,
        isBrandShared: true,
        isActive: true,
      },
    });

    // Calculate aggregate performance metrics from all orders with submitted proof
    const ordersWithProof = await this.orderModel.findAll({
      where: {
        hypeStoreId: storeId,
        instagramProofUrl: { [require('sequelize').Op.ne]: null }, // Has proof submitted
      },
      include: [
        {
          model: this.influencerModel,
          as: 'influencer',
          attributes: ['id', 'instagramFollowersCount'],
        },
      ],
    });

    let avgExpectedROI: number | null = null;
    let avgEstimatedEngagement: number | null = null;
    let avgEstimatedReach: number | null = null;
    let avgEngagementScore: number | null = null;

    if (ordersWithProof.length > 0) {
      const metrics = {
        totalROI: 0,
        countROI: 0,
        totalEngagement: 0,
        countEngagement: 0,
        totalReach: 0,
        countReach: 0,
        totalEngagementScore: 0,
        countEngagementScore: 0,
      };

      // Calculate metrics for each order and get averages
      for (const order of ordersWithProof) {
        // Use stored values or calculate on-the-fly
        let expectedROI = order.expectedRoi ? parseFloat(order.expectedRoi.toString()) : null;
        let estimatedEngagement = order.estimatedEngagement || null;
        let estimatedReach = order.estimatedReach || null;

        // Calculate missing metrics
        if (!estimatedReach && order.influencer?.instagramFollowersCount) {
          estimatedReach = Math.round(order.influencer.instagramFollowersCount * 0.25);
        }

        if (!estimatedEngagement && order.influencer?.instagramFollowersCount) {
          estimatedEngagement = Math.round(order.influencer.instagramFollowersCount * 0.035);
        }

        if (!expectedROI && estimatedReach && estimatedReach > 0) {
          const cashbackAmount = parseFloat(order.cashbackAmount.toString());
          const estimatedValue = (estimatedReach / 1000) * 50;
          expectedROI = ((estimatedValue - cashbackAmount) / cashbackAmount) * 100;
          expectedROI = Math.round(expectedROI * 10) / 10;
        }

        // Get engagement score from profile scoring service
        if (order.influencer) {
          try {
            const engagementStrength = await this.influencerProfileScoringService.calculateEngagementStrength(order.influencer);
            if (engagementStrength?.score) {
              metrics.totalEngagementScore += engagementStrength.score;
              metrics.countEngagementScore++;
            }
          } catch (error) {
            // Ignore if engagement calculation fails
          }
        }

        // Add to totals
        if (expectedROI !== null) {
          metrics.totalROI += expectedROI;
          metrics.countROI++;
        }
        if (estimatedEngagement !== null) {
          metrics.totalEngagement += estimatedEngagement;
          metrics.countEngagement++;
        }
        if (estimatedReach !== null) {
          metrics.totalReach += estimatedReach;
          metrics.countReach++;
        }
      }

      // Calculate averages
      avgExpectedROI = metrics.countROI > 0 ? Math.round((metrics.totalROI / metrics.countROI) * 10) / 10 : null;
      avgEstimatedEngagement = metrics.countEngagement > 0 ? Math.round(metrics.totalEngagement / metrics.countEngagement) : null;
      avgEstimatedReach = metrics.countReach > 0 ? Math.round(metrics.totalReach / metrics.countReach) : null;
      avgEngagementScore = metrics.countEngagementScore > 0 ? Math.round((metrics.totalEngagementScore / metrics.countEngagementScore) * 10) / 10 : null;
    }

    // Determine tier labels
    const getTierLabel = (value: number | null, type: 'roi' | 'engagement' | 'reach'): string => {
      if (!value) return 'Unknown';

      if (type === 'roi') {
        if (value >= 150) return 'Elite';
        if (value >= 100) return 'Excellent';
        if (value >= 50) return 'Good';
        if (value >= 0) return 'Average';
        return 'Poor';
      } else if (type === 'engagement') {
        if (value >= 10000) return 'Elite';
        if (value >= 5000) return 'Excellent';
        if (value >= 2000) return 'Good';
        if (value >= 500) return 'Average';
        return 'Low';
      } else if (type === 'reach') {
        if (value >= 100000) return 'Elite';
        if (value >= 50000) return 'Excellent';
        if (value >= 20000) return 'Good';
        if (value >= 5000) return 'Average';
        return 'Low';
      }
      return 'Unknown';
    };

    // Get wallet details for budget information
    const wallet = await this.walletModel.findOne({
      where: {
        userId: store.brandId,
        userType: UserType.BRAND,
      },
    });

    // Get all orders for this store (for total count and sales)
    const allOrders = await this.orderModel.findAll({
      where: { hypeStoreId: storeId },
      attributes: ['id', 'orderAmount', 'createdAt'],
    });

    const totalOrders = allOrders.length;
    const totalSales = allOrders.reduce((sum, order) => sum + parseFloat(order.orderAmount.toString()), 0);

    // Calculate orders and sales from last month for comparison
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    const lastMonthOrders = allOrders.filter(order => new Date(order.createdAt) >= lastMonthDate);
    const lastMonthOrdersCount = lastMonthOrders.length;
    const lastMonthSales = lastMonthOrders.reduce((sum, order) => sum + parseFloat(order.orderAmount.toString()), 0);

    // Calculate previous month's data for growth comparison
    const twoMonthsAgoDate = new Date();
    twoMonthsAgoDate.setMonth(twoMonthsAgoDate.getMonth() - 2);

    const previousMonthOrders = allOrders.filter(
      order => new Date(order.createdAt) >= twoMonthsAgoDate && new Date(order.createdAt) < lastMonthDate
    );
    const previousMonthOrdersCount = previousMonthOrders.length;
    const previousMonthSales = previousMonthOrders.reduce((sum, order) => sum + parseFloat(order.orderAmount.toString()), 0);

    // Calculate growth percentages
    const ordersGrowth = previousMonthOrdersCount > 0
      ? Math.round(((lastMonthOrdersCount - previousMonthOrdersCount) / previousMonthOrdersCount) * 100)
      : 0;

    const salesGrowth = previousMonthSales > 0
      ? Math.round(((lastMonthSales - previousMonthSales) / previousMonthSales) * 100)
      : 0;

    // Extract cashback percentage from coupon code (last 2 digits)
    const cashbackPercentage = brandCoupon?.couponCode
      ? parseInt(brandCoupon.couponCode.slice(-2))
      : null;

    // Calculate predicted validity based on avg order value and remaining budget
    let predictedValidityTransactions: number | null = null;
    if (wallet && totalOrders > 0) {
      const avgCashbackPerOrder = parseFloat(wallet.totalDebited.toString()) / totalOrders;
      const remainingBudget = parseFloat(wallet.balance.toString());
      predictedValidityTransactions = avgCashbackPerOrder > 0
        ? Math.floor(remainingBudget / avgCashbackPerOrder)
        : null;
    }

    return {
      ...store.toJSON(),
      brandCouponCode: brandCoupon?.couponCode || null,
      cashbackLimit: cashbackPercentage ? `${cashbackPercentage}%` : null,
      monthlyPurchaseLimit: store.cashbackConfig?.monthlyClaimCount || null,
      wallet: wallet
        ? {
            totalBudget: parseFloat(wallet.totalCredited.toString()),
            budgetUtilised: parseFloat(wallet.totalDebited.toString()),
            budgetRemaining: parseFloat(wallet.balance.toString()),
            predictedValidityTransactions: predictedValidityTransactions,
          }
        : null,
      orders: {
        total: totalOrders,
        growthPercentage: ordersGrowth,
      },
      sales: {
        total: totalSales,
        growthPercentage: salesGrowth,
      },
      aggregatePerformance: {
        expectedROI: avgExpectedROI,
        estimatedEngagement: avgEstimatedEngagement,
        estimatedReach: avgEstimatedReach,
        engagementScore: avgEngagementScore,
        totalInfluencers: ordersWithProof.length,
        tierLabels: {
          expectedROI: getTierLabel(avgExpectedROI, 'roi'),
          estimatedEngagement: getTierLabel(avgEstimatedEngagement, 'engagement'),
          estimatedReach: getTierLabel(avgEstimatedReach, 'reach'),
        },
      },
    };
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
   * Get webhook credentials for a store
   */
  async getWebhookCredentials(storeId: number, brandId: number): Promise<{
    apiKey: string;
    webhookUrl: string | null;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
  }> {
    // Verify store belongs to brand
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    // Get webhook credentials
    const credentials = await this.webhookSecretModel.findOne({
      where: { hypeStoreId: storeId },
    });

    if (!credentials) {
      throw new NotFoundException('Webhook credentials not found for this store');
    }

    return {
      apiKey: credentials.apiKey,
      webhookUrl: credentials.webhookUrl,
      isActive: credentials.isActive,
      lastUsedAt: credentials.lastUsedAt,
      createdAt: credentials.createdAt,
    };
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
   * Create a brand-shared coupon for a store
   * This coupon can be used by all influencers with their unique referral codes
   */
  async createBrandSharedCoupon(
    storeId: number,
    brandId: number,
    couponCode?: string,
    description?: string,
  ) {
    // Verify store belongs to brand
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
      include: [{ model: this.brandModel, as: 'brand' }],
    });

    if (!store) {
      throw new NotFoundException('Store not found or does not belong to this brand');
    }

    // Auto-generate coupon code if not provided
    // Format: {First 2 letters of brand name}COL{sequential number}
    // Example: SNCOL12
    if (!couponCode) {
      const brand = store.brand;
      if (!brand || !brand.brandName) {
        throw new BadRequestException('Brand name not found for auto-generating coupon code');
      }

      // Get first 2 letters of brand name
      const brandPrefix = brand.brandName
        .replace(/[^A-Za-z]/g, '') // Remove non-alphabetic characters
        .substring(0, 2)
        .toUpperCase();

      // Find the next sequential number by counting existing brand coupons
      const existingBrandCoupons = await this.couponCodeModel.count({
        where: {
          couponCode: { [require('sequelize').Op.like]: `${brandPrefix}COL%` },
        },
      });

      const sequentialNumber = existingBrandCoupons + 1;
      couponCode = `${brandPrefix}COL${sequentialNumber}`;

      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 50) {
        const existing = await this.couponCodeModel.findOne({
          where: { couponCode },
        });

        if (!existing) {
          break;
        }

        // Increment number if collision
        const nextNumber = existingBrandCoupons + attempts + 2;
        couponCode = `${brandPrefix}COL${nextNumber}`;
        attempts++;
      }

      if (attempts >= 50) {
        throw new BadRequestException('Failed to generate unique coupon code');
      }
    } else {
      // Validate provided coupon code is unique
      const existingCoupon = await this.couponCodeModel.findOne({
        where: { couponCode: couponCode.toUpperCase() },
      });

      if (existingCoupon) {
        throw new BadRequestException('This coupon code is already in use');
      }
    }

    // Check if store already has a brand-shared coupon
    const existingBrandCoupon = await this.couponCodeModel.findOne({
      where: {
        hypeStoreId: storeId,
        isBrandShared: true,
        isActive: true,
      },
    });

    if (existingBrandCoupon) {
      throw new BadRequestException(
        `Store already has an active brand-shared coupon: ${existingBrandCoupon.couponCode}`,
      );
    }

    // Create the brand-shared coupon
    const brandCoupon = await this.couponCodeModel.create({
      hypeStoreId: storeId,
      influencerId: null, // NULL for brand-shared coupons
      couponCode: couponCode.toUpperCase(),
      isBrandShared: true,
      isUniversal: false, // Specific to this store, not all stores
      isActive: true,
      totalUses: 0,
      maxUses: null, // Unlimited uses
      validFrom: null,
      validUntil: null,
    } as any);

    return {
      success: true,
      data: {
        id: brandCoupon.id,
        couponCode: brandCoupon.couponCode,
        hypeStoreId: storeId,
        storeName: store.storeName,
        isBrandShared: true,
        isActive: true,
        totalUses: 0,
        createdAt: brandCoupon.createdAt,
        description: description || `Brand-shared coupon for ${store.storeName}`,
      },
      message: `Brand-shared coupon ${couponCode} created successfully. Influencers can now use this with their referral codes.`,
    };
  }

  /**
   * Get brand-shared coupon for a store
   */
  async getBrandSharedCoupon(storeId: number, brandId: number) {
    // Verify store belongs to brand
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Store not found or does not belong to this brand');
    }

    // Get brand-shared coupon
    const brandCoupon = await this.couponCodeModel.findOne({
      where: {
        hypeStoreId: storeId,
        isBrandShared: true,
        isActive: true,
      },
    });

    if (!brandCoupon) {
      return {
        success: true,
        data: null,
        message: 'No brand-shared coupon exists for this store yet',
      };
    }

    // Get stats: how many influencers have referral codes for this store
    const referralCodeCount = await this.referralCodeModel.count({
      where: { hypeStoreId: storeId, isActive: true },
    });

    return {
      success: true,
      data: {
        id: brandCoupon.id,
        couponCode: brandCoupon.couponCode,
        hypeStoreId: storeId,
        storeName: store.storeName,
        isBrandShared: true,
        isActive: brandCoupon.isActive,
        totalUses: brandCoupon.totalUses,
        influencersUsingCount: referralCodeCount,
        createdAt: brandCoupon.createdAt,
      },
      message: 'Brand-shared coupon details',
    };
  }

  /**
   * Deactivate brand-shared coupon for a store
   */
  async deactivateBrandSharedCoupon(storeId: number, brandId: number) {
    // Verify store belongs to brand
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Store not found or does not belong to this brand');
    }

    // Find and deactivate brand-shared coupon
    const brandCoupon = await this.couponCodeModel.findOne({
      where: {
        hypeStoreId: storeId,
        isBrandShared: true,
        isActive: true,
      },
    });

    if (!brandCoupon) {
      throw new NotFoundException('No active brand-shared coupon found for this store');
    }

    await brandCoupon.update({
      isActive: false,
      deactivatedAt: new Date(),
    });

    return {
      success: true,
      message: `Brand-shared coupon ${brandCoupon.couponCode} has been deactivated`,
    };
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
    brandId: number,
    updateDto: UpdateCreatorPreferenceDto,
  ): Promise<HypeStoreCreatorPreference> {
    let preferences = await this.creatorPreferenceModel.findOne({
      where: { brandId },
    });

    if (!preferences) {
      preferences = await this.creatorPreferenceModel.create({
        brandId,
        influencerTypes: [],
        minAge: 18,
        maxAge: 60,
        genderPreference: [],
        nicheCategories: [],
        preferredLocations: [],
        isPanIndia: false,
      } as any);
    }

    // Sanitize incoming payload to avoid NaN/undefined writes
    this.logger.debug('Creator preference update received', { brandId, updateDto });
    // Duplicate basic console logs to help DB-side tracing in lower environments
    // (these appear in the PostgreSQL logs when using psql \watch scripts)
    // eslint-disable-next-line no-console
    console.log('[creator-preferences] incoming', { brandId, updateDto });

    const updateData: Partial<UpdateCreatorPreferenceDto> = {};

    // Force arrays to string arrays (filter out non-strings)
    if (Array.isArray(updateDto.influencerTypes)) {
      updateData.influencerTypes = updateDto.influencerTypes.filter((v) => typeof v === 'string') as any;
    }
    if (Array.isArray(updateDto.genderPreference)) {
      updateData.genderPreference = updateDto.genderPreference.filter((v) => typeof v === 'string') as any;
    }
    if (Array.isArray(updateDto.nicheCategories)) {
      updateData.nicheCategories = updateDto.nicheCategories.filter((v) => typeof v === 'string');
    }
    if (Array.isArray(updateDto.preferredLocations)) {
      updateData.preferredLocations = updateDto.preferredLocations.filter((v) => typeof v === 'string');
    }
    if (typeof updateDto.isPanIndia === 'boolean') updateData.isPanIndia = updateDto.isPanIndia;

    const minAge = Number(updateDto.minAge);
    if (Number.isFinite(minAge)) {
      updateData.minAge = minAge;
    } else if (updateDto.minAge !== undefined) {
      this.logger.warn('Rejected non-finite minAge in creator preferences', { brandId, value: updateDto.minAge });
      // eslint-disable-next-line no-console
      console.warn('[creator-preferences] rejected minAge', { brandId, value: updateDto.minAge });
    }

    const maxAge = Number(updateDto.maxAge);
    if (Number.isFinite(maxAge)) {
      updateData.maxAge = maxAge;
    } else if (updateDto.maxAge !== undefined) {
      this.logger.warn('Rejected non-finite maxAge in creator preferences', { brandId, value: updateDto.maxAge });
      // eslint-disable-next-line no-console
      console.warn('[creator-preferences] rejected maxAge', { brandId, value: updateDto.maxAge });
    }

    this.logger.debug('Creator preference update sanitized', { brandId, updateData });
    // eslint-disable-next-line no-console
    console.log('[creator-preferences] sanitized update', { brandId, updateData });

    if (Object.keys(updateData).length === 0) {
      this.logger.warn('Creator preference update ignored because payload was empty after sanitization', {
        brandId,
        raw: updateDto,
      });
      // eslint-disable-next-line no-console
      console.warn('[creator-preferences] update skipped (empty after sanitize)', { brandId, raw: updateDto });
      return preferences;
    }

    try {
      await preferences.update(updateData);
    } catch (err) {
      this.logger.error('Failed to update creator preferences', err?.stack, { brandId, updateData, raw: updateDto });
      // eslint-disable-next-line no-console
      console.error('[creator-preferences] update failed', { brandId, updateData, raw: updateDto, err });
      throw err;
    }
    // eslint-disable-next-line no-console
    console.log('[creator-preferences] update persisted', { brandId, preferencesId: preferences.id });
    return preferences;
  }

  /**
   * Get brand-level creator preferences
   */
  async getCreatorPreferences(
    brandId: number,
  ): Promise<HypeStoreCreatorPreference> {
    let preferences = await this.creatorPreferenceModel.findOne({
      where: { brandId },
    });

    if (!preferences) {
      preferences = await this.creatorPreferenceModel.create({
        brandId,
        influencerTypes: [],
        minAge: 18,
        maxAge: 60,
        genderPreference: [],
        nicheCategories: [],
        preferredLocations: [],
        isPanIndia: false,
      } as any);
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
      where: { hypeStoreId: storeId },
    });

    const totalSales = await this.orderModel.sum('orderAmount', {
      where: { hypeStoreId: storeId },
    });

    const totalCashbackSent = await this.orderModel.sum('cashbackAmount', {
      where: { hypeStoreId: storeId },
    });

    // Get orders from last month for comparison
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    const lastMonthOrders = await this.orderModel.count({
      where: {
        hypeStoreId: storeId,
        createdAt: { [require('sequelize').Op.gte]: lastMonthDate },
      },
    });

    const lastMonthSales = await this.orderModel.sum('orderAmount', {
      where: {
        hypeStoreId: storeId,
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
      where: { hypeStoreId: storeId },
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
  async getOrderDetails(storeId: number, brandId: number, orderId: string): Promise<any> {
    const store = await this.hypeStoreModel.findOne({
      where: { id: storeId, brandId },
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found');
    }

    const order = await this.orderModel.findOne({
      where: { hypeStoreId: storeId, externalOrderId: orderId },
      include: [
        {
          model: this.influencerModel,
          as: 'influencer',
          attributes: [
            'id',
            'name',
            'username',
            'profileImage',
            'instagramFollowersCount',
            'instagramFollowsCount',
            'instagramMediaCount',
            'instagramUsername',
          ],
        },
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          attributes: ['id', 'storeName'],
        },
        {
          model: this.couponCodeModel,
          as: 'couponCode',
          attributes: ['id', 'couponCode'],
        },
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Calculate performance metrics using existing engagement calculation service
    let expectedROI = order.expectedRoi ? parseFloat(order.expectedRoi.toString()) : null;
    let estimatedEngagement = order.estimatedEngagement || null;
    let estimatedReach = order.estimatedReach || null;
    let engagementScore: number | null = null;
    let engagementRating: string | null = null;
    let avgEngagementRate: number | null = null;
    let dataSource = 'estimated';

    // Get engagement data from profile scoring service
    if (order.influencer) {
      try {
        const engagementStrength = await this.influencerProfileScoringService.calculateEngagementStrength(order.influencer);

        if (engagementStrength && engagementStrength.breakdown?.engagementOverview?.details) {
          const details = engagementStrength.breakdown.engagementOverview.details;

          // Use calculated engagement score and rating
          engagementScore = engagementStrength.score;
          engagementRating = details.rating;
          avgEngagementRate = details.engagementRate;

          // Use actual reach from Instagram insights
          if (!estimatedReach && details.avgReach) {
            estimatedReach = details.avgReach;
            dataSource = 'instagram_insights';
          }

          // Calculate total engagement count from followers and engagement rate
          if (!estimatedEngagement && avgEngagementRate && order.influencer.instagramFollowersCount) {
            estimatedEngagement = Math.round((order.influencer.instagramFollowersCount * avgEngagementRate) / 100);
          }

          // Calculate ROI based on actual reach data
          if (!expectedROI && estimatedReach && estimatedReach > 0) {
            const cashbackAmount = parseFloat(order.cashbackAmount.toString());
            // ROI formula: (Value - Cost) / Cost
            // Assuming value is based on reach multiplied by industry standard CPM
            const estimatedValue = (estimatedReach / 1000) * 50; // ₹50 CPM industry standard
            expectedROI = ((estimatedValue - cashbackAmount) / cashbackAmount) * 100;
            expectedROI = Math.round(expectedROI * 10) / 10; // Round to 1 decimal
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to calculate engagement strength for influencer ${order.influencerId}: ${error.message}`);
      }

      // Fallback to basic estimates if engagement service didn't provide data
      if (!estimatedReach || !estimatedEngagement) {
        const followerCount = order.influencer.instagramFollowersCount || 0;

        if (!estimatedReach) {
          estimatedReach = Math.round(followerCount * 0.25);
        }

        if (!estimatedEngagement) {
          estimatedEngagement = Math.round(followerCount * 0.035);
        }

        if (!expectedROI && estimatedReach > 0) {
          const cashbackAmount = parseFloat(order.cashbackAmount.toString());
          const estimatedValue = (estimatedReach / 1000) * 50;
          expectedROI = ((estimatedValue - cashbackAmount) / cashbackAmount) * 100;
          expectedROI = Math.round(expectedROI * 10) / 10;
        }
      }
    }

    // Determine tier labels based on metrics
    const getTierLabel = (value: number | null, type: 'roi' | 'engagement' | 'reach'): string => {
      if (!value) return 'Unknown';

      if (type === 'roi') {
        if (value >= 150) return 'Elite';
        if (value >= 100) return 'Excellent';
        if (value >= 50) return 'Good';
        if (value >= 0) return 'Average';
        return 'Poor';
      } else if (type === 'engagement') {
        if (value >= 10000) return 'Elite';
        if (value >= 5000) return 'Excellent';
        if (value >= 2000) return 'Good';
        if (value >= 500) return 'Average';
        return 'Low';
      } else if (type === 'reach') {
        if (value >= 100000) return 'Elite';
        if (value >= 50000) return 'Excellent';
        if (value >= 20000) return 'Good';
        if (value >= 5000) return 'Average';
        return 'Low';
      }
      return 'Unknown';
    };

    // Calculate cashback percentage/type
    let cashbackType = order.cashbackType;
    if (!cashbackType && order.orderAmount && order.cashbackAmount) {
      const percentage = (parseFloat(order.cashbackAmount.toString()) / parseFloat(order.orderAmount.toString())) * 100;
      cashbackType = `Flat ${percentage.toFixed(0)}%`;
    }

    // Format response with performance metrics
    return {
      id: order.id,
      externalOrderId: order.externalOrderId,
      orderTitle: order.orderTitle || null,
      orderDate: order.orderDate,
      orderAmount: parseFloat(order.orderAmount.toString()),
      orderStatus: order.orderStatus,
      cashback: {
        amount: parseFloat(order.cashbackAmount.toString()),
        type: cashbackType,
        status: order.cashbackStatus,
        creditedAt: order.cashbackCreditedAt,
      },
      promotionMedia: order.instagramProofUrl
        ? {
            type: order.proofContentType,
            url: order.instagramProofUrl,
            thumbnailUrl: order.proofThumbnailUrl || null,
            postedAt: order.proofPostedAt || order.proofSubmittedAt,
            viewCount: order.proofViewCount || null,
            submittedAt: order.proofSubmittedAt,
          }
        : null,
      performance: {
        expectedROI: expectedROI,
        estimatedEngagement: estimatedEngagement,
        estimatedReach: estimatedReach,
        avgEngagementRate: avgEngagementRate,
        engagementScore: engagementScore, // Score out of 100 from engagement calculation service
        engagementRating: engagementRating, // Exceptional, Excellent, Good, Fair, etc.
        dataSource: dataSource,
        tierLabels: {
          expectedROI: getTierLabel(expectedROI, 'roi'),
          estimatedEngagement: getTierLabel(estimatedEngagement, 'engagement'),
          estimatedReach: getTierLabel(estimatedReach, 'reach'),
        },
      },
      store: order.hypeStore
        ? {
            id: order.hypeStore.id,
            name: order.hypeStore.storeName,
          }
        : null,
      influencer: order.influencer
        ? {
            id: order.influencer.id,
            name: order.influencer.name,
            username: order.influencer.username,
            profileImage: order.influencer.profileImage,
            instagramUsername: order.influencer.instagramUsername,
            instagramFollowersCount: order.influencer.instagramFollowersCount,
          }
        : null,
      couponCode: order.couponCode?.couponCode || null,
      referralCode: order.referralCode || null,
      returnPeriod: {
        days: order.returnPeriodDays,
        endsAt: order.returnPeriodEndsAt,
        isReturned: order.isReturned,
      },
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Process unified webhook from brand
   * Handles both purchase and return events based on eventType
   */
  async processWebhook(
    apiKey: string,
    webhookDto: any, // UnifiedWebhookDto
    ipAddress: string,
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    cashbackAmount?: number;
    cashbackStatus?: string;
    cashbackReversed?: boolean;
  }> {
    const { eventType, ...data } = webhookDto;

    // Route to appropriate handler based on event type
    if (eventType === 'purchase') {
      return this.processPurchaseWebhook(apiKey, data as any, ipAddress);
    } else if (eventType === 'return') {
      return this.processReturnWebhook(apiKey, data as any, ipAddress);
    } else {
      throw new BadRequestException(`Invalid event type: ${eventType}`);
    }
  }

  /**
   * Process purchase webhook from brand
   * Called when a customer makes a purchase using an influencer's coupon
   */
  async processPurchaseWebhook(
    apiKey: string,
    webhookDto: PurchaseWebhookDto,
    ipAddress: string,
  ): Promise<{
    success: boolean;
    message: string;
    orderId?: number;
    cashbackAmount?: number;
    cashbackStatus?: string;
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

      // 2. Check for duplicate order (idempotency)
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
          headers: {},
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
          headers: {},
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

      // 5. Determine influencer attribution
      let attributedInfluencerId: number;

      // ATTRIBUTION FLOW:
      // 1. If referralCode is provided → parse influencerId from "INFL{id}" format
      // 2. Else if coupon code is "INFL{id}" → parse influencerId directly
      // 3. Else → use coupon's influencerId field (for brand-shared coupons)

      if (webhookDto.referralCode) {
        // Parse influencerId from referral code format: INFL123 → 123
        const match = webhookDto.referralCode.match(/^INFL(\d+)$/);
        if (match) {
          attributedInfluencerId = parseInt(match[1], 10);
        } else {
          // Fallback: lookup in database for custom referral codes
          const referralCodeRecord = await this.referralCodeModel.findOne({
            where: { referralCode: webhookDto.referralCode, isActive: true },
          });

          if (!referralCodeRecord) {
            responseStatus = 400;
            responseBody = { success: false, message: 'Invalid or inactive referral code' };
            await this.logWebhookRequest({
              hypeStoreId: hypeStore.id,
              method: 'POST',
              path: '/webhooks/purchase',
              headers: {},
              body: webhookDto,
              ipAddress,
              status: responseStatus,
              responseBody,
              isValid: true,
              errorMessage: 'Referral code not found',
            });
            throw new BadRequestException('Invalid or inactive referral code');
          }

          attributedInfluencerId = referralCodeRecord.influencerId;
        }
      } else {
        // Parse from coupon code if it's INFL{id} format
        const match = webhookDto.couponCode.match(/^INFL(\d+)$/);
        if (match) {
          attributedInfluencerId = parseInt(match[1], 10);
        } else if (couponCode.influencerId) {
          // Use couponCode's influencerId (for old system compatibility)
          attributedInfluencerId = couponCode.influencerId;
        } else {
          responseStatus = 400;
          responseBody = { success: false, message: 'Coupon requires referral code for attribution' };
          throw new BadRequestException('Coupon requires referral code for attribution');
        }
      }

      // 6. Calculate cashback
      const { cashbackAmount, tierId } = await this.calculateCashbackAmount(
        webhookDto.orderAmount,
        attributedInfluencerId,
        hypeStore.id,
      );

      // 7. Create order in transaction
      const transaction: Transaction = await this.sequelize.transaction();

      try {
        // Calculate return period end date (use webhook value or default to 30 days)
        const orderDate = new Date(webhookDto.orderDate);
        const returnPeriodDays = webhookDto.returnPeriodDays || 30;
        const returnPeriodEndsAt = new Date(orderDate);
        returnPeriodEndsAt.setDate(returnPeriodEndsAt.getDate() + returnPeriodDays);

        const order = await this.orderModel.create(
          {
            hypeStoreId: hypeStore.id,
            couponCodeId: couponCode.id,
            influencerId: attributedInfluencerId, // Use attributed influencer (from referral or coupon)
            externalOrderId: webhookDto.externalOrderId,
            referralCode: webhookDto.referralCode || null, // Store referral code if provided
            orderTitle: webhookDto.orderTitle || null, // Store product/order title
            orderAmount: webhookDto.orderAmount,
            orderCurrency: webhookDto.orderCurrency || 'INR',
            orderDate: orderDate,
            customerEmail: webhookDto.customerEmail,
            customerPhone: webhookDto.customerPhone,
            customerName: webhookDto.customerName,
            orderStatus: webhookDto.orderStatus || OrderStatus.PENDING,
            cashbackAmount,
            cashbackType: webhookDto.cashbackType || null, // Store cashback type description
            cashbackStatus: CashbackStatus.PENDING,
            cashbackTierId: tierId,
            webhookReceivedAt: new Date(),
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

        // Update referral code stats if referral code was used
        if (webhookDto.referralCode) {
          await this.referralCodeModel.increment(
            {
              totalOrders: 1,
              totalRevenue: webhookDto.orderAmount,
            },
            {
              where: { referralCode: webhookDto.referralCode },
              transaction,
            },
          );
          await this.referralCodeModel.update(
            { lastUsedAt: new Date() },
            {
              where: { referralCode: webhookDto.referralCode },
              transaction,
            },
          );
        }

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
          headers: {},
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
          headers: {},
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

      // 2. Find existing order
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
          headers: {},
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

      // 3.5. Validate return window - CRITICAL BUSINESS RULE
      const now = new Date();
      const returnWindowEnds = order.returnPeriodEndsAt ||
        new Date(order.createdAt.getTime() + parseFloat(order.returnPeriodDays.toString()) * 24 * 60 * 60 * 1000);

      if (now > returnWindowEnds) {
        responseStatus = 400;
        responseBody = {
          success: false,
          message: 'Return window has closed. Returns are not allowed after the return period ends.',
          returnWindowEndsAt: returnWindowEnds.toISOString(),
          currentTime: now.toISOString(),
        };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/return',
          headers: {},
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          errorMessage: 'Return window has closed',
        });
        throw new BadRequestException('Return window has closed. Cashback has already been unlocked and credited to influencer.');
      }

      // Additional validation: Only allow returns for orders with locked or pending cashback
      if (order.cashbackStatus === CashbackStatus.CREDITED) {
        responseStatus = 400;
        responseBody = {
          success: false,
          message: 'Cannot process return. Cashback has already been credited to influencer.',
          cashbackStatus: order.cashbackStatus,
        };
        await this.logWebhookRequest({
          hypeStoreId: hypeStore.id,
          method: 'POST',
          path: '/webhooks/return',
          headers: {},
          body: webhookDto,
          ipAddress,
          status: responseStatus,
          responseBody,
          isValid: true,
          errorMessage: 'Cashback already credited',
        });
        throw new BadRequestException('Cannot process return. Cashback has already been credited to influencer.');
      }

      // 4. Update order status and reverse cashback if needed
      const transaction: Transaction = await this.sequelize.transaction();
      let cashbackReversed = false;

      try {
        // Update order status to returned/refunded
        await order.update(
          {
            orderStatus: OrderStatus.RETURNED,
            cashbackStatus: CashbackStatus.CANCELLED,
            visibleToInfluencer: false, // Ensure order stays hidden from influencer
            notes: `Return processed on ${new Date(webhookDto.returnDate).toISOString()}. Reason: ${webhookDto.returnReason || 'Not specified'}`,
          },
          { transaction },
        );

        const cashbackAmount = parseFloat(order.cashbackAmount.toString());

        // Prepare brand wallet credit (refund)
        const brandWallet = await this.walletModel.findOne({
          where: { userId: hypeStore.brandId, userType: UserType.BRAND },
          transaction,
        });

        // Handle cashback reversal based on current status
        // Note: CREDITED status should be prevented by validation above, but kept as defensive code
        // TypeScript doesn't know about potential race conditions, so we use type assertion here
        if (
          (order.cashbackStatus as any) === CashbackStatus.CREDITED &&
          order.walletTransactionId
        ) {
          // This should never happen due to validation above
          this.logger.error(
            `⚠️ CRITICAL: Return processed for order ${order.id} with CREDITED cashback. This should have been blocked by validation!`,
          );

          const influencerWallet = await this.walletModel.findOne({
            where: {
              userId: order.influencerId,
              userType: UserType.INFLUENCER,
            },
            transaction,
          });

          if (influencerWallet) {
            const previousBalance = parseFloat(influencerWallet.balance.toString());
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
                hypeStoreId: hypeStore.id,
                hypeStoreOrderId: order.id,
              } as any,
              { transaction },
            );

            cashbackReversed = true;
          }
        } else if (
          order.cashbackStatus === CashbackStatus.PROCESSING &&
          order.lockedCashbackTransactionId
        ) {
          // Cashback still locked: release lock and remove from influencer locked amount
          const influencerWallet = await this.walletModel.findOne({
            where: {
              userId: order.influencerId,
              userType: UserType.INFLUENCER,
            },
            transaction,
          });

          const lockedTx = await this.walletTransactionModel.findByPk(
            order.lockedCashbackTransactionId,
            { transaction },
          );

          if (influencerWallet && lockedTx) {
            const newLockedAmount =
              parseFloat(influencerWallet.lockedAmount.toString()) - cashbackAmount;

            await influencerWallet.update(
              {
                lockedAmount: newLockedAmount < 0 ? 0 : newLockedAmount,
                totalCashbackReceived:
                  parseFloat(influencerWallet.totalCashbackReceived.toString()) - cashbackAmount,
              },
              { transaction },
            );

            await lockedTx.update(
              {
                status: TransactionStatus.CANCELLED,
                isLocked: false,
                notes: `Return processed before unlock for order ${order.externalOrderId}`,
              },
              { transaction },
            );

            cashbackReversed = true;
          }
        }

        // Credit the brand wallet back if available
        if (brandWallet) {
          const brandBalance = parseFloat(brandWallet.balance.toString());
          await this.walletTransactionModel.create(
            {
              walletId: brandWallet.id,
              transactionType: TransactionType.REFUND,
              amount: cashbackAmount,
              balanceBefore: brandBalance,
              balanceAfter: brandBalance + cashbackAmount,
              status: TransactionStatus.COMPLETED,
              description: `Cashback returned for order ${order.externalOrderId}`,
              hypeStoreId: hypeStore.id,
              hypeStoreOrderId: order.id,
            } as any,
            { transaction },
          );

          await brandWallet.update(
            {
              balance: brandBalance + cashbackAmount,
              totalCredited: parseFloat(brandWallet.totalCredited.toString()) + cashbackAmount,
            },
            { transaction },
          );
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
          headers: {},
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
          headers: {},
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
