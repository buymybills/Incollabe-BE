import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { BotKeyGuard } from '../../bot-analytics/guards/bot-key.guard';
import { CategoryReelService } from '../../shared/services/category-reel.service';

/**
 * Bot-facing endpoint: the Instagram shopping bot fetches the admin-curated
 * look-discovery feed — active categories, each with its active reels. The bot
 * renders categories as chips; tapping one sends that category's reels.
 *
 * Secured by the shared x-bot-key (server-to-server, same as analytics).
 */
@ApiTags('Bot - Category Reels')
@ApiSecurity('x-bot-key')
@Controller('bot-category-reels')
@UseGuards(BotKeyGuard)
export class BotCategoryReelController {
  constructor(private readonly service: CategoryReelService) {}

  @Get()
  @ApiOperation({ summary: 'Active reel categories, each with its active reels' })
  async feed() {
    const categories = await this.service.botFeed();
    return { categories };
  }
}
