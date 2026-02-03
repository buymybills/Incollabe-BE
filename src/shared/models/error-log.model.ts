import { Table, Column, Model, DataType, CreatedAt } from 'sequelize-typescript';

@Table({
  tableName: 'error_logs',
  timestamps: false,
})
export class ErrorLog extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare requestId: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  declare endpoint: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: false,
  })
  declare method: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare statusCode: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorMessage: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorStack: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare userId: number | null;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare userType: string | null;

  @Column({
    type: DataType.STRING(45),
    allowNull: true,
  })
  declare ipAddress: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare userAgent: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare requestBody: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare responseBody: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare systemInfo: Record<string, any> | null;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;
}
