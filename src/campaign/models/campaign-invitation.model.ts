import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Campaign } from './campaign.model';
import { Influencer } from '../../auth/model/influencer.model';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

@Table({
  tableName: 'campaign_invitations',
  timestamps: true,
  underscored: false, // DB columns are already in camelCase
  indexes: [
    {
      unique: true,
      fields: ['campaignId', 'influencerId'],
      name: 'unique_campaign_influencer_invitation',
    },
  ],
})
export class CampaignInvitation extends Model<CampaignInvitation> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  campaignId: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  influencerId: number;

  @Column({
    type: DataType.ENUM(...Object.values(InvitationStatus)),
    allowNull: false,
    defaultValue: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  message: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  expiresAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  respondedAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  responseMessage: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Campaign)
  campaign: Campaign;

  @BelongsTo(() => Influencer)
  influencer: Influencer;
}
