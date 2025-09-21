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
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum FollowerType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export enum FollowingType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'follows',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: [
        'followerType',
        'followerInfluencerId',
        'followerBrandId',
        'followingType',
        'followingInfluencerId',
        'followingBrandId',
      ],
    },
  ],
})
export class Follow extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(FollowerType)))
  followerType: FollowerType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  followerInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  followerBrandId: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(FollowingType)))
  followingType: FollowingType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  followingInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  followingBrandId: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Influencer, 'followerInfluencerId')
  followerInfluencer: Influencer;

  @BelongsTo(() => Brand, 'followerBrandId')
  followerBrand: Brand;

  @BelongsTo(() => Influencer, 'followingInfluencerId')
  followingInfluencer: Influencer;

  @BelongsTo(() => Brand, 'followingBrandId')
  followingBrand: Brand;

  get follower() {
    return this.followerType === FollowerType.INFLUENCER
      ? this.followerInfluencer
      : this.followerBrand;
  }

  get following() {
    return this.followingType === FollowingType.INFLUENCER
      ? this.followingInfluencer
      : this.followingBrand;
  }

  get followerId() {
    return this.followerType === FollowerType.INFLUENCER
      ? this.followerInfluencerId
      : this.followerBrandId;
  }

  get followingId() {
    return this.followingType === FollowingType.INFLUENCER
      ? this.followingInfluencerId
      : this.followingBrandId;
  }
}
