import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  HasMany,
} from 'sequelize-typescript';
import { HypeStoreWalletTransaction } from './hype-store-wallet-transaction.model';

export interface HypeStoreWalletCreationAttributes {
  userId: number;
  userType: string;
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

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: 'user_type',
  })
  declare userType: string;

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
  @HasMany(() => HypeStoreWalletTransaction)
  declare transactions: HypeStoreWalletTransaction[];
}
