import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { RequestWithUser } from '../types/request.types';
import { UserType } from './models/wallet.model';
import {
  RechargeWalletDto,
  VerifyRechargePaymentDto,
  PayInfluencerDto,
  AddCashbackDto,
  RequestRedemptionDto,
  ProcessRedemptionDto,
  GetTransactionsDto,
  WalletBalanceResponseDto,
  RechargeInitiateResponseDto,
  RechargeVerifyResponseDto,
  RedemptionRequestResponseDto,
  GetTransactionsResponseDto,
} from './dto/wallet.dto';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Get current wallet balance and statistics for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
    type: WalletBalanceResponseDto,
  })
  async getBalance(@Req() req: RequestWithUser) {
    return this.walletService.getWalletBalance(
      req.user.id,
      req.user.userType as unknown as UserType,
    );
  }

  @Post('recharge')
  @ApiOperation({
    summary: 'Initiate wallet recharge (Brands only)',
    description:
      'Create a Razorpay payment order to add money to wallet. Amount in paise (minimum 500000 paise = ₹5,000).\n\n' +
      '**Flow:**\n' +
      '1. Call this endpoint with amount in paise to create Razorpay order\n' +
      '2. Show Razorpay checkout on frontend\n' +
      '3. After payment, call POST /wallet/verify-payment\n\n' +
      '**Only brands can recharge their wallet.**',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment order created successfully',
    type: RechargeInitiateResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid amount or below minimum limit',
  })
  @ApiResponse({
    status: 403,
    description: 'Only brands can recharge wallet',
  })
  async initiateRecharge(
    @Req() req: RequestWithUser,
    @Body() dto: RechargeWalletDto,
  ) {
    return this.walletService.initiateRecharge(
      req.user.id,
      req.user.userType as unknown as UserType,
      dto,
    );
  }

  @Post('verify-payment')
  @ApiOperation({
    summary: 'Verify Razorpay payment and credit wallet',
    description:
      'After successful Razorpay payment, call this endpoint to verify the payment signature and credit the wallet.\n\n' +
      '**This must be called after user completes payment on Razorpay checkout.**',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and wallet credited',
    type: RechargeVerifyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment signature',
  })
  async verifyPayment(
    @Req() req: RequestWithUser,
    @Body() dto: VerifyRechargePaymentDto,
  ) {
    return this.walletService.verifyAndCreditRecharge(
      req.user.id,
      req.user.userType as unknown as UserType,
      dto,
    );
  }

  @Post('pay-influencer')
  @ApiOperation({
    summary: 'Pay influencer from wallet (Brands only)',
    description:
      'Deduct money from brand wallet and credit to influencer wallet as cashback.\n\n' +
      '**Use Cases:**\n' +
      '- Pay influencer for campaign deliverables\n' +
      '- Reward influencer for performance\n' +
      '- Any brand-to-influencer payment\n\n' +
      '**Requirements:**\n' +
      '- Brand must have sufficient wallet balance\n' +
      '- Amount must be > 0',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance',
  })
  @ApiResponse({
    status: 403,
    description: 'Only brands can pay influencers',
  })
  async payInfluencer(
    @Req() req: RequestWithUser,
    @Body() dto: PayInfluencerDto,
  ) {
    // Only brands can pay
    if (req.user.userType !== 'brand') {
      throw new Error('Only brands can pay influencers');
    }

    return this.walletService.payInfluencer(req.user.id, dto);
  }

  @Post('redeem')
  @ApiOperation({
    summary: 'Request wallet redemption (Influencers only)',
    description:
      'Request to withdraw money from wallet to UPI ID.\n\n' +
      '**Flow:**\n' +
      '1. Influencer requests redemption\n' +
      '2. Admin approves via POST /admin/wallet/process-redemption\n' +
      '3. Money sent to UPI within 24-48 hours\n\n' +
      '**Requirements:**\n' +
      '- Minimum redemption: ₹100\n' +
      '- Must have UPI ID set or provide one\n' +
      '- Sufficient wallet balance\n\n' +
      '**Similar to referral reward redemption flow.**',
  })
  @ApiResponse({
    status: 201,
    description: 'Redemption request submitted',
    type: RedemptionRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or invalid amount',
  })
  @ApiResponse({
    status: 403,
    description: 'Only influencers can redeem',
  })
  async requestRedemption(
    @Req() req: RequestWithUser,
    @Body() dto: RequestRedemptionDto,
  ) {
    // Only influencers can redeem
    if (req.user.userType !== 'influencer') {
      throw new Error('Only influencers can redeem from wallet');
    }

    return this.walletService.requestRedemption(req.user.id, dto);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Get paginated list of all wallet transactions with optional filters.\n\n' +
      '**Transaction Types:**\n' +
      '- recharge: Brand added money\n' +
      '- debit: Brand paid influencer\n' +
      '- cashback: Influencer received payment\n' +
      '- redemption: Influencer withdrew money\n' +
      '- refund: Money returned to wallet\n' +
      '- adjustment: Admin adjustment',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved',
    type: GetTransactionsResponseDto,
  })
  async getTransactions(
    @Req() req: RequestWithUser,
    @Query() dto: GetTransactionsDto,
  ) {
    return this.walletService.getTransactionHistory(
      req.user.id,
      req.user.userType as unknown as UserType,
      dto,
    );
  }
}
