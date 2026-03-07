import {
  Table,
  Column,
  Model,
  DataType,
  Index,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Brand } from '../../brand/model/brand.model';

@Table({
  tableName: 'hype_stores',
  timestamps: true,
  underscored: true,
})
export class HypeStore extends Model<HypeStore> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => Brand)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    unique: true,
  })
  declare brandId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare storeName: string;

  @Index
  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    unique: true,
  })
  declare storeSlug: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare storeDescription: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  declare storeLogo: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  declare storeBanner: string;

  // Store settings
  @Index
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isVerified: boolean;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0.00,
  })
  declare minOrderValue: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare maxOrderValue: number;

  // Statistics
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare totalOrders: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    defaultValue: 0.00,
  })
  declare totalRevenue: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    defaultValue: 0.00,
  })
  declare totalCashbackGiven: number;

  // Metadata
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare settings: Record<string, any>;

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
  @BelongsTo(() => Brand)
  declare brand: Brand;
}
