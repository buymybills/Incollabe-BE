import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { ReelCategory } from './reel-category.model';

/**
 * A single Instagram reel curated under a ReelCategory. The shopping bot sends
 * these when a shopper picks (or names) a category; tapping "Shop this reel"
 * runs the reel through the bot's analyze → product-match pipeline.
 */
@Table({
  tableName: 'category_reels',
  timestamps: true,
  underscored: true,
})
export class CategoryReel extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => ReelCategory)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'category_id',
  })
  declare categoryId: number;

  @BelongsTo(() => ReelCategory)
  declare category?: ReelCategory;

  /** The raw Instagram reel link the admin pasted. */
  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'reel_url',
  })
  declare reelUrl: string;

  /** Shortcode parsed from the link (e.g. "Cabc123" in /reel/Cabc123/). */
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
    field: 'media_shortcode',
  })
  declare mediaShortcode: string | null;

  /** Short label shown on the reel card. */
  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare title: string | null;

  /** Longer caption shown under the title. */
  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare caption: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order',
  })
  declare sortOrder: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'created_by',
  })
  declare createdBy: number | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  /** Parse the Instagram shortcode from a post/reel URL. */
  static parseShortcode(url: string): string | null {
    if (!url) return null;
    const match = url.match(
      /instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i,
    );
    return match ? match[1] : null;
  }
}
