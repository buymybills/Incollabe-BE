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
import { Brand } from './brand.model';
import { BrandNiche } from './brand-niche.model';

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
  name: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  icon: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  description: string;

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
