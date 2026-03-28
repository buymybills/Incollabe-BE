import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Default,
  Index,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Admin } from '../../admin/models/admin.model';

// ============================================================================
// ENUMS
// ============================================================================

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export enum TriggerType {
  EVENT = 'event',
  SCHEDULED = 'scheduled',
}

export enum LayoutType {
  CARD = 'card',
  MODAL = 'modal',
  BANNER = 'banner',
  TOP_BANNER = 'top_banner',
  IMAGE_ONLY = 'image_only',
}

export enum TriggerEvent {
  APP_OPEN = 'app_open',
  SCREEN_VIEW_HOME = 'screen_view_home',
  SCREEN_VIEW_CAMPAIGNS = 'screen_view_campaigns',
  SCREEN_VIEW_PROFILE = 'screen_view_profile',
  SCREEN_VIEW_WALLET = 'screen_view_wallet',
  SCREEN_VIEW_HYPE_STORE = 'screen_view_hype_store',
  PROFILE_VIEW_SELF = 'profile_view_self',
  POST_CREATE = 'post_create',
  CAMPAIGN_APPLICATION_SUBMITTED = 'campaign_application_submitted',
  LOW_CREDITS = 'low_credits',
  OUT_OF_CREDITS = 'out_of_credits',
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface ButtonConfig {
  text: string;
  actionUrl: string;
  backgroundColor: string;
  textColor: string;
}

export interface UIConfig {
  layoutType: LayoutType;
  backgroundColor: string;
  textColor: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string; // For banner/image_only layouts (entire element is clickable)
  buttonConfig?: ButtonConfig; // For modal/card layouts (explicit buttons)
  secondaryButtonConfig?: ButtonConfig;
}

export interface FrequencyConfig {
  maxImpressionsPerUser?: number; // Total lifetime impressions per user
  maxImpressionsPerDay?: number; // Max impressions in 24 hours
  cooldownHours?: number; // Hours to wait after dismiss before showing again
  globalMaxImpressions?: number; // Stop campaign after total impressions
}

export interface BehaviorFilters {
  minCampaignApplications?: number;
  requiresZeroCredits?: boolean;
  hasProSubscription?: boolean;
  minFollowerCount?: number;
  maxFollowerCount?: number;
}

// ============================================================================
// MODEL
// ============================================================================

@Table({
  tableName: 'fiam_campaigns',
  timestamps: true,
  underscored: true,
})
export class FiamCampaign extends Model<FiamCampaign> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  // Campaign Metadata
  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare name: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  declare internalName: string | null;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null;

  @AllowNull(false)
  @Default(CampaignStatus.DRAFT)
  @Index
  @Column(DataType.STRING(20))
  declare status: CampaignStatus;

  @AllowNull(false)
  @Default(0)
  @Index
  @Column(DataType.INTEGER)
  declare priority: number;

  // Rich UI Configuration
  @AllowNull(false)
  @Column(DataType.JSONB)
  declare uiConfig: UIConfig;

  // Trigger Configuration
  @AllowNull(false)
  @Index
  @Column(DataType.STRING(20))
  declare triggerType: TriggerType;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare triggerEvents: TriggerEvent[] | null;

  @AllowNull(true)
  @Index
  @Column(DataType.DATE)
  declare scheduledAt: Date | null;

  // Targeting Configuration
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare targetUserTypes: ('influencer' | 'brand')[] | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare targetGender: 'male' | 'female' | 'others' | 'all' | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare targetMinAge: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare targetMaxAge: number | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare targetLocations: string[] | null;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare targetIsPanIndia: boolean;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare targetNicheIds: number[] | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare targetSpecificUserIds: number[] | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare targetBehaviorFilters: BehaviorFilters | null;

  // Frequency Capping
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare frequencyConfig: FrequencyConfig | null;

  // Campaign Lifecycle
  @AllowNull(true)
  @Index
  @Column(DataType.DATE)
  declare startDate: Date | null;

  @AllowNull(true)
  @Index
  @Column(DataType.DATE)
  declare endDate: Date | null;

  // Analytics
  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare totalImpressions: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare totalClicks: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare totalDismissals: number;

  @AllowNull(false)
  @Default(0)
  @Column(DataType.INTEGER)
  declare totalConversions: number;

  // Conversion tracking
  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare conversionEvent: string | null;

  @AllowNull(false)
  @Default(24)
  @Column(DataType.INTEGER)
  declare conversionWindowHours: number;

  // Metadata
  @ForeignKey(() => Admin)
  @AllowNull(false)
  @Index
  @Column(DataType.INTEGER)
  declare createdBy: number;

  @BelongsTo(() => Admin, 'createdBy')
  declare creator: Admin;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare internalNotes: string | null;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if campaign is currently active and within date range
   */
  isActive(): boolean {
    const now = new Date();

    if (this.status !== CampaignStatus.ACTIVE) {
      return false;
    }

    if (this.startDate && now < this.startDate) {
      return false;
    }

    if (this.endDate && now > this.endDate) {
      return false;
    }

    return true;
  }

  /**
   * Check if campaign has reached global impression limit
   */
  hasReachedGlobalLimit(): boolean {
    const maxImpressions = this.frequencyConfig?.globalMaxImpressions;
    return maxImpressions ? this.totalImpressions >= maxImpressions : false;
  }

  /**
   * Calculate conversion rate percentage
   */
  getConversionRate(): number {
    return this.totalImpressions > 0
      ? (this.totalConversions / this.totalImpressions) * 100
      : 0;
  }

  /**
   * Calculate click-through rate percentage
   */
  getClickThroughRate(): number {
    return this.totalImpressions > 0
      ? (this.totalClicks / this.totalImpressions) * 100
      : 0;
  }

  /**
   * Calculate dismissal rate percentage
   */
  getDismissalRate(): number {
    return this.totalImpressions > 0
      ? (this.totalDismissals / this.totalImpressions) * 100
      : 0;
  }

  /**
   * Check if campaign is eligible for a specific trigger event
   */
  matchesTriggerEvent(event: TriggerEvent): boolean {
    if (this.triggerType !== TriggerType.EVENT) {
      return false;
    }

    if (!this.triggerEvents || this.triggerEvents.length === 0) {
      return false;
    }

    return this.triggerEvents.includes(event);
  }

  /**
   * Check if campaign should be shown to a specific user type
   */
  matchesUserType(userType: 'influencer' | 'brand'): boolean {
    // If no user types specified, target all users
    if (!this.targetUserTypes || this.targetUserTypes.length === 0) {
      return true;
    }

    return this.targetUserTypes.includes(userType);
  }
}
