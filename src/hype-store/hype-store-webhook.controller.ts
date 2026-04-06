import {
  Controller,
  Post,
  Body,
  Param,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { HypeStoreService } from './hype-store.service';
import { UnifiedWebhookDto, WebhookResponseDto, WebhookEventType } from '../wallet/dto/hype-store-webhook.dto';

/**
 * Public webhook controller for receiving order events from brand systems
 * No authentication guard - uses API key verification only
 */
@ApiTags('Hype Store Webhooks (Public)')
@Controller('webhooks/hype-store')
export class HypeStoreWebhookController {
  constructor(private readonly hypeStoreService: HypeStoreService) {}

  @Post(':apiKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive order events from brand (Public endpoint)',
    description:
      'Unified endpoint for all order events (purchase, return, etc.).\n\n' +
      '**Authentication:**\n' +
      '- API Key: Passed in URL path (:apiKey parameter) - obtained from store creation response\n\n' +
      '**Required Fields for Purchase:**\n' +
      '- `eventType`: Must be "purchase" or "return"\n' +
      '- `externalOrderId`: Your unique order ID\n' +
      '- `couponCode`: The coupon code used (e.g., SNCOL12, SNITCHCOLLABKAROO)\n' +
      '- `referralCode`: Influencer referral code for attribution (e.g., INFL123)\n' +
      '- `orderTitle`: Product/order name\n' +
      '- `orderAmount`: Order amount in rupees\n' +
      '- `orderDate`: ISO 8601 date format\n\n' +
      '**Product Details (Optional but Recommended):**\n' +
      '- `productSKU`, `productCategory`, `productBrand`, `productVariant`, `productImageUrl`, `productQuantity`\n\n' +
      '**Return Window:**\n' +
      '- `returnPeriodDays`: Number of days for return window (default: 30 days)\n' +
      '- Cashback is locked until return period expires\n\n' +
      '**Event Types:**\n' +
      '- `purchase`: When a customer makes a purchase using an influencer\'s coupon\n' +
      '- `return`: When a customer returns a product or gets a refund\n\n' +
      '**Idempotency:**\n' +
      'Duplicate purchase requests with the same externalOrderId will be safely ignored and return the original order details.\n\n' +
      '**Cashback:**\n' +
      '- Purchase: Cashback is automatically calculated based on influencer tier\n' +
      '- Cashback Type: Auto-derived from coupon code (e.g., SNCOL12 → "Flat 12%")\n' +
      '- Return: If cashback was credited, it will be automatically reversed',
  })
  @ApiParam({
    name: 'apiKey',
    description: 'Brand store API key (obtained from store creation response)',
    example: 'hs_live_a1b2c3d4e5f6g7h8i9j0',
  })
  @ApiBody({
    type: UnifiedWebhookDto,
    description: 'Order event data. Both couponCode and referralCode are required for proper influencer attribution.',
    examples: {
      purchaseMinimal: {
        summary: 'Minimal Purchase (Required Fields Only)',
        description: 'Minimum required fields for a purchase event',
        value: {
          eventType: 'purchase',
          externalOrderId: 'ORD-2026-12345',
          couponCode: 'SNCOL12',
          referralCode: 'INFL123',
          orderTitle: 'Men\'s Cotton Shirt - Blue',
          orderAmount: 3500.0,
          orderDate: '2026-03-17T10:30:00Z',
        },
      },
      purchaseComplete: {
        summary: 'Complete Purchase Event (All Product Details)',
        description: 'Purchase event with all product details, customer info, and return window',
        value: {
          eventType: 'purchase',
          externalOrderId: 'ORD-2026-12346',
          couponCode: 'SNCOL12',
          referralCode: 'INFL123',
          orderTitle: 'Men\'s Premium Cotton Shirt - Blue Denim',
          productSKU: 'SHIRT-BLU-L-2026',
          productCategory: 'Clothing',
          productBrand: 'Snitch',
          productVariant: 'Blue - Size L',
          productImageUrl: 'https://example.com/products/blue-shirt.jpg',
          productQuantity: 1,
          orderAmount: 5000.0,
          orderCurrency: 'INR',
          orderDate: '2026-03-17T10:30:00Z',
          orderStatus: 'confirmed',
          returnPeriodDays: 30,
          customerName: 'Rajesh Kumar',
          customerEmail: 'rajesh@example.com',
          customerPhone: '+919876543210',
        },
      },
      purchaseBrandShared: {
        summary: 'Brand-Shared Coupon Purchase',
        description: 'Purchase using brand-shared coupon (like SNITCHCOLLABKAROO) with influencer referral code for attribution',
        value: {
          eventType: 'purchase',
          externalOrderId: 'ORD-2026-12347',
          couponCode: 'SNITCHCOLLABKAROO',
          referralCode: 'INFL456',
          orderTitle: 'Winter Jacket - Black',
          productSKU: 'JKT-BLK-M-001',
          productCategory: 'Outerwear',
          productBrand: 'Snitch',
          productVariant: 'Black - Medium',
          productImageUrl: 'https://example.com/jacket.jpg',
          productQuantity: 1,
          orderAmount: 12500.0,
          orderDate: '2026-03-17T14:15:00Z',
          returnPeriodDays: 45,
          customerName: 'Priya Sharma',
          customerEmail: 'priya@example.com',
          customerPhone: '+919876543210',
        },
      },
      purchaseMultiProduct: {
        summary: 'Multi-Item Purchase',
        description: 'Purchase with multiple items using metadata for detailed item breakdown',
        value: {
          eventType: 'purchase',
          externalOrderId: 'ORD-2026-12348',
          couponCode: 'SNCOL12',
          referralCode: 'INFL789',
          orderTitle: 'Winter Combo - Jacket + Jeans',
          productCategory: 'Combo',
          productQuantity: 2,
          orderAmount: 15000.0,
          orderDate: '2026-03-17T16:00:00Z',
          returnPeriodDays: 30,
          customerName: 'Amit Verma',
          customerEmail: 'amit@example.com',
          metadata: {
            items: [
              { sku: 'JKT-001', name: 'Winter Jacket', price: 8000, quantity: 1 },
              { sku: 'JEANS-002', name: 'Denim Jeans', price: 7000, quantity: 1 },
            ],
            paymentMethod: 'Credit Card',
            appliedDiscount: 2000,
          },
        },
      },
      return: {
        summary: 'Return Event',
        description: 'Customer returned a product - cashback will be automatically reversed',
        value: {
          eventType: 'return',
          externalOrderId: 'ORD-2026-12345',
          returnAmount: 5000.0,
          returnDate: '2026-03-20T16:00:00Z',
          returnReason: 'Product defective - size mismatch',
        },
      },
      partialReturn: {
        summary: 'Partial Return',
        description: 'Customer returned part of the order - proportional cashback will be reversed',
        value: {
          eventType: 'return',
          externalOrderId: 'ORD-2026-12346',
          returnAmount: 2500.0,
          returnDate: '2026-03-20T14:00:00Z',
          returnReason: 'One item damaged, keeping the other',
          metadata: {
            returnedItems: ['SHIRT-001'],
            retainedItems: ['JEANS-002'],
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Event processed successfully',
    type: WebhookResponseDto,
    schema: {
      oneOf: [
        {
          title: 'Purchase Response',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Order processed successfully' },
            orderId: { type: 'number', example: 123 },
            cashbackAmount: { type: 'number', example: 2500.0 },
            cashbackStatus: { type: 'string', example: 'pending' },
          },
        },
        {
          title: 'Return Response',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Return processed successfully' },
            orderId: { type: 'number', example: 123 },
            cashbackReversed: { type: 'boolean', example: true },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or coupon code',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid or inactive coupon code' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API key',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid API key' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found (for return events)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
      },
    },
  })
  async receiveWebhook(
    @Param('apiKey') apiKey: string,
    @Body() webhookDto: UnifiedWebhookDto,
    @Ip() ipAddress: string,
  ) {
    return this.hypeStoreService.processWebhook(apiKey, webhookDto, ipAddress);
  }
}
