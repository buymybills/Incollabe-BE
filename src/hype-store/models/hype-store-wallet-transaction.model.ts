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
import { HypeStoreWallet } from './hype-store-wallet.model';
import { HypeStore } from './hype-store.model';

export enum WalletTransactionType {
  ADD_MONEY = 'ADD_MONEY',
  CASHBACK_DEBIT = 'CASHBACK_DEBIT',
}

export interface HypeStoreWalletTransactionCreationAttributes {
  walletId: number;
  storeId?: number; // Optional: tracks which store the transaction is related to
  transactionType: WalletTransactionType;
  amount: number;
  previousBalance: number;
  newBalance: number;
  description?: string;
  paymentMethod?: string;
  paymentReferenceId?: string;
}

@Table({
  tableName: 'hype_store_wallet_transactions',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})
export class HypeStoreWalletTransaction extends Model<
  HypeStoreWalletTransaction,
  HypeStoreWalletTransactionCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => HypeStoreWallet)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'wallet_id',
  })
  declare walletId: number;

  @ForeignKey(() => HypeStore)
  @Column({
    type: DataType.INTEGER,
    allowNull: true, // Nullable: ADD_MONEY is brand-level, CASHBACK_DEBIT might be store-specific
    field: 'hype_store_id',
  })
  declare storeId: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: 'transaction_type',
  })
  declare transactionType: WalletTransactionType;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    field: 'amount',
  })
  declare amount: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    field: 'previous_balance',
  })
  declare previousBalance: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    allowNull: false,
    field: 'new_balance',
  })
  declare newBalance: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'description',
  })
  declare description: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'payment_method',
  })
  declare paymentMethod: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'payment_reference_id',
  })
  declare paymentReferenceId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => HypeStoreWallet)
  declare wallet: HypeStoreWallet;

  @BelongsTo(() => HypeStore)
  declare store: HypeStore;
}
