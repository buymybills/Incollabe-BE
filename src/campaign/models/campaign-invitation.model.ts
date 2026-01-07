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
  indexes: [
    {
      unique: true,
      fields: ['campaign_id', 'influencer_id'],
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
    field: 'campaign_id',
  })
  campaignId: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'influencer_id',
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
    field: 'expires_at',
  })
  expiresAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'responded_at',
  })
  respondedAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'response_message',
  })
  responseMessage: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Campaign)
  campaign: Campaign;

  @BelongsTo(() => Influencer)
  influencer: Influencer;
}
