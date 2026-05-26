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
import { MetaWebhookService, IgMessageEvent, IgTemplateElement } from '../services/meta-webhook.service';
import { ShoppingAgentService } from '../../shopping-agent/shopping-agent.service';

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
    private readonly shoppingAgentService: ShoppingAgentService,
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
        `Invalid signature — check IG_WEBHOOK_APP_SECRET matches the registered Meta app`,
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

  private async processEvent(event: IgMessageEvent) {
    this.logger.log(
      `Message from ${event.senderId}: "${event.text.slice(0, 80)}" attachments=${event.attachments.length}`,
    );

    // Acknowledge immediately — blue read receipt + typing bubble
    this.metaWebhookService.sendSenderAction(event.senderId, 'mark_seen').catch(() => {});
    this.metaWebhookService.sendSenderAction(event.senderId, 'typing_on').catch(() => {});

    // For slow operations (reel scans, URL processing) send a text ack so user isn't left waiting
    const isSlowScan =
      event.attachments.length > 0 || /https?:\/\//i.test(event.text);
    if (isSlowScan) {
      this.metaWebhookService
        .sendMessage(event.senderId, 'On it — scanning the reel 👀 give me a few seconds…')
        .catch(() => {});
    }

    // Build the message string for the agent.
    // For reel/media attachments, resolve to a CDN URL so the agent can scan them.
    let agentMessage = event.text;

    if (event.attachments.length > 0) {
      const resolvedUrls: string[] = [];
      for (const att of event.attachments) {
        if (att.url) {
          resolvedUrls.push(att.url);
        } else if (att.reel_video_id) {
          const cdnUrl = await this.metaWebhookService
            .resolveIgMediaUrl(att.reel_video_id)
            .catch((err) => {
              this.logger.warn(`Could not resolve reel ${att.reel_video_id}: ${err.message}`);
              return null;
            });
          if (cdnUrl) resolvedUrls.push(cdnUrl);
        }
      }
      if (resolvedUrls.length > 0) {
        const urlsText = resolvedUrls.join(' ');
        agentMessage = agentMessage ? `${agentMessage} ${urlsText}` : urlsText;
      }
    }

    if (!agentMessage.trim()) return;

    // Keep typing bubble alive every 15 s while the agent is thinking / calling tools
    const typingInterval = setInterval(() => {
      this.metaWebhookService.sendSenderAction(event.senderId, 'typing_on').catch(() => {});
    }, 15_000);

    try {
      // Use senderId as the sessionId so each Instagram user has persistent conversation history
      const result = await this.shoppingAgentService.chat(event.senderId, agentMessage);

      clearInterval(typingInterval);

      // Strip markdown formatting — IG DMs render plain text only
      const cleanReply = result.reply
        .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
        .replace(/\*(.*?)\*/g, '$1')        // italic
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // inline links → label only

      await this.metaWebhookService.sendMessage(event.senderId, cleanReply);

      // Send product carousel if the agent found products
      if (result.products?.length > 0) {
        const elements: IgTemplateElement[] = result.products
          .slice(0, 10)
          .map((p) => ({
            title: `${p.brand} – ${p.title}`,
            subtitle: `₹${p.priceInr}`,
            image_url: p.image || undefined,
            url: p.url,
            buttons: [{ url: p.url, title: 'Buy Now' }],
          }));
        await this.metaWebhookService.sendGenericTemplate(event.senderId, elements);

        // Quick-reply chips so users can refine without typing
        await this.metaWebhookService.sendQuickReplies(
          event.senderId,
          'Anything else?',
          [
            { title: 'Show more', payload: 'SHOW_MORE' },
            { title: 'Under ₹1000', payload: 'UNDER_1000' },
            { title: 'Different style', payload: 'DIFFERENT_STYLE' },
          ],
        );
      }
    } catch (err: any) {
      clearInterval(typingInterval);
      this.logger.error(`Agent error for ${event.senderId}: ${err.message}`);
      await this.metaWebhookService
        .sendMessage(event.senderId, 'Sorry, I ran into an issue. Please try again in a moment.')
        .catch(() => {});
    }
  }
}
