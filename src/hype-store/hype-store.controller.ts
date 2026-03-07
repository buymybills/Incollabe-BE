import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { HypeStoreService } from './hype-store.service';
import { CreateHypeStoreDto, UpdateHypeStoreDto } from './dto/create-hype-store.dto';
import { UpdateCashbackConfigDto } from './dto/cashback-config.dto';
import { AddMoneyToWalletDto } from './dto/wallet.dto';
import { UpdateCreatorPreferenceDto } from './dto/creator-preference.dto';
import { CASHBACK_CLAIM_STRATEGIES } from './constants/cashback-strategies';
import { CreateWalletRechargeOrderDto, VerifyWalletPaymentDto } from './dto/wallet.dto';

@ApiTags('Hype Store')
@ApiBearerAuth()
@Controller('api/brand/hype-store')
export class HypeStoreController {
  constructor(private readonly hypeStoreService: HypeStoreService) {}

  @Get('cashback-strategies')
  @ApiOperation({
    summary: 'Get available cashback claim strategies',
    description: 'Returns list of all available cashback claim strategies with their descriptions and claim limits'
  })
  @ApiResponse({ status: 200, description: 'List of cashback strategies retrieved successfully' })
  getCashbackStrategies() {
    return {
      strategies: CASHBACK_CLAIM_STRATEGIES,
    };
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new hype store (Brands only)',
    description: 'Create a new hype store for your brand. Store name is auto-generated (Store 1, Store 2, etc.). Creates brand wallet if it doesn\'t exist. Minimum cashback is fixed at Rs 100.'
  })
  @ApiResponse({ status: 201, description: 'Store created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createStore(@Request() req: any, @Body() createDto: CreateHypeStoreDto) {
    const brandId = req.user.id;
    return this.hypeStoreService.createStore(brandId, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all stores for current brand',
    description: 'Returns all hype stores belonging to the authenticated brand'
  })
  @ApiResponse({ status: 200, description: 'Stores retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyStores(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoresByBrandId(brandId);
  }

  @Get('wallet/balance')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Get brand-level wallet balance shared across all stores. Wallet is created automatically when first store is created.'
  })
  @ApiResponse({ status: 200, description: 'Wallet balance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletBalance(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getWalletBalance(brandId);
  }

  @Get('wallet/transactions')
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description: 'Get paginated wallet transaction history for the brand'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletTransactions(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getWalletTransactions(
      brandId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Post('wallet/create-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create Razorpay order for wallet recharge',
    description: 'Step 1 of wallet recharge: Creates Razorpay payment order. Minimum recharge: Rs 5,000. Returns orderId and amount for Razorpay checkout.'
  })
  @ApiResponse({ status: 200, description: 'Razorpay order created successfully' })
  @ApiResponse({ status: 400, description: 'Amount below minimum (Rs 5,000)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createWalletRechargeOrder(
    @Request() req: any,
    @Body() createOrderDto: CreateWalletRechargeOrderDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.createWalletRechargeOrder(brandId, createOrderDto.amount);
  }

  @Post('wallet/verify-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Razorpay payment and credit wallet',
    description: 'Step 2 of wallet recharge: Verifies Razorpay payment signature and credits wallet balance'
  })
  @ApiResponse({ status: 200, description: 'Payment verified and wallet credited' })
  @ApiResponse({ status: 400, description: 'Invalid payment signature' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyWalletPayment(
    @Request() req: any,
    @Body() verifyPaymentDto: VerifyWalletPaymentDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.verifyAndAddMoneyToWallet(
      brandId,
      verifyPaymentDto.orderId,
      verifyPaymentDto.paymentId,
      verifyPaymentDto.signature,
    );
  }

  @Post('wallet/add-money')
  @ApiOperation({
    summary: 'Add money to wallet (Manual/Admin)',
    description: 'Legacy endpoint for manual wallet additions. Use create-order + verify-payment for Razorpay flow.'
  })
  @ApiResponse({ status: 200, description: 'Money added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount or below minimum' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addMoneyToWallet(@Request() req: any, @Body() addMoneyDto: AddMoneyToWalletDto) {
    const brandId = req.user.id;
    return this.hypeStoreService.addMoneyToWallet(brandId, addMoneyDto);
  }

  @Get(':storeId')
  @ApiOperation({
    summary: 'Get store details by ID',
    description: 'Get specific store details including basic info, cashback config, and creator preferences'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreById(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreById(parseInt(storeId), brandId);
  }

  @Put(':storeId')
  @ApiOperation({
    summary: 'Update store details',
    description: 'Update store banner image, description, or active status'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateStore(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateHypeStoreDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateStore(parseInt(storeId), brandId, updateDto);
  }

  @Get(':storeId/cashback-config')
  @ApiOperation({
    summary: 'Get cashback configuration',
    description: 'Get cashback configuration for the store. Minimum cashback is fixed at Rs 100.'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Cashback config retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCashbackConfig(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCashbackConfig(parseInt(storeId), brandId);
  }

  @Put(':storeId/cashback-config')
  @ApiOperation({
    summary: 'Update cashback configuration',
    description: 'Update max cashback, cashback percentage, and monthly claim count (1-6). Minimum cashback is fixed at Rs 100 and cannot be changed. Claim strategy is automatically derived from claim count.'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Cashback config updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCashbackConfig(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateCashbackConfigDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCashbackConfig(parseInt(storeId), brandId, updateDto);
  }

  @Get(':storeId/creator-preferences')
  @ApiOperation({
    summary: 'Get creator targeting preferences',
    description: 'Get creator targeting preferences including influencer types, age, gender, niche, and locations'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Creator preferences retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCreatorPreferences(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCreatorPreferences(parseInt(storeId), brandId);
  }

  @Put(':storeId/creator-preferences')
  @ApiOperation({
    summary: 'Update creator targeting preferences',
    description: 'Update creator targeting criteria for the store'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Creator preferences updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCreatorPreferences(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateCreatorPreferenceDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCreatorPreferences(parseInt(storeId), brandId, updateDto);
  }

  @Get(':storeId/dashboard')
  @ApiOperation({
    summary: 'Get store dashboard analytics',
    description: 'Get comprehensive analytics including total orders, revenue, active creators, conversion rate, etc.'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Dashboard analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreDashboard(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreDashboard(parseInt(storeId), brandId);
  }

  @Get(':storeId/orders')
  @ApiOperation({
    summary: 'Get all orders for store',
    description: 'Get paginated list of all orders for the store'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreOrders(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreOrders(
      parseInt(storeId),
      brandId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get(':storeId/orders/:orderId')
  @ApiOperation({
    summary: 'Get order details',
    description: 'Get detailed information about a specific order'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiParam({ name: 'orderId', type: String, description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrderDetails(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getOrderDetails(parseInt(storeId), brandId, orderId);
  }
}
