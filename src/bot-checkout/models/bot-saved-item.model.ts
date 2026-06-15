import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, AllowNull, Index } from 'sequelize-typescript';

/**
 * A product a shopper saved from the Instagram bot (the "💾 Save" button).
 * Keyed by the IG-scoped id (igsid) so saves persist across bot restarts and
 * are shared across instances — replacing the bot's old in-memory Map.
 */
@Table({
  tableName: 'bot_saved_items',
  timestamps: true,
  underscored: true,
})
export class BotSavedItem extends Model {
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
  @Column({ field: 'image_url', type: DataType.STRING(1024) })
  declare imageUrl: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare slug: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
