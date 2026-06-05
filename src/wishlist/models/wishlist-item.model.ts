import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  ForeignKey,
  AllowNull,
  Index,
} from 'sequelize-typescript';
import { Wishlist } from './wishlist.model';

@Table({ tableName: 'wishlist_items', timestamps: true })
export class WishlistItem extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @Index
  @ForeignKey(() => Wishlist)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: 'wishlist_id' })
  declare wishlistId: number;

  @BelongsTo(() => Wishlist)
  declare wishlist: Wishlist;

  @AllowNull(false)
  @Column({ type: DataType.STRING(256), field: 'product_name' })
  declare productName: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(128), field: 'brand_name' })
  declare brandName: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'product_url' })
  declare productUrl: string | null;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'image_url' })
  declare imageUrl: string | null;

  @AllowNull(true)
  @Column({ type: DataType.DECIMAL(10, 2), field: 'price_inr' })
  declare priceInr: number | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(32) })
  declare size: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
