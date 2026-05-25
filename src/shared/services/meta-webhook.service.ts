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

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Constant-time HMAC-SHA256 verification of Meta webhook signatures.
   * Header format: "sha256=<hex>"
   */
  verifySignature(rawBody: Buffer, signatureHeader: string): boolean {
    const appSecret = this.configService.get<string>('IG_WEBHOOK_APP_SECRET');
    if (!appSecret) {
      this.logger.warn('IG_APP_SECRET not configured — skipping signature check');
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
      // Legacy Messenger Platform format
      for (const m of entry.messaging ?? []) {
        const ev = this.buildEvent(m.sender?.id, m.message);
        if (ev) events.push(ev);
      }

      // IG Graph API format — wrapped in a `changes` envelope per field
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;
        const v = change.value;
        if (!v) continue;
        const ev = this.buildEvent(v.sender?.id, v.message);
        if (ev) events.push(ev);
      }
    }

    return events;
  }

  private buildEvent(senderId: string, message: any): IgMessageEvent | null {
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
      text: message.text ?? '',
      attachments,
      mid: message.mid ?? null,
    };
  }

  /**
   * Send a DM reply via the Instagram Graph API.
   * Splits long messages into IG-friendly chunks (max ~980 chars each).
   */
  async sendMessage(recipientId: string, text: string): Promise<void> {
    const accessToken = this.configService.get<string>('IG_PAGE_ACCESS_TOKEN');
    const graphBase =
      this.configService.get<string>('IG_GRAPH_BASE') || 'https://graph.instagram.com';
    const graphVersion =
      this.configService.get<string>('IG_GRAPH_VERSION') || 'v21.0';

    if (!accessToken) {
      this.logger.error('IG_PAGE_ACCESS_TOKEN not configured');
      return;
    }

    const url = `${graphBase}/${graphVersion}/me/messages?access_token=${encodeURIComponent(accessToken)}`;
    const chunks = this.chunkText(text);

    for (const chunk of chunks) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: chunk },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Graph API ${res.status}: ${errBody}`);
      }
    }
  }

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
