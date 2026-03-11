import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiHeader } from '@nestjs/swagger';
import { HypeStoreService } from './hype-store.service';
import { PurchaseWebhookDto, ReturnWebhookDto, WebhookResponseDto } from '../wallet/dto/hype-store-webhook.dto';

/**
 * Public webhook controller for receiving purchase and return events from brand systems
 * No authentication guard - uses API key and signature verification instead
 */
@ApiTags('Hype Store Webhooks (Public)')
@Controller('api/webhooks/hype-store')
export class HypeStoreWebhookController {
  constructor(private readonly hypeStoreService: HypeStoreService) {}

  @Post(':apiKey/purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive purchase webhook from brand (Public endpoint)',
    description:
      'Called by brand system when a customer makes a purchase using an influencer\'s coupon code.\n\n' +
      '**Authentication:**\n' +
      '- API Key: Passed in URL path (:apiKey parameter)\n' +
      '- Signature: HMAC-SHA256 signature of request body, passed in X-Webhook-Signature header\n\n' +
      '**Signature Generation:**\n' +
      '```javascript\n' +
      'const crypto = require(\'crypto\');\n' +
      'const payload = JSON.stringify(requestBody);\n' +
      'const signature = crypto.createHmac(\'sha256\', webhookSecret)\n' +
      '  .update(payload)\n' +
      '  .digest(\'hex\');\n' +
      '```\n\n' +
      '**Idempotency:**\n' +
      'Duplicate requests with the same externalOrderId will be safely ignored and return the original order details.\n\n' +
      '**Cashback Calculation:**\n' +
      'Cashback is automatically calculated based on the influencer\'s follower count tier configured in the store.\n\n' +
      '**Return Period:**\n' +
      'Optionally specify returnPeriodDays (defaults to 30 days). The order will be hidden from the influencer until the return period ends.',
  })
  @ApiParam({
    name: 'apiKey',
    description: 'Brand store API key (obtained from store settings)',
    example: 'hs_live_a1b2c3d4e5f6g7h8i9j0',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    description: 'HMAC-SHA256 signature of the request body using webhook secret',
    required: true,
    schema: { type: 'string' },
  })
  @ApiBody({
    type: PurchaseWebhookDto,
    description: 'Purchase event data',
    examples: {
      basicPurchase: {
        summary: 'Basic Purchase',
        description: 'Minimal purchase event with required fields only',
        value: {
          externalOrderId: 'ORD-2026-12345',
          couponCode: 'MYNTRA-000123-A3F2B1',
          orderAmount: 5000.0,
          orderDate: '2026-03-09T10:30:00Z',
        },
      },
      completePurchase: {
        summary: 'Complete Purchase',
        description: 'Purchase event with all customer details and metadata',
        value: {
          externalOrderId: 'ORD-2026-12346',
          couponCode: 'MYNTRA-000456-B4C3D2',
          orderAmount: 12500.0,
          orderCurrency: 'INR',
          orderDate: '2026-03-09T14:15:00Z',
          customerEmail: 'customer@example.com',
          customerPhone: '+919876543210',
          customerName: 'Rajesh Kumar',
          orderStatus: 'confirmed',
          returnPeriodDays: 45,
          metadata: {
            items: [
              { sku: 'SHIRT-001', name: 'Blue Shirt', quantity: 2, price: 2500 },
              { sku: 'JEANS-002', name: 'Black Jeans', quantity: 1, price: 7500 },
            ],
            shippingAddress: {
              street: '123 Main Street',
              city: 'Mumbai',
              state: 'Maharashtra',
              pincode: '400001',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase processed successfully',
    type: WebhookResponseDto,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Order processed successfully' },
        orderId: { type: 'number', example: 123 },
        cashbackAmount: { type: 'number', example: 2500.0 },
        cashbackStatus: { type: 'string', example: 'pending' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid coupon code or request data',
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
    description: 'Invalid API key or webhook signature',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid webhook signature' },
      },
    },
  })
  async receivePurchase(
    @Param('apiKey') apiKey: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() webhookDto: PurchaseWebhookDto,
    @Ip() ipAddress: string,
  ) {
    return this.hypeStoreService.processPurchaseWebhook(
      apiKey,
      webhookDto,
      signature || '',
      ipAddress,
    );
  }

  @Post(':apiKey/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive return/refund webhook from brand (Public endpoint)',
    description:
      'Called by brand system when a customer returns a product or gets a refund.\n\n' +
      '**Authentication:**\n' +
      '- API Key: Passed in URL path (:apiKey parameter)\n' +
      '- Signature: HMAC-SHA256 signature of request body, passed in X-Webhook-Signature header\n\n' +
      '**Cashback Reversal:**\n' +
      'If cashback was already credited to the influencer, it will be automatically deducted from their wallet.',
  })
  @ApiParam({
    name: 'apiKey',
    description: 'Brand store API key (obtained from store settings)',
    example: 'hs_live_a1b2c3d4e5f6g7h8i9j0',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    description: 'HMAC-SHA256 signature of the request body using webhook secret',
    required: true,
    schema: { type: 'string' },
  })
  @ApiBody({
    type: ReturnWebhookDto,
    description: 'Return/refund event data',
    examples: {
      basicReturn: {
        summary: 'Basic Return',
        description: 'Minimal return event with required fields only',
        value: {
          externalOrderId: 'ORD-2026-12345',
          returnAmount: 5000.0,
          returnDate: '2026-03-15T16:00:00Z',
        },
      },
      completeReturn: {
        summary: 'Complete Return',
        description: 'Return event with reason and metadata',
        value: {
          externalOrderId: 'ORD-2026-12346',
          returnAmount: 12500.0,
          returnDate: '2026-03-16T11:30:00Z',
          returnReason: 'Product defective - size mismatch',
          metadata: {
            returnMethod: 'pickup',
            refundMethod: 'original_payment',
            qcStatus: 'approved',
          },
        },
      },
      partialReturn: {
        summary: 'Partial Return',
        description: 'Partial refund for one item from order',
        value: {
          externalOrderId: 'ORD-2026-12346',
          returnAmount: 2500.0,
          returnDate: '2026-03-16T14:00:00Z',
          returnReason: 'Customer requested partial refund for one item',
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
    description: 'Return processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Return processed successfully' },
        orderId: { type: 'number', example: 123 },
        cashbackReversed: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API key or webhook signature',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid API key' },
      },
    },
  })
  async receiveReturn(
    @Param('apiKey') apiKey: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() webhookDto: ReturnWebhookDto,
    @Ip() ipAddress: string,
  ) {
    return this.hypeStoreService.processReturnWebhook(
      apiKey,
      webhookDto,
      signature || '',
      ipAddress,
    );
  }
}
