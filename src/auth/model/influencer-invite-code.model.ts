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
} from 'sequelize-typescript';

@Table({
  tableName: 'influencer_invite_codes',
  timestamps: true,
})
export class InfluencerInviteCode extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare code: string;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare createdBy: number;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare totalUsed: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare notes: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
