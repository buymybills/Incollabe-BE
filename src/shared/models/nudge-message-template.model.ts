import { Table, Column, Model, DataType } from 'sequelize-typescript';

export enum NudgeMessageType {
  ROTATION = 'rotation', // Generic rotating messages
  OUT_OF_CREDITS = 'out_of_credits', // Urgent - user has 0 credits
  ACTIVE_USER = 'active_user', // User with many applications
}

@Table({
  tableName: 'nudge_message_templates',
  timestamps: true,
  underscored: true,
})
export class NudgeMessageTemplate extends Model {
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
  declare title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare body: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: 'message_type',
  })
  declare messageType: NudgeMessageType;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'min_campaign_applications',
  })
  declare minCampaignApplications: number | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'requires_zero_credits',
  })
  declare requiresZeroCredits: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare priority: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'rotation_order',
  })
  declare rotationOrder: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    field: 'times_sent',
  })
  declare timesSent: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    field: 'conversion_count',
  })
  declare conversionCount: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'valid_from',
  })
  declare validFrom: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'valid_until',
  })
  declare validUntil: Date | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'created_by',
  })
  declare createdBy: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'internal_notes',
  })
  declare internalNotes: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'created_at',
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  /**
   * Check if template is currently valid based on date range
   */
  isCurrentlyValid(): boolean {
    const now = new Date();

    if (this.validFrom && now < this.validFrom) {
      return false; // Not yet started
    }

    if (this.validUntil && now > this.validUntil) {
      return false; // Already expired
    }

    return true;
  }

  /**
   * Check if template matches user's behavior
   */
  matchesUserBehavior(weeklyCredits: number, campaignApplications: number): boolean {
    // Check credits requirement
    if (this.requiresZeroCredits && weeklyCredits !== 0) {
      return false;
    }

    // Check applications requirement
    if (this.minCampaignApplications !== null && campaignApplications < this.minCampaignApplications) {
      return false;
    }

    return true;
  }

  /**
   * Get conversion rate for this template
   */
  getConversionRate(): number {
    if (this.timesSent === 0) return 0;
    return (this.conversionCount / this.timesSent) * 100;
  }
}
