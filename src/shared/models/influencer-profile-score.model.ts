import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramProfileAnalysis } from './instagram-profile-analysis.model';

@Table({
  tableName: 'influencer_profile_scores',
  timestamps: true,
  underscored: true,
})
export class InfluencerProfileScore extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare instagramUsername: string;

  // Overall Score
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
  })
  declare totalScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare maxScore: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare scoreChange: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare grade: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare profileSummary: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare facebookPageConnected: boolean;

  // Category 1: Audience Quality
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare audienceQualityScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare audienceQualityMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceQualityBreakdown: object;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceQualityOnlinePresence: object;

  // Category 2: Content Relevance
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare contentRelevanceScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare contentRelevanceMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentRelevanceDetails: object;

  // Category 3: Content Quality
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare contentQualityScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare contentQualityMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentQualityDetails: object;

  // Category 4: Engagement Strength
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare engagementStrengthScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare engagementStrengthMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare engagementStrengthDetails: object;

  // Category 5: Growth Momentum
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare growthMomentumScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare growthMomentumMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare growthMomentumDetails: object;

  // Category 6: Monetisation Potential
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare monetisationScore: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare monetisationMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare monetisationDetails: object;

  // Metadata
  @ForeignKey(() => InstagramProfileAnalysis)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare snapshotId: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare calculatedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare validUntil: Date;

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
  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => InstagramProfileAnalysis)
  declare snapshot: InstagramProfileAnalysis;
}
