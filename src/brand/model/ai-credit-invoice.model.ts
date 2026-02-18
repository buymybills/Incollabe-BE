import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Brand } from './brand.model';

export enum AiCreditInvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum AiCreditPaymentMethod {
  RAZORPAY = 'razorpay',
  UPI = 'upi',
  CARD = 'card',
  NET_BANKING = 'netbanking',
}

@Table({
  tableName: 'ai_credit_invoices',
  timestamps: true,
  underscored: true,
})
export class AiCreditInvoice extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: true,
    field: 'invoice_number',
  })
  declare invoiceNumber: string;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'brand_id',
  })
  declare brandId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'campaign_id',
  })
  declare campaignId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'credits_purchased',
  })
  declare creditsPurchased: number;

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
    defaultValue: 0,
  })
  declare cgst: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare sgst: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare igst: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'total_amount',
  })
  declare totalAmount: number;

  @Column({
    type: DataType.ENUM(...Object.values(AiCreditInvoiceStatus)),
    defaultValue: AiCreditInvoiceStatus.PENDING,
    field: 'payment_status',
  })
  declare paymentStatus: AiCreditInvoiceStatus;

  @Column({
    type: DataType.ENUM(...Object.values(AiCreditPaymentMethod)),
    allowNull: true,
    field: 'payment_method',
  })
  declare paymentMethod: AiCreditPaymentMethod;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'razorpay_order_id',
  })
  declare razorpayOrderId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'razorpay_payment_id',
  })
  declare razorpayPaymentId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'paid_at',
  })
  declare paidAt: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'invoice_url',
  })
  declare invoiceUrl: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'invoice_data',
  })
  declare invoiceData: any;

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
