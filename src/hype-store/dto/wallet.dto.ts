import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreateWalletRechargeOrderDto {
  @IsNumber()
  @Min(5000, { message: 'Minimum wallet recharge is ₹5000' })
  amount: number;
}

export class VerifyWalletPaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  paymentId: string;

  @IsString()
  signature: string;
}

export class AddMoneyToWalletDto {
  @IsNumber()
  @Min(5000, { message: 'Minimum wallet recharge is ₹5000' })
  amount: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReferenceId?: string;

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
