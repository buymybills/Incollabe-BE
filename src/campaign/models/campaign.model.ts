import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Brand } from '../../brand/model/brand.model';
import { CampaignCity } from './campaign-city.model';
import { CampaignDeliverable } from './campaign-deliverable.model';
import { CampaignInvitation } from './campaign-invitation.model';
import { CampaignApplication } from './campaign-application.model';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CampaignType {
  UGC = 'ugc',
  PAID = 'paid',
  BARTER = 'barter',
  ENGAGEMENT = 'engagement',
}

export interface CampaignCreationAttributes {
  brandId: number;
  name: string;
  description?: string;
  category?: string;
  deliverableFormat?: string;
  status?: CampaignStatus;
  type?: CampaignType;
  isInviteOnly?: boolean;
  isOrganic?: boolean;
  isPanIndia?: boolean;
  minAge?: number;
  maxAge?: number;
  isOpenToAllAges?: boolean;
  genderPreferences?: string[];
  isOpenToAllGenders?: boolean;
  nicheIds?: number[];
  customInfluencerRequirements?: string;
  performanceExpectations?: string;
  brandSupport?: string;
  campaignBudget?: number;
  barterProductWorth?: number;
  additionalMonetaryPayout?: number;
  numberOfInfluencers?: number;
  isActive?: boolean;
}

@Table({
  tableName: 'campaigns',
  timestamps: true,
})
export class Campaign extends Model<Campaign, CampaignCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare brandId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare category: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare deliverableFormat: string;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignStatus)),
    allowNull: false,
    defaultValue: CampaignStatus.ACTIVE,
  })
  declare status: CampaignStatus;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignType)),
    allowNull: false,
    defaultValue: CampaignType.PAID,
  })
  declare type: CampaignType;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isInviteOnly: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isOrganic: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isPanIndia: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare minAge: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxAge: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isOpenToAllAges: boolean;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare genderPreferences: string[];

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare isOpenToAllGenders: boolean;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare nicheIds: number[];

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare customInfluencerRequirements: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare performanceExpectations: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare brandSupport: string;

  // Budget and Influencer Count Fields
  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: true,
  })
  declare campaignBudget: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: true,
  })
  declare barterProductWorth: number;

  @Column({
    type: DataType.DECIMAL(12, 2),
    allowNull: true,
  })
  declare additionalMonetaryPayout: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  declare numberOfInfluencers: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'ai_score_enabled',
  })
  declare aiScoreEnabled: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'ai_score_credit_purchased',
  })
  declare aiScoreCreditPurchased: boolean;

  // Max Campaign Payment Fields
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isMaxCampaign: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare maxCampaignPaymentStatus: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare maxCampaignPaymentId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare maxCampaignOrderId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare maxCampaignPaidAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxCampaignAmount: number;

  // Invite-Only Campaign Payment Fields
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'invite_only_paid',
  })
  declare inviteOnlyPaid: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'invite_only_payment_status',
  })
  declare inviteOnlyPaymentStatus: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'invite_only_payment_id',
  })
  declare inviteOnlyPaymentId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'invite_only_order_id',
  })
  declare inviteOnlyOrderId: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'invite_only_paid_at',
  })
  declare inviteOnlyPaidAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'invite_only_amount',
  })
  declare inviteOnlyAmount: number;

  // Payment Status Tracking Fields
  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'payment_status_message',
  })
  declare paymentStatusMessage: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'payment_status_updated_at',
  })
  declare paymentStatusUpdatedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_payment_attempt_at',
  })
  declare lastPaymentAttemptAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'razorpay_last_webhook_at',
  })
  declare razorpayLastWebhookAt: Date;

  // Timestamps
  declare createdAt: Date;
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => CampaignCity)
  declare cities: CampaignCity[];

  @HasMany(() => CampaignDeliverable)
  declare deliverables: CampaignDeliverable[];

  @HasMany(() => CampaignInvitation)
  declare invitations: CampaignInvitation[];

  @HasMany(() => CampaignApplication)
  declare applications: CampaignApplication[];
}
