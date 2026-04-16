import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { HypeStore } from '../../wallet/models/hype-store.model';
import { HypeStoreCashbackConfig } from '../../hype-store/models/hype-store-cashback-config.model';
import { HypeStoreCouponCode } from '../../wallet/models/hype-store-coupon-code.model';
import { HypeStoreOrder, OrderStatus, CashbackStatus } from '../../wallet/models/hype-store-order.model';
import { HypeStoreReferralCode } from '../../wallet/models/hype-store-referral-code.model';
import { Wallet, UserType } from '../../wallet/models/wallet.model';
import { WalletTransaction, TransactionType, TransactionStatus } from '../../wallet/models/wallet-transaction.model';
import { Brand } from '../../brand/model/brand.model';
import { BrandNiche } from '../../brand/model/brand-niche.model';
import { SubmitProofDto } from '../dto/hype-store-order.dto';
import { Niche } from '../../auth/model/niche.model';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramProfileAnalysis } from '../../shared/models/instagram-profile-analysis.model';
import { InstagramService } from '../../shared/services/instagram.service';
import axios from 'axios';

@Injectable()
export class InfluencerHypeStoreService {
  private readonly logger = new Logger(InfluencerHypeStoreService.name);

  constructor(
    @InjectModel(HypeStore)
    private hypeStoreModel: typeof HypeStore,
    @InjectModel(HypeStoreCashbackConfig)
    private cashbackConfigModel: typeof HypeStoreCashbackConfig,
    @InjectModel(HypeStoreCouponCode)
    private couponCodeModel: typeof HypeStoreCouponCode,
    @InjectModel(HypeStoreOrder)
    private orderModel: typeof HypeStoreOrder,
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(WalletTransaction)
    private walletTransactionModel: typeof WalletTransaction,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(HypeStoreReferralCode)
    private referralCodeModel: typeof HypeStoreReferralCode,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(InstagramProfileAnalysis)
    private instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    private instagramService: InstagramService,
    private sequelize: Sequelize,
  ) {}

  /**
   * Get all available Hype Stores for influencers
   */
  async getAllStores(
    influencerId: number,
    page: number = 1,
    limit: number = 20,
    search?: string,
    sortBy?: string,
    niche?: string,
  ) {
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause: any = {
      isActive: true,
    };
    const cashbackWhere: any = {};

    // If search provided, search in store name or brand name
    let brandWhere: any = {};
    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause.storeName = {
        [Op.iLike]: `%${searchTerm}%`,
      };
      brandWhere = {
        [Op.or]: [
          { brandName: { [Op.iLike]: `%${searchTerm}%` } },
          { username: { [Op.iLike]: `%${searchTerm}%` } },
        ],
      };
    }

    // Niche filter only if provided
    const nicheFilter = niche && niche.trim() ? niche.trim() : undefined;

    // Pre-filter brandIds by niche to avoid complex includes that break validation
    if (nicheFilter) {
      const nicheRecord = await Niche.findOne({
        where: { name: { [Op.iLike]: nicheFilter } },
        include: [
          {
            model: Brand,
            as: 'brands',
            attributes: ['id'],
            through: { attributes: [] },
          },
        ],
      });

      const brandIds =
        nicheRecord && (nicheRecord as any).brands
          ? ((nicheRecord as any).brands as Brand[]).map((b) => b.id)
          : [];

      if (brandIds.length === 0) {
        return {
          success: true,
          data: {
            stores: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
          },
          message: 'Hype stores retrieved successfully',
        };
      }

      whereClause.brandId = { [Op.in]: brandIds };
    }

    // Get all stores with brand and cashback config
    const { rows: stores, count: total } = await this.hypeStoreModel.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: this.brandModel,
          as: 'brand',
          attributes: ['id', 'brandName', 'username', 'profileImage', 'profileBanner'],
          where: search && search.trim() ? brandWhere : undefined,
          required: false,
        },
        {
          model: this.cashbackConfigModel,
          as: 'cashbackConfig',
          attributes: [
            'id',
            'reelPostMinCashback',
            'reelPostMaxCashback',
            'storyMinCashback',
            'storyMaxCashback',
            'monthlyClaimCount',
            'claimStrategy',
          ],
          where: Object.keys(cashbackWhere).length ? cashbackWhere : undefined,
        },
      ] as any,
      limit,
      offset,
      order:
        sortBy === 'cashback_asc'
          ? [[{ model: this.cashbackConfigModel, as: 'cashbackConfig' }, 'reelPostMaxCashback', 'ASC']]
          : sortBy === 'cashback_desc'
            ? [[{ model: this.cashbackConfigModel, as: 'cashbackConfig' }, 'reelPostMaxCashback', 'DESC']]
            : [['createdAt', 'DESC']],
    });

    // Enrich with influencer-specific data
    const enrichedStores = await Promise.all(
      stores.map(async (store) => {
        // Get influencer's stats for this store
        const orders = await this.orderModel.findAll({
          where: {
            hypeStoreId: store.id,
            influencerId,
          },
          attributes: ['cashbackAmount', 'cashbackStatus'],
        });

        const totalOrders = orders.length;
        const totalCashbackEarned = orders.reduce(
          (sum, order) => sum + parseFloat(order.cashbackAmount.toString()),
          0,
        );

        // Check if this store has an active coupon code
        // This can be either:
        // 1. Brand-shared coupon (isBrandShared: true, influencerId: null)
        // 2. Influencer-specific coupon (influencerId: X, isUniversal: false)
        const storeCoupon = await this.couponCodeModel.findOne({
          where: {
            hypeStoreId: store.id,
            isActive: true,
            [Op.or]: [
              { isBrandShared: true },  // Brand-shared coupon
              { influencerId },          // Influencer-specific coupon
            ],
          },
        });

        return {
          id: store.id,
          storeName: store.storeName,
          storeDescription: store.storeDescription,
          bannerImageUrl: store.storeBanner,
          logoUrl: store.storeLogo,
          brand: store.brand,
          cashbackConfig: store.cashbackConfig,
          hasCoupon: !!storeCoupon, // Store has either brand-shared or influencer-specific coupon
          totalOrders,
          totalCashbackEarned,
          createdAt: store.createdAt,
        };
      }),
    );

    return {
      success: true,
      data: {
        stores: enrichedStores,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Hype stores retrieved successfully',
    };
  }

  /**
   * Get specific store details with influencer data
   */
  async getStoreDetails(influencerId: number, storeId: number) {
    const store = await this.hypeStoreModel.findOne({
      where: {
        id: storeId,
        isActive: true,
      },
      attributes: [
        'id',
        'brandId',
        'storeName',
        'storeDescription',
        'storeLogo',
        'storeBanner',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: this.brandModel,
          as: 'brand',
          attributes: [
            'id',
            'brandName',
            'username',
            'brandBio',
            'profileImage',
            'profileBanner',
            'websiteUrl',
          ],
        },
        {
          model: this.cashbackConfigModel,
          as: 'cashbackConfig',
          attributes: [
            'id',
            'reelPostMinCashback',
            'reelPostMaxCashback',
            'storyMinCashback',
            'storyMaxCashback',
            'monthlyClaimCount',
            'claimStrategy',
          ],
        },
      ],
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found or inactive');
    }

    // Compute influencer's universal coupon on-the-fly (no DB storage needed)
    // Format: INFL{influencerId} - works across all stores
    const universalCouponCode = `INFL${influencerId}`;

    // Get brand's shared coupon code for this store
    const brandCoupon = await this.couponCodeModel.findOne({
      where: {
        hypeStoreId: storeId,
        isBrandShared: true,
        isActive: true,
      },
    });

    // Get influencer's stats for this store
    const orders = await this.orderModel.findAll({
      where: {
        hypeStoreId: storeId,
        influencerId,
      },
    });

    const totalOrders = orders.length;
    const totalOrderValue = orders.reduce(
      (sum, order) => sum + parseFloat(order.orderAmount.toString()),
      0,
    );
    const totalCashbackEarned = orders.reduce(
      (sum, order) => sum + parseFloat(order.cashbackAmount.toString()),
      0,
    );
    const pendingCashback = orders
      .filter((order) => order.cashbackStatus === CashbackStatus.PENDING || order.cashbackStatus === CashbackStatus.PROCESSING)
      .reduce((sum, order) => sum + parseFloat(order.cashbackAmount.toString()), 0);
    const creditedCashback = orders
      .filter((order) => order.cashbackStatus === CashbackStatus.CREDITED)
      .reduce((sum, order) => sum + parseFloat(order.cashbackAmount.toString()), 0);

    return {
      success: true,
      data: {
        id: store.id,
        storeName: store.storeName,
        storeDescription: store.storeDescription,
        bannerImageUrl: store.storeBanner,
        logoUrl: store.storeLogo,
        isActive: store.isActive,
        brand: store.brand,
        cashbackConfig: store.cashbackConfig,
        // Brand's shared coupon code (what customers use at checkout)
        brandCouponCode: brandCoupon?.couponCode || null,
        // Influencer's referral code (for attribution)
        myReferralCode: universalCouponCode,
        myStats: {
          totalOrders,
          totalOrderValue,
          totalCashbackEarned,
          pendingCashback,
          creditedCashback,
        },
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      },
      message: 'Store details retrieved successfully',
    };
  }

  /**
   * Get or create universal coupon for influencer (works across all stores)
   * This is the new optimized approach - ONE coupon per influencer
   */
  async getOrCreateUniversalCoupon(influencerId: number) {
    // Check if universal coupon already exists
    const existingCoupon = await this.couponCodeModel.findOne({
      where: {
        influencerId,
        isUniversal: true,
        isActive: true,
      },
    });

    if (existingCoupon) {
      return {
        success: true,
        data: existingCoupon,
        message: 'Your universal coupon',
      };
    }

    // Generate unique universal coupon code
    // Format: INFL{influencerId}
    let couponCode = `INFL${influencerId}`;

    // Ensure uniqueness - add random suffix if needed
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.couponCodeModel.findOne({
        where: { couponCode },
      });

      if (!existing) {
        break;
      }

      // Add random 4-digit suffix
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      couponCode = `INFL${influencerId}${randomSuffix}`;
      attempts++;
    }

    if (attempts >= 10) {
      throw new BadRequestException('Failed to generate unique coupon code');
    }

    // Create universal coupon
    const newCoupon = await this.couponCodeModel.create({
      hypeStoreId: null, // NULL = universal
      influencerId,
      couponCode,
      isActive: true,
      isUniversal: true,
      totalUses: 0,
      maxUses: null,
      validFrom: null,
      validUntil: null,
    } as any);

    return {
      success: true,
      data: newCoupon,
      message: 'Universal coupon generated successfully',
    };
  }

  /**
   * @deprecated Use getOrCreateUniversalCoupon instead
   * Legacy method for generating store-specific coupons
   */
  /**
   * Get all orders for influencer with filters
   */
  async getMyOrders(
    influencerId: number,
    page: number = 1,
    limit: number = 20,
    storeId?: number,
    cashbackStatus?: string,
  ) {
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      influencerId,
      visibleToInfluencer: true, // Only show orders after 30-day return period
    };

    if (storeId) {
      whereClause.hypeStoreId = storeId;
    }

    if (cashbackStatus) {
      whereClause.cashbackStatus = cashbackStatus;
    }

    // Get orders
    const { rows: orders, count: total } = await this.orderModel.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          attributes: ['id', 'storeName', 'storeLogo'],
          include: [
            {
              model: this.brandModel,
              as: 'brand',
              attributes: ['id', 'brandName', 'profileImage'],
            },
          ],
        },
        {
          model: this.couponCodeModel,
          as: 'couponCode',
          attributes: ['id', 'couponCode'],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Calculate summary stats (only visible orders)
    const allOrders = await this.orderModel.findAll({
      where: {
        influencerId,
        visibleToInfluencer: true // Only count visible orders
      },
    });

    const totalOrders = allOrders.length;
    const totalOrderValue = allOrders.reduce(
      (sum, order) => sum + parseFloat(order.orderAmount.toString()),
      0,
    );
    const totalCashbackEarned = allOrders.reduce(
      (sum, order) => sum + parseFloat(order.cashbackAmount.toString()),
      0,
    );
    const pendingCashback = allOrders
      .filter(
        (order) =>
          order.cashbackStatus === CashbackStatus.PENDING ||
          order.cashbackStatus === CashbackStatus.PROCESSING,
      )
      .reduce((sum, order) => sum + parseFloat(order.cashbackAmount.toString()), 0);
    const creditedCashback = allOrders
      .filter((order) => order.cashbackStatus === CashbackStatus.CREDITED)
      .reduce((sum, order) => sum + parseFloat(order.cashbackAmount.toString()), 0);

    return {
      success: true,
      data: {
        orders,
        summary: {
          totalOrders,
          totalOrderValue,
          totalCashbackEarned,
          pendingCashback,
          creditedCashback,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Orders retrieved successfully',
    };
  }

  /**
   * Get detailed information for a specific order (influencer view)
   */
  async getInfluencerOrderDetails(influencerId: number, orderId: number) {
    // Find order with all related data
    const order = await this.orderModel.findOne({
      where: { id: orderId },
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          attributes: ['id', 'storeName', 'storeLogo', 'storeBanner'],
          include: [
            {
              model: this.brandModel,
              as: 'brand',
              attributes: ['id', 'brandName', 'username', 'profileImage'],
              include: [
                {
                  model: Niche,
                  as: 'niches',
                  attributes: ['id', 'name'],
                  through: { attributes: [] },
                },
              ],
            },
          ],
        },
        {
          model: this.couponCodeModel,
          as: 'couponCode',
          attributes: ['id', 'couponCode', 'isUniversal', 'isBrandShared'],
        },
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify this order belongs to the influencer
    if (order.influencerId !== influencerId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    // Calculate tier labels for performance metrics
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

    // Format the response
    return {
      success: true,
      data: {
        id: order.id,
        externalOrderId: order.externalOrderId,
        orderTitle: order.orderTitle || null,
        orderAmount: parseFloat(order.orderAmount.toString()),
        orderCurrency: order.orderCurrency,
        orderDate: order.orderDate,
        orderStatus: order.orderStatus,
        cashbackAmount: parseFloat(order.cashbackAmount.toString()),
        cashbackType: order.cashbackType || null,
        cashbackStatus: order.cashbackStatus,
        cashbackCreditedAt: order.cashbackCreditedAt || null,
        minimumCashbackClaimed: order.minimumCashbackClaimed || false,
        isReturned: order.isReturned || false,
        returnedAt: order.returnedAt || null,
        returnPeriodDays: order.returnPeriodDays || 30,
        returnWindowClosesAt: order.returnPeriodEndsAt || null,
        instagramProof: {
          url: order.instagramProofUrl || null,
          contentType: order.proofContentType || null,
          thumbnailUrl: order.proofThumbnailUrl || null,
          viewCount: order.proofViewCount || null,
          postedAt: order.proofPostedAt || null,
          submittedAt: order.proofSubmittedAt || null,
        },
        performance: {
          expectedROI: order.expectedRoi || null,
          estimatedEngagement: order.estimatedEngagement || null,
          estimatedReach: order.estimatedReach || null,
          tierLabels: {
            expectedROI: getTierLabel(order.expectedRoi || null, 'roi'),
            estimatedEngagement: getTierLabel(order.estimatedEngagement || null, 'engagement'),
            estimatedReach: getTierLabel(order.estimatedReach || null, 'reach'),
          },
        },
        customer: {
          name: order.customerName || null,
          email: order.customerEmail || null,
          phone: order.customerPhone || null,
        },
        couponCode: order.couponCode
          ? {
              id: order.couponCode.id,
              couponCode: order.couponCode.couponCode,
              isUniversal: order.couponCode.isUniversal,
              isBrandShared: order.couponCode.isBrandShared,
            }
          : null,
        hypeStore: order.hypeStore
          ? {
              id: order.hypeStore.id,
              storeName: order.hypeStore.storeName,
              logoUrl: order.hypeStore.storeLogo || null,
              bannerImageUrl: order.hypeStore.storeBanner || null,
              brand: order.hypeStore.brand
                ? {
                    id: order.hypeStore.brand.id,
                    brandName: order.hypeStore.brand.brandName,
                    username: order.hypeStore.brand.username,
                    profileImage: order.hypeStore.brand.profileImage || null,
                    niches: (order.hypeStore.brand as any).niches?.map((niche: any) => ({
                      id: niche.id,
                      name: niche.name,
                    })) || [],
                  }
                : null,
            }
          : null,
        metadata: order.metadata || null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      message: 'Order details retrieved successfully',
    };
  }

  /**
   * Get influencer wallet
   */
  async getWallet(influencerId: number) {
    let wallet = await this.walletModel.findOne({
      where: {
        userId: influencerId,
        userType: UserType.INFLUENCER,
      },
    });

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await this.walletModel.create({
        userId: influencerId,
        userType: UserType.INFLUENCER,
        balance: 0,
        lockedAmount: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    const availableBalance = parseFloat(wallet.balance.toString());
    const lockedAmount = parseFloat(wallet.lockedAmount.toString());
    const totalAmount = availableBalance + lockedAmount;

    return {
      success: true,
      data: {
        ...wallet.toJSON(),
        availableBalance,
        lockedAmount,
        totalAmount,
        breakdown: {
          available: {
            amount: availableBalance,
            description: 'Amount available for redemption',
          },
          locked: {
            amount: lockedAmount,
            description: 'Amount locked during return window, will be available after return period closes',
          },
        },
      },
      message: 'Wallet balance retrieved successfully',
    };
  }

  /**
   * Get wallet with locked transaction details
   */
  async getWalletWithDetails(influencerId: number) {
    let wallet = await this.walletModel.findOne({
      where: {
        userId: influencerId,
        userType: UserType.INFLUENCER,
      },
      include: [
        {
          model: this.walletTransactionModel,
          as: 'transactions',
          where: { isLocked: true },
          required: false,
          attributes: ['id', 'amount', 'lockExpiresAt', 'hypeStoreOrderId', 'description'],
        },
      ],
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        userId: influencerId,
        userType: UserType.INFLUENCER,
        balance: 0,
        lockedAmount: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    const availableBalance = parseFloat(wallet.balance.toString());
    const lockedAmount = parseFloat(wallet.lockedAmount.toString());
    const totalAmount = availableBalance + lockedAmount;

    const lockedTransactions = (wallet.transactions || []).map((tx) => ({
      id: tx.id,
      amount: parseFloat(tx.amount.toString()),
      lockExpiresAt: tx.lockExpiresAt,
      orderId: tx.hypeStoreOrderId,
      description: tx.description,
      daysRemaining: tx.lockExpiresAt
        ? Math.ceil(
            (new Date(tx.lockExpiresAt).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null,
    }));

    return {
      success: true,
      data: {
        wallet,
        balance: {
          available: availableBalance,
          locked: lockedAmount,
          total: totalAmount,
        },
        lockedTransactions,
        message:
          lockedTransactions.length > 0
            ? `You have ₹${lockedAmount.toFixed(2)} locked across ${lockedTransactions.length} order(s)`
            : 'No locked cashback currently',
      },
    };
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(
    influencerId: number,
    page: number = 1,
    limit: number = 20,
    type?: string,
  ) {
    // Get or create wallet
    let wallet = await this.walletModel.findOne({
      where: {
        userId: influencerId,
        userType: UserType.INFLUENCER,
      },
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        userId: influencerId,
        userType: UserType.INFLUENCER,
        balance: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      walletId: wallet.id,
    };

    if (type) {
      whereClause.transactionType = type;
    }

    // Get transactions
    const { rows: transactions, count: total } = await this.walletTransactionModel.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      message: 'Transactions retrieved successfully',
    };
  }

  /**
   * Extract media shortcode from Instagram URL
   * Examples:
   * - https://www.instagram.com/reel/ABC123xyz/ -> ABC123xyz
   * - https://www.instagram.com/p/ABC123xyz/ -> ABC123xyz
   */
  private extractInstagramShortcode(url: string): string | null {
    try {
      const patterns = [
        /instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/,
        /instagr\.am\/p\/([A-Za-z0-9_-]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch Instagram media details using oembed API (doesn't require access token)
   * This gets basic info like media ID, thumbnail, and type
   */
  private async fetchInstagramMediaDetails(url: string): Promise<{
    mediaId?: string;
    thumbnailUrl?: string;
    authorName?: string;
    mediaType?: string;
  }> {
    try {
      // Use Instagram's oEmbed API (public, no auth required)
      const response = await axios.get('https://graph.instagram.com/oembed', {
        params: { url },
      });

      return {
        thumbnailUrl: response.data.thumbnail_url,
        authorName: response.data.author_name,
        mediaType: response.data.type, // "rich" for posts/reels
      };
    } catch (error) {
      console.warn('Failed to fetch Instagram oembed data:', error.message);
      return {};
    }
  }

  /**
   * Fetch Instagram media insights (view count, reach, etc.) using Graph API
   * Requires user's Instagram access token
   */
  private async fetchInstagramMediaInsights(
    influencer: Influencer,
    shortcode: string,
  ): Promise<{
    viewCount?: number;
    reach?: number;
    timestamp?: string;
  }> {
    try {
      if (!influencer.instagramAccessToken || !influencer.instagramUserId) {
        return {};
      }

      // First, get media ID from shortcode using business discovery
      const mediaResponse = await axios.get(
        `https://graph.instagram.com/v24.0/${influencer.instagramUserId}/media`,
        {
          params: {
            fields: 'id,media_type,media_product_type,timestamp,shortcode',
            access_token: influencer.instagramAccessToken,
            limit: 100, // Check recent 100 posts
          },
        },
      );

      // Find the media matching this shortcode
      let mediaId: string | undefined = undefined;
      let timestamp: string | undefined = undefined;
      let mediaProductType: string | undefined = undefined;
      let mediaType: string | undefined = undefined;

      for (const media of mediaResponse.data.data || []) {
        // Direct shortcode match if available in API response
        if (media.shortcode === shortcode) {
          mediaId = media.id;
          timestamp = media.timestamp;
          mediaProductType = media.media_product_type;
          mediaType = media.media_type;
          break;
        }

        // Fallback: check permalink if shortcode not in response
        try {
          const mediaDetailResponse = await axios.get(
            `https://graph.instagram.com/v24.0/${media.id}`,
            {
              params: {
                fields: 'id,permalink,timestamp,shortcode,media_type,media_product_type',
                access_token: influencer.instagramAccessToken,
              },
            },
          );

          if (mediaDetailResponse.data.shortcode === shortcode ||
              mediaDetailResponse.data.permalink?.includes(shortcode)) {
            mediaId = media.id;
            timestamp = mediaDetailResponse.data.timestamp;
            mediaProductType = mediaDetailResponse.data.media_product_type;
            mediaType = mediaDetailResponse.data.media_type;
            break;
          }
        } catch (err) {
          continue; // Skip this media if we can't fetch details
        }
      }

      if (!mediaId) {
        return { timestamp };
      }

      // Choose appropriate metrics based on media type
      let metrics: string;
      if (mediaProductType === 'REELS' || mediaProductType === 'CLIPS') {
        // For REELS: use 'views' metric (not 'ig_reels_aggregated_all_plays_count')
        // Also fetch engagement metrics
        metrics = 'views,reach,likes,comments,shares,saved,total_interactions';
      } else if (mediaType === 'VIDEO') {
        // For regular videos
        metrics = 'reach,likes,comments,shares,saved';
      } else if (mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM') {
        // For images and carousels
        metrics = 'reach,likes,comments,shares,saved';
      } else {
        // Fallback
        metrics = 'reach';
      }

      // Fetch insights for this media
      let insightsResponse: any;
      try {
        insightsResponse = await axios.get(
          `https://graph.instagram.com/v24.0/${mediaId}/insights`,
          {
            params: {
              metric: metrics,
              access_token: influencer.instagramAccessToken,
            },
          },
        );
      } catch (insightError: any) {
        // If specific metrics fail (e.g., for REELS), try with basic metrics
        console.warn(`Failed to fetch insights with metrics ${metrics}, retrying with basic metrics...`);
        insightsResponse = await axios.get(
          `https://graph.instagram.com/v24.0/${mediaId}/insights`,
          {
            params: {
              metric: 'reach',
              access_token: influencer.instagramAccessToken,
            },
          },
        );
      }

      const insights = insightsResponse.data.data || [];

      // Extract view count - for REELS it's 'views', for old videos it might be other metrics
      const viewCountMetric = insights.find(
        (m: any) => m.name === 'views' || m.name === 'ig_reels_aggregated_all_plays_count',
      );
      const reachMetric = insights.find((m: any) => m.name === 'reach');

      return {
        viewCount: viewCountMetric?.values?.[0]?.value,
        reach: reachMetric?.values?.[0]?.value,
        timestamp,
      };
    } catch (error) {
      console.warn('Failed to fetch Instagram insights:', error.message);
      return {};
    }
  }

  /**
   * Submit Instagram proof (Reel/Post/Story) for cashback
   * Creates a LOCKED cashback transaction that will be unlocked when return window closes
   */
  async submitProof(
    influencerId: number,
    orderId: number,
    submitProofDto: SubmitProofDto,
  ) {
    // Validate that either mediaId or instagramUrl is provided (not both)
    if (!submitProofDto.mediaId && !submitProofDto.instagramUrl) {
      throw new BadRequestException('Either mediaId or instagramUrl must be provided');
    }
    if (submitProofDto.mediaId && submitProofDto.instagramUrl) {
      throw new BadRequestException('Provide either mediaId OR instagramUrl, not both');
    }

    // Get order with associations
    const order = await this.orderModel.findOne({
      where: { id: orderId },
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          required: true, // Ensure the association is loaded
          include: [
            {
              model: this.brandModel,
              as: 'brand',
              required: true, // Ensure brand is loaded
              attributes: ['id', 'brandName'],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Ensure associations are loaded
    if (!order.hypeStore) {
      throw new Error('HypeStore association not loaded for order');
    }

    if (!order.hypeStore.brand) {
      throw new Error('Brand association not loaded for hype store');
    }

    // Verify order belongs to this influencer
    if (order.influencerId !== influencerId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    // Check if cashback is still pending
    if (order.cashbackStatus !== CashbackStatus.PENDING) {
      throw new BadRequestException(
        `Cannot submit proof. Cashback status is already "${order.cashbackStatus}"`,
      );
    }

    // Check if proof already submitted
    if (order.instagramProofUrl) {
      throw new BadRequestException('Proof has already been submitted for this order');
    }

    // Fetch influencer details (for Instagram access token)
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // If mediaId is provided, fetch full media details from Instagram
    let instagramUrl = submitProofDto.instagramUrl;
    let mediaTimestamp: Date | null = null;
    let mediaUrl: string | null = null;
    let mediaThumbnail: string | null = null;

    if (submitProofDto.mediaId) {
      try {
        this.logger.log(`[submitProof order=${orderId}] Fetching Instagram media details for mediaId=${submitProofDto.mediaId}`);

        if (!influencer.instagramAccessToken) {
          throw new BadRequestException('Instagram account not connected. Cannot fetch media details.');
        }

        // Fetch media details from Instagram API
        const fields = 'id,permalink,timestamp,media_url,thumbnail_url';
        this.logger.log(`[submitProof order=${orderId}] Calling Instagram API with fields=${fields}`);

        const response = await axios.get(
          `https://graph.instagram.com/v24.0/${submitProofDto.mediaId}`,
          {
            params: {
              fields,
              access_token: influencer.instagramAccessToken,
            },
            timeout: 10000, // 10 second timeout
          }
        );

        const mediaData = response.data;
        this.logger.log(`[submitProof order=${orderId}] Instagram API response received: ${JSON.stringify(mediaData)}`);

        instagramUrl = mediaData.permalink; // Use Instagram permalink as the proof URL
        mediaTimestamp = mediaData.timestamp ? new Date(mediaData.timestamp) : null;
        mediaUrl = mediaData.media_url;
        mediaThumbnail = mediaData.thumbnail_url || mediaData.media_url;

      } catch (error) {
        this.logger.error(`[submitProof order=${orderId}] Instagram API call failed:`, error);
        if (axios.isAxiosError(error)) {
          const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to fetch Instagram media details';
          const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : '';
          this.logger.error(`[submitProof order=${orderId}] Instagram API error details: ${errorDetail}`);
          throw new BadRequestException(`Instagram API error: ${errorMsg}`);
        }
        throw new BadRequestException('Failed to fetch Instagram media details');
      }
    }

    // Use cached profile analysis data (same as profile scoring system)
    // If mediaId was provided and we fetched details, use those; otherwise use null
    let thumbnailUrl: string | null = mediaThumbnail;
    let viewCount: number | null = null;
    let postedAt: Date | null = mediaTimestamp;
    let estimatedReach: number | null = null;
    let estimatedEngagement: number | null = null;
    let expectedRoi: number | null = null;

    const profileAnalysis = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId },
      order: [['analyzed_at', 'DESC']],
    });

    if (profileAnalysis) {
      // Use cached average metrics from profile analysis
      if (profileAnalysis.avgReach) {
        estimatedReach = profileAnalysis.avgReach;
      }

      // Calculate engagement from avg engagement rate and followers
      const avgEngagementRate = parseFloat(profileAnalysis.avgEngagementRate?.toString() || '0');
      const totalFollowers = profileAnalysis.totalFollowers || influencer.instagramFollowersCount || 0;
      if (avgEngagementRate > 0 && totalFollowers > 0) {
        estimatedEngagement = Math.round((totalFollowers * avgEngagementRate) / 100);
      }
    }

    // Fallback: estimate from follower count if no cached data
    const followerCount = influencer.instagramFollowersCount || 0;
    if (!estimatedReach && followerCount > 0) {
      estimatedReach = Math.round(followerCount * 0.25); // 25% of followers
    }
    if (!estimatedEngagement && followerCount > 0) {
      estimatedEngagement = Math.round(followerCount * 0.035); // 3.5% of followers
    }

    // Calculate ROI based on reach
    if (estimatedReach && estimatedReach > 0) {
      const cashbackAmount = parseFloat(order.cashbackAmount.toString());
      const estimatedValue = (estimatedReach / 1000) * 50; // ₹50 CPM
      expectedRoi = ((estimatedValue - cashbackAmount) / cashbackAmount) * 100;
      expectedRoi = Math.round(expectedRoi * 10) / 10; // Round to 1 decimal
    }

    // Get or create influencer wallet
    let wallet = await this.walletModel.findOne({
      where: {
        userId: influencerId,
        userType: UserType.INFLUENCER,
      },
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        userId: influencerId,
        userType: UserType.INFLUENCER,
        balance: 0,
        lockedAmount: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    // Save proof details for admin review - NO wallet transactions yet
    try {
      this.logger.log(
        `[submitProof order=${orderId} influencer=${influencerId}] Saving proof for admin review`,
      );

      // Update order with proof details for admin review
      await order.update({
        instagramProofUrl: instagramUrl,
        proofContentType: submitProofDto.contentType,
        proofSubmittedAt: new Date(),
        proofThumbnailUrl: thumbnailUrl,
        proofViewCount: viewCount,
        proofPostedAt: postedAt,
        expectedRoi: expectedRoi,
        estimatedEngagement: estimatedEngagement,
        estimatedReach: estimatedReach,
        proofApprovalStatus: 'pending_review', // Admin needs to approve
        metadata: {
          ...(order.metadata || {}),
          mediaId: submitProofDto.mediaId || null,
          mediaUrl: mediaUrl || null,
        },
        notes: submitProofDto.notes
          ? `${order.notes ? order.notes + '\n' : ''}Proof submitted: ${submitProofDto.notes}`
          : order.notes,
      } as any);

      this.logger.log(
        `[submitProof order=${orderId} influencer=${influencerId}] Proof saved successfully, pending admin review`,
      );

      return {
        success: true,
        data: {
          id: order.id,
          externalOrderId: order.externalOrderId,
          orderAmount: parseFloat(order.orderAmount.toString()),
          cashbackAmount: parseFloat(order.cashbackAmount.toString()),
          cashbackStatus: order.cashbackStatus,
          proofApprovalStatus: 'pending_review',
          instagramProofUrl: order.instagramProofUrl,
          proofContentType: order.proofContentType,
          proofSubmittedAt: order.proofSubmittedAt,
          hypeStore: order.hypeStore
            ? {
                id: order.hypeStore.id,
                storeName: order.hypeStore.storeName,
                brand: order.hypeStore.brand,
              }
            : null,
        },
        message: `Proof submitted successfully and is pending admin review. Once approved, cashback of ₹${parseFloat(order.cashbackAmount.toString()).toFixed(2)} will be locked in your wallet.`,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[submitProof order=${orderId} influencer=${influencerId}] failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Admin approves submitted proof and locks cashback
   * This creates wallet transactions and locks the cashback
   */
  async approveProof(
    orderId: number,
    adminId: number,
  ): Promise<{ success: boolean; message: string; data: any }> {
    // Get order with all associations
    const order = await this.orderModel.findOne({
      where: { id: orderId },
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          required: true,
          include: [
            {
              model: this.brandModel,
              as: 'brand',
              required: true,
              attributes: ['id', 'brandName'],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate proof is submitted and pending review
    if (!order.instagramProofUrl) {
      throw new BadRequestException('No proof has been submitted for this order');
    }

    if (order.proofApprovalStatus !== 'pending_review') {
      throw new BadRequestException(
        `Proof is already ${order.proofApprovalStatus}. Only pending proofs can be approved.`,
      );
    }

    // Check brand wallet has sufficient balance
    const brandId = order.hypeStore?.brand?.id || order.hypeStore?.brandId;
    if (!brandId) {
      throw new NotFoundException('Brand not found for this store');
    }

    const brandWallet = await this.walletModel.findOne({
      where: { userId: brandId, userType: UserType.BRAND },
    });

    if (!brandWallet) {
      throw new NotFoundException('Brand wallet not found');
    }

    const cashbackAmount = parseFloat(order.cashbackAmount.toString());
    const brandBalance = parseFloat(brandWallet.balance.toString());

    if (brandBalance < cashbackAmount) {
      throw new BadRequestException(
        `Insufficient brand wallet balance. Required: ₹${cashbackAmount}, Available: ₹${brandBalance}`,
      );
    }

    // Get influencer wallet
    const wallet = await this.walletModel.findOne({
      where: {
        userId: order.influencerId,
        userType: UserType.INFLUENCER,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Influencer wallet not found');
    }

    // Create wallet transactions in a database transaction
    const transaction: Transaction = await this.sequelize.transaction();

    try {
      this.logger.log(
        `[approveProof order=${orderId} admin=${adminId}] Starting approval process`,
      );

      const previousLockedAmount = parseFloat(wallet.lockedAmount.toString());
      const newLockedAmount = previousLockedAmount + cashbackAmount;
      const returnPeriodEndsAt =
        order.returnPeriodEndsAt ||
        new Date(
          Date.now() +
            parseFloat(order.returnPeriodDays.toString()) * 24 * 60 * 60 * 1000,
        );

      // 1. Create locked cashback transaction for influencer
      const lockedTransaction = await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: cashbackAmount,
          balanceBefore: parseFloat(wallet.balance.toString()),
          balanceAfter: parseFloat(wallet.balance.toString()),
          status: TransactionStatus.COMPLETED,
          isLocked: true,
          lockExpiresAt: returnPeriodEndsAt,
          description: `Locked cashback for order ${order.externalOrderId} (Admin approved)`,
          hypeStoreId: order.hypeStoreId,
          hypeStoreOrderId: order.id,
          notes: `Cashback locked during return window. Will be unlocked on ${returnPeriodEndsAt.toISOString()}`,
        } as any,
        { transaction },
      );

      // 2. Update influencer wallet with locked amount
      await wallet.update(
        {
          lockedAmount: newLockedAmount,
          totalCashbackReceived:
            parseFloat(wallet.totalCashbackReceived.toString()) +
            cashbackAmount,
        },
        { transaction },
      );

      // 3. Create debit transaction for brand
      const brandDebitTx = await this.walletTransactionModel.create(
        {
          walletId: brandWallet.id,
          transactionType: TransactionType.DEBIT,
          amount: cashbackAmount,
          balanceBefore: brandBalance,
          balanceAfter: brandBalance - cashbackAmount,
          status: TransactionStatus.COMPLETED,
          description: `Cashback reserved for order ${order.externalOrderId} (Admin approved)`,
          hypeStoreId: order.hypeStoreId,
          hypeStoreOrderId: order.id,
        } as any,
        { transaction },
      );

      // 4. Update brand wallet
      await brandWallet.update(
        {
          balance: brandBalance - cashbackAmount,
          totalDebited:
            parseFloat(brandWallet.totalDebited.toString()) + cashbackAmount,
        },
        { transaction },
      );

      // 5. Update order with approval details
      await order.update(
        {
          proofApprovalStatus: 'approved',
          proofApprovedBy: adminId,
          proofApprovedAt: new Date(),
          cashbackStatus: CashbackStatus.PROCESSING,
          lockedCashbackTransactionId: lockedTransaction.id,
          metadata: {
            ...(order.metadata || {}),
            brandDebitTransactionId: brandDebitTx.id,
          },
        } as any,
        { transaction },
      );

      await transaction.commit();

      this.logger.log(
        `[approveProof order=${orderId} admin=${adminId}] Proof approved successfully. Cashback locked.`,
      );

      return {
        success: true,
        message: `Proof approved successfully. Cashback of ₹${cashbackAmount.toFixed(2)} has been locked and will be available after the return window closes.`,
        data: {
          orderId: order.id,
          externalOrderId: order.externalOrderId,
          cashbackAmount,
          proofApprovalStatus: 'approved',
          cashbackStatus: CashbackStatus.PROCESSING,
          returnPeriodEndsAt,
        },
      };
    } catch (error) {
      await transaction.rollback();
      const err = error as Error;
      this.logger.error(
        `[approveProof order=${orderId} admin=${adminId}] Failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  /**
   * Admin rejects submitted proof
   */
  async rejectProof(
    orderId: number,
    adminId: number,
    rejectionReason?: string,
  ): Promise<{ success: boolean; message: string; data: any }> {
    const order = await this.orderModel.findByPk(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.instagramProofUrl) {
      throw new BadRequestException('No proof has been submitted for this order');
    }

    if (order.proofApprovalStatus !== 'pending_review') {
      throw new BadRequestException(
        `Proof is already ${order.proofApprovalStatus}. Only pending proofs can be rejected.`,
      );
    }

    await order.update({
      proofApprovalStatus: 'rejected',
      proofApprovedBy: adminId,
      proofApprovedAt: new Date(),
      proofRejectionReason: rejectionReason,
    } as any);

    this.logger.log(
      `[rejectProof order=${orderId} admin=${adminId}] Proof rejected. Reason: ${rejectionReason}`,
    );

    return {
      success: true,
      message: 'Proof rejected successfully. Influencer can resubmit.',
      data: {
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        proofApprovalStatus: 'rejected',
        rejectionReason,
      },
    };
  }

  /**
   * Claim minimum cashback without posting content (7% or flat minimum)
   * Creates a LOCKED cashback transaction that will be unlocked when return window closes
   */
  async claimMinimumCashback(influencerId: number, orderId: number) {
    // Get order with associations
    const order = await this.orderModel.findOne({
      where: { id: orderId },
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          include: [
            {
              model: this.cashbackConfigModel,
              as: 'cashbackConfig',
              attributes: ['reelPostMinCashback', 'storyMinCashback'],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify order belongs to this influencer
    if (order.influencerId !== influencerId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    // Check if cashback is still pending
    if (order.cashbackStatus !== CashbackStatus.PENDING) {
      throw new BadRequestException(
        `Cannot claim cashback. Cashback status is already "${order.cashbackStatus}"`,
      );
    }

    // Check if minimum cashback already claimed
    if (order.minimumCashbackClaimed) {
      throw new BadRequestException('Minimum cashback has already been claimed for this order');
    }

    // Calculate minimum cashback amount
    // Use the minimum cashback from config (e.g., ₹100) or 7% of order amount, whichever is higher
    const cashbackConfig = order.hypeStore?.cashbackConfig;
    const minCashbackFromConfig = cashbackConfig
      ? Math.min(
          parseFloat(cashbackConfig.reelPostMinCashback.toString()),
          parseFloat(cashbackConfig.storyMinCashback.toString()),
        )
      : 100; // Default ₹100 if no config

    const sevenPercentCashback = parseFloat(order.orderAmount.toString()) * 0.07;
    const minimumCashbackAmount = Math.max(minCashbackFromConfig, sevenPercentCashback);

    // Get or create influencer wallet
    let wallet = await this.walletModel.findOne({
      where: {
        userId: influencerId,
        userType: UserType.INFLUENCER,
      },
    });

    if (!wallet) {
      wallet = await this.walletModel.create({
        userId: influencerId,
        userType: UserType.INFLUENCER,
        balance: 0,
        lockedAmount: 0,
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    // Credit locked cashback to wallet in transaction
    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const previousLockedAmount = parseFloat(wallet.lockedAmount.toString());
      const newLockedAmount = previousLockedAmount + minimumCashbackAmount;
      const returnPeriodEndsAt = order.returnPeriodEndsAt || 
        new Date(Date.now() + parseFloat(order.returnPeriodDays.toString()) * 24 * 60 * 60 * 1000);

      // Update wallet with locked amount
      await wallet.update(
        {
          lockedAmount: newLockedAmount,
          totalCashbackReceived:
            parseFloat(wallet.totalCashbackReceived.toString()) + minimumCashbackAmount,
        },
        { transaction },
      );

      // Create locked wallet transaction
      const walletTransaction = await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: minimumCashbackAmount,
          balanceBefore: parseFloat(wallet.balance.toString()),
          balanceAfter: parseFloat(wallet.balance.toString()), // Balance doesn't change, only locked amount
          status: TransactionStatus.COMPLETED,
          isLocked: true,
          lockExpiresAt: returnPeriodEndsAt,
          description: `Minimum locked cashback for order ${order.externalOrderId} (claimed without posting)`,
          hypeStoreId: order.hypeStoreId,
          hypeStoreOrderId: order.id,
          notes: `Minimum cashback (7% or ₹${minimumCashbackAmount.toFixed(2)}) locked during return window. Will be unlocked on ${returnPeriodEndsAt.toISOString()}`,
        } as any,
        { transaction },
      );

      // Update order
      await order.update(
        {
          cashbackAmount: minimumCashbackAmount, // Update to minimum amount
          cashbackStatus: CashbackStatus.CREDITED,
          cashbackCreditedAt: new Date(),
          minimumCashbackClaimed: true,
          lockedCashbackTransactionId: walletTransaction.id,
          notes: `${order.notes ? order.notes + '\n' : ''}Minimum locked cashback claimed without posting content (7% instant, locked during return window)`,
        },
        { transaction },
      );

      await transaction.commit();

      // Reload wallet to get updated values
      await wallet.reload();

      return {
        success: true,
        data: {
          order: {
            id: order.id,
            externalOrderId: order.externalOrderId,
            orderAmount: parseFloat(order.orderAmount.toString()),
            cashbackAmount: minimumCashbackAmount,
            cashbackStatus: order.cashbackStatus,
            cashbackCreditedAt: order.cashbackCreditedAt,
            minimumCashbackClaimed: order.minimumCashbackClaimed,
          },
          wallet: {
            balance: parseFloat(wallet.balance.toString()),
            lockedAmount: parseFloat(wallet.lockedAmount.toString()),
            totalCashbackReceived: parseFloat(wallet.totalCashbackReceived.toString()),
          },
          transaction: {
            id: walletTransaction.id,
            amount: minimumCashbackAmount,
            transactionType: walletTransaction.transactionType,
            isLocked: walletTransaction.isLocked,
            lockExpiresAt: walletTransaction.lockExpiresAt,
            description: walletTransaction.description,
            createdAt: walletTransaction.createdAt,
          },
        },
        message: `Minimum locked cashback of ₹${minimumCashbackAmount.toFixed(2)} has been added to your wallet. This amount will be available for redemption after the return window closes.`,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get or create a referral code for an influencer for a specific store
   * Used for brand-shared coupons with referral tracking
   */
  async getOrCreateReferralCode(influencerId: number, hypeStoreId: number) {
    // Check if store exists
    const store = await this.hypeStoreModel.findByPk(hypeStoreId, {
      include: [{ model: this.brandModel }],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    if (!store.isActive) {
      throw new BadRequestException('Store is not active');
    }

    // Check if referral code already exists for this influencer-store combination
    let referralCode = await this.referralCodeModel.findOne({
      where: {
        influencerId,
        hypeStoreId,
      },
    });

    if (referralCode) {
      return {
        success: true,
        data: {
          referralCode: referralCode.referralCode,
          hypeStoreId: store.id,
          storeName: store.storeName,
          brandName: store.brand?.brandName || '',
          totalClicks: referralCode.totalClicks,
          totalOrders: referralCode.totalOrders,
          totalRevenue: parseFloat(referralCode.totalRevenue.toString()),
          isActive: referralCode.isActive,
          createdAt: referralCode.createdAt,
        },
        message: 'Your referral code for this store',
      };
    }

    // Generate new referral code
    let newReferralCode = `INFL${influencerId}`;
    let attempts = 0;
    const maxAttempts = 10;

    // Check for uniqueness
    while (attempts < maxAttempts) {
      const exists = await this.referralCodeModel.findOne({
        where: { referralCode: newReferralCode },
      });

      if (!exists) {
        break;
      }

      // If collision, append random suffix
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      newReferralCode = `INFL${influencerId}${randomSuffix}`;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new BadRequestException('Unable to generate unique referral code');
    }

    // Create new referral code
    referralCode = await this.referralCodeModel.create({
      influencerId,
      hypeStoreId,
      referralCode: newReferralCode,
      isActive: true,
      totalClicks: 0,
      totalOrders: 0,
      totalRevenue: 0,
    });

    return {
      success: true,
      data: {
        referralCode: referralCode.referralCode,
        hypeStoreId: store.id,
        storeName: store.storeName,
        brandName: store.brand?.brandName || '',
        totalClicks: 0,
        totalOrders: 0,
        totalRevenue: 0,
        isActive: true,
        createdAt: referralCode.createdAt,
      },
      message: 'Referral code created successfully',
    };
  }

  /**
   * Get brand-shared coupon for a store
   * Returns the shared coupon code (e.g., SNITCHCOLLABKAROO) along with the influencer's referral code
   */
  async getBrandSharedCoupon(influencerId: number, hypeStoreId: number) {
    // Get or create referral code first
    const referralResult = await this.getOrCreateReferralCode(influencerId, hypeStoreId);

    // Find brand-shared coupon for this store
    const brandCoupon = await this.couponCodeModel.findOne({
      where: {
        hypeStoreId,
        isBrandShared: true,
        isActive: true,
      },
    });

    if (!brandCoupon) {
      throw new NotFoundException('No brand-shared coupon available for this store');
    }

    // Get store details
    const store = await this.hypeStoreModel.findByPk(hypeStoreId, {
      include: [{ model: this.brandModel }],
    });

    return {
      success: true,
      data: {
        couponCode: brandCoupon.couponCode,
        referralCode: referralResult.data.referralCode,
        trackingLink: `${store?.brand?.websiteUrl || ''}?referralCode=${referralResult.data.referralCode}&coupon=${brandCoupon.couponCode}`,
        hypeStoreId: store?.id,
        storeName: store?.storeName,
        brandName: store?.brand?.brandName || '',
        instructions: `Share this link with your followers. When they use coupon ${brandCoupon.couponCode} at checkout, you'll get credited!`,
      },
      message: 'Brand-shared coupon with your referral tracking link',
    };
  }

  /**
   * Mark an order as returned by customer
   * This removes the locked cashback from the wallet
   */
  async markOrderReturned(influencerId: number, orderId: number) {
    const order = await this.orderModel.findByPk(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.influencerId !== influencerId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    if (order.isReturned) {
      throw new BadRequestException('Order has already been marked as returned');
    }

    if (!order.lockedCashbackTransactionId) {
      throw new BadRequestException('No locked cashback found for this order');
    }

    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const lockedCashbackTx = await this.walletTransactionModel.findByPk(
        order.lockedCashbackTransactionId,
      );

      if (!lockedCashbackTx) {
        throw new NotFoundException(
          `Locked cashback transaction #${order.lockedCashbackTransactionId} not found`,
        );
      }

      const wallet = await this.walletModel.findByPk(lockedCashbackTx.walletId);
      if (!wallet) {
        throw new NotFoundException('Wallet not found for transaction');
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
          balanceAfter: parseFloat(wallet.balance.toString()), // Balance unchanged
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
          notes: `${order.notes ? order.notes + '\n' : ''}Item returned on ${new Date().toISOString()}. Cashback of ₹${cashbackAmount.toFixed(2)} has been removed from wallet.`,
        },
        { transaction },
      );

      await transaction.commit();

      await wallet.reload();

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
      throw error;
    }
  }

  /**
   * Refresh Instagram metrics for a single order
   * Updates view count, reach, and other engagement metrics
   */
  async refreshInstagramMetricsForOrder(orderId: number): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const order = await this.orderModel.findOne({
      where: { id: orderId },
      include: [
        {
          model: this.influencerModel,
          as: 'influencer',
        },
      ],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.instagramProofUrl) {
      return {
        success: false,
        message: 'No Instagram proof URL found for this order',
      };
    }

    const influencer = order.influencer;
    if (!influencer || !influencer.instagramAccessToken) {
      return {
        success: false,
        message: 'Influencer Instagram access token not available',
      };
    }

    try {
      // Extract shortcode from the proof URL
      const shortcode = this.extractInstagramShortcode(order.instagramProofUrl);
      if (!shortcode) {
        return {
          success: false,
          message: 'Could not extract Instagram shortcode from URL',
        };
      }

      // Fetch updated insights
      const insights = await this.fetchInstagramMediaInsights(influencer, shortcode);

      // Update order with new metrics
      const updateData: any = {};
      let hasUpdates = false;

      if (insights.viewCount !== undefined && insights.viewCount !== order.proofViewCount) {
        updateData.proofViewCount = insights.viewCount;
        hasUpdates = true;
      }

      if (insights.reach !== undefined && insights.reach !== order.estimatedReach) {
        updateData.estimatedReach = insights.reach;
        hasUpdates = true;
      }

      if (hasUpdates) {
        await order.update(updateData);

        return {
          success: true,
          message: 'Instagram metrics updated successfully',
          data: {
            orderId: order.id,
            previousViewCount: order.proofViewCount,
            newViewCount: insights.viewCount,
            previousReach: order.estimatedReach,
            newReach: insights.reach,
          },
        };
      }

      return {
        success: true,
        message: 'No changes detected in Instagram metrics',
        data: {
          orderId: order.id,
          viewCount: insights.viewCount,
          reach: insights.reach,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to refresh metrics for order ${orderId}:`, errorMessage);
      return {
        success: false,
        message: `Failed to refresh metrics: ${errorMessage}`,
      };
    }
  }

  /**
   * Refresh Instagram metrics for all recent orders (last 30 days)
   * This can be called by a cron job to keep metrics up-to-date
   */
  async refreshInstagramMetricsForRecentOrders(daysBack: number = 30): Promise<{
    success: boolean;
    message: string;
    data: {
      totalOrders: number;
      successfulUpdates: number;
      failedUpdates: number;
      noChanges: number;
      errors: Array<{ orderId: number; error: string }>;
    };
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Find all orders with Instagram proof submitted in the last X days
    const orders = await this.orderModel.findAll({
      where: {
        instagramProofUrl: { [Op.ne]: null as any },
        proofSubmittedAt: { [Op.gte]: cutoffDate },
      },
      include: [
        {
          model: this.influencerModel,
          as: 'influencer',
          required: true,
        },
      ],
      order: [['proofSubmittedAt', 'DESC']],
    });

    const results = {
      totalOrders: orders.length,
      successfulUpdates: 0,
      failedUpdates: 0,
      noChanges: 0,
      errors: [] as Array<{ orderId: number; error: string }>,
    };

    console.log(`🔄 Starting Instagram metrics refresh for ${orders.length} orders from the last ${daysBack} days...`);

    for (const order of orders) {
      try {
        const result = await this.refreshInstagramMetricsForOrder(order.id);

        if (result.success) {
          if (result.message.includes('updated successfully')) {
            results.successfulUpdates++;
            console.log(`✅ Updated order ${order.id}: ${result.data?.previousViewCount || 0} → ${result.data?.newViewCount || 0} views`);
          } else {
            results.noChanges++;
          }
        } else {
          results.failedUpdates++;
          results.errors.push({
            orderId: order.id,
            error: result.message,
          });
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failedUpdates++;
        results.errors.push({
          orderId: order.id,
          error: errorMessage,
        });
        console.error(`❌ Failed to refresh order ${order.id}:`, errorMessage);
      }
    }

    console.log(`✅ Refresh completed: ${results.successfulUpdates} updated, ${results.noChanges} unchanged, ${results.failedUpdates} failed`);

    return {
      success: true,
      message: `Refreshed metrics for ${results.totalOrders} orders`,
      data: results,
    };
  }
}
