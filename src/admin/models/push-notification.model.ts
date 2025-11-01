import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  AllowNull,
  Default,
} from 'sequelize-typescript';
import { Admin } from './admin.model';

export enum NotificationStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum ReceiverType {
  ALL_USERS = 'all_users',
  ALL_INFLUENCERS = 'all_influencers',
  ALL_BRANDS = 'all_brands',
  BRANDS = 'brands',
  INFLUENCERS = 'influencers',
  SPECIFIC_USERS = 'specific_users',
}

export enum GenderFilter {
  MALE = 'male',
  FEMALE = 'female',
  OTHERS = 'others',
  ALL = 'all',
}

@Table({
  tableName: 'push_notifications',
  timestamps: true,
})
export class PushNotification extends Model<PushNotification> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare title: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare body: string;

  @AllowNull(false)
  @Default(ReceiverType.ALL_USERS)
  @Column(DataType.ENUM(...Object.values(ReceiverType)))
  declare receiverType: ReceiverType;

  @AllowNull(true)
  @Column(DataType.JSON)
  declare specificReceivers: number[] | null; // Array of user IDs (influencer or brand IDs)

  @AllowNull(true)
  @Column(DataType.JSON)
  declare locations: string[] | null; // Array of city names

  @AllowNull(true)
  @Default(GenderFilter.ALL)
  @Column(DataType.ENUM(...Object.values(GenderFilter)))
  declare genderFilter: GenderFilter | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare minAge: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare maxAge: number | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  declare nicheIds: number[] | null; // Array of niche IDs

  @AllowNull(true)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isPanIndia: boolean;

  @AllowNull(false)
  @Default(NotificationStatus.DRAFT)
  @Column(DataType.ENUM(...Object.values(NotificationStatus)))
  declare status: NotificationStatus;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare scheduledAt: Date | null;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare sentAt: Date | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare totalRecipients: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare successCount: number | null;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare failureCount: number | null;

  @AllowNull(true)
  @Column(DataType.JSON)
  declare metadata: Record<string, any> | null; // Additional data like image URL, action URL, etc.

  @ForeignKey(() => Admin)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare createdBy: number;

  @BelongsTo(() => Admin, 'createdBy')
  declare creator: Admin;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
