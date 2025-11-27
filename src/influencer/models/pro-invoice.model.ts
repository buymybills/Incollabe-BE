import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { ProSubscription } from './pro-subscription.model';
import { ProPaymentTransaction } from './pro-payment-transaction.model';
import { PaymentMethod, InvoiceStatus } from './payment-enums';

// Re-export for backward compatibility
export { InvoiceStatus };

@Table({
  tableName: 'pro_invoices',
  timestamps: true,
})
export class ProInvoice extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
  })
  declare invoiceNumber: string;

  @ForeignKey(() => ProSubscription)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare subscriptionId: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare tax: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare totalAmount: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare billingPeriodStart: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare billingPeriodEnd: Date;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    defaultValue: InvoiceStatus.PENDING,
  })
  declare paymentStatus: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare razorpayOrderId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare razorpayPaymentId: string;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: false,
    defaultValue: PaymentMethod.RAZORPAY,
  })
  declare paymentMethod: PaymentMethod;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare paidAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare invoiceUrl: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare invoiceData: any;

  @BelongsTo(() => ProSubscription)
  declare subscription: ProSubscription;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @HasMany(() => ProPaymentTransaction)
  declare transactions: ProPaymentTransaction[];
}
