import { Table, Column, Model, DataType } from 'sequelize-typescript';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'key_backups',
  timestamps: true,
  underscored: true,
})
export class KeyBackup extends Model<KeyBackup> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['influencer', 'brand']],
    },
  })
  declare userType: UserType;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare userId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare encryptedPrivateKey: string;

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  declare salt: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare publicKey: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
  })
  declare keyVersion: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastAccessedAt: Date;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare deviceInfo: any;
}
