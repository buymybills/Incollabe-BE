import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { HypeStore } from './hype-store.model';
import { CashbackClaimStrategy } from '../constants/cashback-strategies';

export interface HypeStoreCashbackConfigCreationAttributes {
  storeId: number;
  reelPostMinCashback?: number;
  reelPostMaxCashback?: number;
  storyMinCashback?: number;
  storyMaxCashback?: number;
  monthlyClaimCount?: number;
  claimStrategy?: CashbackClaimStrategy;
}

@Table({
  tableName: 'hype_store_cashback_config',
  timestamps: true,
  underscored: true,
})
export class HypeStoreCashbackConfig extends Model<
  HypeStoreCashbackConfig,
  HypeStoreCashbackConfigCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
    field: 'hype_store_id',
  })
  declare storeId: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 100,
    field: 'reel_post_min_cashback',
  })
  declare reelPostMinCashback: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 12000,
    field: 'reel_post_max_cashback',
  })
  declare reelPostMaxCashback: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 100,
    field: 'story_min_cashback',
  })
  declare storyMinCashback: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 12000,
    field: 'story_max_cashback',
  })
  declare storyMaxCashback: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 3,
    field: 'monthly_claim_count',
  })
  declare monthlyClaimCount: number;

  @Column({
    type: DataType.STRING(50),
    defaultValue: CashbackClaimStrategy.OPTIMIZED_SPEND,
    field: 'claim_strategy',
  })
  declare claimStrategy: CashbackClaimStrategy;

  @Column({
    type: DataType.DECIMAL(5, 2),
    defaultValue: 20.0,
    field: 'cashback_percentage',
  })
  declare cashbackPercentage: number;

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
}
