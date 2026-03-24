import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { HypeStore } from '../../wallet/models/hype-store.model';
import { Influencer } from '../../auth/model/influencer.model';
import { HypeStoreCashbackTransaction } from './hype-store-cashback-transaction.model';

export enum CashbackStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

export enum PromotionType {
  REEL = 'REEL',
  POST = 'POST',
  STORY = 'STORY',
}

export interface HypeStoreOrderCreationAttributes {
  storeId: number;
  influencerId: number;
  orderId: string;
  externalOrderId?: string;
  productName: string;
  productDetails?: string;
  orderAmount: number;
  cashbackPercentage?: number;
  cashbackAmount?: number;
  cashbackStatus?: CashbackStatus;
  cashbackSentAt?: Date;
  promotionType?: PromotionType;
  promotionContentUrl?: string;
  promotionPostedAt?: Date;
  expectedRoi?: number;
  estimatedEngagement?: number;
  estimatedReach?: number;
  influencerTier?: string;
  orderDate?: Date;
}

@Table({
  tableName: 'hype_store_orders',
  timestamps: true,
  underscored: true,
})
export class HypeStoreOrder extends Model<
  HypeStoreOrder,
  HypeStoreOrderCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'hype_store_id',
  })
  declare storeId: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'influencer_id',
  })
  declare influencerId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    field: 'order_id',
  })
  declare orderId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'external_order_id',
  })
  declare externalOrderId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'product_name',
  })
  declare productName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'product_details',
  })
  declare productDetails: string;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    field: 'order_amount',
  })
  declare orderAmount: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    field: 'cashback_percentage',
  })
  declare cashbackPercentage: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0.0,
    field: 'cashback_amount',
  })
  declare cashbackAmount: number;

  @Column({
    type: DataType.STRING(50),
    defaultValue: CashbackStatus.PENDING,
    field: 'cashback_status',
  })
  declare cashbackStatus: CashbackStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'cashback_sent_at',
  })
  declare cashbackSentAt: Date;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'promotion_type',
  })
  declare promotionType: PromotionType;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'promotion_content_url',
  })
  declare promotionContentUrl: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'promotion_posted_at',
  })
  declare promotionPostedAt: Date;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    field: 'expected_roi',
  })
  declare expectedRoi: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'estimated_engagement',
  })
  declare estimatedEngagement: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'estimated_reach',
  })
  declare estimatedReach: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'influencer_tier',
  })
  declare influencerTier: string;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
    field: 'order_date',
  })
  declare orderDate: Date;

  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare store: HypeStore;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @HasMany(() => HypeStoreCashbackTransaction)
  declare cashbackTransactions: HypeStoreCashbackTransaction[];
}
