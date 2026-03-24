import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
  IsInt,
  IsBoolean,
} from 'class-validator';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  RETURNED = 'returned',
}

export enum CashbackStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CREDITED = 'credited',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// DTO for receiving order from brand's webhook
export class CreateOrderWebhookDto {
  @ApiProperty({
    description: 'Brand order ID (unique identifier from brand system)',
    example: 'ORD-2026-12345',
  })
  @IsString()
  externalOrderId: string;

  @ApiProperty({
    description: 'Coupon code used for this order',
    example: 'MYNTRA-000123-A3F2B1',
  })
  @IsString()
  couponCode: string;

  @ApiProperty({
    description: 'Order amount in rupees',
    example: 5000.0,
  })
  @IsNumber()
  @Min(0)
  orderAmount: number;

  @ApiProperty({
    description: 'Order currency code',
    example: 'INR',
    default: 'INR',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderCurrency?: string;

  @ApiProperty({
    description: 'Order date in ISO format',
    example: '2026-03-06T10:30:00Z',
  })
  @IsDateString()
  orderDate: string;

  @ApiProperty({
    description: 'Customer email address',
    required: false,
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiProperty({
    description: 'Customer phone number',
    required: false,
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({
    description: 'Customer name',
    required: false,
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
    default: 'pending',
    required: false,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiProperty({
    description: 'Additional metadata (items, shipping address, etc.)',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New order status',
    enum: OrderStatus,
    example: 'confirmed',
  })
  @IsEnum(OrderStatus)
  orderStatus: OrderStatus;

  @ApiProperty({
    description: 'Notes about status change',
    required: false,
    example: 'Order confirmed by brand',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetOrdersQueryDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Filter by order status',
    enum: OrderStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiProperty({
    description: 'Filter by cashback status',
    enum: CashbackStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(CashbackStatus)
  cashbackStatus?: CashbackStatus;

  @ApiProperty({
    description: 'Filter by influencer ID',
    required: false,
    example: 123,
  })
  @IsOptional()
  @IsInt()
  influencerId?: number;

  @ApiProperty({
    description: 'Filter orders from date (ISO format)',
    required: false,
    example: '2026-03-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'Filter orders to date (ISO format)',
    required: false,
    example: '2026-03-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  hypeStoreId: number;

  @ApiProperty({ example: 1 })
  couponCodeId: number;

  @ApiProperty({ example: 123 })
  influencerId: number;

  @ApiProperty({ example: 'ORD-2026-12345' })
  externalOrderId: string;

  @ApiProperty({ example: 5000.0 })
  orderAmount: number;

  @ApiProperty({ example: 'INR' })
  orderCurrency: string;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  orderDate: Date;

  @ApiProperty({ example: 'customer@example.com', nullable: true })
  customerEmail: string;

  @ApiProperty({ example: '+919876543210', nullable: true })
  customerPhone: string;

  @ApiProperty({ example: 'John Doe', nullable: true })
  customerName: string;

  @ApiProperty({ example: 'confirmed', enum: OrderStatus })
  orderStatus: OrderStatus;

  @ApiProperty({ example: 2500.0 })
  cashbackAmount: number;

  @ApiProperty({ example: 'credited', enum: CashbackStatus })
  cashbackStatus: CashbackStatus;

  @ApiProperty({ example: 1, nullable: true })
  cashbackTierId: number;

  @ApiProperty({ example: 1, nullable: true })
  walletTransactionId: number;

  @ApiProperty({ example: '2026-03-06T10:30:15Z' })
  webhookReceivedAt: Date;

  @ApiProperty({ example: '2026-03-06T10:31:00Z', nullable: true })
  cashbackCreditedAt: Date;

  @ApiProperty({ nullable: true })
  metadata: Record<string, any>;

  @ApiProperty({ nullable: true })
  notes: string;

  @ApiProperty({ example: '2026-03-06T10:30:15Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-06T10:31:00Z' })
  updatedAt: Date;

  // Populated relations
  @ApiProperty({ required: false })
  influencer?: {
    id: number;
    name: string;
    username: string;
    profileImage: string;
  };

  @ApiProperty({ required: false })
  couponCode?: {
    id: number;
    couponCode: string;
  };
}

export class ProcessCashbackDto {
  @ApiProperty({
    description: 'Force process even if already processed',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiProperty({
    description: 'Notes for manual processing',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
