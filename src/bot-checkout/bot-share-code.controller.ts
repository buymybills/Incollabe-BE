import { Body, Controller, Get, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { BotKeyGuard } from '../bot-analytics/guards/bot-key.guard';
import { BotShareCodeService } from './bot-share-code.service';

const CODE_RE = /^[a-z0-9_]{3,30}$/;
function normalize(raw?: string): string {
  return String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Share codes for the Instagram bot's saved-items lists. A shopper claims a short
 * code (e.g. "collabneha"); a friend who types it sees the owner's saved list.
 * Server-to-server only — secured by the shared x-bot-key header (same as bot
 * analytics / saved items). Responses are wrapped under `data` by ResponseInterceptor.
 *
 * Routes (global prefix 'api'):
 *   GET  /api/bot-share-code?igsid=…           -> { code: string | null }
 *   GET  /api/bot-share-code/resolve?code=…    -> { igsid: string | null }
 *   POST /api/bot-share-code  { igsid, code }  -> { ok: true, code }  (HTTP 409 if taken)
 */
@ApiTags('Bot Share Codes')
@ApiSecurity('x-bot-key')
@Controller('bot-share-code')
@UseGuards(BotKeyGuard)
export class BotShareCodeController {
  constructor(private readonly shareCodes: BotShareCodeService) {}

  @Get()
  @ApiOperation({ summary: "Get a shopper's saved-items share code" })
  async getForUser(@Query('igsid') igsid?: string) {
    if (!igsid) throw new BadRequestException('igsid is required');
    const code = await this.shareCodes.getForUser(igsid);
    return { code };
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a share code to its owner igsid' })
  async resolve(@Query('code') code?: string) {
    const norm = normalize(code);
    if (!CODE_RE.test(norm)) return { igsid: null };
    const igsid = await this.shareCodes.resolve(norm);
    return { igsid };
  }

  @Post()
  @ApiOperation({ summary: 'Claim/set a custom share code' })
  async claim(@Body() body: { igsid?: string; code?: string }) {
    if (!body?.igsid) throw new BadRequestException('igsid is required');
    const norm = normalize(body.code);
    if (!CODE_RE.test(norm)) {
      throw new BadRequestException('code must be 3-30 characters of a-z, 0-9 or _');
    }
    // Throws ConflictException (HTTP 409) if another shopper owns the code.
    const result = await this.shareCodes.claim(body.igsid, norm);
    return { ok: true, code: result.code };
  }
}
