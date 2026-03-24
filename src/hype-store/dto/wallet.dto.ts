import { IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWalletRechargeOrderDto {
  @ApiProperty({
    description: 'Amount to add to wallet in Rs (minimum 5000)',
    example: 10000,
    minimum: 5000,
    type: Number
  })
  @IsNumber()
  @Min(5000, { message: 'Minimum wallet recharge is ₹5000' })
  amount: number;
}

export class VerifyWalletPaymentDto {
  @ApiProperty({
    description: 'Razorpay order ID received from create-order API',
    example: 'order_NXt7aB3kEFG9H2',
    type: String
  })
  @IsString()
  orderId: string;

  @ApiProperty({
    description: 'Razorpay payment ID received after successful payment',
    example: 'pay_NXt7aB3kEFG9H2',
    type: String
  })
  @IsString()
  paymentId: string;

  @ApiProperty({
    description: 'Razorpay signature received after successful payment for verification',
    example: 'a8b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
    type: String
  })
  @IsString()
  signature: string;
}

export class AddMoneyToWalletDto {
  @ApiProperty({
    description: 'Amount to add to wallet in Rs (minimum 5000)',
    example: 10000,
    minimum: 5000,
    type: Number
  })
  @IsNumber()
  @Min(5000, { message: 'Minimum wallet recharge is ₹5000' })
  amount: number;

  @ApiProperty({
    description: 'Payment method used (optional)',
    example: 'razorpay',
    required: false,
    type: String
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({
    description: 'Payment reference ID from payment gateway (optional)',
    example: 'pay_NXt7aB3kEFG9H2',
    required: false,
    type: String
  })
  @IsOptional()
  @IsString()
  paymentReferenceId?: string;

  @ApiProperty({
    description: 'Description for the transaction (optional)',
    example: 'Manual wallet recharge',
    required: false,
    type: String
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class WalletBalanceResponseDto {
  balance: number;
  totalAdded: number;
  totalSpent: number;
  brandId: number;
}

export class WalletTransactionResponseDto {
  id: number;
  transactionType: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  paymentMethod: string;
  paymentReferenceId: string;
  createdAt: Date;
}
