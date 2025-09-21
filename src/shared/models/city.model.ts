import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Country } from './country.model';

export interface CityCreationAttributes {
  name: string;
  state?: string;
  countryId: number;
  isActive?: boolean;
}

@Table({ tableName: 'cities', timestamps: true })
export class City extends Model<City, CityCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare state: string;

  @ForeignKey(() => Country)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare countryId: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @BelongsTo(() => Country)
  declare country: Country;
}
