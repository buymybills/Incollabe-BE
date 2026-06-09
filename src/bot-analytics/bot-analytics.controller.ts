import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { BotKeyGuard } from './guards/bot-key.guard';
import { BotAnalyticsService } from './bot-analytics.service';
import { TrackBotEventDto, TrackBotEventsBatchDto } from './dto/track-bot-event.dto';

/**
 * Public ingestion endpoint for the Instagram shopping bot.
 * Secured by a shared secret header (x-bot-key), not admin/user auth.
 * Fire-and-forget: returns 200 immediately; persistence happens async.
 */
@Controller('analytics')
export class BotAnalyticsController {
  constructor(private readonly botAnalytics: BotAnalyticsService) {}

  @Public()
  @UseGuards(BotKeyGuard)
  @Post('bot-event')
  @HttpCode(HttpStatus.OK)
  ingest(@Body() body: TrackBotEventDto | TrackBotEventsBatchDto) {
    const events =
      'events' in body && Array.isArray(body.events) ? body.events : [body as TrackBotEventDto];
    this.botAnalytics.track(events);
    return { received: events.length };
  }
}
