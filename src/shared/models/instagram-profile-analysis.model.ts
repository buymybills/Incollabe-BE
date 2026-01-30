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
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export interface NichePerformance {
  niche: string;
  count: number;
  avgReach: number;
  avgEngagement: number;
  avgImpressions: number;
}

export interface LanguageDistribution {
  lang: string;
  percentage: number;
  count: number;
}

export interface KeywordData {
  keyword: string;
  count: number;
  avgEngagement?: number;
}

export interface GrowthMetrics {
  followers: {
    start: number;
    end: number;
    growthCount: number;
    growthPercentage: number;
  };
  engagement: {
    start: number;
    end: number;
    changePercentage: number;
  };
  mediaCount: {
    start: number;
    end: number;
    postsAdded: number;
  };
}

export interface AudienceDemographics {
  ageRange: string;
  gender?: string;
  percentage: number;
}

export interface LocationData {
  location: string;
  percentage: number;
}

export interface InstagramProfileAnalysisCreationAttributes {
  influencerId?: number;
  brandId?: number;
  instagramUserId: string;
  instagramUsername?: string;
  syncNumber?: number;
  syncDate?: Date;
  postsAnalyzed?: number;
  analysisPeriodStart?: Date;
  analysisPeriodEnd?: Date;
  totalFollowers?: number;
  activeFollowers?: number;
  activeFollowersPercentage?: number;
  onlineFollowersHourlyData?: any;
  topNiches?: NichePerformance[];
  nichePerformance?: NichePerformance[];
  contentStyles?: any;
  dominantStyle?: string;
  paidCampaignsCount?: number;
  paidCampaignsByNiche?: any;
  languagesUsed?: LanguageDistribution[];
  primaryLanguage?: string;
  topKeywords?: KeywordData[];
  suggestedKeywords?: KeywordData[];
  targetAudience?: any;
  audienceAgeGender?: AudienceDemographics[];
  audienceCities?: LocationData[];
  audienceCountries?: LocationData[];
  targetAudienceSummary?: string;
  facelessContentPercentage?: number;
  avgLightingScore?: number;
  avgAestheticsScore?: number;
  avgEditingQualityScore?: number;
  visualAnalysisSummary?: string;
  avgEngagementRate?: number;
  avgReach?: number;
  avgImpressions?: number;
  totalLikes?: number;
  totalComments?: number;
  totalShares?: number;
  totalSaves?: number;
  growthMetrics?: GrowthMetrics;
  relevanceScore?: number;
  trendingTopics?: any;
  aiGrowthFeedback?: string;
  aiPostingFeedback?: string;
  aiEngagementFeedback?: string;
  aiContentFeedback?: string;
  aiFeedbackGeneratedAt?: Date;
  aiFeedbackVersion?: number;
  // Comprehensive AI analysis cache (generated once per snapshot)
  aiNicheAnalysis?: any;
  aiLanguageAnalysis?: any;
  aiVisualAnalysis?: any;
  aiSentimentAnalysis?: any;
  aiHashtagAnalysis?: any;
  aiCtaAnalysis?: any;
  aiColorPaletteAnalysis?: any;
  aiTrendAnalysis?: any;
  aiRetentionCurve?: any;
  aiMonetizationAnalysis?: any;
  aiPayoutPrediction?: any;
  aiAudienceSentiment?: any;
  analyzedAt?: Date;
}

@Table({ tableName: 'instagram_profile_analysis', timestamps: true, underscored: true })
export class InstagramProfileAnalysis extends Model<InstagramProfileAnalysis, InstagramProfileAnalysisCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare influencerId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare brandId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare instagramUserId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare instagramUsername: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare syncNumber: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare syncDate: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare postsAnalyzed: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
  })
  declare analysisPeriodStart: Date;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
  })
  declare analysisPeriodEnd: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare totalFollowers: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare activeFollowers: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare activeFollowersPercentage: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare onlineFollowersHourlyData: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare topNiches: NichePerformance[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare nichePerformance: NichePerformance[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare contentStyles: any;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare dominantStyle: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare paidCampaignsCount: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare paidCampaignsByNiche: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare languagesUsed: LanguageDistribution[];

  @Column({
    type: DataType.STRING(10),
    allowNull: true,
  })
  declare primaryLanguage: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare topKeywords: KeywordData[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare suggestedKeywords: KeywordData[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare targetAudience: any;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare avgEngagementRate: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare avgReach: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare avgImpressions: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare totalLikes: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare totalComments: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare totalShares: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare totalSaves: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare growthMetrics: GrowthMetrics;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare relevanceScore: number;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare trendingTopics: any;

  // Audience Demographics
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceAgeGender: AudienceDemographics[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceCities: LocationData[];

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare audienceCountries: LocationData[];

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare targetAudienceSummary: string;

  // Visual Analysis
  @Column({
    type: DataType.DECIMAL(5, 2),
    defaultValue: 0.00,
  })
  declare facelessContentPercentage: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare avgLightingScore: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare avgAestheticsScore: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare avgEditingQualityScore: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare visualAnalysisSummary: string;

  // AI Feedback Cache - Store generated feedback to avoid repeated AI calls
  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare aiGrowthFeedback: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare aiPostingFeedback: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare aiEngagementFeedback: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare aiContentFeedback: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare aiFeedbackGeneratedAt: Date;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 1,
  })
  declare aiFeedbackVersion: number;

  // Comprehensive AI analysis cache (generated once per snapshot, reused by all scoring APIs)
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiNicheAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiLanguageAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiVisualAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiSentimentAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiHashtagAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiCtaAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiColorPaletteAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiTrendAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiRetentionCurve: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiMonetizationAnalysis: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiPayoutPrediction: any;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare aiAudienceSentiment: any;

  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare analyzedAt: Date;

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

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
