import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum TopCampaignsSortBy {
  // Application Metrics
  APPLICATIONS_COUNT = 'applications_count',
  CONVERSION_RATE = 'conversion_rate',
  APPLICANT_QUALITY = 'applicant_quality',

  // Budget & Payout
  TOTAL_BUDGET = 'total_budget',
  BUDGET_PER_DELIVERABLE = 'budget_per_deliverable',

  // Campaign Scope
  GEOGRAPHIC_REACH = 'geographic_reach',
  CITIES_COUNT = 'cities_count',
  NICHES_COUNT = 'niches_count',

  // Engagement & Success
  SELECTED_INFLUENCERS = 'selected_influencers',
  COMPLETION_RATE = 'completion_rate',

  // Recency
  RECENTLY_LAUNCHED = 'recently_launched',
  RECENTLY_ACTIVE = 'recently_active',

  // Composite
  COMPOSITE = 'composite',
}

export enum TopCampaignsTimeframe {
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  ALL_TIME = 'all',
}

export enum TopCampaignsStatus {
  ALL = 'all',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export class TopCampaignsRequestDto {
  @ApiPropertyOptional({
    description: 'Sort by metric',
    enum: TopCampaignsSortBy,
    default: TopCampaignsSortBy.COMPOSITE,
    example: TopCampaignsSortBy.COMPOSITE,
  })
  @IsOptional()
  @IsEnum(TopCampaignsSortBy)
  sortBy?: TopCampaignsSortBy = TopCampaignsSortBy.COMPOSITE;

  @ApiPropertyOptional({
    description: 'Timeframe for campaign activity',
    enum: TopCampaignsTimeframe,
    default: TopCampaignsTimeframe.ALL_TIME,
    example: TopCampaignsTimeframe.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(TopCampaignsTimeframe)
  timeframe?: TopCampaignsTimeframe = TopCampaignsTimeframe.ALL_TIME;

  @ApiPropertyOptional({
    description: 'Filter by campaign status',
    enum: TopCampaignsStatus,
    default: TopCampaignsStatus.ALL,
    example: TopCampaignsStatus.ALL,
  })
  @IsOptional()
  @IsEnum(TopCampaignsStatus)
  status?: TopCampaignsStatus = TopCampaignsStatus.ALL;

  @ApiPropertyOptional({
    description: 'Filter campaigns from verified brands only',
    default: false,
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verifiedBrandsOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Number of top campaigns to return',
    minimum: 1,
    maximum: 50,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

export class ApplicationMetrics {
  @ApiProperty({
    description: 'Total number of applications received',
    example: 125,
  })
  applicationsCount: number;

  @ApiProperty({
    description: 'Application to selection conversion rate (percentage)',
    example: 24.5,
  })
  conversionRate: number;

  @ApiProperty({
    description: 'Average applicant quality score (0-100)',
    example: 75.5,
  })
  applicantQuality: number;
}

export class BudgetMetrics {
  @ApiProperty({
    description: 'Total campaign budget in rupees',
    example: 150000,
  })
  totalBudget: number;

  @ApiProperty({
    description: 'Budget per deliverable in rupees',
    example: 5000,
  })
  budgetPerDeliverable: number;

  @ApiProperty({
    description: 'Number of deliverables',
    example: 30,
  })
  deliverablesCount: number;
}

export class ScopeMetrics {
  @ApiProperty({
    description: 'Whether campaign is Pan-India',
    example: true,
  })
  isPanIndia: boolean;

  @ApiProperty({
    description: 'Number of cities targeted',
    example: 5,
  })
  citiesCount: number;

  @ApiProperty({
    description: 'Number of niches targeted',
    example: 3,
  })
  nichesCount: number;

  @ApiProperty({
    description: 'Geographic reach score (0-100)',
    example: 85.5,
  })
  geographicReach: number;
}

export class EngagementMetrics {
  @ApiProperty({
    description: 'Number of influencers selected',
    example: 15,
  })
  selectedInfluencers: number;

  @ApiProperty({
    description: 'Campaign completion rate (percentage)',
    example: 80.5,
  })
  completionRate: number;

  @ApiProperty({
    description: 'Campaign status',
    example: 'active',
  })
  status: string;
}

export class RecencyMetrics {
  @ApiProperty({
    description: 'Days since campaign was launched',
    example: 15,
  })
  daysSinceLaunch: number;

  @ApiProperty({
    description: 'Days since last application',
    example: 2,
    nullable: true,
  })
  daysSinceLastApplication: number | null;

  @ApiProperty({
    description: 'Campaign created date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}

export class CampaignMetrics {
  @ApiProperty({
    description: 'Application metrics',
    type: ApplicationMetrics,
  })
  application: ApplicationMetrics;

  @ApiProperty({
    description: 'Budget metrics',
    type: BudgetMetrics,
  })
  budget: BudgetMetrics;

  @ApiProperty({
    description: 'Scope metrics',
    type: ScopeMetrics,
  })
  scope: ScopeMetrics;

  @ApiProperty({
    description: 'Engagement metrics',
    type: EngagementMetrics,
  })
  engagement: EngagementMetrics;

  @ApiProperty({
    description: 'Recency metrics',
    type: RecencyMetrics,
  })
  recency: RecencyMetrics;

  @ApiProperty({
    description: 'Composite score (0-100)',
    example: 82.5,
  })
  compositeScore: number;
}

export class TopCampaignDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: 123,
  })
  id: number;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Fashion Campaign 2024',
  })
  name: string;

  @ApiProperty({
    description: 'Campaign description',
    example: 'Promote our new summer collection',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Campaign category',
    example: 'Fashion',
    nullable: true,
  })
  category: string | null;

  @ApiProperty({
    description: 'Campaign type',
    example: 'paid',
  })
  type: string;

  @ApiProperty({
    description: 'Campaign status',
    example: 'active',
  })
  status: string;

  @ApiProperty({
    description: 'Brand information',
    example: {
      id: 45,
      brandName: 'Nike India',
      username: 'nikeindia',
      profileImage: 'https://...',
      isVerified: true,
    },
  })
  brand: {
    id: number;
    brandName: string;
    username: string;
    profileImage: string | null;
    isVerified: boolean;
  };

  @ApiProperty({
    description: 'Campaign metrics',
    type: CampaignMetrics,
  })
  metrics: CampaignMetrics;

  @ApiProperty({
    description: 'Campaign created date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}

export class TopCampaignsResponseDto {
  @ApiProperty({
    description: 'List of top campaigns',
    type: [TopCampaignDto],
  })
  campaigns: TopCampaignDto[];

  @ApiProperty({
    description: 'Total number of campaigns that qualified',
    example: 45,
  })
  total: number;

  @ApiProperty({
    description: 'Sort metric used',
    enum: TopCampaignsSortBy,
    example: TopCampaignsSortBy.COMPOSITE,
  })
  sortBy: TopCampaignsSortBy;

  @ApiProperty({
    description: 'Timeframe used',
    enum: TopCampaignsTimeframe,
    example: TopCampaignsTimeframe.ALL_TIME,
  })
  timeframe: TopCampaignsTimeframe;

  @ApiProperty({
    description: 'Status filter used',
    enum: TopCampaignsStatus,
    example: TopCampaignsStatus.ALL,
  })
  statusFilter: TopCampaignsStatus;

  @ApiProperty({
    description: 'Number of campaigns returned',
    example: 10,
  })
  limit: number;
}
