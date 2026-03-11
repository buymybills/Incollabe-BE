import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  IsInt,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType, TransactionStatus } from '../models/wallet-transaction.model';

// ==================== RECHARGE DTOs ====================

export class RechargeWalletDto {
  @ApiProperty({
    description: 'Amount to recharge (minimum ₹5,000)',
    example: 10000,
    minimum: 5000,
  })
  @IsNumber()
  @Min(5000, { message: 'Minimum recharge amount is ₹5,000' })
  amount: number;

  @ApiProperty({
    description: 'Optional notes for this recharge',
    example: 'Recharge for campaign payments',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyRechargePaymentDto {
  @ApiProperty({
    description: 'Razorpay order ID',
    example: 'order_MNqwertyuiop1234',
  })
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({
    description: 'Razorpay payment ID',
    example: 'pay_MNqwertyuiop5678',
  })
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({
    description: 'Razorpay signature for verification',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  @IsString()
  razorpaySignature: string;
}

// ==================== PAYMENT DTOs ====================

export class PayInfluencerDto {
  @ApiProperty({
    description: 'Influencer ID to pay',
    example: 123,
  })
  @IsInt()
  influencerId: number;

  @ApiProperty({
    description: 'Amount to pay',
    example: 5000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Campaign ID (optional)',
    example: 456,
    required: false,
  })
  @IsOptional()
  @IsInt()
  campaignId?: number;

  @ApiProperty({
    description: 'Payment description',
    example: 'Payment for campaign deliverables',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Additional notes (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ==================== CASHBACK DTOs ====================

export class AddCashbackDto {
  @ApiProperty({
    description: 'Influencer ID to credit cashback',
    example: 123,
  })
  @IsInt()
  influencerId: number;

  @ApiProperty({
    description: 'Cashback amount',
    example: 500,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Hype Store ID (optional)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  hypeStoreId?: number;

  @ApiProperty({
    description: 'Cashback description',
    example: 'Cashback for purchase from XYZ Store',
  })
  @IsString()
  description: string;
}

// ==================== REDEMPTION DTOs ====================

export class RequestRedemptionDto {
  @ApiProperty({
    description: 'UPI ID for payout (optional, uses default if not provided)',
    example: '9876543210@paytm',
    required: false,
  })
  @IsOptional()
  @IsString()
  upiId?: string;

  @ApiProperty({
    description: 'Amount to redeem (optional, redeems full balance if not provided)',
    example: 5000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Minimum redemption amount is ₹100' })
  amount?: number;
}

export class ProcessRedemptionDto {
  @ApiProperty({
    description: 'Transaction ID to process',
    example: 123,
  })
  @IsInt()
  transactionId: number;

  @ApiProperty({
    description: 'Action to perform',
    enum: ['approve', 'reject'],
    example: 'approve',
  })
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @ApiProperty({
    description: 'Admin notes (optional)',
    example: 'Approved and processed via Razorpay',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

// ==================== QUERY DTOs ====================

export class GetTransactionsDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Filter by transaction type',
    enum: TransactionType,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: 'Filter by status',
    enum: TransactionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}

// ==================== RESPONSE DTOs ====================

export class WalletBalanceResponseDto {
  @ApiProperty({ example: 25000 })
  balance: number;

  @ApiProperty({ example: 50000 })
  totalCredited: number;

  @ApiProperty({ example: 25000 })
  totalDebited: number;

  @ApiProperty({ example: 5000 })
  totalCashbackReceived: number;

  @ApiProperty({ example: 2000 })
  totalRedeemed: number;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class RechargeInitiateResponseDto {
  @ApiProperty({ example: 'wallet_recharge_92_1709805600000' })
  id: string;

  @ApiProperty({
    example: {
      orderId: 'order_MNqwertyuiop1234',
      amount: 1000000,
      currency: 'INR',
      keyId: 'rzp_test_abc123',
    },
  })
  payment: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
}

export class RechargeVerifyResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Wallet recharged successfully' })
  message: string;

  @ApiProperty({ example: 10000 })
  amountCredited: number;

  @ApiProperty({ example: 35000 })
  newBalance: number;

  @ApiProperty({ example: 123 })
  transactionId: number;
}

export class RedemptionRequestResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Redemption request submitted successfully' })
  message: string;

  @ApiProperty({ example: 5000 })
  amountRequested: number;

  @ApiProperty({ example: '9876543210@paytm' })
  upiId: string;

  @ApiProperty({ example: 456 })
  transactionId: number;
}

export class TransactionItemDto {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({ enum: TransactionType, example: 'recharge' })
  transactionType: TransactionType;

  @ApiProperty({ example: 10000 })
  amount: number;

  @ApiProperty({ example: 25000 })
  balanceBefore: number;

  @ApiProperty({ example: 35000 })
  balanceAfter: number;

  @ApiProperty({ enum: TransactionStatus, example: 'completed' })
  status: TransactionStatus;

  @ApiProperty({ example: 'Wallet recharge via Razorpay' })
  description: string;

  @ApiProperty({ example: '2026-03-05T10:30:00Z' })
  createdAt: Date;
}

export class GetTransactionsResponseDto {
  @ApiProperty({ type: [TransactionItemDto] })
  transactions: TransactionItemDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
