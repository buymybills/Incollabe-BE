import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
  Min,
  ValidateIf,
} from 'class-validator';
import { OrderStatus } from './hype-store-order.dto';

/**
 * Event types for unified webhook
 */
export enum WebhookEventType {
  PURCHASE = 'purchase',
  RETURN = 'return',
}

/**
 * Unified webhook DTO for both purchase and return events
 * Sent by brand when order events occur
 */
export class UnifiedWebhookDto {
  @ApiProperty({
    description: 'Event type: purchase or return',
    enum: WebhookEventType,
    example: 'purchase',
  })
  @IsEnum(WebhookEventType)
  eventType: WebhookEventType;

  @ApiProperty({
    description: 'Brand order ID (unique identifier from brand system)',
    example: 'ORD-2026-12345',
  })
  @IsString()
  externalOrderId: string;

  // Purchase-specific fields (required when eventType = 'purchase')
  @ApiProperty({
    description: 'Coupon code used for this order (required for purchase events)',
    example: 'SNITCHCOLLABKAROO',
    required: false,
  })
  @ValidateIf((o) => o.eventType === WebhookEventType.PURCHASE)
  @IsString()
  couponCode?: string;

  @ApiProperty({
    description: 'Referral code to identify which influencer referred this customer (required for brand-shared coupons)',
    example: 'INFL15',
    required: false,
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiProperty({
    description: 'Order/Product title (required for purchase events)',
    example: 'JBL Tune 770NC Active Noise Cancelling Headphones',
    required: false,
  })
  @ValidateIf((o) => o.eventType === WebhookEventType.PURCHASE)
  @IsString()
  orderTitle?: string;

  @ApiProperty({
    description: 'Product SKU/Item Code',
    example: 'JBL-770NC-BLK',
    required: false,
  })
  @IsOptional()
  @IsString()
  productSKU?: string;

  @ApiProperty({
    description: 'Product category',
    example: 'Electronics',
    required: false,
  })
  @IsOptional()
  @IsString()
  productCategory?: string;

  @ApiProperty({
    description: 'Product brand name',
    example: 'JBL',
    required: false,
  })
  @IsOptional()
  @IsString()
  productBrand?: string;

  @ApiProperty({
    description: 'Product variant (size, color, etc.)',
    example: 'Black - Wireless',
    required: false,
  })
  @IsOptional()
  @IsString()
  productVariant?: string;

  @ApiProperty({
    description: 'Product image URL',
    example: 'https://example.com/products/jbl-770nc.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  productImageUrl?: string;

  @ApiProperty({
    description: 'Product quantity',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  productQuantity?: number;

  @ApiProperty({
    description: 'Order amount in rupees (required for purchase events)',
    example: 5000.0,
    required: false,
  })
  @ValidateIf((o) => o.eventType === WebhookEventType.PURCHASE)
  @IsNumber()
  @Min(0)
  orderAmount?: number;

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
    description: 'Order date in ISO format (required for purchase events)',
    example: '2026-03-06T10:30:00Z',
    required: false,
  })
  @ValidateIf((o) => o.eventType === WebhookEventType.PURCHASE)
  @IsDateString()
  orderDate?: string;

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
    description: 'Return period duration in days (defaults to 30 if not provided)',
    example: 30,
    default: 30,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  returnPeriodDays?: number;

  // Return-specific fields (required when eventType = 'return')
  @ApiProperty({
    description: 'Return/refund amount in rupees (required for return events)',
    example: 5000.0,
    required: false,
  })
  @ValidateIf((o) => o.eventType === WebhookEventType.RETURN)
  @IsNumber()
  @Min(0)
  returnAmount?: number;

  @ApiProperty({
    description: 'Return date in ISO format (required for return events)',
    example: '2026-03-15T14:30:00Z',
    required: false,
  })
  @ValidateIf((o) => o.eventType === WebhookEventType.RETURN)
  @IsDateString()
  returnDate?: string;

  @ApiProperty({
    description: 'Reason for return',
    required: false,
    example: 'Product defective',
  })
  @IsOptional()
  @IsString()
  returnReason?: string;

  // Common fields
  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

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
  })
  @IsString()
  orderTitle: string;

  @ApiProperty({
    description: 'Product SKU/Item Code',
    example: 'JBL-770NC-BLK',
    required: false,
  })
  @IsOptional()
  @IsString()
  productSKU?: string;

  @ApiProperty({
    description: 'Product category',
    example: 'Electronics',
    required: false,
  })
  @IsOptional()
  @IsString()
  productCategory?: string;

  @ApiProperty({
    description: 'Product brand name',
    example: 'JBL',
    required: false,
  })
  @IsOptional()
  @IsString()
  productBrand?: string;

  @ApiProperty({
    description: 'Product variant (size, color, etc.)',
    example: 'Black - Wireless',
    required: false,
  })
  @IsOptional()
  @IsString()
  productVariant?: string;

  @ApiProperty({
    description: 'Product image URL',
    example: 'https://example.com/products/jbl-770nc.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  productImageUrl?: string;

  @ApiProperty({
    description: 'Product quantity',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  productQuantity?: number;

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
