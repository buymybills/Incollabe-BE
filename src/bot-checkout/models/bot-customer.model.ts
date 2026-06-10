import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Index,
  Default,
  HasMany,
} from 'sequelize-typescript';
import { BotAddress } from './bot-address.model';

/**
 * A shopper who has started checking out through the Instagram shopping bot.
 * Keyed by the IG-scoped id (igsid) so the same person is recognised on a
 * return visit and their saved addresses are offered back to them.
 */
@Table({
  tableName: 'bot_customers',
  timestamps: true,
  underscored: true,
})
export class BotCustomer extends Model<BotCustomer> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @AllowNull(false)
  @Default('thesouledstore')
  @Index
  @Column(DataType.STRING(60))
  declare brand: string;

  // Instagram-scoped sender id — the stable identity carried in the checkout link
  @AllowNull(false)
  @Index({ unique: false })
  @Column(DataType.STRING(64))
  declare igsid: string;

  // Hashed sender id, to line up with bot_events.user_key for analytics joins
  @AllowNull(true)
  @Index
  @Column(DataType.STRING(64))
  declare userKey: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  declare username: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  declare name: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(150))
  declare email: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare mobile: string | null;

  @HasMany(() => BotAddress)
  declare addresses?: BotAddress[];

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}
