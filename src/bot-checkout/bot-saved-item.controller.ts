import { Body, Controller, Get, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { BotKeyGuard } from '../bot-analytics/guards/bot-key.guard';
import { BotSavedItemService } from './bot-saved-item.service';

/**
 * Backend store for the Instagram bot's saved items ("💾 Save"). Server-to-server
 * only — secured by the shared x-bot-key header (same as bot analytics).
 *
 * Routes (global prefix 'api'):
 *   POST   /api/bot-saved          { igsid, url, title, imageUrl?, slug? }
 *   POST   /api/bot-saved/remove   { igsid, url }
 *   GET    /api/bot-saved?igsid=…
 */
@ApiTags('Bot Saved Items')
@ApiSecurity('x-bot-key')
@Controller('bot-saved')
@UseGuards(BotKeyGuard)
export class BotSavedItemController {
  constructor(private readonly savedItems: BotSavedItemService) {}

  @Post()
  @ApiOperation({ summary: 'Save a product for a shopper' })
  async save(
    @Body() body: { igsid?: string; url?: string; title?: string; imageUrl?: string; slug?: string },
  ) {
    if (!body?.igsid || !body?.url) throw new BadRequestException('igsid and url are required');
    const result = await this.savedItems.save({
      igsid: body.igsid,
      productUrl: body.url,
      title: body.title || 'Product',
      imageUrl: body.imageUrl ?? null,
      slug: body.slug ?? null,
    });
    return { success: true, ...result };
  }

  @Post('remove')
  @ApiOperation({ summary: 'Remove a saved product' })
  async remove(@Body() body: { igsid?: string; url?: string }) {
    if (!body?.igsid || !body?.url) throw new BadRequestException('igsid and url are required');
    const result = await this.savedItems.unsave(body.igsid, body.url);
    return { success: true, ...result };
  }

  @Get()
  @ApiOperation({ summary: 'List a shopper\'s saved products' })
  async list(@Query('igsid') igsid?: string) {
    if (!igsid) throw new BadRequestException('igsid is required');
    const items = await this.savedItems.list(igsid);
    return {
      success: true,
      count: items.length,
      items: items.map((i) => ({
        url: i.productUrl,
        title: i.title,
        imageUrl: i.imageUrl,
        slug: i.slug,
        createdAt: i.createdAt,
      })),
    };
  }
}
