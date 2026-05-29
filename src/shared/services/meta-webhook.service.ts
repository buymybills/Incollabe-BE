import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IgMessageEvent {
  senderId: string;
  text: string;
  attachments: IgAttachment[];
  mid: string | null;
}

export interface IgAttachment {
  type: string;
  url: string | null;
  reel_video_id: string | null;
  title: string | null;
}

export type IgTemplateButton =
  | { type?: 'web_url'; url: string; title: string }
  | { type: 'postback'; payload: string; title: string };

export interface IgTemplateElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  url?: string;
  buttons?: IgTemplateButton[];
}

export interface IgQuickReply {
  title: string;
  payload?: string;
}

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  // ---- Helpers ----

  private get accessToken(): string {
    return this.configService.get<string>('IG_PAGE_ACCESS_TOKEN') ?? '';
  }

  private get graphUrl(): string {
    const base = this.configService.get<string>('IG_GRAPH_BASE') || 'https://graph.instagram.com';
    const version = this.configService.get<string>('IG_GRAPH_VERSION') || 'v21.0';
    return `${base}/${version}`;
  }

  private truncate(s: any, n: number): string {
    const str = String(s ?? '').trim();
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  private isHttpsUrl(s: any): boolean {
    return typeof s === 'string' && /^https?:\/\//i.test(s);
  }

  // ---- Signature verification ----

  /**
   * Constant-time HMAC-SHA256 verification of Meta webhook signatures.
   * Header format: "sha256=<hex>"
   */
  verifySignature(rawBody: Buffer, signatureHeader: string): boolean {
    const appSecret = this.configService.get<string>('IG_WEBHOOK_APP_SECRET');
    if (!appSecret) {
      this.logger.warn('IG_WEBHOOK_APP_SECRET not configured — skipping signature check');
      return false;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

    const expected = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    const provided = signatureHeader.slice('sha256='.length);

    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  }

  // ---- Event parsing ----

  /**
   * Parse a Meta webhook body into a flat list of message events.
   * Supports both IG webhook payload shapes:
   *   1. entry[].messaging[]                         — Messenger Platform (legacy)
   *   2. entry[].changes[].value.{sender,message}   — IG Graph API (current)
   */
  extractIncoming(body: any): IgMessageEvent[] {
    if (body?.object !== 'instagram') return [];

    const events: IgMessageEvent[] = [];

    for (const entry of body.entry ?? []) {
      const pageId = entry.id as string;

      for (const m of entry.messaging ?? []) {
        const senderId = m.sender?.id as string;
        // Skip echoes (messages the page itself sent)
        if (senderId && pageId && senderId === pageId) continue;

        const ev = this.buildMessageEvent(senderId, m.message)
          ?? this.buildPostbackEvent(senderId, m.postback);
        if (ev) events.push(ev);
      }

      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const v = change.value;
        if (!v) continue;
        const senderId = v.sender?.id as string;
        const ev = this.buildMessageEvent(senderId, v.message)
          ?? this.buildPostbackEvent(senderId, v.postback);
        if (ev) events.push(ev);
      }
    }

    return events;
  }

  private buildMessageEvent(senderId: string, message: any): IgMessageEvent | null {
    if (!senderId || !message) return null;
    if (message.is_echo) return null;

    const attachments: IgAttachment[] = (message.attachments ?? [])
      .filter((a: any) => a?.payload?.url || a?.payload?.reel_video_id)
      .map((a: any) => ({
        type: a.type,
        url: a.payload?.url || null,
        reel_video_id: a.payload?.reel_video_id || null,
        title: a.payload?.title || null,
      }));

    return {
      senderId,
      // Quick reply taps arrive as message.quick_reply.payload, not message.text
      text: (message.quick_reply?.payload as string) ?? (message.text as string) ?? '',
      attachments,
      mid: message.mid ?? null,
    };
  }

  private buildPostbackEvent(senderId: string, postback: any): IgMessageEvent | null {
    if (!senderId || !postback) return null;
    // Postback payload is the "I want this 🛍️" WANT|... string
    const text = (postback.payload ?? postback.title) as string;
    if (!text) return null;
    return { senderId, text, attachments: [], mid: postback.mid ?? null };
  }

  // ---- Messaging primitives ----

  /**
   * Low-level send: POST a single message object to the IG Graph API.
   */
  private async sendRaw(recipientId: string, message: object): Promise<void> {
    const token = this.accessToken;
    if (!token) {
      this.logger.error('IG_PAGE_ACCESS_TOKEN not configured');
      return;
    }
    const url = `${this.graphUrl}/me/messages?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, ...message }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Graph API ${res.status}: ${errBody}`);
    }
  }

  /**
   * Send a read receipt or typing indicator.
   * action: "mark_seen" | "typing_on" | "typing_off"
   * typing_on expires after ~20s — re-send on each tool call for long operations.
   */
  async sendSenderAction(recipientId: string, action: 'mark_seen' | 'typing_on' | 'typing_off'): Promise<void> {
    const token = this.accessToken;
    if (!token) return;
    const url = `${this.graphUrl}/me/messages?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, sender_action: action }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Graph API ${res.status}: ${errBody}`);
    }
  }

  /**
   * Send a DM text reply. Splits long messages into IG-friendly chunks (~980 chars).
   */
  async sendMessage(recipientId: string, text: string): Promise<void> {
    if (!text?.trim()) return;
    for (const chunk of this.chunkText(text)) {
      await this.sendRaw(recipientId, { message: { text: chunk } });
    }
  }

  /**
   * Send a horizontal carousel of cards (IG generic template).
   * IG allows max 10 cards and max 3 buttons per card.
   * Each element: { title, subtitle?, image_url?, url?, buttons?: [{url, title}] }
   */
  async sendGenericTemplate(recipientId: string, elements: IgTemplateElement[]): Promise<void> {
    if (!elements.length) return;

    const payloadElements = elements.slice(0, 10).map((el) => {
      const e: any = { title: this.truncate(el.title || 'Product', 80) };
      if (el.subtitle) e.subtitle = this.truncate(el.subtitle, 80);
      if (this.isHttpsUrl(el.image_url)) e.image_url = el.image_url;
      if (this.isHttpsUrl(el.url)) e.default_action = { type: 'web_url', url: el.url };
      const buttons = (el.buttons || [])
        .slice(0, 3)
        .map((b) => {
          if (b.type === 'postback') {
            return { type: 'postback', payload: (b as any).payload, title: this.truncate(b.title || 'Select', 20) };
          }
          const url = (b as any).url;
          if (this.isHttpsUrl(url)) {
            return { type: 'web_url', url, title: this.truncate(b.title || 'Open', 20) };
          }
          return null;
        })
        .filter(Boolean);
      if (buttons.length) e.buttons = buttons;
      return e;
    });

    await this.sendRaw(recipientId, {
      message: {
        attachment: {
          type: 'template',
          payload: { template_type: 'generic', elements: payloadElements },
        },
      },
    });
  }

  /**
   * Send a message with tappable quick-reply chips.
   * IG allows max 13 chips, title ≤20 chars.
   * Each reply: { title, payload? }
   */
  async sendQuickReplies(recipientId: string, text: string, replies: IgQuickReply[]): Promise<void> {
    if (!replies.length) {
      if (text) await this.sendMessage(recipientId, text);
      return;
    }
    const quick_replies = replies.slice(0, 13).map((r) => ({
      content_type: 'text',
      title: this.truncate(r.title, 20),
      payload: r.payload || r.title,
    }));
    await this.sendRaw(recipientId, {
      message: { text: this.truncate(text || '👇', 1000), quick_replies },
    });
  }

  /**
   * Resolve an IG media id (e.g. reel_video_id from a DM attachment) to its
   * authenticated CDN URL using the Page access token.
   */
  async resolveIgMediaUrl(mediaId: string): Promise<string | null> {
    const token = this.accessToken;
    if (!mediaId || !token) return null;

    const url = `${this.graphUrl}/${encodeURIComponent(mediaId)}?fields=id,media_type,media_url,thumbnail_url,permalink&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Graph API ${res.status} resolving ${mediaId}: ${body.slice(0, 300)}`);
    }
    const data: any = await res.json();
    return data.media_url || data.thumbnail_url || null;
  }

  // ---- Private helpers ----

  private chunkText(text: string, maxLen = 980): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLen) {
      let cut = remaining.lastIndexOf('\n', maxLen);
      if (cut < maxLen / 2) cut = remaining.lastIndexOf('. ', maxLen);
      if (cut < maxLen / 2) cut = remaining.lastIndexOf(' ', maxLen);
      if (cut < 1) cut = maxLen;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }
}
