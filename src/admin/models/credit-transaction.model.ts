import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Admin } from './admin.model';

export enum CreditTransactionType {
  REFERRAL_BONUS = 'referral_bonus',
  EARLY_SELECTION_BONUS = 'early_selection_bonus',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Table({
  tableName: 'credit_transactions',
  timestamps: true,
})
export class CreditTransaction extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Column({
    type: DataType.ENUM(...Object.values(CreditTransactionType)),
    allowNull: false,
  })
  declare transactionType: CreditTransactionType;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    comment: 'Amount in Rs',
  })
  declare amount: number;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.PENDING,
  })
  declare paymentStatus: PaymentStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Additional details about the transaction',
  })
  declare description: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Campaign ID if related to campaign',
  })
  declare campaignId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Referred user ID if this is a referral bonus',
  })
  declare referredUserId: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'UPI ID where payment will be sent',
  })
  declare upiId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    comment: 'Payment transaction reference ID',
  })
  declare paymentReferenceId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare paidAt: Date;

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Admin who processed the payment',
  })
  declare processedBy: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare adminNotes: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Admin, 'processedBy')
  declare processedByAdmin: Admin;
}
