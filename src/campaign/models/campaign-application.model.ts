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

export enum ApplicationStatus {
  APPLIED = 'applied',
  UNDER_REVIEW = 'under_review',
  SELECTED = 'selected',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

@Table({
  tableName: 'campaign_applications',
  timestamps: true,
})
export class CampaignApplication extends Model<CampaignApplication> {
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
    type: DataType.ENUM(...Object.values(ApplicationStatus)),
    allowNull: false,
    defaultValue: ApplicationStatus.APPLIED,
  })
  status: ApplicationStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  coverLetter: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  proposalMessage: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  reviewedAt: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  reviewNotes: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    field: 'ai_score',
  })
  declare aiScore: number | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'ai_score_data',
  })
  declare aiScoreData: Record<string, any> | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Campaign)
  declare campaign: Campaign;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
