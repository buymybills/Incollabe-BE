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
  @Column(DataType.STRING)
  declare phoneHash: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare fcmToken: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
