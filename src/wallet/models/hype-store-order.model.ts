import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { HypeStore } from './hype-store.model';
import { HypeStoreCouponCode } from './hype-store-coupon-code.model';
import { Influencer } from '../../auth/model/influencer.model';
import { HypeStoreCashbackTier } from './hype-store-cashback-tier.model';
import { WalletTransaction } from './wallet-transaction.model';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  RETURNED = 'returned',
}

export enum CashbackStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  CREDITED = 'credited',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Table({
  tableName: 'hype_store_orders',
  timestamps: true,
  underscored: true,
})
export class HypeStoreOrder extends Model<HypeStoreOrder> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare hypeStoreId: number;

  @ForeignKey(() => HypeStoreCouponCode)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare couponCodeId: number;

  @ForeignKey(() => Influencer)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Index
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare externalOrderId: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    comment: 'Referral code used for attribution (e.g., INFL15). Used with brand-shared coupons.',
  })
  declare referralCode: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare orderAmount: number;

  @Column({
    type: DataType.STRING(10),
    defaultValue: 'INR',
    allowNull: false,
  })
  declare orderCurrency: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare orderDate: Date;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare customerEmail: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare customerPhone: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare customerName: string;

  @Index
  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    defaultValue: OrderStatus.PENDING,
  })
  declare orderStatus: OrderStatus;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare cashbackAmount: number;

  @Index
  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    defaultValue: CashbackStatus.PENDING,
  })
  declare cashbackStatus: CashbackStatus;

  @ForeignKey(() => HypeStoreCashbackTier)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare cashbackTierId: number;

  @ForeignKey(() => WalletTransaction)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare walletTransactionId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Reference to locked cashback transaction stored in wallet_transactions',
  })
  declare lockedCashbackTransactionId: number;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare webhookReceivedAt: Date;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  declare webhookSignature: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare webhookIpAddress: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare cashbackCreditedAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare processedBy: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: Record<string, any>;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  declare instagramProofUrl: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare proofContentType: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare proofSubmittedAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare minimumCashbackClaimed: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 30,
  })
  declare returnPeriodDays: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare returnPeriodEndsAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether the item was returned by customer during return window',
  })
  declare isReturned: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    comment: 'When the item was marked as returned',
  })
  declare returnedAt: Date;

  @Index
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare visibleToInfluencer: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare visibilityCheckedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare hypeStore: HypeStore;

  @BelongsTo(() => HypeStoreCouponCode)
  declare couponCode: HypeStoreCouponCode;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => HypeStoreCashbackTier)
  declare cashbackTier: HypeStoreCashbackTier;

  @BelongsTo(() => WalletTransaction)
  declare walletTransaction: WalletTransaction;
}
