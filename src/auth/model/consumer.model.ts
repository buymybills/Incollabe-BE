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
  Unique,
  Index,
} from 'sequelize-typescript';

@Table({
  tableName: 'consumers',
  timestamps: true,
})
export class Consumer extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare phone: string;

  @AllowNull(true)
  @Unique
  @Index
  @Column({ type: DataType.STRING, field: 'phone_hash' })
  declare phoneHash: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'profile_image' })
  declare profileImage: string;

  @AllowNull(true)
  @Column({ type: DataType.DATEONLY, field: 'date_of_birth' })
  declare dateOfBirth: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING, field: 'fcm_token' })
  declare fcmToken: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
