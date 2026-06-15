import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, AllowNull, Default, Index } from 'sequelize-typescript';

/**
 * A line in a shopper's cart, built up from the Instagram bot ("🛒 Add to cart")
 * and reviewed before checkout. Keyed by igsid so the cart persists across bot
 * restarts and instances. One row per (igsid, product, size); qty accumulates.
 */
@Table({
  tableName: 'bot_cart_items',
  timestamps: true,
  underscored: true,
})
export class BotCartItem extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @AllowNull(false)
  @Index
  @Column({ field: 'igsid', type: DataType.STRING(64) })
  declare igsid: string;

  @AllowNull(false)
  @Column({ field: 'product_url', type: DataType.STRING(1024) })
  declare productUrl: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare title: string;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare size: string | null;

  @AllowNull(false)
  @Default(0)
  @Column({ field: 'price_inr', type: DataType.DECIMAL(10, 2) })
  declare priceInr: number;

  @AllowNull(true)
  @Column({ field: 'image_url', type: DataType.STRING(1024) })
  declare imageUrl: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare slug: string | null;

  @AllowNull(false)
  @Default(1)
  @Column(DataType.INTEGER)
  declare qty: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
