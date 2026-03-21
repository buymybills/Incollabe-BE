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
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum ViewedUserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export enum ViewerType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'profile_views',
  timestamps: true,
})
export class ProfileView extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  // Profile being viewed
  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(ViewedUserType)))
  declare viewedUserType: ViewedUserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare viewedInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  declare viewedBrandId: number;

  // Viewer details (who is viewing)
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
  @Column({ type: DataType.DATE, defaultValue: DataType.NOW, field: 'viewed_at' })
  declare viewedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  // Relationships
  @BelongsTo(() => Influencer, 'viewedInfluencerId')
  declare viewedInfluencer: Influencer;

  @BelongsTo(() => Brand, 'viewedBrandId')
  declare viewedBrand: Brand;

  @BelongsTo(() => Influencer, 'viewerInfluencerId')
  declare viewerInfluencer: Influencer;

  @BelongsTo(() => Brand, 'viewerBrandId')
  declare viewerBrand: Brand;

  // Virtual getter for viewed user ID
  get viewedUserId(): number {
    return this.viewedUserType === ViewedUserType.INFLUENCER
      ? this.viewedInfluencerId
      : this.viewedBrandId;
  }

  // Virtual getter for viewer ID
  get viewerId(): number {
    return this.viewerType === ViewerType.INFLUENCER
      ? this.viewerInfluencerId
      : this.viewerBrandId;
  }

  // Virtual getter for viewed user
  get viewedUser() {
    return this.viewedUserType === ViewedUserType.INFLUENCER
      ? this.viewedInfluencer
      : this.viewedBrand;
  }

  // Virtual getter for viewer
  get viewer() {
    return this.viewerType === ViewerType.INFLUENCER
      ? this.viewerInfluencer
      : this.viewerBrand;
  }
}
