import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Wallet } from './wallet.model';

export enum TransactionType {
  RECHARGE = 'recharge',           // Brand adds money to wallet
  DEBIT = 'debit',                 // Brand pays influencer
  CASHBACK = 'cashback',           // Influencer receives cashback
  REDEMPTION = 'redemption',       // Influencer withdraws money
  REFUND = 'refund',               // Money returned to wallet
  ADJUSTMENT = 'adjustment',       // Admin adjustment
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Table({
  tableName: 'wallet_transactions',
  timestamps: true,
  underscored: true,
})
export class WalletTransaction extends Model<WalletTransaction> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => Wallet)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare walletId: number;

  @Index
  @Column({
    type: DataType.ENUM(...Object.values(TransactionType)),
    allowNull: false,
  })
  declare transactionType: TransactionType;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare balanceBefore: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare balanceAfter: number;

  @Index
  @Column({
    type: DataType.ENUM(...Object.values(TransactionStatus)),
    allowNull: false,
    defaultValue: TransactionStatus.PENDING,
  })
  declare status: TransactionStatus;

  // Payment gateway details
  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare paymentGateway: string;

  @Index
  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare paymentOrderId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare paymentTransactionId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare paymentReferenceId: string;

  // UPI details (for redemptions)
  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare upiId: string;

  // Related entities
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare relatedUserId: number;

  @Index
  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare relatedUserType: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare campaignId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare hypeStoreId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare hypeStoreOrderId: number;

  // Lock tracking
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this amount is locked (e.g., during return window)',
  })
  declare isLocked: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    comment: 'When this locked amount will be unlocked',
  })
  declare lockExpiresAt: Date;

  // Metadata
  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare metadata: Record<string, any>;

  // Processing details
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare processedBy: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare processedAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare failedReason: string;

  @Index
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
  @BelongsTo(() => Wallet)
  declare wallet: Wallet;
}
