import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  Index,
} from 'sequelize-typescript';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
  ADMIN = 'admin',
}

@Table({
  tableName: 'device_tokens',
  timestamps: true,
})
export class DeviceToken extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Index('idx_user_lookup')
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare userId: number;

  @Index('idx_user_lookup')
  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: false,
  })
  declare userType: UserType;

  @Index('idx_fcm_token')
  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    unique: true,
  })
  declare fcmToken: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare deviceId: string | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare deviceName: string | null;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare deviceOs: string | null;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare appVersion: string | null;

  @Index('idx_last_used')
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare lastUsedAt: Date;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
