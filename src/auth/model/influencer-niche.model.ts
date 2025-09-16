import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from './influencer.model';
import { Niche } from './niche.model';

@Table({
  tableName: 'influencer_niches',
  timestamps: true,
})
export class InfluencerNiche extends Model {
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @ForeignKey(() => Niche)
  @Column(DataType.INTEGER)
  declare nicheId: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
