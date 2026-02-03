import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramProfileAnalysis } from './instagram-profile-analysis.model';

@Table({
  tableName: 'influencer_profile_scores',
  timestamps: true,
})
export class InfluencerProfileScore extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare instagramUsername: string | null;

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
  declare scoreChange: number | null;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
  })
  declare grade: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare profileSummary: string | null;

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
  declare audienceQualityScore: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare audienceQualityMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceQualityBreakdown: Record<string, any> | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceQualityOnlinePresence: Record<string, any> | null;

  // Category 2: Content Relevance
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare contentRelevanceScore: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare contentRelevanceMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentRelevanceDetails: Record<string, any> | null;

  // Category 3: Content Quality
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare contentQualityScore: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare contentQualityMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentQualityDetails: Record<string, any> | null;

  // Category 4: Engagement Strength
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare engagementStrengthScore: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare engagementStrengthMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare engagementStrengthDetails: Record<string, any> | null;

  // Category 5: Growth Momentum
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare growthMomentumScore: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare growthMomentumMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare growthMomentumDetails: Record<string, any> | null;

  // Category 6: Monetisation
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare monetisationScore: number | null;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 100,
  })
  declare monetisationMaxScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare monetisationDetails: Record<string, any> | null;

  // Metadata
  @ForeignKey(() => InstagramProfileAnalysis)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare snapshotId: number | null;

  @BelongsTo(() => InstagramProfileAnalysis)
  declare snapshot: InstagramProfileAnalysis;

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
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;
}
