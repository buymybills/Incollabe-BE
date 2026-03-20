import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Post } from './post.model';
import { Brand } from '../../brand/model/brand.model';
import { Influencer } from '../../auth/model/influencer.model';

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

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'post_boost_invoices',
  timestamps: true,
})
export class PostBoostInvoice extends Model {
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

  @ForeignKey(() => Post)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare postId: number;

  // User type who is boosting the post
  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: false,
  })
  declare userType: UserType;

  // Brand ID if boosted by brand
  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare brandId: number;

  // Influencer ID if boosted by influencer
  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
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

  // Associations
  @BelongsTo(() => Post)
  declare post: Post;

  @BelongsTo(() => Brand)
  declare brand: Brand;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
