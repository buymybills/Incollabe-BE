import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Default,
  Index,
} from 'sequelize-typescript';

export enum ShoppingOrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Table({ tableName: 'shopping_orders', timestamps: true })
export class ShoppingOrder extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  /** Instagram sender ID — the buyer's IG user ID */
  @Index
  @AllowNull(false)
  @Column({ type: DataType.STRING(64), field: 'ig_sender_id' })
  declare igSenderId: string;

  // ─── Product ────────────────────────────────────────────────────────────────

  @AllowNull(false)
  @Column({ type: DataType.STRING(256), field: 'product_name' })
  declare productName: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(128), field: 'brand_name' })
  declare brandName: string;

  /** Numeric brand DB id — filled when matched; null when brand is not on platform */
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: 'brand_id' })
  declare brandId: number | null;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'product_url' })
  declare productUrl: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(32) })
  declare size: string | null;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 2), field: 'amount_inr' })
  declare amountInr: number;

  // ─── Customer ────────────────────────────────────────────────────────────────

  @AllowNull(true)
  @Column({ type: DataType.STRING(128), field: 'customer_name' })
  declare customerName: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(20), field: 'customer_phone' })
  declare customerPhone: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(128), field: 'customer_email' })
  declare customerEmail: string | null;

  // ─── Shipping address ────────────────────────────────────────────────────────

  @AllowNull(true)
  @Column({ type: DataType.STRING(256), field: 'shipping_line1' })
  declare shippingLine1: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(256), field: 'shipping_line2' })
  declare shippingLine2: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(128), field: 'shipping_city' })
  declare shippingCity: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(64), field: 'shipping_state' })
  declare shippingState: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(16), field: 'shipping_pincode' })
  declare shippingPincode: string | null;

  // ─── Billing address (only when different from shipping) ─────────────────────

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: 'billing_different' })
  declare billingDifferent: boolean;

  @AllowNull(true)
  @Column({ type: DataType.STRING(256), field: 'billing_line1' })
  declare billingLine1: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(256), field: 'billing_line2' })
  declare billingLine2: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(128), field: 'billing_city' })
  declare billingCity: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(64), field: 'billing_state' })
  declare billingState: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(16), field: 'billing_pincode' })
  declare billingPincode: string | null;

  // ─── Payment ─────────────────────────────────────────────────────────────────

  @AllowNull(true)
  @Column({ type: DataType.STRING(128), field: 'payment_link_id' })
  declare paymentLinkId: string | null;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'payment_short_url' })
  declare paymentShortUrl: string | null;

  @Default(ShoppingOrderStatus.PENDING)
  @Column({ type: DataType.ENUM(...Object.values(ShoppingOrderStatus)) })
  declare status: ShoppingOrderStatus;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
