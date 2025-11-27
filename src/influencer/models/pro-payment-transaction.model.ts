import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { ProInvoice } from './pro-invoice.model';
import {
  PaymentMethod,
  TransactionType,
  TransactionStatus,
} from './payment-enums';

// Re-export for backward compatibility
export { TransactionType, TransactionStatus };

@Table({
  tableName: 'pro_payment_transactions',
  timestamps: true,
  updatedAt: false,
})
export class ProPaymentTransaction extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => ProInvoice)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare invoiceId: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  declare transactionType: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare razorpayPaymentId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare razorpayOrderId: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare status: string;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
  })
  declare paymentMethod: PaymentMethod;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare failureReason: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: any;

  @BelongsTo(() => ProInvoice)
  declare invoice: ProInvoice;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
