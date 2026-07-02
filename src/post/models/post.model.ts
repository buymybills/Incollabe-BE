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
  HasMany,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Like } from './like.model';
import { Comment } from './comment.model';
import { PostCategory } from './post-category.model';
import { PostSubcategory } from './post-subcategory.model';
import { HypeReelProduct } from './hype-reel-product.model';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export enum PostType {
  REGULAR = 'regular',
  HYPE_REEL = 'hype_reel',
}

export enum CollaboratorStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Table({
  tableName: 'posts',
  timestamps: true,
})
export class Post extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare content?: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  declare mediaUrls: string[];

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(UserType)))
  declare userType: UserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  declare brandId: number;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare likesCount: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare sharesCount: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare viewsCount: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare commentsCount: number;

  // Boost Mode fields
  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isBoosted: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare boostedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare boostExpiresAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare boostPaymentId: string;

  @AllowNull(true)
  @Column(DataType.DECIMAL(10, 2))
  declare boostAmount: number;

  // Boost Payment Tracking fields
  @AllowNull(true)
  @Column(DataType.STRING)
  declare boostOrderId: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare boostPaymentStatus: string;

  // HYPE Reel fields
  @AllowNull(false)
  @Column({
    type: DataType.STRING,
    defaultValue: PostType.REGULAR,
    field: 'post_type',
  })
  declare postType: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_hype_reel',
  })
  declare isHypeReel: boolean;

  @AllowNull(true)
  @ForeignKey(() => PostCategory)
  @Column({ type: DataType.INTEGER, field: 'post_category_id' })
  declare postCategoryId: number;

  @AllowNull(true)
  @ForeignKey(() => PostSubcategory)
  @Column({ type: DataType.INTEGER, field: 'post_subcategory_id' })
  declare postSubcategoryId: number;

  @AllowNull(true)
  @Column({ type: DataType.STRING, field: 'thumbnail_url' })
  declare thumbnailUrl: string;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: 'video_duration_seconds' })
  declare videoDurationSeconds: number;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column({ type: DataType.INTEGER, field: 'collaborator_id' })
  declare collaboratorId: number;

  @AllowNull(true)
  @Column({ type: DataType.STRING, field: 'collaborator_status' })
  declare collaboratorStatus: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => Like)
  declare likes: Like[];

  @HasMany(() => Comment)
  declare comments: Comment[];

  @HasMany(() => HypeReelProduct, { as: 'products', foreignKey: 'postId' })
  declare products: HypeReelProduct[];

  @BelongsTo(() => PostCategory)
  declare postCategory: PostCategory;

  @BelongsTo(() => PostSubcategory)
  declare postSubcategory: PostSubcategory;

  get user() {
    return this.userType === UserType.INFLUENCER ? this.influencer : this.brand;
  }
}
