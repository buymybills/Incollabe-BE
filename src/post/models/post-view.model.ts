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
} from 'sequelize-typescript';
import { Post } from './post.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum ViewerType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'post_views',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['postId', 'viewerType', 'viewerInfluencerId', 'viewerBrandId'],
      name: 'unique_post_viewer',
    },
  ],
})
export class PostView extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Post)
  @Column(DataType.INTEGER)
  declare postId: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(ViewerType)))
  declare viewerType: ViewerType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare viewerInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  declare viewerBrandId: number;

  @AllowNull(false)
  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare viewedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Post)
  declare post: Post;

  @BelongsTo(() => Influencer, 'viewerInfluencerId')
  declare viewerInfluencer: Influencer;

  @BelongsTo(() => Brand, 'viewerBrandId')
  declare viewerBrand: Brand;

  // Virtual getter for viewer ID
  get viewerId(): number {
    return this.viewerType === ViewerType.INFLUENCER
      ? this.viewerInfluencerId
      : this.viewerBrandId;
  }

  // Virtual getter for viewer
  get viewer() {
    return this.viewerType === ViewerType.INFLUENCER
      ? this.viewerInfluencer
      : this.viewerBrand;
  }
}
