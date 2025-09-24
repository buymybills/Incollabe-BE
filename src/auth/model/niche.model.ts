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
  BelongsToMany,
} from 'sequelize-typescript';
import { Influencer } from './influencer.model';
import { InfluencerNiche } from './influencer-niche.model';
import { Brand } from '../../brand/model/brand.model';
import { BrandNiche } from '../../brand/model/brand-niche.model';

@Table({
  tableName: 'niches',
  timestamps: true,
})
export class Niche extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare icon: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsToMany(() => Influencer, () => InfluencerNiche)
  influencers: Influencer[];

  @BelongsToMany(() => Brand, () => BrandNiche)
  brands: Brand[];
}
