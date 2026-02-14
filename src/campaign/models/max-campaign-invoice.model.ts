import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Campaign } from './campaign.model';
import { Brand } from '../../brand/model/brand.model';

export enum InvoiceStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum PaymentMethod {
  RAZORPAY = 'razorpay',
  UPI = 'upi',
  CARD = 'card',
  NET_BANKING = 'netbanking',
}

@Table({
  tableName: 'max_campaign_invoices',
  timestamps: true,
})
export class MaxCampaignInvoice extends Model {
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
  })
  declare invoiceNumber: string;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare campaignId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare brandId: number;

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
  })
  declare totalAmount: number;

  @Column({
    type: DataType.ENUM(...Object.values(InvoiceStatus)),
    defaultValue: InvoiceStatus.PENDING,
  })
  declare paymentStatus: InvoiceStatus;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
  })
  declare paymentMethod: PaymentMethod;

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
    type: DataType.DATE,
    allowNull: true,
  })
  declare paidAt: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare invoiceUrl: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare invoiceData: any;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
