import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotRefundService, RefundResult } from './bot-refund.service';

/**
 * Server-to-server refund endpoint the Shopify connector calls after a successful
 * cancel (or return). Auth: shared `x-order-key` (ORDER_INGEST_KEY).
 * POST /api/bot-refund  { orderId, reason }
 */
@Controller('bot-refund')
export class BotRefundController {
  constructor(
    private readonly refundService: BotRefundService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async refund(
    @Headers('x-order-key') key: string,
    @Body() dto: { orderId: string; reason?: string; amountInr?: number },
  ): Promise<RefundResult> {
    const expected = this.config.get<string>('ORDER_INGEST_KEY');
    if (expected && key !== expected) throw new UnauthorizedException('bad order key');
    return this.refundService.refundOrder(dto.orderId, dto.reason, dto.amountInr);
  }
}
