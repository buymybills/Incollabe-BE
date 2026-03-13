import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { OrderStatus } from './hype-store-order.dto';

/**
 * Webhook DTO for purchase events
 * Sent by brand when a customer makes a purchase using an influencer's coupon
 */
export class PurchaseWebhookDto {
  @ApiProperty({
    description: 'Brand order ID (unique identifier from brand system)',
    example: 'ORD-2026-12345',
  })
  @IsString()
  externalOrderId: string;

  @ApiProperty({
    description: 'Coupon code used for this order',
    example: 'SNITCHCOLLABKAROO',
  })
  @IsString()
  couponCode: string;

  @ApiProperty({
    description: 'Referral code to identify which influencer referred this customer (required for brand-shared coupons)',
    example: 'INFL15',
    required: false,
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiProperty({
    description: 'Order/Product title',
    example: 'JBL Tune 770NC Active Noise Cancelling Headphones',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderTitle?: string;

  @ApiProperty({
    description: 'Order amount in rupees',
    example: 5000.0,
  })
  @IsNumber()
  @Min(0)
  orderAmount: number;

  @ApiProperty({
    description: 'Cashback type/description (e.g., "Flat 20%", "₹500 off")',
    example: 'Flat 20%',
    required: false,
  })
  @IsOptional()
  @IsString()
  cashbackType?: string;

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

  @ApiProperty({
    description: 'Return period duration in days (defaults to 30 if not provided)',
    example: 30,
    default: 30,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  returnPeriodDays?: number;
}

/**
 * Webhook DTO for return/refund events
 * Sent by brand when a customer returns a product or gets a refund
 */
export class ReturnWebhookDto {
  @ApiProperty({
    description: 'Brand order ID to process return for',
    example: 'ORD-2026-12345',
  })
  @IsString()
  externalOrderId: string;

  @ApiProperty({
    description: 'Return/refund amount in rupees',
    example: 5000.0,
  })
  @IsNumber()
  @Min(0)
  returnAmount: number;

  @ApiProperty({
    description: 'Return date in ISO format',
    example: '2026-03-15T14:30:00Z',
  })
  @IsDateString()
  returnDate: string;

  @ApiProperty({
    description: 'Reason for return',
    required: false,
    example: 'Product defective',
  })
  @IsOptional()
  @IsString()
  returnReason?: string;

  @ApiProperty({
    description: 'Additional metadata about the return',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * Response DTO for webhook endpoints
 */
export class WebhookResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Order processed successfully' })
  message: string;

  @ApiProperty({ example: 1 })
  orderId?: number;

  @ApiProperty({ example: 2500.0 })
  cashbackAmount?: number;

  @ApiProperty({ example: 'credited' })
  cashbackStatus?: string;
}
