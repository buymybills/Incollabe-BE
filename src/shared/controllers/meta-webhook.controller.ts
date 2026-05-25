import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { MetaWebhookService } from '../services/meta-webhook.service';

/**
 * Public webhook controller for receiving Instagram DM events from Meta.
 * Register this URL in Meta for Developers → Your App → Webhooks.
 *
 * GET  /api/webhooks/meta  — hub challenge verification (Meta calls this on registration)
 * POST /api/webhooks/meta  — incoming Instagram DM events
 */
@ApiTags('Meta Webhooks (Public)')
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);
  private readonly seenMessageIds = new Set<string>();

  constructor(
    private readonly metaWebhookService: MetaWebhookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Meta webhook verification handshake.
   * Meta sends GET with hub.mode=subscribe, hub.verify_token, hub.challenge.
   * Respond with hub.challenge if the verify token matches.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Meta webhook verification (hub challenge)' })
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  handleVerification(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = this.configService.get<string>('IG_VERIFY_TOKEN');
    const modeOk = mode === 'subscribe';
    const tokenOk = token === verifyToken;

    if (modeOk && tokenOk) {
      this.logger.log('Meta webhook verification successful');
      return res.status(HttpStatus.OK).send(challenge ?? '');
    }

    this.logger.warn(
      `Verification failed — mode_ok=${modeOk} token_ok=${tokenOk}`,
    );
    return res.status(HttpStatus.FORBIDDEN).send('Forbidden');
  }

  /**
   * Receives Instagram DM events from Meta.
   * Verifies X-Hub-Signature-256 header, extracts message events, and
   * processes each one asynchronously (responds 200 immediately to Meta).
   */
  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Instagram DM events from Meta' })
  async handleWebhook(@Req() req: Request) {
    const rawBody: Buffer = (req as any).rawBody;
    const signature = req.headers['x-hub-signature-256'] as string;

    if (!rawBody) {
      this.logger.warn('No rawBody available — ensure raw body parsing is enabled');
      return 'OK';
    }

    if (!this.metaWebhookService.verifySignature(rawBody, signature)) {
      this.logger.warn(
        `Invalid signature — check IG_APP_SECRET matches the registered Meta app`,
      );
      // Still return 200 to prevent Meta from retrying indefinitely
      return 'OK';
    }

    let body: any;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      this.logger.error('Invalid JSON in webhook payload');
      return 'OK';
    }

    this.logger.log(
      `Received: object="${body.object}" entries=${(body.entry ?? []).length}`,
    );

    const events = this.metaWebhookService.extractIncoming(body);
    this.logger.log(`Extracted ${events.length} message event(s)`);

    // Process events asynchronously — do NOT await so Meta gets 200 immediately
    for (const event of events) {
      if (event.mid && this.seenMessageIds.has(event.mid)) {
        this.logger.debug(`Duplicate message ${event.mid} — skipping`);
        continue;
      }
      if (event.mid) this.seenMessageIds.add(event.mid);

      this.processEvent(event).catch((err) => {
        this.logger.error(`Error processing event for ${event.senderId}: ${err.message}`);
      });
    }

    return 'OK';
  }

  private async processEvent(event: {
    senderId: string;
    text: string;
    attachments: any[];
    mid: string | null;
  }) {
    this.logger.log(
      `Message from ${event.senderId}: "${event.text.slice(0, 80)}" attachments=${event.attachments.length}`,
    );

    // TODO: Wire up your AI agent / reply logic here.
    // Example:
    //   const reply = await this.yourAgentService.handle(event);
    //   await this.metaWebhookService.sendMessage(event.senderId, reply);
  }
}
