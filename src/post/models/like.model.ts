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

export enum LikerType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'likes',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['postId', 'likerType', 'likerInfluencerId', 'likerBrandId'],
    },
  ],
})
export class Like extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Post)
  @Column(DataType.INTEGER)
  postId: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(LikerType)))
  likerType: LikerType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  likerInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  likerBrandId: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Post)
  post: Post;

  @BelongsTo(() => Influencer, 'likerInfluencerId')
  likerInfluencer: Influencer;

  @BelongsTo(() => Brand, 'likerBrandId')
  likerBrand: Brand;

  get liker() {
    return this.likerType === LikerType.INFLUENCER
      ? this.likerInfluencer
      : this.likerBrand;
  }

  get likerId() {
    return this.likerType === LikerType.INFLUENCER
      ? this.likerInfluencerId
      : this.likerBrandId;
  }
}
