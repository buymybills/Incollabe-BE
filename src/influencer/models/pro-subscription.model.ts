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
import { SubscriptionStatus, PaymentMethod, UpiMandateStatus } from './payment-enums';

// Re-export for backward compatibility
export { SubscriptionStatus, PaymentMethod, UpiMandateStatus };

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

  // UPI Autopay fields
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare upiMandateId: string;

  @Column({
    type: DataType.ENUM(...Object.values(UpiMandateStatus)),
    allowNull: false,
    defaultValue: UpiMandateStatus.NOT_CREATED,
  })
  declare upiMandateStatus: UpiMandateStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare mandateCreatedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare mandateAuthenticatedAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 19900,
  })
  declare mandateMaxAmount: number;

  // Pause/Resume fields
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isPaused: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare pausedAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare pauseDurationDays: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare resumeDate: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare pauseReason: string;

  // Tracking fields
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare pauseCount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare totalPausedDays: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastAutoChargeAttempt: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare autoChargeFailures: number;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @HasMany(() => ProInvoice)
  declare invoices: ProInvoice[];
}
