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
import { Influencer } from '../../auth/model/influencer.model';

export interface HypeStoreReferralCodeCreationAttributes {
  hypeStoreId: number;
  influencerId: number;
  referralCode: string;
  isActive?: boolean;
  totalClicks?: number;
  totalOrders?: number;
  totalRevenue?: number;
}

/**
 * Tracks unique referral codes for each influencer per brand
 * Used for brand-specific shared coupons (e.g., SNITCHCOLLABKAROO)
 * Each influencer gets a unique referral code (e.g., INFL15) for tracking attribution
 */
@Table({
  tableName: 'hype_store_referral_codes',
  timestamps: true,
  underscored: true,
})
export class HypeStoreReferralCode extends Model<
  HypeStoreReferralCode,
  HypeStoreReferralCodeCreationAttributes
> {
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

  @ForeignKey(() => Influencer)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Index('idx_referral_code_unique')
  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Unique referral code for this influencer (e.g., INFL15, INFL22)',
  })
  declare referralCode: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Total clicks on this referral link',
  })
  declare totalClicks: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Total orders attributed to this referral code',
  })
  declare totalOrders: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    defaultValue: 0.0,
    allowNull: false,
    comment: 'Total revenue from orders using this referral code',
  })
  declare totalRevenue: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastUsedAt: Date;

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

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
