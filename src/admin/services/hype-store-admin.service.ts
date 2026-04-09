import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { HypeStore } from '../../wallet/models/hype-store.model';
import { HypeStoreOrder } from '../../wallet/models/hype-store-order.model';
import { Wallet, UserType } from '../../wallet/models/wallet.model';
import { Brand } from '../../brand/model/brand.model';
import { Niche } from '../../auth/model/niche.model';
import { HypeStoreCashbackConfig } from '../../hype-store/models/hype-store-cashback-config.model';
import { HypeStoreCouponCode } from '../../wallet/models/hype-store-coupon-code.model';
import { HypeStoreWallet } from '../../hype-store/models/hype-store-wallet.model';
import { HypeStoreWalletTransaction } from '../../hype-store/models/hype-store-wallet-transaction.model';
import { InfluencerHypeStoreService } from '../../influencer/services/influencer-hype-store.service';
import {
  DateRangeFilterDto,
  PaginationDto,
  DashboardMetricsDto,
  BrandsListResponseDto,
  BrandWithStoresDto,
  BrandStoresResponseDto,
  StoreDetailDto,
  PerformanceMetricsDto,
  CashbackConfigDto,
  WalletMetricsDto,
  OrdersListResponseDto,
  OrderListItemDto,
  WalletTransactionsListResponseDto,
  WalletTransactionItemDto,
} from '../dto/hype-store-admin.dto';

@Injectable()
export class HypeStoreAdminService {
  constructor(
    @InjectModel(HypeStore)
    private hypeStoreModel: typeof HypeStore,
    @InjectModel(HypeStoreOrder)
    private orderModel: typeof HypeStoreOrder,
    @InjectModel(Wallet)
    private walletModel: typeof Wallet,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(HypeStoreCashbackConfig)
    private cashbackConfigModel: typeof HypeStoreCashbackConfig,
    @InjectModel(HypeStoreCouponCode)
    private couponCodeModel: typeof HypeStoreCouponCode,
    @InjectModel(HypeStoreWallet)
    private hypeStoreWalletModel: typeof HypeStoreWallet,
    @InjectModel(HypeStoreWalletTransaction)
    private walletTransactionModel: typeof HypeStoreWalletTransaction,
    private sequelize: Sequelize,
    @Inject(forwardRef(() => InfluencerHypeStoreService))
    private influencerHypeStoreService: InfluencerHypeStoreService,
  ) {}

  /**
   * Get dashboard metrics with date range filtering and comparison with previous period
   */
  async getDashboardMetrics(dateRange: DateRangeFilterDto): Promise<DashboardMetricsDto> {
    // Default date range: last 30 days
    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
    const startDate = dateRange.startDate
      ? new Date(dateRange.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate previous period (same duration)
    const periodDuration = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDuration);
    const prevEndDate = new Date(startDate.getTime() - 1); // Day before current period starts

    // Fetch current period metrics
    const currentMetrics = await this.calculateMetrics(startDate, endDate);

    // Fetch previous period metrics for comparison
    const previousMetrics = await this.calculateMetrics(prevStartDate, prevEndDate);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    return {
      totalActiveBrands: currentMetrics.activeBrands,
      totalActiveBrandsChange: calculateChange(
        currentMetrics.activeBrands,
        previousMetrics.activeBrands,
      ),
      totalActiveStores: currentMetrics.activeStores,
      totalActiveStoresChange: calculateChange(
        currentMetrics.activeStores,
        previousMetrics.activeStores,
      ),
      totalSalesQuantity: currentMetrics.salesQuantity,
      totalSalesQuantityChange: calculateChange(
        currentMetrics.salesQuantity,
        previousMetrics.salesQuantity,
      ),
      totalSalesAmount: currentMetrics.salesAmount,
      totalSalesAmountChange: calculateChange(
        currentMetrics.salesAmount,
        previousMetrics.salesAmount,
      ),
      totalCashbackGivenQty: currentMetrics.cashbackGivenQty,
      totalCashbackGivenQtyChange: calculateChange(
        currentMetrics.cashbackGivenQty,
        previousMetrics.cashbackGivenQty,
      ),
      totalCashbackGivenAmount: currentMetrics.cashbackGivenAmount,
      totalCashbackGivenAmountChange: calculateChange(
        currentMetrics.cashbackGivenAmount,
        previousMetrics.cashbackGivenAmount,
      ),
      currentAmountInWallet: currentMetrics.currentWalletAmount,
      currentAmountInWalletChange: calculateChange(
        currentMetrics.currentWalletAmount,
        previousMetrics.currentWalletAmount,
      ),
      lifetimeAmountInWallet: currentMetrics.lifetimeWalletAmount,
      lifetimeAmountInWalletChange: calculateChange(
        currentMetrics.lifetimeWalletAmount,
        previousMetrics.lifetimeWalletAmount,
      ),
    };
  }

  /**
   * Calculate metrics for a specific date range
   */
  private async calculateMetrics(startDate: Date, endDate: Date) {
    const createdAtRange = {
      [Op.between]: [startDate, endDate],
    };

    // Count active brands with stores
    const activeBrandsCount = await this.brandModel.count({
      distinct: true,
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStores',
          required: true, // Only brands with at least one store
          where: { isActive: true },
        },
      ],
      where: {
        isActive: true,
        createdAt: createdAtRange,
      },
    });

    // Count active stores
    const activeStoresCount = await this.hypeStoreModel.count({
      where: {
        isActive: true,
        createdAt: createdAtRange,
      },
    });

    // Sales metrics (orders within date range)
    const salesStats = await this.orderModel.findOne({
      attributes: [
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'totalOrders'],
        [this.sequelize.fn('SUM', this.sequelize.col('order_amount')), 'totalAmount'],
        [this.sequelize.fn('SUM', this.sequelize.col('cashback_amount')), 'totalCashback'],
        [
          this.sequelize.fn(
            'COUNT',
            this.sequelize.fn('DISTINCT', this.sequelize.literal('CASE WHEN cashback_amount > 0 THEN id END'))
          ),
          'ordersWithCashback',
        ],
      ],
      where: {
        orderDate: {
          [Op.between]: [startDate, endDate],
        },
      },
      raw: true,
    });

    // Wallet metrics
    const walletStats = await this.walletModel.findOne({
      attributes: [
        [this.sequelize.fn('SUM', this.sequelize.col('balance')), 'currentBalance'],
        [this.sequelize.fn('SUM', this.sequelize.col('total_cashback_received')), 'lifetimeCashback'],
      ],
      where: {
        userType: UserType.INFLUENCER,
        isActive: true,
        createdAt: createdAtRange,
      },
      raw: true,
    });

    return {
      activeBrands: activeBrandsCount,
      activeStores: activeStoresCount,
      salesQuantity: parseInt((salesStats as any)?.totalOrders || '0'),
      salesAmount: parseFloat((salesStats as any)?.totalAmount || '0'),
      cashbackGivenQty: parseInt((salesStats as any)?.ordersWithCashback || '0'),
      cashbackGivenAmount: parseFloat((salesStats as any)?.totalCashback || '0'),
      currentWalletAmount: parseFloat((walletStats as any)?.currentBalance || '0'),
      lifetimeWalletAmount: parseFloat((walletStats as any)?.lifetimeCashback || '0'),
    };
  }

  /**
   * Get paginated list of brands with their stores and statistics
   */
  async getBrandsList(
    pagination: PaginationDto,
    dateRange: DateRangeFilterDto,
  ): Promise<BrandsListResponseDto> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const offset = (page - 1) * limit;

    // Build where clause for date filtering
    const whereClause: any = { isActive: true };
    if (dateRange.startDate || dateRange.endDate) {
      whereClause.createdAt = {};
      if (dateRange.startDate) {
        whereClause.createdAt[Op.gte] = new Date(dateRange.startDate);
      }
      if (dateRange.endDate) {
        whereClause.createdAt[Op.lte] = new Date(dateRange.endDate);
      }
    }

    // Get brands with store count
    const { rows: brands, count: total } = await this.brandModel.findAndCountAll({
      where: whereClause,
      distinct: true,
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStores',
          attributes: ['id', 'isActive', 'totalOrders', 'totalRevenue'],
        },
        {
          model: Niche,
          as: 'niches',
          attributes: ['name'],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Transform to DTO
    const data: BrandWithStoresDto[] = brands.map((brand) => {
      // Use type assertion for included associations
      const brandData = brand as any;

      // Count active stores
      const activeStoreCount = (brandData.hypeStores || []).filter((store: any) => store.isActive).length;

      // Calculate totals from all stores
      const totalRevenue = (brandData.hypeStores || []).reduce(
        (sum: number, store: any) => sum + parseFloat(store.totalRevenue?.toString() || '0'),
        0,
      );
      const totalOrders = (brandData.hypeStores || []).reduce(
        (sum: number, store: any) => sum + parseInt(store.totalOrders?.toString() || '0'),
        0,
      );

      // Get category names from niches
      const categories = (brandData.niches || [])
        .map((niche: any) => niche.name)
        .filter(Boolean)
        .join(' | ') || 'Uncategorized';

      return {
        id: brand.id,
        brandName: brand.brandName || 'Unknown Brand',
        logoUrl: brandData.profileImage || brandData.instagramProfilePictureUrl || '',
        category: categories,
        activeStoreCount,
        createdAt: brand.createdAt.toISOString(),
        totalRevenue,
        totalOrders,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all stores for a specific brand
   */
  async getBrandStores(brandId: number): Promise<BrandStoresResponseDto> {
    const brand = await this.brandModel.findByPk(brandId, {
      include: [
        {
          model: this.hypeStoreModel,
          as: 'hypeStores',
        },
      ],
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const brandData = brand as any;

    return {
      brand: {
        id: brand.id,
        name: brand.brandName || 'Unknown Brand',
      },
      stores: (brandData.hypeStores || []).map((store: any) => ({
        id: store.id,
        storeName: store.storeName,
        storeSlug: store.storeSlug,
        isActive: store.isActive,
        isVerified: store.isVerified,
        totalOrders: store.totalOrders,
        totalRevenue: parseFloat(store.totalRevenue?.toString() || '0'),
        totalCashbackGiven: parseFloat(store.totalCashbackGiven?.toString() || '0'),
        createdAt: store.createdAt?.toISOString?.() || store.createdAt,
        updatedAt: store.updatedAt?.toISOString?.() || store.updatedAt,
      })),
    };
  }

  /**
   * Get detailed information for a specific store
   */
  async getStoreDetail(storeId: number, dateRange: DateRangeFilterDto): Promise<StoreDetailDto> {
    const store = await this.hypeStoreModel.findByPk(storeId, {
      include: [
        {
          model: this.cashbackConfigModel,
          as: 'cashbackConfig',
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brandName'],
        },
      ],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // Default date range: last 30 days
    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
    const startDate = dateRange.startDate
      ? new Date(dateRange.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate previous period
    const periodDuration = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodDuration);
    const prevEndDate = new Date(startDate.getTime() - 1);

    // Get performance metrics (average from all orders with ROI data)
    const performanceStats = await this.orderModel.findOne({
      attributes: [
        [this.sequelize.fn('AVG', this.sequelize.col('expected_roi')), 'avgRoi'],
        [this.sequelize.fn('AVG', this.sequelize.col('estimated_engagement')), 'avgEngagement'],
        [this.sequelize.fn('AVG', this.sequelize.col('estimated_reach')), 'avgReach'],
      ],
      where: this.sequelize.and(
        { hypeStoreId: storeId },
        this.sequelize.literal('expected_roi IS NOT NULL'),
      ),
      raw: true,
    });

    const avgRoi = parseFloat((performanceStats as any)?.avgRoi || '1.0');
    const avgEngagement = parseInt((performanceStats as any)?.avgEngagement || '0');
    const avgReach = parseInt((performanceStats as any)?.avgReach || '0');

    // Determine performance tier based on ROI
    let performanceTier = 'Standard';
    if (avgRoi >= 2.0) {
      performanceTier = 'Elite';
    } else if (avgRoi >= 1.5) {
      performanceTier = 'Premium';
    }

    // Get wallet metrics for current and previous period
    const currentWalletMetrics = await this.calculateWalletMetrics(storeId, startDate, endDate);
    const previousWalletMetrics = await this.calculateWalletMetrics(
      storeId,
      prevStartDate,
      prevEndDate,
    );

    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return parseFloat((((current - previous) / previous) * 100).toFixed(1));
    };

    // Get brand wallet for current balance
    const brandWallet = await this.hypeStoreWalletModel.findOne({
      where: {
        userId: (store as any).brandId,
        userType: 'brand',
      },
    });

    const performance: PerformanceMetricsDto = {
      expectedRoi: parseFloat(avgRoi.toFixed(1)),
      estimatedEngagement: avgEngagement,
      estimatedReach: avgReach,
      performanceTier,
    };

    const cashbackConfig: CashbackConfigDto = {
      reelPostMinCashback: parseFloat(
        ((store as any).cashbackConfig?.reelPostMinCashback?.toString() || '200'),
      ),
      reelPostMaxCashback: parseFloat(
        ((store as any).cashbackConfig?.reelPostMaxCashback?.toString() || '4000'),
      ),
      storyMinCashback: parseFloat(
        ((store as any).cashbackConfig?.storyMinCashback?.toString() || '200'),
      ),
      storyMaxCashback: parseFloat(
        ((store as any).cashbackConfig?.storyMaxCashback?.toString() || '4000'),
      ),
      monthlyClaimCount: (store as any).cashbackConfig?.monthlyClaimCount || 3,
      claimStrategy: (store as any).cashbackConfig?.claimStrategy || 'OPTIMIZED_SPEND',
    };

    const walletMetrics: WalletMetricsDto = {
      currentWalletAmount: parseFloat(brandWallet?.balance?.toString() || '0'),
      currentWalletAmountChange: calculateChange(
        parseFloat(brandWallet?.balance?.toString() || '0'),
        previousWalletMetrics.currentBalance,
      ),
      totalCashbackUsed: currentWalletMetrics.totalCashbackUsed,
      totalCashbackUsedChange: calculateChange(
        currentWalletMetrics.totalCashbackUsed,
        previousWalletMetrics.totalCashbackUsed,
      ),
      totalOrders: currentWalletMetrics.totalOrders,
      totalOrdersChange: calculateChange(
        currentWalletMetrics.totalOrders,
        previousWalletMetrics.totalOrders,
      ),
      totalSales: currentWalletMetrics.totalSales,
      totalSalesChange: calculateChange(
        currentWalletMetrics.totalSales,
        previousWalletMetrics.totalSales,
      ),
    };

    return {
      id: store.id,
      storeName: store.storeName,
      storeSlug: store.storeSlug || '',
      isActive: store.isActive,
      isVerified: store.isVerified,
      performance,
      cashbackConfig,
      walletMetrics,
      createdAt: store.createdAt.toISOString(),
      updatedAt: store.updatedAt.toISOString(),
    };
  }

  /**
   * Calculate wallet metrics for a specific date range
   */
  private async calculateWalletMetrics(
    storeId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    currentBalance: number;
    totalCashbackUsed: number;
    totalOrders: number;
    totalSales: number;
  }> {
    // Get orders for this store in the date range
    const ordersStats = await this.orderModel.findOne({
      attributes: [
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'totalOrders'],
        [this.sequelize.fn('SUM', this.sequelize.col('order_amount')), 'totalSales'],
        [this.sequelize.fn('SUM', this.sequelize.col('cashback_amount')), 'totalCashback'],
      ],
      where: {
        hypeStoreId: storeId,
        orderDate: {
          [Op.between]: [startDate, endDate],
        },
      },
      raw: true,
    });

    // Get wallet balance at end of period
    const store = await this.hypeStoreModel.findByPk(storeId);
    const brandWallet = await this.hypeStoreWalletModel.findOne({
      where: {
        userId: (store as any)?.brandId,
        userType: 'brand',
      },
    });

    return {
      currentBalance: parseFloat(brandWallet?.balance?.toString() || '0'),
      totalCashbackUsed: parseFloat((ordersStats as any)?.totalCashback || '0'),
      totalOrders: parseInt((ordersStats as any)?.totalOrders || '0'),
      totalSales: parseFloat((ordersStats as any)?.totalSales || '0'),
    };
  }

  /**
   * Get paginated list of orders for a specific store
   */
  async getStoreOrders(
    storeId: number,
    pagination: PaginationDto,
  ): Promise<OrdersListResponseDto> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const offset = (page - 1) * limit;

    // Verify store exists
    const store = await this.hypeStoreModel.findByPk(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const { rows: orders, count: total } = await this.orderModel.findAndCountAll({
      where: {
        hypeStoreId: storeId,
      },
      include: [
        {
          model: this.couponCodeModel,
          as: 'couponCode',
          attributes: ['couponCode'],
        },
      ],
      order: [['orderDate', 'DESC']],
      limit,
      offset,
    });

    const ordersList: OrderListItemDto[] = orders.map((order) => ({
      id: order.id,
      customerName: order.customerName || 'N/A',
      externalOrderId: order.externalOrderId,
      couponCode: (order as any).couponCode?.couponCode || 'N/A',
      orderValue: parseFloat(order.orderAmount.toString()),
      cashbackAmount: parseFloat(order.cashbackAmount.toString()),
      orderDate: order.orderDate.toISOString(),
      cashbackStatus: order.cashbackStatus,
      orderStatus: order.orderStatus,
    }));

    return {
      orders: ordersList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get wallet transaction history for a brand
   */
  async getWalletTransactions(
    brandId: number,
    pagination: PaginationDto,
  ): Promise<WalletTransactionsListResponseDto> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const offset = (page - 1) * limit;

    // Get brand wallet
    const wallet = await this.hypeStoreWalletModel.findOne({
      where: {
        userId: brandId,
        userType: 'brand',
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this brand');
    }

    const { rows: transactions, count: total } =
      await this.walletTransactionModel.findAndCountAll({
        where: {
          walletId: wallet.id,
        },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

    const transactionsList: WalletTransactionItemDto[] = transactions.map((txn) => ({
      id: txn.id,
      transactionType: txn.transactionType,
      description: txn.description || 'Wallet transaction',
      amount: parseFloat(txn.amount.toString()),
      balanceAfter: parseFloat(txn.newBalance.toString()),
      status: txn.paymentReferenceId ? 'SUCCESS' : 'SUCCESS', // Simplification - all recorded transactions are successful
      paymentMethod: txn.paymentMethod || 'N/A',
      paymentReferenceId: txn.paymentReferenceId || 'N/A',
      createdAt: txn.createdAt.toISOString(),
    }));

    return {
      transactions: transactionsList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get list of proofs for admin review
   */
  async getProofsList(filters: any) {
    const { page = 1, limit = 20, status, storeId, influencerId } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {
      instagramProofUrl: { [Op.ne]: null }, // Only orders with submitted proofs
    };

    if (status) {
      whereClause.proofApprovalStatus = status;
    }

    if (storeId) {
      whereClause.hypeStoreId = storeId;
    }

    if (influencerId) {
      whereClause.influencerId = influencerId;
    }

    const { rows: orders, count: total } = await this.orderModel.findAndCountAll({
      where: whereClause,
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
        {
          model: require('../../auth/model/influencer.model').Influencer,
          as: 'influencer',
          attributes: ['id', 'instagramUsername', 'instagramFollowersCount'],
        },
      ],
      order: [['proofSubmittedAt', 'DESC']],
      limit,
      offset,
    });

    return {
      data: orders.map((order) => ({
        id: order.id,
        externalOrderId: order.externalOrderId,
        influencerId: order.influencerId,
        influencer: order.influencer
          ? {
              id: order.influencer.id,
              username: order.influencer.instagramUsername,
              followersCount: order.influencer.instagramFollowersCount,
            }
          : null,
        store: order.hypeStore
          ? {
              id: order.hypeStore.id,
              storeName: order.hypeStore.storeName,
              brandName: order.hypeStore.brand?.brandName,
            }
          : null,
        orderAmount: parseFloat(order.orderAmount.toString()),
        cashbackAmount: parseFloat(order.cashbackAmount.toString()),
        cashbackTier: order.cashbackTierId
          ? {
              id: order.cashbackTierId,
            }
          : null,
        proof: {
          instagramUrl: order.instagramProofUrl,
          thumbnailUrl: order.proofThumbnailUrl,
          contentType: order.proofContentType,
          viewCount: order.proofViewCount,
          submittedAt: order.proofSubmittedAt,
          postedAt: order.proofPostedAt,
        },
        proofApprovalStatus: order.proofApprovalStatus,
        orderDate: order.orderDate,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve proof - delegates to InfluencerHypeStoreService
   */
  async approveProof(orderId: number, adminId: number) {
    // Delegate to the service that has the logic
    return this.influencerHypeStoreService.approveProof(orderId, adminId);
  }

  /**
   * Reject proof - delegates to InfluencerHypeStoreService
   */
  async rejectProof(orderId: number, adminId: number, rejectionReason: string) {
    // Delegate to the service that has the logic
    return this.influencerHypeStoreService.rejectProof(orderId, adminId, rejectionReason);
  }
}
