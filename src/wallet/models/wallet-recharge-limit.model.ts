import {
  Table,
  Column,
  Model,
  DataType,
} from 'sequelize-typescript';

export enum LimitUserType {
  BRAND = 'brand',
  INFLUENCER = 'influencer',
}

@Table({
  tableName: 'wallet_recharge_limits',
  timestamps: true,
  underscored: true,
})
export class WalletRechargeLimit extends Model<WalletRechargeLimit> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Column({
    type: DataType.ENUM(...Object.values(LimitUserType)),
    allowNull: false,
    unique: true,
  })
  declare userType: LimitUserType;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 5000.00,    // Minimum ₹5,000 for brands
  })
  declare minRechargeAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,          // NULL = No maximum limit
    defaultValue: null,
  })
  declare maxRechargeAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare dailyRechargeLimit: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare monthlyRechargeLimit: number;

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
}
