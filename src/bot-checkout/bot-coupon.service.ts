import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { fn, col, where as sqWhere } from 'sequelize';
import { BotCoupon, BotCouponType } from './models/bot-coupon.model';

export interface CouponResult {
  valid: boolean;
  code?: string;
  discountInr: number;
  finalInr: number;
  label?: string; // human-readable e.g. "20% OFF" / "₹100 OFF"
  reason?: string; // why invalid
}

@Injectable()
export class BotCouponService {
  constructor(
    @InjectModel(BotCoupon)
    private readonly couponModel: typeof BotCoupon,
  ) {}

  private async findByCode(code: string): Promise<BotCoupon | null> {
    const c = (code ?? '').trim();
    if (!c) return null;
    // case-insensitive exact match
    return this.couponModel.findOne({
      where: sqWhere(fn('lower', col('code')), c.toLowerCase()),
    });
  }

  /**
   * Validate a code against an order amount and return the computed discount.
   * Discount is always computed here (never trusted from the client).
   */
  async validate(code: string, amountInr: number): Promise<CouponResult> {
    const amount = Math.max(0, Number(amountInr) || 0);
    const fail = (reason: string): CouponResult => ({ valid: false, discountInr: 0, finalInr: amount, reason });

    const coupon = await this.findByCode(code);
    if (!coupon) return fail('Invalid code');
    if (!coupon.isActive) return fail('This code is no longer active');

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) return fail('This code is not active yet');
    if (coupon.validUntil && now > new Date(coupon.validUntil)) return fail('This code has expired');
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return fail('This code has been fully used');
    if (coupon.minOrderInr != null && amount < Number(coupon.minOrderInr)) {
      return fail(`Minimum order ₹${Math.round(Number(coupon.minOrderInr))} for this code`);
    }

    let discount: number;
    let label: string;
    if (coupon.discountType === BotCouponType.PERCENT) {
      const pct = Number(coupon.discountValue);
      discount = (amount * pct) / 100;
      if (coupon.maxDiscountInr != null) discount = Math.min(discount, Number(coupon.maxDiscountInr));
      label = `${pct % 1 === 0 ? pct : pct.toFixed(0)}% OFF`;
    } else {
      discount = Number(coupon.discountValue);
      label = `₹${Math.round(discount)} OFF`;
    }

    discount = Math.min(Math.round(discount), amount); // never exceed the order
    return {
      valid: true,
      code: coupon.code,
      discountInr: discount,
      finalInr: amount - discount,
      label,
    };
  }

  /** Atomically count a successful redemption. */
  async redeem(code: string): Promise<void> {
    const coupon = await this.findByCode(code);
    if (coupon) await this.couponModel.increment('used_count', { where: { id: coupon.id } });
  }

  // ---- Admin CRUD ----

  async list() {
    return this.couponModel.findAll({ order: [['created_at', 'DESC']] });
  }

  async create(input: {
    code: string;
    discountType: BotCouponType;
    discountValue: number;
    maxDiscountInr?: number | null;
    minOrderInr?: number | null;
    isActive?: boolean;
    usageLimit?: number | null;
    validFrom?: Date | null;
    validUntil?: Date | null;
  }) {
    return this.couponModel.create({
      code: (input.code ?? '').trim().toUpperCase(),
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscountInr: input.maxDiscountInr ?? null,
      minOrderInr: input.minOrderInr ?? null,
      isActive: input.isActive ?? true,
      usageLimit: input.usageLimit ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    } as any);
  }

  async update(id: number, patch: Partial<BotCoupon>) {
    const coupon = await this.couponModel.findByPk(id);
    if (!coupon) return null;
    if (patch.code !== undefined) (patch as any).code = String(patch.code).trim().toUpperCase();
    await coupon.update(patch as any);
    return coupon;
  }

  async remove(id: number): Promise<boolean> {
    const n = await this.couponModel.destroy({ where: { id } });
    return n > 0;
  }
}
