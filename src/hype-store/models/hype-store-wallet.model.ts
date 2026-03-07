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
import { Brand } from '../../brand/model/brand.model';
import { HypeStoreWalletTransaction } from './hype-store-wallet-transaction.model';

export interface HypeStoreWalletCreationAttributes {
  brandId: number;
  balance?: number;
  totalAdded?: number;
  totalSpent?: number;
}

@Table({
  tableName: 'hype_store_wallet',
  timestamps: true,
  underscored: true,
})
export class HypeStoreWallet extends Model<
  HypeStoreWallet,
  HypeStoreWalletCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
    field: 'brand_id',
  })
  declare brandId: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0.0,
    field: 'balance',
  })
  declare balance: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0.0,
    field: 'total_added',
  })
  declare totalAdded: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0.0,
    field: 'total_spent',
  })
  declare totalSpent: number;

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
  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => HypeStoreWalletTransaction)
  declare transactions: HypeStoreWalletTransaction[];
}
