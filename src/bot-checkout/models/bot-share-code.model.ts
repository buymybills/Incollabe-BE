import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, AllowNull, Index } from 'sequelize-typescript';

/**
 * A shopper's share code for their saved-items list (the bot's "share my code"
 * feature). A friend who types the code sees the owner's saved list (read-only).
 * One code per shopper (unique igsid); codes are globally unique (unique code) so
 * the DB constraint makes claiming race-free. Uniqueness is enforced by the unique
 * indexes in migrations/create_bot_share_codes.sql.
 */
@Table({
  tableName: 'bot_share_codes',
  timestamps: true,
  underscored: true,
})
export class BotShareCode extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @AllowNull(false)
  @Index
  @Column({ field: 'igsid', type: DataType.STRING(64) })
  declare igsid: string;

  @AllowNull(false)
  @Index
  @Column({ type: DataType.STRING(30) })
  declare code: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
