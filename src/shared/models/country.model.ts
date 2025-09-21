import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  HasMany,
} from 'sequelize-typescript';
import { City } from './city.model';

export interface CountryCreationAttributes {
  name: string;
  code: string;
  isActive?: boolean;
}

@Table({ tableName: 'countries', timestamps: true })
export class Country extends Model<Country, CountryCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(3),
    allowNull: false,
    unique: true,
  })
  declare code: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @HasMany(() => City)
  declare cities: City[];
}
