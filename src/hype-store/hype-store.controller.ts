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
import { HypeStoreService } from './hype-store.service';
import { CreateHypeStoreDto, UpdateHypeStoreDto } from './dto/create-hype-store.dto';
import { UpdateCashbackConfigDto } from './dto/cashback-config.dto';
import { AddMoneyToWalletDto } from './dto/wallet.dto';
import { UpdateCreatorPreferenceDto } from './dto/creator-preference.dto';
import { CASHBACK_CLAIM_STRATEGIES } from './constants/cashback-strategies';
import { CreateWalletRechargeOrderDto, VerifyWalletPaymentDto } from './dto/wallet.dto';

@Controller('api/brand/hype-store')
export class HypeStoreController {
  constructor(private readonly hypeStoreService: HypeStoreService) {}

  /**
   * Get available cashback claim strategies
   * GET /api/brand/hype-store/cashback-strategies
   */
  @Get('cashback-strategies')
  getCashbackStrategies() {
    return {
      strategies: CASHBACK_CLAIM_STRATEGIES,
    };
  }

  /**
   * Create a new Hype Store
   * POST /api/brand/hype-store/create
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createStore(@Request() req: any, @Body() createDto: CreateHypeStoreDto) {
    const brandId = req.user.id; // Assumes brand ID is in req.user from auth guard
    return this.hypeStoreService.createStore(brandId, createDto);
  }

  /**
   * Get all stores for current brand
   * GET /api/brand/hype-store
   */
  @Get()
  async getMyStores(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoresByBrandId(brandId);
  }

  /**
   * Get wallet balance
   * GET /api/brand/hype-store/wallet/balance
   */
  @Get('wallet/balance')
  async getWalletBalance(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getWalletBalance(brandId);
  }

  /**
   * Get wallet transaction history
   * GET /api/brand/hype-store/wallet/transactions
   */
  @Get('wallet/transactions')
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

  /**
   * Create Razorpay order for wallet recharge
   * POST /api/brand/hype-store/wallet/create-order
   */
  @Post('wallet/create-order')
  @HttpCode(HttpStatus.OK)
  async createWalletRechargeOrder(
    @Request() req: any,
    @Body() createOrderDto: CreateWalletRechargeOrderDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.createWalletRechargeOrder(brandId, createOrderDto.amount);
  }

  /**
   * Verify Razorpay payment and add money to wallet
   * POST /api/brand/hype-store/wallet/verify-payment
   */
  @Post('wallet/verify-payment')
  @HttpCode(HttpStatus.OK)
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

  /**
   * Add money to wallet (Legacy - for manual/admin additions)
   * POST /api/brand/hype-store/wallet/add-money
   */
  @Post('wallet/add-money')
  async addMoneyToWallet(@Request() req: any, @Body() addMoneyDto: AddMoneyToWalletDto) {
    const brandId = req.user.id;
    return this.hypeStoreService.addMoneyToWallet(brandId, addMoneyDto);
  }

  /**
   * Get specific store by ID
   * GET /api/brand/hype-store/:storeId
   */
  @Get(':storeId')
  async getStoreById(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreById(parseInt(storeId), brandId);
  }

  /**
   * Update store details
   * PUT /api/brand/hype-store/:storeId
   */
  @Put(':storeId')
  async updateStore(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateHypeStoreDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateStore(parseInt(storeId), brandId, updateDto);
  }

  /**
   * Get cashback configuration
   * GET /api/brand/hype-store/:storeId/cashback-config
   */
  @Get(':storeId/cashback-config')
  async getCashbackConfig(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCashbackConfig(parseInt(storeId), brandId);
  }

  /**
   * Update cashback configuration
   * PUT /api/brand/hype-store/:storeId/cashback-config
   */
  @Put(':storeId/cashback-config')
  async updateCashbackConfig(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateCashbackConfigDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCashbackConfig(parseInt(storeId), brandId, updateDto);
  }

  /**
   * Get creator preferences
   * GET /api/brand/hype-store/:storeId/creator-preferences
   */
  @Get(':storeId/creator-preferences')
  async getCreatorPreferences(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCreatorPreferences(parseInt(storeId), brandId);
  }

  /**
   * Update creator preferences
   * PUT /api/brand/hype-store/:storeId/creator-preferences
   */
  @Put(':storeId/creator-preferences')
  async updateCreatorPreferences(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateCreatorPreferenceDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCreatorPreferences(parseInt(storeId), brandId, updateDto);
  }

  /**
   * Get store dashboard with analytics
   * GET /api/brand/hype-store/:storeId/dashboard
   */
  @Get(':storeId/dashboard')
  async getStoreDashboard(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreDashboard(parseInt(storeId), brandId);
  }

  /**
   * Get all orders for a store
   * GET /api/brand/hype-store/:storeId/orders
   */
  @Get(':storeId/orders')
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

  /**
   * Get order details
   * GET /api/brand/hype-store/:storeId/orders/:orderId
   */
  @Get(':storeId/orders/:orderId')
  async getOrderDetails(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getOrderDetails(parseInt(storeId), brandId, orderId);
  }
}
