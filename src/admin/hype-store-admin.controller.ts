import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { HypeStoreAdminService } from './services/hype-store-admin.service';
import {
  DateRangeFilterDto,
  PaginationDto,
  DashboardMetricsDto,
  BrandsListResponseDto,
  BrandStoresResponseDto,
  StoreDetailDto,
  OrdersListResponseDto,
  WalletTransactionsListResponseDto,
} from './dto/hype-store-admin.dto';
import {
  ListPendingProofsDto,
  ApproveProofDto,
  RejectProofDto,
  ProofApprovalResponseDto,
} from './dto/hype-store-proof-approval.dto';

@ApiTags('Admin - Hype Store')
@Controller('admin/hype-store')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class HypeStoreAdminController {
  constructor(private readonly hypeStoreAdminService: HypeStoreAdminService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get Hype Store dashboard metrics',
    description: 'Returns aggregated metrics for Hype Store with date range filtering and comparison with previous period',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO format). Defaults to 30 days ago',
    example: '2025-09-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO format). Defaults to now',
    example: '2025-10-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardMetricsDto,
    schema: {
      example: {
        totalActiveBrands: 3200,
        totalActiveBrandsChange: 36,
        totalActiveStores: 3200,
        totalActiveStoresChange: -2.9,
        totalSalesQuantity: 17000,
        totalSalesQuantityChange: -2.9,
        totalSalesAmount: 200000,
        totalSalesAmountChange: -2.9,
        totalCashbackGivenQty: 12000,
        totalCashbackGivenQtyChange: -2.9,
        totalCashbackGivenAmount: 20000,
        totalCashbackGivenAmountChange: -2.9,
        currentAmountInWallet: 1200000,
        currentAmountInWalletChange: -2.9,
        lifetimeAmountInWallet: 2000000,
        lifetimeAmountInWalletChange: -2.9,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getDashboard(@Query() dateRange: DateRangeFilterDto): Promise<DashboardMetricsDto> {
    return this.hypeStoreAdminService.getDashboardMetrics(dateRange);
  }

  @Get('brands')
  @ApiOperation({
    summary: 'Get list of all brands on Hype Store',
    description: 'Returns paginated list of brands with their store count and statistics',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 20,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter brands created after this date',
    example: '2025-09-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter brands created before this date',
    example: '2025-10-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Brands list retrieved successfully',
    type: BrandsListResponseDto,
    schema: {
      example: {
        data: [
          {
            id: 1,
            brandName: 'Myntra',
            logoUrl: 'https://cdn.example.com/myntra-logo.png',
            category: 'Fashion | Accessories | Lifestyle',
            activeStoreCount: 1,
            createdAt: '2026-01-28T00:00:00Z',
            totalRevenue: 50000,
            totalOrders: 250,
          },
        ],
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getBrands(
    @Query() pagination: PaginationDto,
    @Query() dateRange: DateRangeFilterDto,
  ): Promise<BrandsListResponseDto> {
    return this.hypeStoreAdminService.getBrandsList(pagination, dateRange);
  }

  @Get('brands/:brandId/stores')
  @ApiOperation({
    summary: 'Get stores for a specific brand',
    description: 'Returns list of all stores belonging to a brand with their statistics',
  })
  @ApiParam({ name: 'brandId', type: Number, example: 1, description: 'Brand ID' })
  @ApiResponse({
    status: 200,
    description: 'Brand stores retrieved successfully',
    type: BrandStoresResponseDto,
    schema: {
      example: {
        brand: {
          id: 1,
          name: 'Myntra',
        },
        stores: [
          {
            id: 10,
            storeName: 'Myntra Store',
            storeSlug: 'myntra-store',
            isActive: true,
            isVerified: true,
            totalOrders: 250,
            totalRevenue: 50000,
            totalCashbackGiven: 2000,
            createdAt: '2026-01-28T00:00:00Z',
            updatedAt: '2026-02-10T00:00:00Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getBrandStores(@Param('brandId', ParseIntPipe) brandId: number) {
    return this.hypeStoreAdminService.getBrandStores(brandId);
  }

  @Get('stores/:storeId')
  @ApiOperation({
    summary: 'Get detailed information for a specific store',
    description:
      'Returns store details with performance metrics, cashback configuration, and wallet metrics',
  })
  @ApiParam({ name: 'storeId', type: Number, example: 1, description: 'Store ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for metrics calculation (ISO format). Defaults to 30 days ago',
    example: '2025-09-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for metrics calculation (ISO format). Defaults to now',
    example: '2025-10-31T23:59:59Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Store details retrieved successfully',
    type: StoreDetailDto,
    schema: {
      example: {
        id: 1,
        storeName: 'Myntra Store',
        storeSlug: 'myntra-store',
        isActive: true,
        isVerified: true,
        performance: {
          expectedRoi: 1.4,
          estimatedEngagement: 13100,
          estimatedReach: 210000,
          performanceTier: 'Elite',
        },
        cashbackConfig: {
          reelPostMinCashback: 200,
          reelPostMaxCashback: 4000,
          storyMinCashback: 200,
          storyMaxCashback: 4000,
          monthlyClaimCount: 3,
          claimStrategy: 'OPTIMIZED_SPEND',
        },
        walletMetrics: {
          currentWalletAmount: 110000,
          currentWalletAmountChange: 36,
          totalCashbackUsed: 110000,
          totalCashbackUsedChange: 36,
          totalOrders: 400,
          totalOrdersChange: 36,
          totalSales: 4260000,
          totalSalesChange: 36,
        },
        createdAt: '2026-01-28T00:00:00Z',
        updatedAt: '2026-03-15T10:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getStoreDetail(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query() dateRange: DateRangeFilterDto,
  ): Promise<StoreDetailDto> {
    return this.hypeStoreAdminService.getStoreDetail(storeId, dateRange);
  }

  @Get('stores/:storeId/orders')
  @ApiOperation({
    summary: 'Get orders for a specific store',
    description: 'Returns paginated list of orders with customer details and cashback information',
  })
  @ApiParam({ name: 'storeId', type: Number, example: 1, description: 'Store ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Orders list retrieved successfully',
    type: OrdersListResponseDto,
    schema: {
      example: {
        orders: [
          {
            id: 123,
            customerName: 'Sneha Shah',
            externalOrderId: 'ORD-2026-12345',
            couponCode: 'MYNTRA-000123-A3F2B1',
            orderValue: 10000,
            cashbackAmount: 1000,
            orderDate: '2025-10-02T00:00:00Z',
            cashbackStatus: 'CREDITED',
            orderStatus: 'DELIVERED',
          },
        ],
        total: 180,
        page: 1,
        limit: 20,
        totalPages: 9,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getStoreOrders(
    @Param('storeId', ParseIntPipe) storeId: number,
    @Query() pagination: PaginationDto,
  ): Promise<OrdersListResponseDto> {
    return this.hypeStoreAdminService.getStoreOrders(storeId, pagination);
  }

  @Get('brands/:brandId/transactions')
  @ApiOperation({
    summary: 'Get wallet transaction history for a brand',
    description: 'Returns paginated list of wallet transactions (recharges, debits, etc.)',
  })
  @ApiParam({ name: 'brandId', type: Number, example: 1, description: 'Brand ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet transactions retrieved successfully',
    type: WalletTransactionsListResponseDto,
    schema: {
      example: {
        transactions: [
          {
            id: 12,
            transactionType: 'ADD_MONEY',
            description: 'Wallet recharge',
            amount: 36000,
            balanceAfter: 136000,
            status: 'SUCCESS',
            paymentMethod: 'UPI',
            paymentReferenceId: 'pay_123456789',
            createdAt: '2026-03-22T01:54:00Z',
          },
        ],
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Brand wallet not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getWalletTransactions(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query() pagination: PaginationDto,
  ): Promise<WalletTransactionsListResponseDto> {
    return this.hypeStoreAdminService.getWalletTransactions(brandId, pagination);
  }

  @Get('proofs')
  @ApiOperation({
    summary: 'Get list of submitted proofs for review',
    description: 'Returns paginated list of orders with submitted Instagram proofs, filterable by approval status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending_review', 'approved', 'rejected'],
    description: 'Filter by approval status',
    example: 'pending_review',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    type: Number,
    description: 'Filter by store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Proofs list retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 360,
            externalOrderId: 'ORD-1775304111881',
            influencer: {
              id: 7,
              username: 'rishab_100_',
              followersCount: 6,
            },
            store: {
              id: 22,
              storeName: 'Store 1',
              brandName: 'my brand',
            },
            orderAmount: 3598,
            cashbackAmount: 899.5,
            cashbackTier: {
              id: 2,
              followerRange: '1-499',
              percentage: 25,
            },
            proof: {
              instagramUrl: 'https://www.instagram.com/reel/DWtbiPkgthI/',
              thumbnailUrl: 'https://scontent-...',
              contentType: 'reel',
              viewCount: null,
              submittedAt: '2026-04-04T16:05:02.893Z',
              postedAt: '2026-04-04T12:32:16.000Z',
            },
            proofApprovalStatus: 'pending_review',
            orderDate: '2026-04-04T12:01:52.208Z',
          },
        ],
        total: 15,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async getProofs(@Query() filters: ListPendingProofsDto) {
    return this.hypeStoreAdminService.getProofsList(filters);
  }

  @Post('proofs/:orderId/approve')
  @ApiOperation({
    summary: 'Approve submitted proof and lock cashback',
    description: 'Approves Instagram proof, creates wallet transactions, and locks cashback for the order',
  })
  @ApiParam({ name: 'orderId', type: Number, example: 360, description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Proof approved successfully',
    type: ProofApprovalResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Proof approved successfully. Cashback of ₹899.50 has been locked and will be available after the return window closes.',
        data: {
          orderId: 360,
          externalOrderId: 'ORD-1775304111881',
          cashbackAmount: 899.5,
          proofApprovalStatus: 'approved',
          cashbackStatus: 'processing',
          returnPeriodEndsAt: '2026-05-04T12:01:51.882Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - proof already processed or missing' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async approveProof(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: ApproveProofDto,
    @Req() req: any,
  ): Promise<ProofApprovalResponseDto> {
    const adminId = req.user?.id || 1; // Get from JWT token
    return this.hypeStoreAdminService.approveProof(orderId, adminId);
  }

  @Post('proofs/:orderId/reject')
  @ApiOperation({
    summary: 'Reject submitted proof',
    description: 'Rejects Instagram proof with a reason. Influencer can resubmit after rejection.',
  })
  @ApiParam({ name: 'orderId', type: Number, example: 360, description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Proof rejected successfully',
    type: ProofApprovalResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Proof rejected successfully. Influencer can resubmit.',
        data: {
          orderId: 360,
          externalOrderId: 'ORD-1775304111881',
          proofApprovalStatus: 'rejected',
          rejectionReason: 'Poor quality image, product not clearly visible',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - proof already processed or missing' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  async rejectProof(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: RejectProofDto,
    @Req() req: any,
  ): Promise<ProofApprovalResponseDto> {
    const adminId = req.user?.id || 1; // Get from JWT token
    return this.hypeStoreAdminService.rejectProof(orderId, adminId, body.rejectionReason);
  }
}
