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

export enum CommentAuthorType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'post_comments',
  timestamps: true,
})
export class Comment extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Post)
  @Column(DataType.INTEGER)
  declare postId: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare content: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(CommentAuthorType)))
  declare authorType: CommentAuthorType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare authorInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  declare authorBrandId: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Post)
  declare post: Post;

  @BelongsTo(() => Influencer, 'authorInfluencerId')
  declare authorInfluencer: Influencer;

  @BelongsTo(() => Brand, 'authorBrandId')
  declare authorBrand: Brand;

  get author() {
    return this.authorType === CommentAuthorType.INFLUENCER
      ? this.authorInfluencer
      : this.authorBrand;
  }

  get authorId() {
    return this.authorType === CommentAuthorType.INFLUENCER
      ? this.authorInfluencerId
      : this.authorBrandId;
  }
}
