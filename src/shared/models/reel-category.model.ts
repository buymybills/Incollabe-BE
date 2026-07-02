import { Table, Column, Model, DataType, HasMany } from 'sequelize-typescript';
import { CategoryReel } from './category-reel.model';

/**
 * Admin-curated occasion/style category (e.g. "Party Wear", "Vacay Wear",
 * "Office Wear", "Casual Gathering"). Each category groups a set of Instagram
 * reels (see CategoryReel) that the shopping bot surfaces as look-discovery
 * chips — tap a category → bot sends its curated reels.
 */
@Table({
  tableName: 'reel_categories',
  timestamps: true,
  underscored: true,
})
export class ReelCategory extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  /** Display name shown as a chip in the bot + heading in admin. */
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare name: string;

  /** URL/keyword-friendly form of the name (lowercase, hyphenated), unique. */
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare slug: string;

  /** Optional admin note / description. */
  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  /** Lower sorts first in the bot chip list + admin. */
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

  @HasMany(() => CategoryReel)
  declare reels?: CategoryReel[];

  /** Canonical slug: lowercase, spaces/punctuation → single hyphens. */
  static toSlug(name: string): string {
    return (name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
