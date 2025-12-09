import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { InstagramMediaInsight } from './instagram-media-insight.model';

export interface InstagramMediaCreationAttributes {
  influencerId?: number;
  brandId?: number;
  mediaId: string;
  caption?: string;
  mediaType?: string;
  mediaProductType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: Date;
  firstFetchedAt?: Date;
  lastSyncedAt?: Date;
}

@Table({ tableName: 'instagram_media', timestamps: true, underscored: true })
export class InstagramMedia extends Model<InstagramMedia, InstagramMediaCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare influencerId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare brandId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare mediaId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare caption: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare mediaType: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare mediaProductType: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare mediaUrl: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare thumbnailUrl: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare permalink: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare timestamp: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare firstFetchedAt: Date;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare lastSyncedAt: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => InstagramMediaInsight)
  declare insights: InstagramMediaInsight[];
}
