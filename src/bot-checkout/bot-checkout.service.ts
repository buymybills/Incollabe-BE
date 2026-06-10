import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Op } from 'sequelize';
import { BotCustomer } from './models/bot-customer.model';
import { BotAddress } from './models/bot-address.model';
import { BotOrder } from './models/bot-order.model';
import { BotAnalyticsService } from '../bot-analytics/bot-analytics.service';
import { BotEventType } from '../bot-analytics/models/bot-event.model';
import {
  CheckoutPayload,
  hashUserKey,
  verifyRazorpaySignature,
} from './checkout-token.util';

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
    private readonly config: ConfigService,
    private readonly analytics: BotAnalyticsService,
  ) {}

  /** Find or create the customer for an IG sender, updating any contact fields provided. */
  async getOrCreateCustomer(input: CustomerInput): Promise<BotCustomer> {
    const brand = input.brand || 'thesouledstore';
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
  async getCustomerWithAddresses(brand: string, igsid: string) {
    const customer = await this.customerModel.findOne({ where: { brand, igsid } });
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
    const existing = await this.addressModel.count({
      where: { customerId: customer.id, isActive: true },
    });
    // First address (or explicitly requested) becomes the default
    const makeDefault = address.isDefault || existing === 0;
    if (makeDefault) {
      await this.addressModel.update(
        { isDefault: false },
        { where: { customerId: customer.id } },
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
    } as any);
  }

  /** Soft-delete an address, but only if it belongs to this IG sender. */
  async deleteAddress(brand: string, igsid: string, addressId: number): Promise<boolean> {
    const customer = await this.customerModel.findOne({ where: { brand, igsid } });
    if (!customer) return false;
    const addr = await this.addressModel.findOne({
      where: { id: addressId, customerId: customer.id, isActive: true },
    });
    if (!addr) return false;
    await addr.update({ isActive: false });
    // If we removed the default, promote the most recent remaining address
    if (addr.isDefault) {
      const next = await this.addressModel.findOne({
        where: { customerId: customer.id, isActive: true },
        order: [['updated_at', 'DESC']],
      });
      if (next) await next.update({ isDefault: true });
    }
    return true;
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
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    method?: string;
    status?: string;
  }): Promise<BotOrder> {
    const customer = await this.getOrCreateCustomer(params.input);

    if (params.razorpayPaymentId) {
      const dup = await this.orderModel.findOne({
        where: { razorpayPaymentId: params.razorpayPaymentId },
      });
      if (dup) return dup;
    }

    let snapshot: Record<string, any> | null = null;
    if (params.addressId) {
      const addr = await this.addressModel.findOne({
        where: { id: params.addressId, customerId: customer.id },
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
      brand: params.input.brand || 'thesouledstore',
      customerId: customer.id,
      igsid: params.input.igsid,
      username: params.input.username ?? customer.username ?? null,
      productSlug: params.productSlug ?? null,
      productTitle: params.productTitle ?? null,
      size: params.size ?? null,
      gender: params.gender ?? null,
      qty: params.qty ?? 1,
      amountInr: params.amountInr,
      razorpayOrderId: params.razorpayOrderId ?? null,
      razorpayPaymentId: params.razorpayPaymentId ?? null,
      razorpaySignature: params.razorpaySignature ?? null,
      method: params.method ?? null,
      status: params.status ?? 'paid',
      shippingAddress: snapshot,
    } as any);
  }

  /** Detailed order list for the admin table — includes shipping address + Razorpay txn. */
  async adminOrders(
    range: { brand?: string; startDate?: Date; endDate?: Date },
    limit = 100,
  ) {
    const where: any = { brand: range.brand || 'thesouledstore' };
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
  ): Promise<{ orderId: string; keyId: string; amount: number } | null> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret || !payload.priceInr || payload.priceInr <= 0) return null;
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const amount = Math.round(payload.priceInr * 100);
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          notes: {
            source: 'checkout',
            igsid: payload.igsid,
            productSlug: payload.slug ?? '',
            productTitle: (payload.title ?? '').slice(0, 100),
            size: payload.size ?? '',
          },
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Razorpay order create failed: ${res.status}`);
        return null;
      }
      const data: any = await res.json();
      if (!data?.id) return null;
      return { orderId: data.id, keyId, amount };
    } catch (err: any) {
      this.logger.error(`Razorpay order error: ${err?.message}`);
      return null;
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
    },
  ): Promise<{ ok: boolean; orderId?: number; error?: string }> {
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
    if (!verifyRazorpaySignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, keySecret)) {
      this.logger.warn(`Signature verification failed for ${body.razorpay_payment_id}`);
      return { ok: false, error: 'signature_failed' };
    }

    const userKey = hashUserKey(payload.igsid);
    const gender = payload.gender || undefined;

    const order = await this.saveOrder({
      input: { igsid: payload.igsid, username: payload.username, userKey },
      addressId: body.addressId,
      productSlug: payload.slug,
      productTitle: payload.title,
      size: payload.size,
      gender,
      amountInr: payload.priceInr,
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature,
      method: body.method,
      status: 'paid',
    });

    // Record the sale (GMV / Orders) directly via the analytics service
    this.analytics.track([
      {
        eventType: BotEventType.PAYMENT_COMPLETED,
        userKey,
        username: payload.username,
        productSlug: payload.slug,
        productTitle: payload.title,
        size: payload.size,
        gender,
        priceInr: payload.priceInr,
        valueInr: payload.priceInr,
        metadata: { razorpayPaymentId: body.razorpay_payment_id, orderId: order.id },
      } as any,
    ]);

    // Confirm to the shopper in Instagram
    const sizeLabel = payload.size ? ` (Size ${payload.size})` : '';
    void this.sendInstagramDm(
      payload.igsid,
      `✅ Payment of ₹${payload.priceInr.toLocaleString('en-IN')} received for ${payload.title ?? 'your order'}${sizeLabel}! 🎉\nYour order is confirmed — we'll get it shipped to your saved address. Thanks for shopping with The Souled Store! 🛍️`,
    );

    this.logger.log(`Checkout order #${order.id} paid — ${payload.title} ₹${payload.priceInr} (${body.razorpay_payment_id})`);
    return { ok: true, orderId: order.id };
  }

  /** Send a plain-text Instagram DM via the Graph API (reuses the bot's page token). */
  private async sendInstagramDm(igsid: string, text: string): Promise<void> {
    const token = this.config.get<string>('IG_PAGE_ACCESS_TOKEN');
    const version = this.config.get<string>('IG_GRAPH_VERSION') || 'v21.0';
    if (!token) return;
    try {
      await fetch(`https://graph.instagram.com/${version}/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text } }),
      });
    } catch (err: any) {
      this.logger.warn(`Confirmation DM failed: ${err?.message}`);
    }
  }
}
