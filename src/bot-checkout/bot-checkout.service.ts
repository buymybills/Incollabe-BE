import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { BotCustomer } from './models/bot-customer.model';
import { BotAddress } from './models/bot-address.model';
import { BotOrder } from './models/bot-order.model';
import { BotAnalyticsService } from '../bot-analytics/bot-analytics.service';
import { BotEventType } from '../bot-analytics/models/bot-event.model';
import { OrderForwardService } from './order-forward.service';
import { BotCartService } from './bot-cart.service';
import { BotCouponService } from './bot-coupon.service';
import {
  CheckoutPayload,
  hashUserKey,
  verifyRazorpaySignature,
} from './checkout-token.util';

const DEFAULT_BRAND = 'thesouledstore';
const MAX_ADDRESSES_PER_CUSTOMER = 10;
const RAZORPAY_TIMEOUT_MS = 10_000;

/** Amount to charge: sum of cart line items, or the single-item priceInr. */
export function cartTotalInr(payload: CheckoutPayload): number {
  if (payload.items?.length) {
    return payload.items.reduce(
      (sum, it) => sum + (Number(it.priceInr) || 0) * Math.max(1, it.qty ?? 1),
      0,
    );
  }
  return Number(payload.priceInr) || 0;
}

export interface CustomerInput {
  igsid: string;
  brand?: string;
  userKey?: string;
  username?: string;
  name?: string;
  email?: string;
  mobile?: string;
}

export interface AddressInput {
  label?: string;
  name?: string;
  mobile?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

@Injectable()
export class BotCheckoutService {
  private readonly logger = new Logger(BotCheckoutService.name);

  constructor(
    @InjectModel(BotCustomer) private readonly customerModel: typeof BotCustomer,
    @InjectModel(BotAddress) private readonly addressModel: typeof BotAddress,
    @InjectModel(BotOrder) private readonly orderModel: typeof BotOrder,
    private readonly sequelize: Sequelize,
    private readonly config: ConfigService,
    private readonly analytics: BotAnalyticsService,
    private readonly forwarder: OrderForwardService,
    private readonly cart: BotCartService,
    private readonly coupon: BotCouponService,
  ) {}

  /** Find or create the customer for an IG sender, updating any contact fields provided. */
  async getOrCreateCustomer(input: CustomerInput): Promise<BotCustomer> {
    const brand = input.brand || DEFAULT_BRAND;
    let customer = await this.customerModel.findOne({
      where: { brand, igsid: input.igsid },
    });
    if (!customer) {
      customer = await this.customerModel.create({
        brand,
        igsid: input.igsid,
        userKey: input.userKey ?? null,
        username: input.username ?? null,
        name: input.name ?? null,
        email: input.email ?? null,
        mobile: input.mobile ?? null,
      } as any);
    } else {
      // Fill/refresh contact details when newer values arrive
      const patch: any = {};
      if (input.userKey && !customer.userKey) patch.userKey = input.userKey;
      if (input.username) patch.username = input.username;
      if (input.name) patch.name = input.name;
      if (input.email) patch.email = input.email;
      if (input.mobile) patch.mobile = input.mobile;
      if (Object.keys(patch).length) await customer.update(patch);
    }
    return customer;
  }

  /** Customer + their active saved addresses (default first), for the checkout page. */
  async getCustomerWithAddresses(igsid: string) {
    const customer = await this.customerModel.findOne({ where: { brand: DEFAULT_BRAND, igsid } });
    if (!customer) return { customer: null, addresses: [] as BotAddress[] };
    const addresses = await this.listAddresses(customer.id);
    return { customer, addresses };
  }

  async listAddresses(customerId: number): Promise<BotAddress[]> {
    return this.addressModel.findAll({
      where: { customerId, isActive: true },
      order: [
        ['is_default', 'DESC'],
        ['updated_at', 'DESC'],
      ],
    });
  }

  /** Add a new address for an IG sender (creating the customer if needed). */
  async addAddress(input: CustomerInput, address: AddressInput): Promise<BotAddress> {
    const customer = await this.getOrCreateCustomer(input);

    return this.sequelize.transaction(async (t) => {
      const existing = await this.addressModel.count({
        where: { customerId: customer.id, isActive: true },
        transaction: t,
      });

      if (existing >= MAX_ADDRESSES_PER_CUSTOMER) {
        throw new BadRequestException(
          `You can save a maximum of ${MAX_ADDRESSES_PER_CUSTOMER} addresses. Please delete one before adding a new one.`,
        );
      }

      // First address (or explicitly requested) becomes the default
      const makeDefault = address.isDefault || existing === 0;
      if (makeDefault) {
        await this.addressModel.update(
          { isDefault: false },
          { where: { customerId: customer.id }, transaction: t },
        );
      }

      return this.addressModel.create({
        customerId: customer.id,
        label: address.label ?? null,
        name: address.name ?? customer.name ?? null,
        mobile: address.mobile ?? customer.mobile ?? null,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India',
        isDefault: makeDefault,
        isActive: true,
      } as any, { transaction: t });
    });
  }

  /** Soft-delete an address, but only if it belongs to this IG sender. */
  async deleteAddress(igsid: string, addressId: number): Promise<boolean> {
    return this.sequelize.transaction(async (t) => {
      const customer = await this.customerModel.findOne({
        where: { brand: DEFAULT_BRAND, igsid },
        transaction: t,
      });
      if (!customer) return false;

      const addr = await this.addressModel.findOne({
        where: { id: addressId, customerId: customer.id, isActive: true },
        transaction: t,
      });
      if (!addr) return false;

      await addr.update({ isActive: false }, { transaction: t });

      // If we removed the default, promote the most-recently-updated remaining address
      if (addr.isDefault) {
        const next = await this.addressModel.findOne({
          where: { customerId: customer.id, isActive: true },
          order: [['updated_at', 'DESC']],
          transaction: t,
        });
        if (next) await next.update({ isDefault: true }, { transaction: t });
      }

      return true;
    });
  }

  /** Persist a paid order (idempotent on razorpay_payment_id). */
  async saveOrder(params: {
    input: CustomerInput;
    addressId?: number;
    productSlug?: string;
    productTitle?: string;
    size?: string;
    gender?: string;
    qty?: number;
    amountInr: number;
    couponCode?: string | null;
    discountInr?: number;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    method?: string;
    status?: string;
    // Cart checkout writes one row per line under the same payment id, so dedup
    // must be per (payment, product, size) rather than per payment alone.
    dedupeBySlugSize?: boolean;
  }): Promise<BotOrder> {
    const customer = await this.getOrCreateCustomer(params.input);

    return this.sequelize.transaction(async (t) => {
      // Idempotency: return the existing order if this payment (line) was already recorded
      if (params.razorpayPaymentId) {
        const where: any = { razorpayPaymentId: params.razorpayPaymentId };
        if (params.dedupeBySlugSize) {
          where.productSlug = params.productSlug ?? null;
          where.size = params.size ?? null;
        }
        const dup = await this.orderModel.findOne({ where, transaction: t });
        if (dup) return dup;
      }

      let snapshot: Record<string, any> | null = null;
      if (params.addressId) {
        const addr = await this.addressModel.findOne({
          where: { id: params.addressId, customerId: customer.id },
          transaction: t,
        });
        if (addr) {
          snapshot = {
            label: addr.label,
            name: addr.name,
            mobile: addr.mobile,
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            country: addr.country,
          };
        }
      }

      return this.orderModel.create({
        brand: params.input.brand || DEFAULT_BRAND,
        customerId: customer.id,
        igsid: params.input.igsid,
        username: params.input.username ?? customer.username ?? null,
        productSlug: params.productSlug ?? null,
        productTitle: params.productTitle ?? null,
        size: params.size ?? null,
        gender: params.gender ?? null,
        qty: params.qty ?? 1,
        amountInr: params.amountInr,
        couponCode: params.couponCode ?? null,
        discountInr: params.discountInr ?? 0,
        razorpayOrderId: params.razorpayOrderId ?? null,
        razorpayPaymentId: params.razorpayPaymentId ?? null,
        razorpaySignature: params.razorpaySignature ?? null,
        method: params.method ?? null,
        status: params.status ?? 'paid',
        shippingAddress: snapshot,
      } as any, { transaction: t });
    });
  }

  /** Detailed order list for the admin table — includes shipping address + Razorpay txn. */
  async adminOrders(
    range: { brand?: string; startDate?: Date; endDate?: Date },
    limit = 100,
  ) {
    const where: any = { brand: range.brand || DEFAULT_BRAND };
    if (range.startDate || range.endDate) {
      where.createdAt = {};
      if (range.startDate) where.createdAt[Op.gte] = range.startDate;
      if (range.endDate) where.createdAt[Op.lte] = range.endDate;
    }
    const rows = await this.orderModel.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      include: [
        { model: BotCustomer, attributes: ['name', 'email', 'mobile', 'username'] },
      ],
    });
    return rows.map((o) => {
      const addr = (o.shippingAddress ?? {}) as Record<string, any>;
      return {
        id: o.id,
        product: o.productTitle,
        slug: o.productSlug,
        size: o.size,
        gender: o.gender,
        amountInr: Math.round(Number(o.amountInr || 0)),
        status: o.status,
        paid: o.status === 'paid',
        username: o.username ?? o.customer?.username ?? null,
        customerName: o.customer?.name ?? addr.name ?? null,
        mobile: o.customer?.mobile ?? addr.mobile ?? null,
        email: o.customer?.email ?? null,
        razorpayPaymentId: o.razorpayPaymentId,
        razorpayOrderId: o.razorpayOrderId,
        address: o.shippingAddress
          ? [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
          : null,
        createdAt: o.createdAt,
      };
    });
  }

  // ==========================================================================
  // PAYMENT — Razorpay order creation + verification (moved here from the bot)
  // ==========================================================================

  /** Create a Razorpay Order for Standard Checkout. Amount comes from the signed token. */
  async createRazorpayOrder(
    payload: CheckoutPayload,
    couponCode?: string,
  ): Promise<{ orderId: string; keyId: string; amount: number; baseInr: number; discountInr: number; couponCode: string | null } | null> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    // Cart checkout: charge the sum of the line items. Single item: charge priceInr.
    const baseInr = cartTotalInr(payload);
    if (!keyId || !keySecret || !baseInr || baseInr <= 0) return null;

    // Apply a bot coupon (validated server-side — never trust a client discount).
    let chargeInr = baseInr;
    let discountInr = 0;
    let appliedCode: string | null = null;
    if (couponCode) {
      const cp = await this.coupon.validate(couponCode, baseInr);
      if (cp.valid) {
        chargeInr = cp.finalInr;
        discountInr = cp.discountInr;
        appliedCode = cp.code ?? null;
      }
    }
    if (chargeInr < 1) chargeInr = 1; // Razorpay minimum is ₹1

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RAZORPAY_TIMEOUT_MS);
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const amount = Math.round(chargeInr * 100);
      const isCart = !!payload.items?.length;
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          notes: {
            source: 'checkout',
            igsid: payload.igsid,
            productSlug: isCart ? '' : (payload.slug ?? ''),
            productTitle: isCart
              ? `Cart (${payload.items!.length} item${payload.items!.length === 1 ? '' : 's'})`
              : (payload.title ?? '').slice(0, 100),
            size: isCart ? '' : (payload.size ?? ''),
            couponCode: appliedCode ?? '',
            discountInr,
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Razorpay order create failed: ${res.status}`);
        return null;
      }
      const data: any = await res.json();
      if (!data?.id) return null;
      return { orderId: data.id, keyId, amount, baseInr, discountInr, couponCode: appliedCode };
    } catch (err: any) {
      this.logger.error(`Razorpay order error: ${err?.message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Verify the Razorpay payment signature, persist the paid order (with address +
   * txn), record the sale for analytics, and DM the shopper a confirmation.
   */
  async completePayment(
    payload: CheckoutPayload,
    body: {
      addressId?: number;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      method?: string;
      code?: string;
    },
  ): Promise<{ ok: boolean; orderId?: number; error?: string }> {
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
    if (!verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, keySecret)) {
      this.logger.warn(`Signature verification failed for ${body.razorpay_payment_id}`);
      return { ok: false, error: 'signature_failed' };
    }

    const userKey = hashUserKey(payload.igsid);
    const gender = payload.gender || undefined;

    // Re-validate the coupon server-side and compute the total discount applied.
    const baseTotal = cartTotalInr(payload);
    let discountTotal = 0;
    let appliedCode: string | null = null;
    if (body.code) {
      const cp = await this.coupon.validate(body.code, baseTotal);
      if (cp.valid) {
        discountTotal = cp.discountInr;
        appliedCode = cp.code ?? null;
      }
    }
    const netTotal = Math.max(0, baseTotal - discountTotal);

    // ---- Cart checkout: one paid order row per line, sharing the payment id ----
    if (payload.items?.length) {
      const orders: BotOrder[] = [];
      let remainingDiscount = discountTotal;
      for (let i = 0; i < payload.items.length; i++) {
        const it = payload.items[i];
        const qty = Math.max(1, it.qty ?? 1);
        const lineBase = (Number(it.priceInr) || 0) * qty;
        // Distribute the discount across lines proportionally; the last line takes
        // the rounding remainder so the recorded amounts sum to what was charged.
        const isLast = i === payload.items.length - 1;
        const lineDiscount = isLast
          ? remainingDiscount
          : (baseTotal > 0 ? Math.min(remainingDiscount, Math.round(discountTotal * (lineBase / baseTotal))) : 0);
        remainingDiscount -= lineDiscount;
        const lineAmount = Math.max(0, lineBase - lineDiscount);

        const order = await this.saveOrder({
          input: { igsid: payload.igsid, username: payload.username, userKey },
          addressId: body.addressId,
          productSlug: it.slug,
          productTitle: it.title,
          size: it.size,
          gender,
          qty,
          amountInr: lineAmount,
          couponCode: appliedCode,
          discountInr: lineDiscount,
          razorpayOrderId: body.razorpay_order_id,
          razorpayPaymentId: body.razorpay_payment_id,
          razorpaySignature: body.razorpay_signature,
          method: body.method,
          status: 'paid',
          dedupeBySlugSize: true,
        });
        orders.push(order);

        void this.analytics.track([
          {
            eventType: BotEventType.PAYMENT_COMPLETED,
            userKey,
            username: payload.username,
            productSlug: it.slug,
            productTitle: it.title,
            size: it.size,
            gender,
            priceInr: it.priceInr,
            valueInr: lineAmount,
            metadata: { razorpayPaymentId: body.razorpay_payment_id, orderId: order.id, couponCode: appliedCode, discountInr: lineDiscount },
          } as any,
        ]);

        void this.forwarder.forward(order);
        void this.fetchRazorpayEmail(body.razorpay_payment_id).then((customerEmail) =>
          this.pushOrderToHub(order, {
            title: it.title,
            slug: it.slug,
            size: it.size,
            gender,
            priceInr: it.priceInr,
            amountInr: lineAmount,
            igsid: payload.igsid,
            username: payload.username,
            customerEmail,
          }),
        );
      }

      if (appliedCode) void this.coupon.redeem(appliedCode).catch(() => {});
      // Empty the shopper's cart now that it's paid (best-effort).
      void this.cart.clear(payload.igsid).catch(() => {});

      const savedLine = discountTotal > 0 ? ` (saved ₹${discountTotal.toLocaleString('en-IN')} with ${appliedCode})` : '';
      void this.sendInstagramDm(
        payload.igsid,
        `✅ Payment of ₹${netTotal.toLocaleString('en-IN')} received for ${payload.items.length} item${payload.items.length === 1 ? '' : 's'}!${savedLine} 🎉\nYour order is confirmed — we'll ship everything to your saved address. Thanks for shopping with The Souled Store! 🛍️`,
      );
      this.logger.log(`Cart checkout paid — ${payload.items.length} lines ₹${netTotal} (disc ₹${discountTotal}) (${body.razorpay_payment_id})`);
      return { ok: true, orderId: orders[0]?.id };
    }

    // ---- Single-item checkout ----
    const order = await this.saveOrder({
      input: { igsid: payload.igsid, username: payload.username, userKey },
      addressId: body.addressId,
      productSlug: payload.slug,
      productTitle: payload.title,
      size: payload.size,
      gender,
      amountInr: netTotal,
      couponCode: appliedCode,
      discountInr: discountTotal,
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature,
      method: body.method,
      status: 'paid',
    });
    if (appliedCode) void this.coupon.redeem(appliedCode).catch(() => {});

    // Record the sale (GMV / Orders) directly via the analytics service
    void this.analytics.track([
      {
        eventType: BotEventType.PAYMENT_COMPLETED,
        userKey,
        username: payload.username,
        productSlug: payload.slug,
        productTitle: payload.title,
        size: payload.size,
        gender,
        priceInr: payload.priceInr,
        valueInr: netTotal,
        metadata: { razorpayPaymentId: body.razorpay_payment_id, orderId: order.id, couponCode: appliedCode, discountInr: discountTotal },
      } as any,
    ]);

    // Forward the order OUTBOUND to the brand's system ("revert it to them").
    void this.forwarder.forward(order);
    // Push to the bot's order hub so the connector creates the store entry in real time.
    void this.fetchRazorpayEmail(body.razorpay_payment_id).then((customerEmail) =>
      this.pushOrderToHub(order, {
        title: payload.title,
        slug: payload.slug,
        size: payload.size,
        gender,
        priceInr: payload.priceInr,
        amountInr: netTotal,
        igsid: payload.igsid,
        username: payload.username,
        customerEmail,
      }),
    );

    // Confirm to the shopper in Instagram
    const sizeLabel = payload.size ? ` (Size ${payload.size})` : '';
    const savedLine = discountTotal > 0 ? ` (saved ₹${discountTotal.toLocaleString('en-IN')} with ${appliedCode})` : '';
    void this.sendInstagramDm(
      payload.igsid,
      `✅ Payment of ₹${netTotal.toLocaleString('en-IN')} received for ${payload.title ?? 'your order'}${sizeLabel}!${savedLine} 🎉\nYour order is confirmed — we'll get it shipped to your saved address. Thanks for shopping with The Souled Store! 🛍️`,
    );

    this.logger.log(`Checkout order #${order.id} paid — ${payload.title} ₹${payload.priceInr} (${body.razorpay_payment_id})`);
    return { ok: true, orderId: order.id };
  }

  /** Fetch the customer email from Razorpay payment details (best-effort). */
  private async fetchRazorpayEmail(paymentId: string): Promise<string | null> {
    try {
      const keyId = this.config.get<string>('RAZORPAY_KEY_ID') || '';
      const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      return data?.email ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Push a placed order line to the bot's order-ingest hub (fire-and-forget) so
   * the per-brand connector (Shopify / WooCommerce / Next.js) creates the store
   * entry in real time. Must never block or fail the checkout.
   */
  private async pushOrderToHub(
    order: BotOrder,
    line: {
      title?: string; slug?: string; size?: string; gender?: string;
      priceInr: number; amountInr: number; igsid: string; username?: string;
      customerEmail?: string | null;
    },
  ): Promise<void> {
    const url = this.config.get<string>('BOT_ORDER_INGEST_URL');
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-order-key': this.config.get<string>('ORDER_INGEST_KEY') || '',
        },
        body: JSON.stringify({
          orderId: `chk_${order.id}`, // stable id → connector dedupes on it
          brand: order.brand,
          productTitle: line.title,
          productSlug: line.slug,
          size: line.size,
          gender: line.gender,
          priceInr: line.priceInr,
          amountInr: line.amountInr,
          username: line.username,
          igsid: line.igsid,
          paymentEvent: 'checkout.verified',
          customerName: (order as any).shippingAddress?.name,
          customerEmail: line.customerEmail ?? null,
          customerPhone: (order as any).shippingAddress?.mobile,
          shippingAddress: (order as any).shippingAddress || undefined,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: any) {
      this.logger.warn(`Order ingest push failed for #${order.id}: ${err?.message}`);
    }
  }

  /** Send a plain-text Instagram DM via the Graph API (reuses the bot's page token). */
  private async sendInstagramDm(igsid: string, text: string): Promise<void> {
    const token = this.config.get<string>('IG_PAGE_ACCESS_TOKEN');
    const version = this.config.get<string>('IG_GRAPH_VERSION') || 'v21.0';
    if (!token) return;
    try {
      // Use Authorization header so the token never appears in server/proxy access logs
      await fetch(`https://graph.instagram.com/${version}/me/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text } }),
      });
    } catch (err: any) {
      this.logger.warn(`Confirmation DM failed: ${err?.message}`);
    }
  }
}
