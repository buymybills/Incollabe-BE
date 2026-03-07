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

export enum CashbackType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Table({
  tableName: 'hype_store_cashback_tiers',
  timestamps: true,
  underscored: true,
})
export class HypeStoreCashbackTier extends Model<HypeStoreCashbackTier> {
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

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  declare tierName: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare minFollowers: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxFollowers: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare cashbackType: CashbackType;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare cashbackValue: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 2000.00,
    allowNull: false,
  })
  declare minCashbackAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 12000.00,
    allowNull: false,
  })
  declare maxCashbackAmount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: false,
  })
  declare priority: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  })
  declare isActive: boolean;

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
}
