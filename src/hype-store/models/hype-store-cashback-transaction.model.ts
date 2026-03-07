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
import { HypeStoreOrder } from './hype-store-order.model';
import { Influencer } from '../../auth/model/influencer.model';
import { HypeStoreWallet } from './hype-store-wallet.model';

export enum CashbackTransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

export interface HypeStoreCashbackTransactionCreationAttributes {
  storeId: number;
  orderId: number;
  influencerId: number;
  walletId: number;
  cashbackAmount: number;
  transactionStatus?: CashbackTransactionStatus;
  transactionReferenceId?: string;
}

@Table({
  tableName: 'hype_store_cashback_transactions',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
})
export class HypeStoreCashbackTransaction extends Model<
  HypeStoreCashbackTransaction,
  HypeStoreCashbackTransactionCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'store_id',
  })
  declare storeId: number;

  @ForeignKey(() => HypeStoreOrder)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'order_id',
  })
  declare orderId: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'influencer_id',
  })
  declare influencerId: number;

  @ForeignKey(() => HypeStoreWallet)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'wallet_id',
  })
  declare walletId: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    field: 'cashback_amount',
  })
  declare cashbackAmount: number;

  @Column({
    type: DataType.STRING(50),
    defaultValue: CashbackTransactionStatus.SUCCESS,
    field: 'transaction_status',
  })
  declare transactionStatus: CashbackTransactionStatus;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'transaction_reference_id',
  })
  declare transactionReferenceId: string;

  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare store: HypeStore;

  @BelongsTo(() => HypeStoreOrder)
  declare order: HypeStoreOrder;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => HypeStoreWallet)
  declare wallet: HypeStoreWallet;
}
