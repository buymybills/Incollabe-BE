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
import { ProInvoice } from './pro-invoice.model';
import { SubscriptionStatus, PaymentMethod } from './payment-enums';

// Re-export for backward compatibility
export { SubscriptionStatus, PaymentMethod };

@Table({
  tableName: 'pro_subscriptions',
  timestamps: true,
})
export class ProSubscription extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Column({
    type: DataType.ENUM(...Object.values(SubscriptionStatus)),
    allowNull: false,
    defaultValue: SubscriptionStatus.PAYMENT_PENDING,
  })
  declare status: SubscriptionStatus;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare startDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare currentPeriodStart: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare currentPeriodEnd: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare nextBillingDate: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 19900, // Rs 199 in paise
  })
  declare subscriptionAmount: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: false,
    defaultValue: PaymentMethod.RAZORPAY,
  })
  declare paymentMethod: PaymentMethod;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare razorpaySubscriptionId: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare autoRenew: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare cancelledAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare cancelReason: string;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @HasMany(() => ProInvoice)
  declare invoices: ProInvoice[];
}
