import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';

@Table({
  tableName: 'api_activity_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_type'] },
    { fields: ['method'] },
    { fields: ['status_code'] },
    { fields: ['created_at'] },
    { fields: ['endpoint'] },
    { fields: ['user_id', 'created_at'] },
  ],
})
export class ApiActivityLog extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  // ========== REQUEST INFO ==========
  @Column({
    type: DataType.STRING(10),
    allowNull: false,
  })
  @Index
  declare method: string; // GET, POST, PUT, DELETE, PATCH

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  @Index
  declare endpoint: string; // /api/campaigns, /admin/users

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare fullUrl: string; // Full URL with query params

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare queryParams: Record<string, any>; // URL query parameters

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare requestBody: Record<string, any>; // POST/PUT body

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare requestHeaders: Record<string, string>; // Headers (sanitized)

  // ========== USER INFO ==========
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  @Index
  declare userId: number | null; // Influencer/Brand/Admin ID

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  @Index
  declare userType: string | null; // 'influencer', 'brand', 'admin', 'external'

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare userEmail: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare username: string | null;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare ipAddress: string; // Client IP

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare userAgent: string; // Browser/App info

  // ========== RESPONSE INFO ==========
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  @Index
  declare statusCode: number; // 200, 201, 400, 500, etc.

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare responseBody: Record<string, any>; // API response (truncated if large)

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare responseSizeBytes: number; // Response size in bytes

  // ========== PERFORMANCE METRICS ==========
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare responseTimeMs: number; // Response time in milliseconds

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isSlow: boolean; // True if response time > 5000ms

  // ========== ERROR INFO ==========
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  @Index
  declare isError: boolean; // True if status >= 400

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorMessage: string | null; // Error message if any

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorStack: string | null; // Error stack trace (admin only)

  // ========== METADATA ==========
  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare controllerName: string | null; // e.g., 'CampaignController'

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare actionName: string | null; // e.g., 'createCampaign'

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare tags: string[]; // ['batch-processing', 'ai-call', 'payment']

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string | null; // Optional admin notes

  // ========== TIMESTAMPS ==========
  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  @Index
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  // ========== HELPER METHODS ==========

  /**
   * Check if this is a successful request
   */
  isSuccess(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /**
   * Get performance category
   */
  getPerformanceCategory(): 'fast' | 'normal' | 'slow' | 'very_slow' {
    if (this.responseTimeMs < 200) return 'fast';
    if (this.responseTimeMs < 1000) return 'normal';
    if (this.responseTimeMs < 5000) return 'slow';
    return 'very_slow';
  }

  /**
   * Sanitize for public view (remove sensitive data)
   */
  toPublicJSON() {
    return {
      id: this.id,
      method: this.method,
      endpoint: this.endpoint,
      statusCode: this.statusCode,
      responseTimeMs: this.responseTimeMs,
      userId: this.userId,
      userType: this.userType,
      createdAt: this.createdAt,
      isError: this.isError,
      isSlow: this.isSlow,
    };
  }
}
