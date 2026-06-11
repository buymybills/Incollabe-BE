import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { BotOrder } from './models/bot-order.model';
import { BotCustomer } from './models/bot-customer.model';

/**
 * Forwards a paid order OUTBOUND to the brand's system ("revert the order to
 * them"). POSTs a normalized order payload signed with HMAC-SHA256 (the same
 * scheme the inbound hype-store webhooks verify, just reversed — now the brand
 * verifies OUR signature). Destination + secret are resolved per brand.
 *
 * Config (env, per brand or global):
 *   ORDER_FORWARD_URL[_<BRAND>]      e.g. ORDER_FORWARD_URL_THESOULEDSTORE
 *   ORDER_FORWARD_SECRET[_<BRAND>]
 */
@Injectable()
export class OrderForwardService {
  private readonly logger = new Logger(OrderForwardService.name);

  constructor(
    @InjectModel(BotOrder) private readonly orderModel: typeof BotOrder,
    @InjectModel(BotCustomer) private readonly customerModel: typeof BotCustomer,
    private readonly config: ConfigService,
  ) {}

  private targetFor(brand: string): { url: string; secret: string } | null {
    const key = (brand || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const url =
      this.config.get<string>(`ORDER_FORWARD_URL_${key}`) ||
      this.config.get<string>('ORDER_FORWARD_URL');
    if (!url) return null;
    const secret =
      this.config.get<string>(`ORDER_FORWARD_SECRET_${key}`) ||
      this.config.get<string>('ORDER_FORWARD_SECRET') ||
      '';
    return { url, secret };
  }

  /** Build the stable order contract sent to the brand. */
  private async buildPayload(order: BotOrder) {
    const addr = (order.shippingAddress ?? {}) as Record<string, any>;
    const customer = order.customerId
      ? await this.customerModel.findByPk(order.customerId)
      : null;
    return {
      event: 'order.placed',
      orderId: order.id,
      brand: order.brand,
      createdAt: order.createdAt,
      product: {
        title: order.productTitle,
        slug: order.productSlug,
        size: order.size,
        qty: order.qty,
        gender: order.gender,
      },
      amount: { value: Math.round(Number(order.amountInr || 0)), currency: 'INR' },
      customer: {
        name: customer?.name ?? addr.name ?? null,
        email: customer?.email ?? null,
        mobile: customer?.mobile ?? addr.mobile ?? null,
        username: order.username ?? customer?.username ?? null,
        igsid: order.igsid,
      },
      shippingAddress: {
        name: addr.name ?? null,
        mobile: addr.mobile ?? null,
        line1: addr.line1 ?? null,
        line2: addr.line2 ?? null,
        city: addr.city ?? null,
        state: addr.state ?? null,
        pincode: addr.pincode ?? null,
        country: addr.country ?? 'India',
      },
      payment: {
        provider: 'razorpay',
        orderId: order.razorpayOrderId,
        paymentId: order.razorpayPaymentId,
        status: order.status,
      },
    };
  }

  /**
   * Push the order to the brand. Non-blocking for the checkout flow — call and
   * forget; this updates the order's fulfillment_status itself. Retries a few
   * times with backoff before marking failed.
   */
  async forward(order: BotOrder): Promise<void> {
    const target = this.targetFor(order.brand);
    if (!target) {
      await order.update({ fulfillmentStatus: 'skipped' });
      this.logger.log(`Order #${order.id}: no forward target for brand "${order.brand}" — skipped`);
      return;
    }

    const payload = await this.buildPayload(order);
    const raw = JSON.stringify(payload);
    const signature = target.secret
      ? createHmac('sha256', target.secret).update(raw).digest('hex')
      : '';

    const MAX = 3;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        const res = await fetch(target.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Brand': order.brand,
            'X-Event': 'order.placed',
          },
          body: raw,
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          let ref: string | null = null;
          try {
            const body: any = await res.json();
            ref = body?.orderId || body?.id || body?.reference || null;
          } catch {
            /* non-JSON ack is fine */
          }
          await order.update({
            fulfillmentStatus: 'sent',
            fulfillmentRef: ref ? String(ref).slice(0, 120) : null,
            fulfillmentError: null,
            fulfillmentAttempts: attempt,
          });
          this.logger.log(`Order #${order.id}: forwarded to brand (attempt ${attempt})${ref ? ` ref=${ref}` : ''}`);
          return;
        }
        if (attempt === MAX) {
          await order.update({
            fulfillmentStatus: 'failed',
            fulfillmentError: `HTTP ${res.status}`,
            fulfillmentAttempts: attempt,
          });
          this.logger.warn(`Order #${order.id}: forward failed after ${MAX} attempts (HTTP ${res.status})`);
          return;
        }
      } catch (err: any) {
        if (attempt === MAX) {
          await order.update({
            fulfillmentStatus: 'failed',
            fulfillmentError: String(err?.message || err).slice(0, 400),
            fulfillmentAttempts: attempt,
          });
          this.logger.warn(`Order #${order.id}: forward error after ${MAX} attempts: ${err?.message}`);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 500 * attempt)); // backoff 500ms, 1000ms
    }
  }
}
