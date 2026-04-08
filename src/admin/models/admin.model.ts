import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  Unique,
  AllowNull,
  Default,
} from 'sequelize-typescript';

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  PROFILE_REVIEWER = 'profile_reviewer',
  CONTENT_MODERATOR = 'content_moderator',
}

export enum AdminStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum AdminTab {
  DASHBOARD = 'dashboard',
  INFLUENCERS = 'influencers',
  BRANDS = 'brands',
  CAMPAIGNS = 'campaigns',
  POSTS = 'posts',
  HYPE_STORE = 'hype_store',
  WALLET = 'wallet',
  PUSH_NOTIFICATIONS = 'push_notifications',
  FIAM_CAMPAIGNS = 'fiam_campaigns',
  PROFILE_REVIEWS = 'profile_reviews',
  ANALYTICS = 'analytics',
  SETTINGS = 'settings',
  ADMIN_MANAGEMENT = 'admin_management',
}

export enum TabAccessLevel {
  NONE = 'none',
  VIEW = 'view',
  EDIT = 'edit',
}

@Table({
  tableName: 'admins',
  timestamps: true,
})
export class Admin extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column({
    type: DataType.STRING,
    validate: {
      isEmail: {
        msg: 'Please provide a valid email address',
      },
    },
  })
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare password: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(50),
    defaultValue: AdminRole.PROFILE_REVIEWER,
  })
  declare role: string;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(AdminStatus)),
    defaultValue: AdminStatus.ACTIVE,
  })
  declare status: AdminStatus;

  @AllowNull(true)
  @Column({
    type: DataType.JSONB,
    field: 'tab_permissions',
  })
  declare tabPermissions: Record<string, TabAccessLevel> | null;

  @AllowNull(true)
  @Column({
    type: DataType.INTEGER,
    field: 'created_by',
  })
  declare createdBy: number | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastLoginAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare resetPasswordToken: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare resetPasswordExpires: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare profileImage: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare twoFactorEnabled: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
