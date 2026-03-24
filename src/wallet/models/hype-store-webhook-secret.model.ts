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

@Table({
  tableName: 'hype_store_webhook_secrets',
  timestamps: true,
  underscored: true,
})
export class HypeStoreWebhookSecret extends Model<HypeStoreWebhookSecret> {
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
    allowNull: false,
    unique: true,
  })
  declare hypeStoreId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare webhookSecret: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare webhookUrl: string;

  @Index
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare apiKey: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare apiKeyHash: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastUsedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => HypeStore)
  declare hypeStore: HypeStore;
}
