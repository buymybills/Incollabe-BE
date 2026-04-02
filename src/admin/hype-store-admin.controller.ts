import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  ParseIntPipe,
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
} from './dto/hype-store-admin.dto';

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
}
