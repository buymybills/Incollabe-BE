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
import { HypeStore } from '../../wallet/models/hype-store.model';

export enum InfluencerTierType {
  BELOW_1K = 'BELOW_1K',
  NANO = 'NANO', // 1k-10k
  MICRO = 'MICRO', // 10k-100k
  MID_TIER = 'MID_TIER', // 100k-500k
  MACRO = 'MACRO', // 500k-1M
  MEGA = 'MEGA', // 1M+
}

export enum GenderPreference {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHERS = 'OTHERS',
}

export interface HypeStoreCreatorPreferenceCreationAttributes {
  storeId: number;
  influencerTypes?: InfluencerTierType[];
  minAge?: number;
  maxAge?: number;
  genderPreference?: GenderPreference[];
  nicheCategories?: string[];
  preferredLocations?: string[];
  isPanIndia?: boolean;
}

@Table({
  tableName: 'hype_store_creator_preferences',
  timestamps: true,
  underscored: true,
})
export class HypeStoreCreatorPreference extends Model<
  HypeStoreCreatorPreference,
  HypeStoreCreatorPreferenceCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
    field: 'hype_store_id',
  })
  declare storeId: number;

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
    field: 'influencer_types',
  })
  declare influencerTypes: InfluencerTierType[];

  @Column({
    type: DataType.INTEGER,
    defaultValue: 18,
    field: 'min_age',
  })
  declare minAge: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 60,
    field: 'max_age',
  })
  declare maxAge: number;

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
    field: 'gender_preference',
  })
  declare genderPreference: GenderPreference[];

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
    field: 'niche_categories',
  })
  declare nicheCategories: string[];

  @Column({
    type: DataType.JSONB,
    defaultValue: [],
    field: 'preferred_locations',
  })
  declare preferredLocations: string[];

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_pan_india',
  })
  declare isPanIndia: boolean;

  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare store: HypeStore;
}
