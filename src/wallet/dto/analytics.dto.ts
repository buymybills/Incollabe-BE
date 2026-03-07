import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsInt, Min } from 'class-validator';

export class GetAnalyticsDto {
  @ApiProperty({
    description: 'Start date for analytics range (ISO format)',
    required: false,
    example: '2026-03-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'End date for analytics range (ISO format)',
    required: false,
    example: '2026-03-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AnalyticsResponseDto {
  @ApiProperty({ example: 150 })
  totalOrders: number;

  @ApiProperty({ example: 750000.0 })
  totalRevenue: number;

  @ApiProperty({ example: 37500.0 })
  totalCashbackGiven: number;

  @ApiProperty({ example: 5000.0 })
  averageOrderValue: number;

  @ApiProperty({ example: 250.0 })
  averageCashbackPerOrder: number;

  @ApiProperty({ example: 75.5, description: 'Percentage of coupons that resulted in orders' })
  conversionRate: number;

  @ApiProperty({
    description: 'Top influencers by revenue',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        influencerId: { type: 'number', example: 123 },
        influencerName: { type: 'string', example: 'John Doe' },
        influencerUsername: { type: 'string', example: 'johndoe' },
        totalOrders: { type: 'number', example: 25 },
        totalRevenue: { type: 'number', example: 125000.0 },
        totalCashback: { type: 'number', example: 6250.0 },
      },
    },
  })
  topInfluencers: Array<{
    influencerId: number;
    influencerName: string;
    influencerUsername: string;
    totalOrders: number;
    totalRevenue: number;
    totalCashback: number;
  }>;

  @ApiProperty({
    description: 'Orders by status breakdown',
    example: {
      pending: 10,
      confirmed: 100,
      shipped: 25,
      delivered: 15,
      cancelled: 0,
      refunded: 0,
      returned: 0,
    },
  })
  ordersByStatus: Record<string, number>;

  @ApiProperty({
    description: 'Cashback by status breakdown',
    example: {
      pending: 5,
      processing: 3,
      credited: 142,
      failed: 0,
      cancelled: 0,
    },
  })
  cashbackByStatus: Record<string, number>;

  @ApiProperty({
    description: 'Revenue by date',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        date: { type: 'string', example: '2026-03-06' },
        revenue: { type: 'number', example: 25000.0 },
        orders: { type: 'number', example: 5 },
        cashback: { type: 'number', example: 1250.0 },
      },
    },
  })
  revenueByDate: Array<{
    date: string;
    revenue: number;
    orders: number;
    cashback: number;
  }>;
}

export class InfluencerPerformanceDto {
  @ApiProperty({ example: 123 })
  influencerId: number;

  @ApiProperty({ example: 'John Doe' })
  influencerName: string;

  @ApiProperty({ example: 'johndoe' })
  influencerUsername: string;

  @ApiProperty({ example: 25 })
  totalOrders: number;

  @ApiProperty({ example: 125000.0 })
  totalRevenue: number;

  @ApiProperty({ example: 6250.0 })
  totalCashbackEarned: number;

  @ApiProperty({ example: 5000.0 })
  averageOrderValue: number;

  @ApiProperty({ example: '2026-03-01T10:30:00Z' })
  firstOrderDate: Date;

  @ApiProperty({ example: '2026-03-30T15:45:00Z' })
  lastOrderDate: Date;
}

export class CouponPerformanceDto {
  @ApiProperty({ example: 1 })
  couponCodeId: number;

  @ApiProperty({ example: 'MYNTRA-000123-A3F2B1' })
  couponCode: string;

  @ApiProperty({ example: 123 })
  influencerId: number;

  @ApiProperty({ example: 15 })
  totalUses: number;

  @ApiProperty({ example: 10 })
  totalOrders: number;

  @ApiProperty({ example: 50000.0 })
  totalRevenue: number;

  @ApiProperty({ example: 2500.0 })
  totalCashback: number;

  @ApiProperty({ example: 66.67, description: 'Percentage of uses that resulted in orders' })
  conversionRate: number;
}
