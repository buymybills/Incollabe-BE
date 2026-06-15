import * as crypto from 'crypto';
import type { ConfigService } from '@nestjs/config';

// Verifies the signed checkout-link token minted by the bot. The token carries
// the IG sender id + product + price so the link itself is the identity, and the
// HMAC signature (shared CHECKOUT_SECRET) makes it tamper-proof — a client can't
// change the price or impersonate another shopper.

/**
 * Centralised secret resolver. Throws in production if no secret is configured
 * so a misconfigured deploy can't silently accept tokens signed with the dev key.
 */
export function getCheckoutSecret(config: ConfigService): string {
  const secret =
    config.get<string>('CHECKOUT_SECRET') ||
    config.get<string>('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CHECKOUT_SECRET env var is required in production');
    }
    return 'dev_checkout_secret';
  }
  return secret;
}

export interface CheckoutLineItem {
  slug?: string;
  title: string;
  size?: string;
  priceInr: number;
  qty?: number;
}

export interface CheckoutPayload {
  igsid: string;
  slug?: string;
  title?: string;
  size?: string;
  priceInr: number;
  username?: string;
  gender?: string;
  // When present, this is a CART checkout: multiple line items paid in one go.
  // priceInr carries the cart total (kept for back-compat with single-item code).
  items?: CheckoutLineItem[];
  ts: number;
}

const b64urlDecode = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

export function verifyCheckoutToken(
  token: string,
  secret: string,
  maxAgeMs = 14 * 24 * 3600 * 1000,
): CheckoutPayload | null {
  try {
    if (!token || !secret) return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
    const data = JSON.parse(b64urlDecode(payload)) as CheckoutPayload;
    if (!data.igsid || typeof data.priceInr !== 'number') return null;
    if (maxAgeMs && Date.now() - data.ts > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

/** Stable hashed key matching the bot's analytics userKey (sha256, 64 chars). */
export function hashUserKey(igsid: string): string {
  return crypto.createHash('sha256').update(String(igsid)).digest('hex').slice(0, 64);
}

/** Razorpay payment signature check: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!keySecret) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  try {
    return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
