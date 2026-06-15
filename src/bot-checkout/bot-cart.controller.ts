import { Body, Controller, Get, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { BotKeyGuard } from '../bot-analytics/guards/bot-key.guard';
import { BotCartService } from './bot-cart.service';

/**
 * Backend store for the Instagram bot's cart ("🛒 Add to cart"). Server-to-server
 * only — secured by the shared x-bot-key header.
 *
 * Routes (global prefix 'api'):
 *   POST /api/bot-cart           { igsid, url, title, size?, priceInr, imageUrl?, slug?, qty? }
 *   POST /api/bot-cart/remove    { igsid, url, size? }
 *   POST /api/bot-cart/qty       { igsid, url, size?, qty }
 *   POST /api/bot-cart/clear     { igsid }
 *   GET  /api/bot-cart?igsid=…
 */
@ApiTags('Bot Cart')
@ApiSecurity('x-bot-key')
@Controller('bot-cart')
@UseGuards(BotKeyGuard)
export class BotCartController {
  constructor(private readonly cart: BotCartService) {}

  @Post()
  @ApiOperation({ summary: 'Add a product to the cart' })
  async add(
    @Body()
    body: {
      igsid?: string;
      url?: string;
      title?: string;
      size?: string;
      priceInr?: number;
      imageUrl?: string;
      slug?: string;
      qty?: number;
    },
  ) {
    if (!body?.igsid || !body?.url) throw new BadRequestException('igsid and url are required');
    if (!body?.priceInr || body.priceInr <= 0) throw new BadRequestException('priceInr is required');
    const summary = await this.cart.add({
      igsid: body.igsid,
      productUrl: body.url,
      title: body.title || 'Product',
      size: body.size ?? null,
      priceInr: body.priceInr,
      imageUrl: body.imageUrl ?? null,
      slug: body.slug ?? null,
      qty: body.qty,
    });
    return { success: true, ...summary };
  }

  @Post('remove')
  @ApiOperation({ summary: 'Remove a line from the cart' })
  async remove(@Body() body: { igsid?: string; url?: string; size?: string }) {
    if (!body?.igsid || !body?.url) throw new BadRequestException('igsid and url are required');
    const summary = await this.cart.remove(body.igsid, body.url, body.size ?? undefined);
    return { success: true, ...summary };
  }

  @Post('qty')
  @ApiOperation({ summary: 'Set the quantity for a cart line' })
  async qty(@Body() body: { igsid?: string; url?: string; size?: string; qty?: number }) {
    if (!body?.igsid || !body?.url || body?.qty === undefined) {
      throw new BadRequestException('igsid, url and qty are required');
    }
    const summary = await this.cart.setQty(body.igsid, body.url, body.size ?? null, body.qty);
    return { success: true, ...summary };
  }

  @Post('clear')
  @ApiOperation({ summary: 'Empty the cart' })
  async clear(@Body() body: { igsid?: string }) {
    if (!body?.igsid) throw new BadRequestException('igsid is required');
    const summary = await this.cart.clear(body.igsid);
    return { success: true, ...summary };
  }

  @Get()
  @ApiOperation({ summary: 'Get the cart contents and totals' })
  async list(@Query('igsid') igsid?: string) {
    if (!igsid) throw new BadRequestException('igsid is required');
    const summary = await this.cart.summary(igsid);
    return { success: true, ...summary };
  }
}
