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

export enum SharerType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'shares',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['post_id', 'sharer_type', 'sharer_influencer_id', 'sharer_brand_id'],
      name: 'unique_post_sharer',
    },
  ],
})
export class Share extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Post)
  @Column(DataType.INTEGER)
  declare postId: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(SharerType)))
  declare sharerType: SharerType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare sharerInfluencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  declare sharerBrandId: number;

  @AllowNull(false)
  @Column({ type: DataType.DATE, defaultValue: DataType.NOW })
  declare sharedAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Post)
  declare post: Post;

  @BelongsTo(() => Influencer, 'sharerInfluencerId')
  declare sharerInfluencer: Influencer;

  @BelongsTo(() => Brand, 'sharerBrandId')
  declare sharerBrand: Brand;

  // Virtual getter for sharer ID
  get sharerId(): number {
    return this.sharerType === SharerType.INFLUENCER
      ? this.sharerInfluencerId
      : this.sharerBrandId;
  }

  // Virtual getter for sharer
  get sharer() {
    return this.sharerType === SharerType.INFLUENCER
      ? this.sharerInfluencer
      : this.sharerBrand;
  }
}
