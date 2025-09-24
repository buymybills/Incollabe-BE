import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Campaign } from './campaign.model';
import { City } from '../../shared/models/city.model';

@Table({
  tableName: 'campaign_cities',
  timestamps: false,
})
export class CampaignCity extends Model<CampaignCity> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  campaignId: number;

  @ForeignKey(() => City)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  cityId: number;

  // Associations
  @BelongsTo(() => Campaign)
  campaign: Campaign;

  @BelongsTo(() => City)
  city: City;
}
