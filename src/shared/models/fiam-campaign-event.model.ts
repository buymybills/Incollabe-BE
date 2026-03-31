import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  AllowNull,
  Index,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { FiamCampaign } from './fiam-campaign.model';

// ============================================================================
// ENUMS
// ============================================================================

export enum EventType {
  IMPRESSION = 'impression', // Campaign shown to user
  CLICK = 'click', // User clicked button
  DISMISS = 'dismiss', // User closed/dismissed campaign
  CONVERSION = 'conversion', // User completed goal
}

// ============================================================================
// MODEL
// ============================================================================

@Table({
  tableName: 'fiam_campaign_events',
  timestamps: false,
  underscored: true,
})
export class FiamCampaignEvent extends Model<FiamCampaignEvent> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  // Campaign Reference
  @ForeignKey(() => FiamCampaign)
  @AllowNull(false)
  @Index
  @Column(DataType.INTEGER)
  declare campaignId: number;

  @BelongsTo(() => FiamCampaign, 'campaignId')
  declare campaign: FiamCampaign;

  // User Identification
  @AllowNull(false)
  @Index
  @Column(DataType.INTEGER)
  declare userId: number;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING(20))
  declare userType: 'influencer' | 'brand';

  // Event Details
  @AllowNull(false)
  @Index
  @Column(DataType.STRING(20))
  declare eventType: EventType;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare eventMetadata: Record<string, any> | null;

  // Tracking Fields
  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare sessionId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare deviceType: 'android' | 'ios' | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare appVersion: string | null;

  // Timestamp
  @CreatedAt
  @Index
  @Column({ field: 'created_at' })
  declare createdAt: Date;
}
