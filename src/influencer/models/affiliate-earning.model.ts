import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';

export enum AffiliateEarningStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  REVERSED = 'reversed',
}

@Table({
  tableName: 'affiliate_earnings',
  timestamps: true,
  underscored: true,
})
export class AffiliateEarning extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Influencer)
  @Index
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare postId: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare hypeStoreOrderId: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare hypeStoreId: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare brandName: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare productName: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare productThumbnailUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare affiliateId: string;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 2), defaultValue: 0 })
  declare amount: number;

  @AllowNull(false)
  @Column({ type: DataType.STRING, defaultValue: AffiliateEarningStatus.PENDING })
  declare status: AffiliateEarningStatus;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare referralClickId: number;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare earnedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare confirmedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare paidAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
