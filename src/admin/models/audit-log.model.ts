import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  Index,
} from 'sequelize-typescript';
import { Admin } from './admin.model';

export enum AuditSection {
  AUTH = 'Auth',
  CAMPAIGNS = 'Campaigns',
  NOTIFICATION_CENTRE = 'Notification Centre',
  BRAND = 'Brand',
  INFLUENCER = 'Influencer',
  ADMIN_MANAGEMENT = 'Admin Management',
  PROFILE_REVIEW = 'Profile Review',
  POSTS = 'Posts',
  SETTINGS = 'Settings',
}

export enum AuditActionType {
  // Auth actions
  LOGIN = 'Login',
  LOGOUT = 'Logout',
  LOGOUT_ALL = 'Logout All Sessions',
  PASSWORD_CHANGE = 'Password Change',
  TWO_FACTOR_ENABLED = 'Two Factor Enabled',
  TWO_FACTOR_DISABLED = 'Two Factor Disabled',

  // Campaign actions
  CAMPAIGN_TYPE_CHANGE = 'Type Change in Campaign',
  CAMPAIGN_APPROVED = 'Campaign Approved',
  CAMPAIGN_REJECTED = 'Campaign Rejected',
  CAMPAIGN_DELETED = 'Campaign Deleted',

  // Notification actions
  NOTIFICATION_CREATED = 'Created New Notification',
  NOTIFICATION_UPDATED = 'Notification Updated',
  NOTIFICATION_DELETED = 'Delete Notification',
  NOTIFICATION_SENT = 'Push Notification Sent',

  // Profile actions
  PROFILE_APPROVED = 'Profile Approved',
  PROFILE_REJECTED = 'Profile Rejected',
  PROFILE_SUSPENDED = 'Profile Suspended',
  PROFILE_ACTIVATED = 'Profile Activated',

  // Brand actions
  BRAND_PROFILE_CREATED = 'New brand profile created',
  BRAND_PROFILE_UPDATED = 'Brand Profile Updated',
  BRAND_VERIFIED = 'Brand Verified',
  BRAND_UNVERIFIED = 'Brand Unverified',
  BRAND_TOP_STATUS_CHANGED = 'Brand Top Status Changed',

  // Influencer actions
  INFLUENCER_PROFILE_CREATED = 'New influencer profile created',
  INFLUENCER_PROFILE_UPDATED = 'Influencer Profile Updated',
  INFLUENCER_VERIFIED = 'Influencer Verified',
  INFLUENCER_UNVERIFIED = 'Influencer Unverified',
  INFLUENCER_TOP_STATUS_CHANGED = 'Influencer Top Status Changed',

  // Admin management
  ADMIN_CREATED = 'New Admin Created',
  ADMIN_UPDATED = 'Admin Updated',
  ADMIN_DELETED = 'Admin Deleted',
  ADMIN_STATUS_CHANGED = 'Admin Status Changed',

  // Post actions
  POST_DELETED = 'Post Deleted',
  POST_FLAGGED = 'Post Flagged',
  POST_UNFLAGGED = 'Post Unflagged',

  // Settings
  SETTINGS_UPDATED = 'Settings Updated',
}

@Table({
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false, // We only need createdAt for audit logs
  indexes: [
    {
      name: 'idx_audit_logs_admin_id',
      fields: ['admin_id'],
    },
    {
      name: 'idx_audit_logs_section',
      fields: ['section'],
    },
    {
      name: 'idx_audit_logs_action_type',
      fields: ['action_type'],
    },
    {
      name: 'idx_audit_logs_created_at',
      fields: ['created_at'],
    },
    {
      name: 'idx_audit_logs_target_id',
      fields: ['target_id'],
    },
  ],
})
export class AuditLog extends Model<AuditLog> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'admin_id',
  })
  declare adminId: number;

  @BelongsTo(() => Admin)
  admin: Admin;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    field: 'admin_name',
  })
  adminName: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    field: 'admin_email',
  })
  adminEmail: string;

  @Column({
    type: DataType.ENUM(...Object.values(AuditSection)),
    allowNull: false,
  })
  section: AuditSection;

  @Column({
    type: DataType.ENUM(...Object.values(AuditActionType)),
    allowNull: false,
    field: 'action_type',
  })
  actionType: AuditActionType;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  details: string | null;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'target_type',
    comment: 'Type of entity affected: campaign, brand, influencer, notification, etc.',
  })
  targetType: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'target_id',
    comment: 'ID of the affected entity',
  })
  targetId: number | null;

  @Column({
    type: DataType.INET,
    allowNull: true,
    field: 'ip_address',
  })
  ipAddress: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'user_agent',
  })
  userAgent: string | null;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;
}
