import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { HypeStoreReferralCode } from './hype-store-referral-code.model';
import { HypeStore } from './hype-store.model';
import { Influencer } from '../../auth/model/influencer.model';

/**
 * Tracks individual click events on referral links
 * Used for analytics and attribution tracking
 */
@Table({
  tableName: 'hype_store_referral_clicks',
  timestamps: true,
  underscored: true,
})
export class HypeStoreReferralClick extends Model<HypeStoreReferralClick> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => HypeStoreReferralCode)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare referralCodeId: number;

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

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    comment: 'Session ID from brand website (if provided)',
  })
  declare sessionId: string;

  @Column({
    type: DataType.STRING(45),
    allowNull: true,
    comment: 'IP address of the customer who clicked',
  })
  declare customerIp: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'User agent string from the click',
  })
  declare userAgent: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Referring URL (where the customer came from)',
  })
  declare referrer: string;

  @Index
  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    comment: 'When the click occurred',
  })
  declare clickedAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Whether this click led to a conversion (order)',
  })
  declare converted: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    comment: 'Order ID if this click converted',
  })
  declare orderId: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    comment: 'When the conversion happened',
  })
  declare convertedAt: Date;

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
  @BelongsTo(() => HypeStoreReferralCode)
  declare referralCode: HypeStoreReferralCode;

  @BelongsTo(() => HypeStore)
  declare hypeStore: HypeStore;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
