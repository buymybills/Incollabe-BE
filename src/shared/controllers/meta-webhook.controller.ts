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
import { MetaWebhookService, IgMessageEvent, IgCommentEvent, IgTemplateElement } from '../services/meta-webhook.service';
import { ShoppingAgentService, DmResponse } from '../../shopping-agent/shopping-agent.service';
import { CommentAutomationService } from '../services/comment-automation.service';

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
  private readonly seenCommentIds = new Set<string>();
  /** mediaId → shortcode cache to avoid re-resolving permalinks per comment. */
  private readonly shortcodeCache = new Map<string, string | null>();

  constructor(
    private readonly metaWebhookService: MetaWebhookService,
    private readonly configService: ConfigService,
    private readonly shoppingAgentService: ShoppingAgentService,
    private readonly commentAutomationService: CommentAutomationService,
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

    this.logger.warn(`Verification failed — mode_ok=${modeOk} token_ok=${tokenOk}`);
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
      this.logger.warn('Invalid signature — check IG_WEBHOOK_APP_SECRET matches the registered Meta app');
      return 'OK';
    }

    let body: any;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      this.logger.error('Invalid JSON in webhook payload');
      return 'OK';
    }

    this.logger.log(`Received: object="${body.object}" entries=${(body.entry ?? []).length}`);

    const events = this.metaWebhookService.extractIncoming(body);
    this.logger.log(`Extracted ${events.length} message event(s)`);

    for (const event of events) {
      if (event.mid && this.seenMessageIds.has(event.mid)) {
        this.logger.debug(`Duplicate message ${event.mid} — skipping`);
        continue;
      }
      if (event.mid) {
        this.seenMessageIds.add(event.mid);
        // Cap dedup set to 5000 entries
        if (this.seenMessageIds.size > 5000) {
          const first = this.seenMessageIds.values().next().value;
          if (first) this.seenMessageIds.delete(first);
        }
      }

      this.processEvent(event).catch((err) => {
        this.logger.error(`Error processing event for ${event.senderId}: ${err.message}`);
      });
    }

    // Comment events → keyword-scoped automation (auto-reply + private DM).
    const comments = this.metaWebhookService.extractComments(body);
    if (comments.length > 0) {
      this.logger.log(`Extracted ${comments.length} comment event(s)`);
    }
    for (const comment of comments) {
      if (this.seenCommentIds.has(comment.commentId)) {
        this.logger.debug(`Duplicate comment ${comment.commentId} — skipping`);
        continue;
      }
      this.seenCommentIds.add(comment.commentId);
      if (this.seenCommentIds.size > 5000) {
        const first = this.seenCommentIds.values().next().value;
        if (first) this.seenCommentIds.delete(first);
      }

      this.processComment(comment).catch((err) => {
        this.logger.error(`Error processing comment ${comment.commentId}: ${err.message}`);
      });
    }

    return 'OK';
  }

  /**
   * Handle a single Instagram comment. Only comments on a configured post/reel
   * whose text matches a configured keyword trigger anything — everything else
   * is ignored (no "alert on every post").
   */
  private async processComment(comment: IgCommentEvent) {
    if (!comment.text?.trim()) return;

    // Resolve the media's shortcode (cached) so we can match against the
    // post/reel link the admin configured.
    let shortcode: string | null = null;
    if (comment.mediaId) {
      if (this.shortcodeCache.has(comment.mediaId)) {
        shortcode = this.shortcodeCache.get(comment.mediaId) ?? null;
      } else {
        shortcode = await this.metaWebhookService
          .resolveMediaShortcode(comment.mediaId)
          .catch(() => null);
        this.shortcodeCache.set(comment.mediaId, shortcode);
      }
    }

    const rule = await this.commentAutomationService.findMatchingRule(
      comment.mediaId,
      shortcode,
      comment.text,
    );

    if (!rule) return; // No configured rule for this post + keyword → do nothing.

    this.logger.log(
      `Comment ${comment.commentId} matched rule #${rule.id} ("${rule.title}") from @${comment.fromUsername ?? '?'}`,
    );

    // Public auto-reply under the comment.
    if (rule.commentReply?.trim()) {
      await this.metaWebhookService
        .replyToComment(comment.commentId, rule.commentReply)
        .catch((e) => this.logger.error(`replyToComment failed: ${e.message}`));
    }

    // Private DM to the commenter (Instagram private reply).
    if (rule.dmMessage?.trim()) {
      await this.metaWebhookService
        .sendPrivateReply(comment.commentId, rule.dmMessage)
        .catch((e) => this.logger.error(`sendPrivateReply failed: ${e.message}`));
    }

    await this.commentAutomationService.markTriggered(rule.id).catch(() => {});
  }

  private async processEvent(event: IgMessageEvent) {
    this.logger.log(
      `Message from ${event.senderId}: "${event.text.slice(0, 80)}" attachments=${event.attachments.length}`,
    );

    // Acknowledge immediately
    this.metaWebhookService.sendSenderAction(event.senderId, 'mark_seen').catch(() => {});
    this.metaWebhookService.sendSenderAction(event.senderId, 'typing_on').catch(() => {});

    // Build message string for the agent.
    // For reel attachments, resolve reel_video_id → CDN URL so the agent can scan them.
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

    // For slow operations (reel scans, URL processing) send an ack so user isn't left waiting
    const isSlowScan = event.attachments.length > 0 || /https?:\/\//i.test(event.text);
    if (isSlowScan) {
      this.metaWebhookService
        .sendMessage(event.senderId, 'On it — scanning the reel 👀 give me a few seconds…')
        .catch(() => {});
    }

    // Keep typing bubble alive every 15s while agent is running
    const typingInterval = setInterval(() => {
      this.metaWebhookService.sendSenderAction(event.senderId, 'typing_on').catch(() => {});
    }, 15_000);

    try {
      // Use senderId as sessionId so each Instagram user has persistent conversation history
      const result = await this.shoppingAgentService.chat(event.senderId, agentMessage);

      clearInterval(typingInterval);

      // Process each rich response in order
      for (const response of result.responses) {
        await this.sendDmResponse(event.senderId, response);
      }

      // Fallback: if agent returned no structured responses but has a text reply, send it
      if (result.responses.length === 0 && result.reply) {
        const cleanReply = this.stripMarkdown(result.reply);
        await this.metaWebhookService.sendMessage(event.senderId, cleanReply);
      }

    } catch (err: any) {
      clearInterval(typingInterval);
      this.logger.error(`Agent error for ${event.senderId}: ${err.message}`);
      await this.metaWebhookService
        .sendMessage(event.senderId, 'Sorry, I ran into an issue. Please try again in a moment.')
        .catch(() => {});
    }

    await this.metaWebhookService.sendSenderAction(event.senderId, 'typing_off').catch(() => {});
  }

  /**
   * Route each DmResponse kind to the appropriate IG Graph API call.
   */
  private async sendDmResponse(senderId: string, response: DmResponse): Promise<void> {
    switch (response.kind) {

      case 'text': {
        const clean = this.stripMarkdown(response.text);
        await this.metaWebhookService.sendMessage(senderId, clean).catch((e) => {
          this.logger.error(`sendMessage error: ${e.message}`);
        });
        break;
      }

      case 'tiles': {
        // Send identified reel items as quick-reply chips
        const sent = await this.metaWebhookService
          .sendQuickReplies(senderId, response.text, response.tiles)
          .then(() => true)
          .catch((e) => {
            this.logger.error(`sendQuickReplies error: ${e.message}`);
            return false;
          });

        // Fallback to numbered list if quick replies fail
        if (!sent) {
          const lines = response.tiles.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
          await this.metaWebhookService
            .sendMessage(senderId, `${response.text}\n\n${lines}\n\nReply with a number or item name to explore 👆`)
            .catch(() => {});
        }
        break;
      }

      case 'products': {
        // Send intro text
        if (response.intro) {
          await this.metaWebhookService.sendMessage(senderId, response.intro).catch(() => {});
        }

        // Send product carousel — each card has "View Product" + "I want this 🛍️" buttons
        const elements: IgTemplateElement[] = response.hits.slice(0, 10).map((hit) => ({
          title: `${hit.brand} – ${hit.title}`,
          subtitle: hit.priceInr ? `₹${hit.priceInr}` : undefined,
          image_url: hit.image || undefined,
          url: hit.url,
          buttons: [
            { url: hit.url, title: 'View Product' },
            // Postback payload triggers the PURCHASE FLOW in the shopping agent
            { type: 'postback' as const, payload: `WANT|${hit.title}|${hit.brand}|${hit.priceInr ?? ''}|${hit.url}`, title: 'I want this 🛍️' },
          ],
        }));

        if (elements.length > 0) {
          await this.metaWebhookService.sendGenericTemplate(senderId, elements).catch(async (e) => {
            this.logger.error(`sendGenericTemplate error: ${e.message} — falling back to text`);
            // Fallback to plain text list
            const lines = response.hits.slice(0, 5).map((h, i) =>
              `${i + 1}. ${h.brand} — ${h.title}${h.priceInr ? ` · ₹${h.priceInr}` : ''}\n${h.url}`,
            );
            await this.metaWebhookService.sendMessage(senderId, lines.join('\n\n')).catch(() => {});
          });
        }

        // Prompt the user to pick one
        await this.metaWebhookService
          .sendMessage(senderId, 'Want to buy any of these? Tap "I want this 🛍️" or tell me which one!')
          .catch(() => {});
        break;
      }

      case 'payment_link': {
        await this.metaWebhookService
          .sendMessage(
            senderId,
            `Here's your payment link for ${response.productName} (${response.price}) 👇\n${response.paymentUrl}\n\nPay via UPI, card, or netbanking — tap to complete your order!`,
          )
          .catch((e) => {
            this.logger.error(`Payment link send error: ${e.message}`);
          });
        break;
      }
    }
  }

  /**
   * Strip markdown formatting — IG DMs render plain text only.
   */
  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')        // bold
      .replace(/\*(.*?)\*/g, '$1')             // italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label only
      .replace(/^#{1,6}\s+/gm, '')             // headings
      .replace(/`{1,3}[^`]*`{1,3}/g, '');     // code spans
  }
}
