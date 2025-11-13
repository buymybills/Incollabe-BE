import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo
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
  userType: UserType;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  influencerId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  brandId: number;

  // Ticket details
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  subject: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  description: string;

  @Column({
    type: DataType.ENUM(...Object.values(ReportType)),
    allowNull: false,
  })
  reportType: ReportType;

  @Column({
    type: DataType.ENUM(...Object.values(TicketStatus)),
    allowNull: false,
    defaultValue: TicketStatus.UNRESOLVED,
  })
  status: TicketStatus;

  // Reported user (if reporting another user)
  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: true,
  })
  reportedUserType: UserType;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  reportedUserId: number;

  // Admin handling
  @ForeignKey(() => Admin)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  assignedToAdminId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  adminNotes: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  resolution: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  resolvedAt: Date;

  // Associations
  @BelongsTo(() => Influencer)
  influencer: Influencer;

  @BelongsTo(() => Brand)
  brand: Brand;

  @BelongsTo(() => Admin)
  assignedAdmin: Admin;
}
