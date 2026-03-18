import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { HypeStore } from './hype-store.model';
import { HypeStoreOrder } from './hype-store-order.model';

@Table({
  tableName: 'hype_store_webhook_logs',
  timestamps: false,
  underscored: true,
})
export class HypeStoreWebhookLog extends Model<HypeStoreWebhookLog> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => HypeStore)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'hype_store_id',
  })
  declare hypeStoreId: number;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
    field: 'request_method',
  })
  declare requestMethod: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'request_path',
  })
  declare requestPath: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'request_headers',
  })
  declare requestHeaders: Record<string, any>;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'request_body',
  })
  declare requestBody: Record<string, any>;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'request_ip',
  })
  declare requestIp: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'response_status',
  })
  declare responseStatus: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'response_body',
  })
  declare responseBody: Record<string, any>;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_valid',
  })
  declare isValid: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'error_message',
  })
  declare errorMessage: string;

  @ForeignKey(() => HypeStoreOrder)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'processed_order_id',
  })
  declare processedOrderId: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare hypeStore: HypeStore;

  @BelongsTo(() => HypeStoreOrder)
  declare processedOrder: HypeStoreOrder;
}
