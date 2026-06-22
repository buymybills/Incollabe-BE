import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StockAlertService, StockAlertResult } from './stock-alert.service';

interface PushStockAlertDto {
  igUserId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Server-to-server endpoint the bot calls to push a back-in-stock / price-drop
 * alert to a shopper's app. Auth: shared `x-order-key` (env ORDER_INGEST_KEY,
 * the same secret used for order ingest). POST /api/stock-alert/push
 */
@Controller('stock-alert')
export class StockAlertController {
  constructor(
    private readonly stockAlertService: StockAlertService,
    private readonly configService: ConfigService,
  ) {}

  @Post('push')
  async push(
    @Headers('x-order-key') key: string,
    @Body() dto: PushStockAlertDto,
  ): Promise<StockAlertResult> {
    const expected = this.configService.get<string>('ORDER_INGEST_KEY');
    if (expected && key !== expected) {
      throw new UnauthorizedException('bad order key');
    }
    return this.stockAlertService.push(dto.igUserId, dto.title, dto.body, dto.data ?? {});
  }
}
