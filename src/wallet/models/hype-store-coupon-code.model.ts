import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  Index,
} from 'sequelize-typescript';
import { HypeStore } from './hype-store.model';
import { Influencer } from '../../auth/model/influencer.model';

@Table({
  tableName: 'hype_store_coupon_codes',
  timestamps: true,
  underscored: true,
})
export class HypeStoreCouponCode extends Model<HypeStoreCouponCode> {
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
    allowNull: true, // NULL for universal coupons
  })
  declare hypeStoreId: number;

  @ForeignKey(() => Influencer)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Index
  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
  })
  declare couponCode: string;

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
  })
  declare totalUses: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxUses: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare validFrom: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare validUntil: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare deactivatedAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'If true, coupon works for all Hype Stores. If false, only for specific hypeStoreId',
  })
  declare isUniversal: boolean;

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
