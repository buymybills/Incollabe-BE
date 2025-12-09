import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { InstagramMedia } from './instagram-media.model';

export interface InstagramMediaInsightCreationAttributes {
  influencerId?: number;
  brandId?: number;
  instagramMediaId?: number;
  mediaId: string;
  mediaType?: string;
  mediaProductType?: string;
  reach?: number;
  saved?: number;
  likes?: number;
  comments?: number;
  plays?: number;
  shares?: number;
  totalInteractions?: number;
  fetchedAt?: Date;
}

@Table({ tableName: 'instagram_media_insights', timestamps: true, underscored: true })
export class InstagramMediaInsight extends Model<InstagramMediaInsight, InstagramMediaInsightCreationAttributes> {
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

  @ForeignKey(() => InstagramMedia)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare instagramMediaId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare mediaId: string;

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
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare reach: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare saved: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare likes: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare comments: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare plays: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare shares: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare totalInteractions: number;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare fetchedAt: Date;

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

  @BelongsTo(() => InstagramMedia)
  declare instagramMedia: InstagramMedia;
}
