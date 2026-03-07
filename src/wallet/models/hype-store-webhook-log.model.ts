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
  })
  declare hypeStoreId: number;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
  })
  declare requestMethod: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare requestPath: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare requestHeaders: Record<string, any>;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare requestBody: Record<string, any>;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare requestIp: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare responseStatus: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare responseBody: Record<string, any>;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  })
  declare isValid: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorMessage: string;

  @ForeignKey(() => HypeStoreOrder)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare processedOrderId: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare hypeStore: HypeStore;

  @BelongsTo(() => HypeStoreOrder)
  declare processedOrder: HypeStoreOrder;
}
