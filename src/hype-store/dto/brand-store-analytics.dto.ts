import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
    required: false,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Number of items to skip',
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class StoreOrderDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  customerName: string;

  @ApiProperty({ example: 'ORD123456' })
  orderId: string;

  @ApiProperty({ example: 'SAVE20' })
  couponUsed: string;

  @ApiProperty({ example: 2500.00 })
  orderValue: number;

  @ApiProperty({ example: 500.00 })
  cashbackAmount: number;

  @ApiProperty({ example: '2026-03-15T10:00:00.000Z' })
  orderDate: string;

  @ApiProperty({ example: 'credited', enum: ['pending', 'processing', 'credited', 'failed'] })
  cashbackStatus: string;
}

export class StoreInfoDto {
  @ApiProperty({ example: 400 })
  totalOrders: number;

  @ApiProperty({ example: 4260000 })
  totalSales: number;

  @ApiProperty({ example: 110000 })
  currentWalletAmount: number;
}

export class StoreOrdersResponseDto {
  @ApiProperty({ type: [StoreOrderDto] })
  orders: StoreOrderDto[];

  @ApiProperty({ example: 400 })
  total: number;

  @ApiProperty({ type: StoreInfoDto })
  storeInfo: StoreInfoDto;
}

export class PerformanceMetricDto {
  @ApiProperty({ example: 1.4 })
  value: number;

  @ApiProperty({ example: '1.4x' })
  formatted: string;

  @ApiProperty({ example: 'Elite', enum: ['Elite', 'Good', 'Average'] })
  rating: string;
}

export class CashbackRangeDto {
  @ApiProperty({ example: 4000 })
  maximum: number;

  @ApiProperty({ example: 200 })
  minimum: number;
}

export class CashbackConfigDto {
  @ApiProperty({ example: 3 })
  claimCountPerCreator: number;

  @ApiProperty({ type: CashbackRangeDto })
  reelPost: CashbackRangeDto;

  @ApiProperty({ type: CashbackRangeDto })
  story: CashbackRangeDto;
}

export class WalletStatsDto {
  @ApiProperty({ example: 110000 })
  currentAmount: number;

  @ApiProperty({ example: 110000 })
  totalCashbackUsed: number;

  @ApiProperty({ example: 400 })
  totalOrders: number;

  @ApiProperty({ example: 4260000 })
  totalSales: number;
}

export class StoreBasicInfoDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Myntra Fashion Store' })
  storeName: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class PerformanceMetricsDto {
  @ApiProperty({ type: PerformanceMetricDto })
  expectedROI: PerformanceMetricDto;

  @ApiProperty({ type: PerformanceMetricDto })
  estimatedEngagement: PerformanceMetricDto;

  @ApiProperty({ type: PerformanceMetricDto })
  estimatedReach: PerformanceMetricDto;
}

export class StoreDetailPerformanceResponseDto {
  @ApiProperty({ type: StoreBasicInfoDto })
  storeInfo: StoreBasicInfoDto;

  @ApiProperty({ type: PerformanceMetricsDto })
  performanceMetrics: PerformanceMetricsDto;

  @ApiProperty({ type: CashbackConfigDto })
  cashbackConfig: CashbackConfigDto;

  @ApiProperty({ type: WalletStatsDto })
  walletStats: WalletStatsDto;
}

export class WalletTransactionDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: '#12' })
  transactionNumber: string;

  @ApiProperty({ example: 'Wallet recharge' })
  type: string;

  @ApiProperty({ example: 36000 })
  amount: number;

  @ApiProperty({ example: 136000 })
  balance: number;

  @ApiProperty({ example: 'successful', enum: ['successful', 'failed', 'pending', 'processing'] })
  status: string;

  @ApiProperty({ example: '2026-03-22T01:54:00.000Z' })
  date: string;

  @ApiProperty({ example: 'order_123456', required: false })
  paymentOrderId?: string;

  @ApiProperty({ example: 'pay_789012', required: false })
  paymentTransactionId?: string;

  @ApiProperty({ example: 'Wallet recharged via Razorpay', required: false })
  description?: string;

  @ApiProperty({ example: 'Payment gateway error', required: false })
  failedReason?: string;
}

export class WalletTransactionsResponseDto {
  @ApiProperty({ type: [WalletTransactionDto] })
  transactions: WalletTransactionDto[];

  @ApiProperty({ example: 50 })
  total: number;
}
