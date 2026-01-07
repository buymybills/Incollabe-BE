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
  tableName: 'invite_only_campaign_invoices',
  timestamps: true,
  underscored: true, // Maps createdAt/updatedAt to created_at/updated_at
})
export class InviteOnlyCampaignInvoice extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING,
    unique: true,
    allowNull: false,
    field: 'invoice_number', // Maps to existing snake_case DB column
  })
  declare invoiceNumber: string;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'campaign_id', // Maps to existing snake_case DB column
  })
  declare campaignId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'brand_id', // Maps to existing snake_case DB column
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
    allowNull: false,
    field: 'total_amount', // Maps to existing snake_case DB column
  })
  declare totalAmount: number;

  @Column({
    type: DataType.ENUM(...Object.values(InvoiceStatus)),
    defaultValue: InvoiceStatus.PENDING,
    field: 'payment_status', // Maps to existing snake_case DB column
  })
  declare paymentStatus: InvoiceStatus;

  @Column({
    type: DataType.ENUM(...Object.values(PaymentMethod)),
    allowNull: true,
    field: 'payment_method', // Maps to existing snake_case DB column
  })
  declare paymentMethod: PaymentMethod;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'razorpay_order_id', // Maps to existing snake_case DB column
  })
  declare razorpayOrderId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'razorpay_payment_id', // Maps to existing snake_case DB column
  })
  declare razorpayPaymentId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'paid_at', // Maps to existing snake_case DB column
  })
  declare paidAt: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'invoice_url', // Maps to existing snake_case DB column
  })
  declare invoiceUrl: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'invoice_data', // Maps to existing snake_case DB column
  })
  declare invoiceData: any;

  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
