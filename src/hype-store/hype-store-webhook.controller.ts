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
      '**Event Types:**\n' +
      '- `purchase`: When a customer makes a purchase using an influencer\'s coupon\n' +
      '- `return`: When a customer returns a product or gets a refund\n\n' +
      '**Idempotency:**\n' +
      'Duplicate purchase requests with the same externalOrderId will be safely ignored and return the original order details.\n\n' +
      '**Cashback:**\n' +
      '- Purchase: Cashback is automatically calculated based on influencer tier\n' +
      '- Return: If cashback was credited, it will be automatically reversed',
  })
  @ApiParam({
    name: 'apiKey',
    description: 'Brand store API key (obtained from store creation response)',
    example: 'hs_live_a1b2c3d4e5f6g7h8i9j0',
  })
  @ApiBody({
    type: UnifiedWebhookDto,
    description: 'Order event data',
    examples: {
      purchase: {
        summary: 'Purchase Event',
        description: 'Customer made a purchase using influencer coupon',
        value: {
          eventType: 'purchase',
          externalOrderId: 'ORD-2026-12345',
          couponCode: 'MYNTRA-000123-A3F2B1',
          orderAmount: 5000.0,
          orderDate: '2026-03-17T10:30:00Z',
          customerEmail: 'customer@example.com',
          customerPhone: '+919876543210',
          orderTitle: 'Blue Shirt',
          orderStatus: 'confirmed',
        },
      },
      purchaseWithReferral: {
        summary: 'Purchase with Referral Code',
        description: 'Purchase using brand-shared coupon with influencer referral code',
        value: {
          eventType: 'purchase',
          externalOrderId: 'ORD-2026-12346',
          couponCode: 'SNITCHCOLLABKAROO',
          referralCode: 'INFL15',
          orderAmount: 12500.0,
          orderDate: '2026-03-17T14:15:00Z',
          customerName: 'Rajesh Kumar',
        },
      },
      return: {
        summary: 'Return Event',
        description: 'Customer returned a product',
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
        description: 'Customer returned part of the order',
        value: {
          eventType: 'return',
          externalOrderId: 'ORD-2026-12346',
          returnAmount: 2500.0,
          returnDate: '2026-03-20T14:00:00Z',
          returnReason: 'Customer requested partial refund',
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
