import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { HypeStore } from './hype-store.model';

@Table({
  tableName: 'hype_store_creator_preferences',
  timestamps: true,
  underscored: true,
})
export class HypeStoreCreatorPreference extends Model<HypeStoreCreatorPreference> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
  })
  declare hypeStoreId: number;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
  })
  declare allowedInfluencerTypes: string[];

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    allowNull: false,
  })
  declare minFollowers: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxFollowers: number;

  @Column({
    type: DataType.ARRAY(DataType.INTEGER),
    allowNull: true,
  })
  declare allowedNicheIds: number[];

  @Column({
    type: DataType.ARRAY(DataType.INTEGER),
    allowNull: true,
  })
  declare allowedCityIds: number[];

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
  })
  declare allowedStates: string[];

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare minEngagementRate: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare hypeStore: HypeStore;
}
