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
  ForeignKey,
  BelongsTo,
  Unique,
} from 'sequelize-typescript';
import { Influencer } from './influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'custom_niches',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userType', 'userId', 'name'], // Ensure unique custom niche names per user
    },
  ],
})
export class CustomNiche extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(UserType)))
  declare userType: UserType;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare userId: number;

  // Optional foreign key relationships for better data integrity
  @ForeignKey(() => Influencer)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @ForeignKey(() => Brand)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare brandId: number;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(100),
    validate: {
      len: [2, 100], // Min 2, max 100 characters
      notEmpty: true,
    },
  })
  declare name: string;

  @AllowNull(true)
  @Column({
    type: DataType.TEXT,
    validate: {
      len: [0, 500], // Max 500 characters for description
    },
  })
  declare description: string;

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

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
