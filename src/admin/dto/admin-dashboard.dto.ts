import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DashboardTimeFrame {
  LAST_24_HOURS = 'last_24_hours',
  LAST_3_DAYS = 'last_3_days',
  LAST_7_DAYS = 'last_7_days',
  LAST_15_DAYS = 'last_15_days',
  LAST_30_DAYS = 'last_30_days',
  CUSTOM = 'custom',
}

export class DashboardRequestDto {
  @ApiProperty({
    description:
      'Time frame for dashboard metrics. Use CUSTOM for custom date range.',
    enum: DashboardTimeFrame,
    required: false,
    default: DashboardTimeFrame.LAST_7_DAYS,
  })
  @IsOptional()
  @IsEnum(DashboardTimeFrame)
  @Transform(({ value }) => value || DashboardTimeFrame.LAST_7_DAYS)
  timeFrame?: DashboardTimeFrame = DashboardTimeFrame.LAST_7_DAYS;

  @ApiProperty({
    description:
      'Start date for custom date range (YYYY-MM-DD). Required when timeFrame is CUSTOM.',
    example: '2024-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description:
      'End date for custom date range (YYYY-MM-DD). Required when timeFrame is CUSTOM.',
    example: '2025-11-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CampaignDashboardRequestDto {
  @ApiProperty({
    description:
      'Time frame for time series chart (Campaign Posted vs Applications). Controls the chart date range.',
    enum: DashboardTimeFrame,
    required: false,
    default: DashboardTimeFrame.LAST_7_DAYS,
  })
  @IsOptional()
  @IsEnum(DashboardTimeFrame)
  @Transform(({ value }) => value || DashboardTimeFrame.LAST_7_DAYS)
  chartTimeFrame?: DashboardTimeFrame = DashboardTimeFrame.LAST_7_DAYS;

  @ApiProperty({
    description:
      'Start date for chart custom range (YYYY-MM-DD). Required when chartTimeFrame is CUSTOM.',
    example: '2025-10-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  chartStartDate?: string;

  @ApiProperty({
    description:
      'End date for chart custom range (YYYY-MM-DD). Required when chartTimeFrame is CUSTOM.',
    example: '2025-10-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  chartEndDate?: string;

  @ApiProperty({
    description:
      'Start date for metrics/aggregate data (YYYY-MM-DD). Used for campaign counts, city presence, category distribution.',
    example: '2025-09-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  metricsStartDate?: string;

  @ApiProperty({
    description:
      'End date for metrics/aggregate data (YYYY-MM-DD). Used for campaign counts, city presence, category distribution.',
    example: '2025-10-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  metricsEndDate?: string;
}

export class MetricDto {
  @ApiProperty({ description: 'Current count' })
  count: number;

  @ApiProperty({ description: 'Percentage change vs last month' })
  percentageChange: number;
}

export class InfluencerMetricsDto {
  @ApiProperty({ description: 'Total influencers metric' })
  totalInfluencers: MetricDto;

  @ApiProperty({ description: 'Verified influencers metric' })
  verifiedInfluencers: MetricDto;

  @ApiProperty({ description: 'Unverified influencers metric' })
  unverifiedInfluencers: MetricDto;

  @ApiProperty({ description: 'Influencers pending verification count' })
  influencersPendingVerification: number;
}

export class BrandMetricsDto {
  @ApiProperty({ description: 'Total brands metric' })
  totalBrands: MetricDto;

  @ApiProperty({ description: 'Verified brands metric' })
  verifiedBrands: MetricDto;

  @ApiProperty({ description: 'Unverified brands metric' })
  unverifiedBrands: MetricDto;

  @ApiProperty({ description: 'Brands pending verification count' })
  brandsPendingVerification: number;
}

export class CampaignMetricsDto {
  @ApiProperty({ description: 'Total campaigns metric' })
  totalCampaigns: MetricDto;

  @ApiProperty({ description: 'Live campaigns metric' })
  campaignsLive: MetricDto;

  @ApiProperty({ description: 'Completed campaigns metric' })
  campaignsCompleted: MetricDto;

  @ApiProperty({ description: 'Total campaign applications count' })
  totalCampaignApplications: number;
}

export class TopInfluencerDto {
  @ApiProperty({ description: 'Rank' })
  rank: number;

  @ApiProperty({ description: 'Influencer ID' })
  id: number;

  @ApiProperty({ description: 'Influencer name' })
  name: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Profile image URL' })
  profileImage: string;

  @ApiProperty({ description: 'Is verified' })
  isVerified: boolean;

  @ApiProperty({ description: 'Follower count or engagement score' })
  score: number;
}

export class TopBrandDto {
  @ApiProperty({ description: 'Rank' })
  rank: number;

  @ApiProperty({ description: 'Brand ID' })
  id: number;

  @ApiProperty({ description: 'Brand name' })
  brandName: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Profile image URL' })
  profileImage: string;

  @ApiProperty({ description: 'Is verified' })
  isVerified: boolean;

  @ApiProperty({ description: 'Campaign count or score' })
  score: number;
}

export class TopCampaignDto {
  @ApiProperty({ description: 'Campaign ID' })
  id: number;

  @ApiProperty({ description: 'Campaign name' })
  name: string;

  @ApiProperty({ description: 'Brand name' })
  brandName: string;

  @ApiProperty({ description: 'Brand logo' })
  brandLogo: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiProperty({ description: 'Deliverable format' })
  deliverableFormat: string;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({ description: 'Application count' })
  applicationCount: number;
}

export class MainDashboardResponseDto {
  @ApiProperty({ description: 'Influencer metrics' })
  influencerMetrics: InfluencerMetricsDto;

  @ApiProperty({ description: 'Brand metrics' })
  brandMetrics: BrandMetricsDto;

  @ApiProperty({ description: 'Campaign metrics' })
  campaignMetrics: CampaignMetricsDto;

  @ApiProperty({
    description: 'Top influencers list',
    type: [TopInfluencerDto],
  })
  topInfluencers: TopInfluencerDto[];

  @ApiProperty({ description: 'Top brands list', type: [TopBrandDto] })
  topBrands: TopBrandDto[];

  @ApiProperty({ description: 'Top campaigns list', type: [TopCampaignDto] })
  topCampaigns: TopCampaignDto[];
}

// Influencer Dashboard DTOs

export class CityPresenceDto {
  @ApiProperty({ description: 'Total number of cities with influencers' })
  totalCities: number;

  @ApiProperty({ description: 'Change compared to last month' })
  changeVsLastMonth: number;

  @ApiProperty({ description: 'Percentage change compared to last month' })
  percentageChange: number;
}

export class CityDistributionDto {
  @ApiProperty({ description: 'City name' })
  cityName: string;

  @ApiProperty({ description: 'Number of influencers in this city' })
  influencerCount: number;

  @ApiProperty({ description: 'Percentage of total influencers' })
  percentage: number;
}

export class DailyActiveInfluencersDataPointDto {
  @ApiProperty({ description: 'Date' })
  date: string;

  @ApiProperty({ description: 'Verified profile count' })
  verifiedCount: number;

  @ApiProperty({ description: 'Unverified profile count' })
  unverifiedCount: number;

  @ApiProperty({ description: 'Total count' })
  totalCount: number;
}

export class DailyActiveInfluencersDto {
  @ApiProperty({ description: 'Current verified count' })
  currentVerifiedCount: number;

  @ApiProperty({ description: 'Current unverified count' })
  currentUnverifiedCount: number;

  @ApiProperty({
    description: 'Time series data',
    type: [DailyActiveInfluencersDataPointDto],
  })
  timeSeriesData: DailyActiveInfluencersDataPointDto[];
}

export class NicheDistributionDto {
  @ApiProperty({ description: 'Niche category name' })
  nicheName: string;

  @ApiProperty({ description: 'Number of influencers' })
  influencerCount: number;

  @ApiProperty({ description: 'Percentage of total' })
  percentage: number;
}

export class InfluencerDashboardResponseDto {
  @ApiProperty({ description: 'Influencer metrics' })
  influencerMetrics: InfluencerMetricsDto;

  @ApiProperty({ description: 'City presence data' })
  cityPresence: CityPresenceDto;

  @ApiProperty({
    description: 'City distribution',
    type: [CityDistributionDto],
  })
  cityDistribution: CityDistributionDto[];

  @ApiProperty({ description: 'Daily active influencers' })
  dailyActiveInfluencers: DailyActiveInfluencersDto;

  @ApiProperty({
    description: 'Niche distribution',
    type: [NicheDistributionDto],
  })
  nicheDistribution: NicheDistributionDto[];
}

// Brand Dashboard DTOs

export class DailyActiveBrandsDataPointDto {
  @ApiProperty({ description: 'Date' })
  date: string;

  @ApiProperty({ description: 'Verified profile count' })
  verifiedCount: number;

  @ApiProperty({ description: 'Unverified profile count' })
  unverifiedCount: number;

  @ApiProperty({ description: 'Total count' })
  totalCount: number;
}

export class DailyActiveBrandsDto {
  @ApiProperty({ description: 'Current verified count' })
  currentVerifiedCount: number;

  @ApiProperty({ description: 'Current unverified count' })
  currentUnverifiedCount: number;

  @ApiProperty({
    description: 'Time series data',
    type: [DailyActiveBrandsDataPointDto],
  })
  timeSeriesData: DailyActiveBrandsDataPointDto[];
}

export class BrandDashboardResponseDto {
  @ApiProperty({ description: 'Brand metrics' })
  brandMetrics: BrandMetricsDto;

  @ApiProperty({ description: 'City presence data' })
  cityPresence: CityPresenceDto;

  @ApiProperty({
    description: 'City distribution',
    type: [CityDistributionDto],
  })
  cityDistribution: CityDistributionDto[];

  @ApiProperty({ description: 'Daily active brands' })
  dailyActiveBrands: DailyActiveBrandsDto;

  @ApiProperty({
    description: 'Niche distribution',
    type: [NicheDistributionDto],
  })
  nicheDistribution: NicheDistributionDto[];
}

// Campaign Dashboard DTOs

export class CampaignPostedVsApplicationsDataPointDto {
  @ApiProperty({ description: 'Date' })
  date: string;

  @ApiProperty({ description: 'Number of campaigns posted' })
  campaignsPosted: number;

  @ApiProperty({ description: 'Number of applications received' })
  applicationsReceived: number;
}

export class CampaignPostedVsApplicationsDto {
  @ApiProperty({ description: 'Current verified profile applicants count' })
  currentVerifiedProfileApplicants: number;

  @ApiProperty({ description: 'Current unverified profile applicants count' })
  currentUnverifiedProfileApplicants: number;

  @ApiProperty({
    description: 'Time series data for campaigns posted vs applications',
    type: [CampaignPostedVsApplicationsDataPointDto],
  })
  timeSeriesData: CampaignPostedVsApplicationsDataPointDto[];
}

export class CampaignCategoryDto {
  @ApiProperty({ description: 'Category name' })
  categoryName: string;

  @ApiProperty({ description: 'Number of campaigns' })
  campaignCount: number;

  @ApiProperty({ description: 'Percentage of total campaigns' })
  percentage: number;
}

export class CityWithActiveCampaignsDto {
  @ApiProperty({ description: 'City name' })
  cityName: string;

  @ApiProperty({ description: 'Percentage of active campaigns in this city' })
  percentage: number;
}

export class CampaignDashboardResponseDto {
  @ApiProperty({ description: 'Campaign metrics' })
  campaignMetrics: CampaignMetricsDto;

  @ApiProperty({ description: 'Total city presence for campaigns' })
  totalCityPresence: number;

  @ApiProperty({
    description: 'Cities with most active campaigns',
    type: [CityWithActiveCampaignsDto],
  })
  citiesWithMostActiveCampaigns: CityWithActiveCampaignsDto[];

  @ApiProperty({ description: 'Campaign posted vs applications received' })
  campaignPostedVsApplications: CampaignPostedVsApplicationsDto;

  @ApiProperty({
    description: 'Campaign category distribution',
    type: [CampaignCategoryDto],
  })
  campaignCategoryDistribution: CampaignCategoryDto[];
}
