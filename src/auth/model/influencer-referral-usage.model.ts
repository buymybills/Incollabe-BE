import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';
import { Influencer } from './influencer.model';

@Table({
  tableName: 'influencer_referral_usages',
  timestamps: true,
})
export class InfluencerReferralUsage extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @Column(DataType.INTEGER)
  declare referredUserId: number;

  @Column(DataType.STRING)
  declare referralCode: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare creditAwarded: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare creditAwardedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
