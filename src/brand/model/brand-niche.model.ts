import {
  Column,
  Model,
  Table,
  DataType,
  ForeignKey,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';
import { Brand } from './brand.model';
import { Niche } from '../../auth/model/niche.model';

export interface BrandNicheCreationAttributes {
  brandId: number;
  nicheId: number;
}

@Table({ tableName: 'brand_niches', timestamps: true })
export class BrandNiche extends Model<
  BrandNiche,
  BrandNicheCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  brandId: number;

  @ForeignKey(() => Niche)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  nicheId: number;
}
