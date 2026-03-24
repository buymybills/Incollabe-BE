import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  Index,
} from 'sequelize-typescript';
import { WalletTransaction } from './wallet-transaction.model';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'wallets',
  timestamps: true,
  underscored: true,
})
export class Wallet extends Model<Wallet> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare userId: number;

  @Index
  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: false,
  })
  declare userType: UserType;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  })
  declare balance: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  })
  declare totalCredited: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  })
  declare totalDebited: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  })
  declare totalCashbackReceived: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  })
  declare totalRedeemed: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Amount locked from cashback until return window closes',
  })
  declare lockedAmount: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
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
  @HasMany(() => WalletTransaction)
  declare transactions: WalletTransaction[];
}
