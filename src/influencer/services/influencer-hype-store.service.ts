import {
  Injectable,
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
import { Wallet, UserType } from '../../wallet/models/wallet.model';
import { WalletTransaction, TransactionType, TransactionStatus } from '../../wallet/models/wallet-transaction.model';
import { Brand } from '../../brand/model/brand.model';
import { SubmitProofDto } from '../dto/hype-store-order.dto';

@Injectable()
export class InfluencerHypeStoreService {
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
  ) {
    const offset = (page - 1) * limit;

    // Build where clause for search
    const whereClause: any = {
      isActive: true,
    };

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
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Check if influencer has universal coupon (one-time check outside loop)
    const universalCoupon = await this.couponCodeModel.findOne({
      where: {
        influencerId,
        isUniversal: true,
        isActive: true,
      },
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

        return {
          id: store.id,
          storeName: store.storeName,
          storeDescription: store.storeDescription,
          bannerImageUrl: store.storeBanner,
          logoUrl: store.storeLogo,
          brand: store.brand,
          cashbackConfig: store.cashbackConfig,
          hasCoupon: !!universalCoupon, // Same coupon works for all stores
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
        },
      ],
    });

    if (!store) {
      throw new NotFoundException('Hype Store not found or inactive');
    }

    // Get influencer's universal coupon (works for all stores)
    const myCoupon = await this.couponCodeModel.findOne({
      where: {
        influencerId,
        isUniversal: true,
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
        myCoupon: myCoupon
          ? {
              id: myCoupon.id,
              couponCode: myCoupon.couponCode,
              isActive: myCoupon.isActive,
              totalUses: myCoupon.totalUses,
              maxUses: myCoupon.maxUses,
              validFrom: myCoupon.validFrom,
              validUntil: myCoupon.validUntil,
              createdAt: myCoupon.createdAt,
            }
          : null,
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
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    return {
      success: true,
      data: wallet,
      message: 'Wallet balance retrieved successfully',
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
   * Submit Instagram proof (Reel/Post/Story) for cashback
   */
  async submitProof(
    influencerId: number,
    orderId: number,
    submitProofDto: SubmitProofDto,
  ) {
    // Get order with associations
    const order = await this.orderModel.findOne({
      where: { id: orderId },
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStore',
          include: [
            {
              model: this.brandModel,
              as: 'brand',
              attributes: ['id', 'brandName'],
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
        `Cannot submit proof. Cashback status is already "${order.cashbackStatus}"`,
      );
    }

    // Check if proof already submitted
    if (order.instagramProofUrl) {
      throw new BadRequestException('Proof has already been submitted for this order');
    }

    // Update order with proof details
    await order.update({
      instagramProofUrl: submitProofDto.instagramUrl,
      proofContentType: submitProofDto.contentType,
      proofSubmittedAt: new Date(),
      cashbackStatus: CashbackStatus.PROCESSING, // Change to processing for admin review
      notes: submitProofDto.notes
        ? `${order.notes ? order.notes + '\n' : ''}Proof submitted: ${submitProofDto.notes}`
        : order.notes,
    });

    return {
      success: true,
      data: {
        id: order.id,
        externalOrderId: order.externalOrderId,
        orderAmount: parseFloat(order.orderAmount.toString()),
        cashbackAmount: parseFloat(order.cashbackAmount.toString()),
        cashbackStatus: order.cashbackStatus,
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
      message:
        'Proof submitted successfully. Cashback will be credited after verification.',
    };
  }

  /**
   * Claim minimum cashback without posting content (7% or flat minimum)
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
        totalCredited: 0,
        totalDebited: 0,
        totalCashbackReceived: 0,
        totalRedeemed: 0,
        isActive: true,
      } as any);
    }

    // Credit cashback to wallet in transaction
    const transaction: Transaction = await this.sequelize.transaction();

    try {
      const previousBalance = parseFloat(wallet.balance.toString());
      const newBalance = previousBalance + minimumCashbackAmount;

      // Update wallet
      await wallet.update(
        {
          balance: newBalance,
          totalCredited: parseFloat(wallet.totalCredited.toString()) + minimumCashbackAmount,
          totalCashbackReceived:
            parseFloat(wallet.totalCashbackReceived.toString()) + minimumCashbackAmount,
        },
        { transaction },
      );

      // Create wallet transaction
      const walletTransaction = await this.walletTransactionModel.create(
        {
          walletId: wallet.id,
          transactionType: TransactionType.CASHBACK,
          amount: minimumCashbackAmount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          status: TransactionStatus.COMPLETED,
          description: `Minimum cashback for order ${order.externalOrderId} (claimed without posting)`,
          storeId: order.hypeStoreId,
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
          walletTransactionId: walletTransaction.id,
          notes: `${order.notes ? order.notes + '\n' : ''}Minimum cashback claimed without posting content (7% instant)`,
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
            totalCashbackReceived: parseFloat(wallet.totalCashbackReceived.toString()),
          },
          transaction: {
            id: walletTransaction.id,
            amount: minimumCashbackAmount,
            transactionType: walletTransaction.transactionType,
            description: walletTransaction.description,
            createdAt: walletTransaction.createdAt,
          },
        },
        message: `Minimum cashback of ₹${minimumCashbackAmount.toFixed(2)} has been credited to your wallet`,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
