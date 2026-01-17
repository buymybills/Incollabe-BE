import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  Index,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';

@Table({ tableName: 'influencer_credibility_scores', timestamps: true, underscored: true })
export class InfluencerCredibilityScore extends Model<InfluencerCredibilityScore> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Index
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

  // Category: Audience Quality (25 points)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
  })
  declare audienceQualityScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceQualityBreakdown: any;

  // Category: Content Performance (25 points)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
  })
  declare contentPerformanceScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentPerformanceBreakdown: any;

  // Category: Consistency & Reliability (20 points)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
  })
  declare consistencyReliabilityScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare consistencyReliabilityBreakdown: any;

  // Category: Content Intelligence (20 points)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
  })
  declare contentIntelligenceScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentIntelligenceBreakdown: any;

  // Category: Brand Safety & Trust (10 points)
  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
  })
  declare brandSafetyTrustScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare brandSafetyTrustBreakdown: any;

  // Full breakdown for reference
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare fullScoreDetails: any;

  @Index
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare calculatedAt: Date;

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

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
