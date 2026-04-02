import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { HypeStore } from '../../wallet/models/hype-store.model';
import { HypeStoreOrder } from '../../wallet/models/hype-store-order.model';
import { Wallet, UserType } from '../../wallet/models/wallet.model';
import { Brand } from '../../brand/model/brand.model';
import { Niche } from '../../auth/model/niche.model';
import {
  DateRangeFilterDto,
  PaginationDto,
  DashboardMetricsDto,
  BrandsListResponseDto,
  BrandWithStoresDto,
  BrandStoresResponseDto,
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
    private sequelize: Sequelize,
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
}
