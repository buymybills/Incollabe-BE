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
  Index,
} from 'sequelize-typescript';
import { Post } from './post.model';
import { HypeStoreOrder } from '../../wallet/models/hype-store-order.model';
import { HypeStore } from '../../wallet/models/hype-store.model';

@Table({
  tableName: 'hype_reel_products',
  timestamps: true,
  underscored: true,
})
export class HypeReelProduct extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @ForeignKey(() => Post)
  @Index
  @Column(DataType.INTEGER)
  declare postId: number;

  @AllowNull(true)
  @ForeignKey(() => HypeStoreOrder)
  @Column(DataType.INTEGER)
  declare hypeStoreOrderId: number;

  @AllowNull(true)
  @ForeignKey(() => HypeStore)
  @Column(DataType.INTEGER)
  declare hypeStoreId: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare productName: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare productBrand: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare productSize: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare productThumbnailUrl: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare affiliateLink: string;

  @AllowNull(true)
  @Column(DataType.DECIMAL(3, 1))
  declare productRating: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare sortOrder: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Post)
  declare post: Post;
}
