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
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';

export enum WithdrawalAccountType {
  UPI = 'upi',
  BANK = 'bank',
}

@Table({
  tableName: 'influencer_withdrawal_accounts',
  timestamps: true,
  underscored: true,
})
export class InfluencerWithdrawalAccount extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare accountType: WithdrawalAccountType;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare upiId: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare accountHolderName: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare accountNumber: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare bankName: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare ifscCode: string;

  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare isDefault: boolean;

  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare isVerified: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastUsedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
