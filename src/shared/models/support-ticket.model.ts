import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Admin } from '../../admin/models/admin.model';

export enum TicketStatus {
  UNRESOLVED = 'unresolved',
  RESOLVED = 'resolved',
}

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export enum ReportType {
  TECHNICAL_ISSUE = 'technical_issue',
  ACCOUNT_ISSUE = 'account_issue',
  PAYMENT_ISSUE = 'payment_issue',
  REPORT_USER = 'report_user',
  CAMPAIGN_ISSUE = 'campaign_issue',
  CONTENT_ISSUE = 'content_issue',
  OTHER = 'other',
}

@Table({
  tableName: 'support_tickets',
  timestamps: true,
  underscored: false,
})
export class SupportTicket extends Model<SupportTicket> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  // Reporter information
  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: false,
  })
  declare userType: UserType;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'influencerId',
  })
  declare influencerId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'brandId',
  })
  declare brandId: number;

  // Ticket details
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare subject: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare description: string;

  @Column({
    type: DataType.ENUM(...Object.values(ReportType)),
    allowNull: false,
  })
  declare reportType: ReportType;

  @Column({
    type: DataType.ENUM(...Object.values(TicketStatus)),
    allowNull: false,
    defaultValue: TicketStatus.UNRESOLVED,
  })
  declare status: TicketStatus;

  // Reported user (if reporting another user)
  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: true,
  })
  declare reportedUserType: UserType;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare reportedUserId: number;

  // Admin handling
  @ForeignKey(() => Admin)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare assignedToAdminId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare adminNotes: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare resolution: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare resolvedAt: Date;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
    defaultValue: [],
  })
  declare imageUrls: string[];

  // Associations
  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;

  @BelongsTo(() => Admin)
  declare assignedAdmin: Admin;

  @HasMany(() => require('./support-ticket-reply.model').SupportTicketReply)
  declare replies: any[];
}
