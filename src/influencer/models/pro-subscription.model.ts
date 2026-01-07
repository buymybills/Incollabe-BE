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
    field: 'upi_mandate_id',
  })
  declare upiMandateId: string;

  @Column({
    type: DataType.ENUM(...Object.values(UpiMandateStatus)),
    allowNull: false,
    defaultValue: UpiMandateStatus.NOT_CREATED,
    field: 'upi_mandate_status',
  })
  declare upiMandateStatus: UpiMandateStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'mandate_created_at',
  })
  declare mandateCreatedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'mandate_authenticated_at',
  })
  declare mandateAuthenticatedAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 19900,
    field: 'mandate_max_amount',
  })
  declare mandateMaxAmount: number;

  // Pause/Resume fields
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_paused',
  })
  declare isPaused: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'paused_at',
  })
  declare pausedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'pause_start_date',
  })
  declare pauseStartDate: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'pause_duration_days',
  })
  declare pauseDurationDays: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'resume_date',
  })
  declare resumeDate: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'pause_reason',
  })
  declare pauseReason: string;

  // Tracking fields
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    field: 'pause_count',
  })
  declare pauseCount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    field: 'total_paused_days',
  })
  declare totalPausedDays: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_auto_charge_attempt',
  })
  declare lastAutoChargeAttempt: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    field: 'auto_charge_failures',
  })
  declare autoChargeFailures: number;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @HasMany(() => ProInvoice)
  declare invoices: ProInvoice[];
}
