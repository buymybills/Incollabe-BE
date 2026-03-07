import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasOne,
  HasMany,
} from 'sequelize-typescript';
import { Brand } from '../../brand/model/brand.model';
import { HypeStoreCashbackConfig } from './hype-store-cashback-config.model';
import { HypeStoreCreatorPreference } from './hype-store-creator-preference.model';
import { HypeStoreOrder } from './hype-store-order.model';

export interface HypeStoreCreationAttributes {
  brandId: number;
  storeName: string; // Auto-generated (Store 1, Store 2, etc.)
  storeDescription?: string; // Populated from brand profile
  bannerImageUrl?: string; // Can be customized
  logoUrl?: string; // Populated from brand profile
  isActive?: boolean;
  monthlyCreatorLimit?: number;
}

@Table({ tableName: 'hype_store', timestamps: true, underscored: true })
export class HypeStore extends Model<HypeStore, HypeStoreCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'brand_id',
  })
  declare brandId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'store_name',
  })
  declare storeName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'store_description',
  })
  declare storeDescription: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'banner_image_url',
  })
  declare bannerImageUrl: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'logo_url',
  })
  declare logoUrl: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 5,
    field: 'monthly_creator_limit',
  })
  declare monthlyCreatorLimit: number;

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
  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasOne(() => HypeStoreCashbackConfig)
  declare cashbackConfig: HypeStoreCashbackConfig;

  @HasOne(() => HypeStoreCreatorPreference)
  declare creatorPreference: HypeStoreCreatorPreference;

  @HasMany(() => HypeStoreOrder)
  declare orders: HypeStoreOrder[];
}
