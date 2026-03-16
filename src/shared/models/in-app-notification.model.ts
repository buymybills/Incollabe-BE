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
} from 'sequelize-typescript';

export enum NotificationType {
  // Campaign related
  CAMPAIGN_INVITE = 'campaign_invite',
  CAMPAIGN_SELECTED = 'campaign_selected',
  CAMPAIGN_REJECTED = 'campaign_rejected',
  CAMPAIGN_STATUS_UPDATE = 'campaign_status',
  CAMPAIGN_COMPLETED = 'campaign_completed',
  CAMPAIGN_CANCELLED = 'campaign_cancelled',

  // Application related
  NEW_APPLICATION = 'new_application',
  APPLICATION_APPROVED = 'application_approved',
  APPLICATION_REJECTED = 'application_rejected',

  // Payment related
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_RELEASED = 'payment_released',
  PAYMENT_FAILED = 'payment_failed',

  // Content related
  CONTENT_SUBMITTED = 'content_submitted',
  CONTENT_APPROVED = 'content_approved',
  CONTENT_REVISION_REQUESTED = 'content_revision_requested',

  // Social interactions
  NEW_FOLLOWER = 'new_follower',
  POST_LIKE = 'post_like',
  POST_COMMENT = 'post_comment',

  // Chat/Messages
  NEW_MESSAGE = 'new_message',
  CHAT_MENTION = 'chat_mention',

  // System
  WELCOME = 'welcome',
  PROFILE_VERIFIED = 'profile_verified',
  PROFILE_REJECTED = 'profile_rejected',
  PRO_SUBSCRIPTION_ACTIVATED = 'pro_subscription_activated',
  PRO_SUBSCRIPTION_EXPIRING = 'pro_subscription_expiring',
  PRO_SUBSCRIPTION_EXPIRED = 'pro_subscription_expired',

  // General
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  CUSTOM = 'custom',
}

export enum NotificationPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

@Table({
  tableName: 'in_app_notifications',
  timestamps: true,
  underscored: true,
})
export class InAppNotification extends Model<InAppNotification> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  // User identification (polymorphic)
  @AllowNull(false)
  @Index
  @Column(DataType.INTEGER)
  declare userId: number;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING(20))
  declare userType: 'influencer' | 'brand';

  // Notification content
  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare body: string;

  @AllowNull(false)
  @Index
  @Column(DataType.STRING(50))
  declare type: NotificationType;

  // Action/Navigation
  @AllowNull(true)
  @Column(DataType.TEXT)
  declare actionUrl: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare actionType: string | null;

  // Media
  @AllowNull(true)
  @Column(DataType.TEXT)
  declare imageUrl: string | null;

  // Related entities
  @AllowNull(true)
  @Column(DataType.STRING(50))
  declare relatedEntityType: string | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare relatedEntityId: number | null;

  // Custom data
  @AllowNull(true)
  @Column(DataType.JSONB)
  declare metadata: Record<string, any> | null;

  // Read status
  @AllowNull(false)
  @Default(false)
  @Index
  @Column(DataType.BOOLEAN)
  declare isRead: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare readAt: Date | null;

  // Priority
  @AllowNull(false)
  @Default(NotificationPriority.NORMAL)
  @Column(DataType.STRING(20))
  declare priority: NotificationPriority;

  // Expiration
  @AllowNull(true)
  @Column(DataType.DATE)
  declare expiresAt: Date | null;

  // Timestamps
  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;
}
