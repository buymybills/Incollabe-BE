import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BotOrder } from '../bot-checkout/models/bot-order.model';
import { RazorpayService } from '../shared/razorpay.service';

export interface RefundResult {
  refunded: boolean;
  amountInr?: number;
  refundId?: string;
  status?: string;
  reason?: string;
}

/**
 * Issues the REAL refund for a cancelled/returned bot order. Payment was taken via
 * Razorpay (the mediator's gateway), NOT Shopify — so Shopify's cancel can't refund
 * it. The connector calls this after a successful Shopify cancel. Idempotent: an
 * order already marked `refunded` is not refunded again.
 */
@Injectable()
export class BotRefundService {
  private readonly logger = new Logger(BotRefundService.name);

  constructor(
    @InjectModel(BotOrder) private readonly orderModel: typeof BotOrder,
    private readonly razorpay: RazorpayService,
  ) {}

  // `orderId` is the id the connector holds; checkout orders are "chk_<bot_orders.id>".
  // `amountInr` (optional) refunds a PARTIAL amount (e.g. a partial return); omitted
  // or >= order total = full refund. Guards against over-refunding a partial return.
  async refundOrder(orderId: string, reason?: string, amountInr?: number): Promise<RefundResult> {
    const m = /^chk_(\d+)$/.exec(orderId || '');
    if (!m) return { refunded: false, reason: 'not a checkout order (no Razorpay payment to refund)' };

    const order = await this.orderModel.findByPk(Number(m[1]));
    if (!order) return { refunded: false, reason: 'order not found' };
    if (!order.razorpayPaymentId) return { refunded: false, reason: 'no Razorpay payment (COD / unpaid)' };
    if (order.status === 'refunded') {
      return { refunded: true, amountInr: Number(order.amountInr), status: 'already_refunded', reason: 'already refunded' };
    }

    const fullInr = Number(order.amountInr);
    // Partial only when a positive amount strictly below the order total is given;
    // otherwise full refund (amountPaise undefined). Never refunds more than paid.
    let amountPaise: number | undefined;
    let refundInr = fullInr;
    if (amountInr != null && amountInr > 0 && amountInr < fullInr) {
      amountPaise = Math.round(amountInr * 100);
      refundInr = amountInr;
    }

    const res = await this.razorpay.refundPayment(order.razorpayPaymentId, amountPaise);
    if (!res.success || !res.data) {
      this.logger.error(`refund failed order=${order.id} payment=${order.razorpayPaymentId}: ${res.error}`);
      return { refunded: false, reason: res.error || 'refund failed' };
    }
    const d = res.data;

    // NB: single-item flow → one refund per order. Multiple partial refunds on one
    // order would need a refunded-amount column (status is boolean here).
    order.status = 'refunded';
    await order.save();
    this.logger.log(`refunded order=${order.id} payment=${order.razorpayPaymentId} refund=${d.id} ₹${refundInr}${amountPaise ? ' (partial)' : ''} (${reason || '—'})`);
    return { refunded: true, amountInr: refundInr, refundId: d.id, status: d.status };
  }
}
