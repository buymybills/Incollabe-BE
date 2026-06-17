import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, AllowNull, Default, Unique } from 'sequelize-typescript';

export enum BotCouponType {
  PERCENT = 'percent', // value = % off
  FLAT = 'flat', // value = flat ₹ off
}

/**
 * Bot-managed promo codes for the Instagram shopping checkout. These are OUR
 * codes (not The Souled Store website coupons) — we control the discount and the
 * reconciliation, so the discount is always recomputed server-side.
 */
@Table({
  tableName: 'bot_coupons',
  timestamps: true,
  underscored: true,
})
export class BotCoupon extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  /** Stored UPPERCASE; matching is case-insensitive. */
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(40))
  declare code: string;

  @AllowNull(false)
  @Default(BotCouponType.PERCENT)
  @Column({ field: 'discount_type', type: DataType.STRING(10) })
  declare discountType: BotCouponType;

  @AllowNull(false)
  @Column({ field: 'discount_value', type: DataType.DECIMAL(10, 2) })
  declare discountValue: number;

  /** Cap for percent discounts (₹). Null = uncapped. */
  @AllowNull(true)
  @Column({ field: 'max_discount_inr', type: DataType.DECIMAL(10, 2) })
  declare maxDiscountInr: number | null;

  /** Minimum order value (₹) for the code to apply. */
  @AllowNull(true)
  @Column({ field: 'min_order_inr', type: DataType.DECIMAL(10, 2) })
  declare minOrderInr: number | null;

  @AllowNull(false)
  @Default(true)
  @Column({ field: 'is_active', type: DataType.BOOLEAN })
  declare isActive: boolean;

  /** Total redemptions allowed across all users. Null = unlimited. */
  @AllowNull(true)
  @Column({ field: 'usage_limit', type: DataType.INTEGER })
  declare usageLimit: number | null;

  @AllowNull(false)
  @Default(0)
  @Column({ field: 'used_count', type: DataType.INTEGER })
  declare usedCount: number;

  @AllowNull(true)
  @Column({ field: 'valid_from', type: DataType.DATE })
  declare validFrom: Date | null;

  @AllowNull(true)
  @Column({ field: 'valid_until', type: DataType.DATE })
  declare validUntil: Date | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
