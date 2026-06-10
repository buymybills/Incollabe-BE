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
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { BotCustomer } from './bot-customer.model';

/**
 * A saved shipping address belonging to a bot customer. A customer can have
 * many — on a repeat purchase the bot offers these back ("use this / add new /
 * delete"). Soft-deleted (is_active=false) so historical orders keep their snapshot.
 */
@Table({
  tableName: 'bot_addresses',
  timestamps: true,
  underscored: true,
})
export class BotAddress extends Model<BotAddress> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  @ForeignKey(() => BotCustomer)
  @AllowNull(false)
  @Index
  @Column({ field: 'customer_id', type: DataType.INTEGER })
  declare customerId: number;

  @BelongsTo(() => BotCustomer)
  declare customer?: BotCustomer;

  // Friendly label e.g. "Home", "Office"
  @AllowNull(true)
  @Column(DataType.STRING(40))
  declare label: string | null;

  // Contact on this address (may differ from the account holder)
  @AllowNull(true)
  @Column(DataType.STRING(120))
  declare name: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare mobile: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  declare line1: string;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare line2: string | null;

  @AllowNull(false)
  @Column(DataType.STRING(80))
  declare city: string;

  @AllowNull(false)
  @Column(DataType.STRING(80))
  declare state: string;

  @AllowNull(false)
  @Column(DataType.STRING(12))
  declare pincode: string;

  @AllowNull(false)
  @Default('India')
  @Column(DataType.STRING(60))
  declare country: string;

  @AllowNull(false)
  @Default(false)
  @Column({ field: 'is_default', type: DataType.BOOLEAN })
  declare isDefault: boolean;

  @AllowNull(false)
  @Default(true)
  @Column({ field: 'is_active', type: DataType.BOOLEAN })
  declare isActive: boolean;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}
