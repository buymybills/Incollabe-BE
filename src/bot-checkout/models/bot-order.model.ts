import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Index,
  Default,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { BotCustomer } from './bot-customer.model';

/**
 * A placed order from the hosted checkout page, with the Razorpay transaction
 * details and a frozen snapshot of the shipping address (so editing/deleting an
 * address later never mutates order history).
 */
@Table({
  tableName: 'bot_orders',
  timestamps: true,
  underscored: true,
})
export class BotOrder extends Model<BotOrder> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @AllowNull(false)
  @Default('thesouledstore')
  @Index
  @Column(DataType.STRING(60))
  declare brand: string;

  @ForeignKey(() => BotCustomer)
  @AllowNull(true)
  @Index
  @Column({ field: 'customer_id', type: DataType.INTEGER })
  declare customerId: number | null;

  @BelongsTo(() => BotCustomer)
  declare customer?: BotCustomer;

  @AllowNull(true)
  @Index
  @Column(DataType.STRING(64))
  declare igsid: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  declare username: string | null;

  // Product
  @AllowNull(true)
  @Index
  @Column(DataType.STRING(180))
  declare productSlug: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare productTitle: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare size: string | null;

  @AllowNull(false)
  @Default(1)
  @Column(DataType.INTEGER)
  declare qty: number;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare gender: string | null;

  @AllowNull(false)
  @Column({ field: 'amount_inr', type: DataType.DECIMAL(10, 2) })
  declare amountInr: number;

  // Coupon applied (bot-managed promo codes)
  @AllowNull(true)
  @Column({ field: 'coupon_code', type: DataType.STRING(40) })
  declare couponCode: string | null;

  @AllowNull(false)
  @Default(0)
  @Column({ field: 'discount_inr', type: DataType.DECIMAL(10, 2) })
  declare discountInr: number;

  // Razorpay transaction details
  @AllowNull(true)
  @Index
  @Column({ field: 'razorpay_order_id', type: DataType.STRING(60) })
  declare razorpayOrderId: string | null;

  @AllowNull(true)
  @Index
  @Column({ field: 'razorpay_payment_id', type: DataType.STRING(60) })
  declare razorpayPaymentId: string | null;

  @AllowNull(true)
  @Column({ field: 'razorpay_signature', type: DataType.STRING(180) })
  declare razorpaySignature: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(30))
  declare method: string | null;

  // created | paid | failed
  @AllowNull(false)
  @Default('created')
  @Index
  @Column(DataType.STRING(20))
  declare status: string;

  // Frozen shipping address snapshot at time of order
  @AllowNull(true)
  @Column({ field: 'shipping_address', type: DataType.JSONB })
  declare shippingAddress: Record<string, any> | null;

  // Outbound forwarding to the brand's store/system ("revert the order to them")
  // pending | sent | failed | skipped
  @AllowNull(false)
  @Default('pending')
  @Index
  @Column({ field: 'fulfillment_status', type: DataType.STRING(20) })
  declare fulfillmentStatus: string;

  // Brand's reference for the order (returned by their endpoint), if any
  @AllowNull(true)
  @Column({ field: 'fulfillment_ref', type: DataType.STRING(120) })
  declare fulfillmentRef: string | null;

  @AllowNull(true)
  @Column({ field: 'fulfillment_error', type: DataType.STRING(400) })
  declare fulfillmentError: string | null;

  @AllowNull(false)
  @Default(0)
  @Column({ field: 'fulfillment_attempts', type: DataType.INTEGER })
  declare fulfillmentAttempts: number;

  @CreatedAt
  @Index
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}
