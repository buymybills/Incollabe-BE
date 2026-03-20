import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';

export enum TimeframeType {
  SEVEN_DAYS = '7_days',
  FIFTEEN_DAYS = '15_days',
  THIRTY_DAYS = '30_days',
  ALL_TIME = 'all_time',
}

export enum FollowerFilterType {
  ALL = 'all',
  FOLLOWERS = 'followers',
  NON_FOLLOWERS = 'non_followers',
}

export enum UserTypeFilter {
  ALL = 'all',
  BRANDS = 'brands',
  INFLUENCERS = 'influencers',
}

export enum BreakdownType {
  FOLLOWER_WISE = 'follower_wise',
  USERTYPE_WISE = 'usertype_wise',
}

export class GetAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Timeframe for analytics',
    enum: TimeframeType,
    default: TimeframeType.THIRTY_DAYS,
  })
  @IsOptional()
  @IsEnum(TimeframeType)
  timeframe?: TimeframeType;

  @ApiPropertyOptional({
    description: 'Breakdown type: follower_wise (simple: followers vs non-followers) or usertype_wise (nested: brands/influencers with followers breakdown)',
    enum: BreakdownType,
    default: BreakdownType.FOLLOWER_WISE,
  })
  @IsOptional()
  @IsEnum(BreakdownType)
  breakdownBy?: BreakdownType;

  // Internal fields (not exposed in API docs)
  followerType?: FollowerFilterType;
  userType?: UserTypeFilter;

  @ApiPropertyOptional({
    description: 'Custom start date (overrides timeframe)',
    example: '2024-08-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Custom end date (overrides timeframe)',
    example: '2024-09-01',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ViewBreakdown {
  @ApiProperty({ description: 'Total count', example: 7700 })
  count: number;

  @ApiProperty({ description: 'Percentage of total', example: 77 })
  percentage: number;
}

export class UserTypeBreakdown {
  @ApiProperty({ description: 'Total count from this user type', example: 5000 })
  total: number;

  @ApiProperty({ description: 'Percentage of total', example: 50 })
  percentage: number;

  @ApiProperty({ description: 'Count from followers', example: 3850 })
  followers: number;

  @ApiProperty({ description: 'Percentage from followers', example: 77 })
  followersPercentage: number;

  @ApiProperty({ description: 'Count from non-followers', example: 1150 })
  nonFollowers: number;

  @ApiProperty({ description: 'Percentage from non-followers', example: 23 })
  nonFollowersPercentage: number;
}

export class CategoryBreakdown {
  @ApiProperty({ description: 'Category name', example: 'Ethnic + Accessories' })
  category: string;

  @ApiProperty({ description: 'Percentage', example: 40 })
  percentage: number;

  @ApiProperty({ description: 'Count', example: 4000 })
  count: number;
}

export class TimeSeriesDataPoint {
  @ApiProperty({ description: 'Date label', example: 'Aug 1' })
  date: string;

  @ApiProperty({ description: 'Followers count', example: 50000 })
  followers: number;

  @ApiProperty({ description: 'Non-followers count', example: 25000 })
  nonFollowers: number;
}

export class TopPost {
  @ApiProperty({ description: 'Post ID', example: 123 })
  id: number;

  @ApiProperty({ description: 'Post date', example: 'Aug 1' })
  date: string;

  @ApiProperty({ description: 'View count', example: 32000 })
  views: number;

  @ApiProperty({ description: 'Media URL', example: 'https://...' })
  mediaUrl: string;

  @ApiProperty({ description: 'Post content', example: 'Check out...' })
  content: string;
}

export class AnalyticsResponseDto {
  @ApiProperty({ description: 'Total views', example: 10000000 })
  totalViews: number;

  @ApiProperty({ description: 'Growth percentage vs last period', example: 20 })
  growthPercentage: number;

  @ApiProperty({ description: 'Breakdown by followers', type: ViewBreakdown })
  followers: ViewBreakdown;

  @ApiProperty({ description: 'Breakdown by non-followers', type: ViewBreakdown })
  nonFollowers: ViewBreakdown;

  @ApiProperty({
    description: 'Breakdown by brands (only when viewing by user type)',
    type: UserTypeBreakdown,
    required: false,
  })
  brands?: UserTypeBreakdown;

  @ApiProperty({
    description: 'Breakdown by influencers (only when viewing by user type)',
    type: UserTypeBreakdown,
    required: false,
  })
  influencers?: UserTypeBreakdown;

  @ApiProperty({
    description: 'Time series data for graph',
    type: [TimeSeriesDataPoint],
  })
  timeSeriesData: TimeSeriesDataPoint[];

  @ApiProperty({
    description: 'Top viewing categories for brands',
    type: [CategoryBreakdown],
  })
  topBrandCategories: CategoryBreakdown[];

  @ApiProperty({
    description: 'Top viewing categories for creators',
    type: [CategoryBreakdown],
  })
  topCreatorCategories: CategoryBreakdown[];

  @ApiProperty({ description: 'Selected timeframe', example: '30_days' })
  timeframe: string;

  @ApiProperty({ description: 'Start date of period', example: '2024-08-01' })
  startDate: string;

  @ApiProperty({ description: 'End date of period', example: '2024-09-01' })
  endDate: string;
}

export class ProfileViewsResponseDto extends AnalyticsResponseDto {
  @ApiProperty({ description: 'Type of analytics', example: 'profile_views' })
  type: 'profile_views';
}

export class PostViewsResponseDto extends AnalyticsResponseDto {
  @ApiProperty({ description: 'Type of analytics', example: 'post_views' })
  type: 'post_views';

  @ApiProperty({
    description: 'Top performing posts by views',
    type: [TopPost],
  })
  topPosts: TopPost[];
}

export class InteractionMetric {
  @ApiProperty({ description: 'Metric name', example: 'LIKES' })
  name: string;

  @ApiProperty({ description: 'Current count', example: 50984 })
  count: number;

  @ApiProperty({ description: 'Growth count vs last period', example: 20000 })
  growth: number;

  @ApiProperty({ description: 'Growth formatted', example: '+20K' })
  growthFormatted: string;
}

export class TopPostByLikes {
  @ApiProperty({ description: 'Post ID', example: 123 })
  id: number;

  @ApiProperty({ description: 'Post date', example: 'Aug 1' })
  date: string;

  @ApiProperty({ description: 'Likes count', example: 32000 })
  likes: number;

  @ApiProperty({ description: 'Likes formatted', example: '32k' })
  likesFormatted: string;

  @ApiProperty({ description: 'Media URL', example: 'https://...' })
  mediaUrl: string;

  @ApiProperty({ description: 'Post content', example: 'Check out...' })
  content: string;
}

export class InteractionsResponseDto {
  @ApiProperty({ description: 'Type of analytics', example: 'interactions' })
  type: 'interactions';

  @ApiProperty({ description: 'Total interactions', example: 100000 })
  totalInteractions: number;

  @ApiProperty({ description: 'Total interactions formatted', example: '10,00,00' })
  totalInteractionsFormatted: string;

  @ApiProperty({ description: 'Growth count vs last period', example: 20000 })
  growth: number;

  @ApiProperty({ description: 'Growth formatted', example: '+20K vs last month' })
  growthFormatted: string;

  @ApiProperty({ description: 'Breakdown by followers', type: ViewBreakdown })
  followers: ViewBreakdown;

  @ApiProperty({ description: 'Breakdown by non-followers', type: ViewBreakdown })
  nonFollowers: ViewBreakdown;

  @ApiProperty({
    description: 'Breakdown by brands (only when viewing by user type)',
    type: UserTypeBreakdown,
    required: false,
  })
  brands?: UserTypeBreakdown;

  @ApiProperty({
    description: 'Breakdown by influencers (only when viewing by user type)',
    type: UserTypeBreakdown,
    required: false,
  })
  influencers?: UserTypeBreakdown;

  @ApiProperty({
    description: 'Interaction metrics (likes, shares)',
    type: [InteractionMetric],
  })
  metrics: InteractionMetric[];

  @ApiProperty({
    description: 'Top performing posts by likes',
    type: [TopPostByLikes],
  })
  topPostsByLikes: TopPostByLikes[];

  @ApiProperty({ description: 'Selected timeframe', example: '30_days' })
  timeframe: string;

  @ApiProperty({ description: 'Start date of period', example: '2024-08-01' })
  startDate: string;

  @ApiProperty({ description: 'End date of period', example: '2024-09-01' })
  endDate: string;
}

export class FollowerTypeBreakdown {
  @ApiProperty({ description: 'Total count', example: 7800 })
  count: number;

  @ApiProperty({ description: 'Percentage of total', example: 78 })
  percentage: number;

  @ApiProperty({ description: 'Type label', example: 'Creators' })
  label: string;
}

export class FollowersGainLost {
  @ApiProperty({ description: 'Total count', example: 1000 })
  total: number;

  @ApiProperty({ description: 'Growth formatted', example: '+20K vs last month' })
  growthFormatted: string;

  @ApiProperty({ description: 'Creators count', example: 780 })
  creators: number;

  @ApiProperty({ description: 'Creators percentage', example: 78 })
  creatorsPercentage: number;

  @ApiProperty({ description: 'Brands count', example: 220 })
  brands: number;

  @ApiProperty({ description: 'Brands percentage', example: 22 })
  brandsPercentage: number;
}

export class FollowersTrendDataPoint {
  @ApiProperty({ description: 'Date label', example: 'Aug 1' })
  date: string;

  @ApiProperty({ description: 'Followers count on this date', example: 50000 })
  count: number;
}

export class TopPostByFollowers {
  @ApiProperty({ description: 'Post ID', example: 123 })
  id: number;

  @ApiProperty({ description: 'Post date', example: 'Aug 1' })
  date: string;

  @ApiProperty({ description: 'Followers gained', example: 2400 })
  followersGained: number;

  @ApiProperty({ description: 'Views count', example: 32000 })
  views: number;

  @ApiProperty({ description: 'Media URL', example: 'https://...' })
  mediaUrl: string;

  @ApiProperty({ description: 'Post content', example: 'Check out...' })
  content: string;
}

export class FollowersResponseDto {
  @ApiProperty({ description: 'Type of analytics', example: 'followers' })
  type: 'followers';

  @ApiProperty({ description: 'Net followers (current total)', example: 1000000 })
  netFollowers: number;

  @ApiProperty({ description: 'Net followers formatted', example: '10,00,00' })
  netFollowersFormatted: string;

  @ApiProperty({ description: 'Growth count vs last period', example: 20000 })
  growth: number;

  @ApiProperty({ description: 'Growth formatted', example: '+20K vs last month' })
  growthFormatted: string;

  @ApiProperty({
    description: 'Breakdown by follower types',
    type: [FollowerTypeBreakdown],
  })
  breakdown: FollowerTypeBreakdown[];

  @ApiProperty({ description: 'Followers gained stats', type: FollowersGainLost })
  followersGain: FollowersGainLost;

  @ApiProperty({ description: 'Followers lost stats', type: FollowersGainLost })
  followersLost: FollowersGainLost;

  @ApiProperty({
    description: 'Followers trend over time',
    type: [FollowersTrendDataPoint],
  })
  followersTrend: FollowersTrendDataPoint[];

  @ApiProperty({
    description: 'Top performing posts by followers gained',
    type: [TopPostByFollowers],
  })
  topPostsByFollowers: TopPostByFollowers[];

  @ApiProperty({
    description: 'Niche with highest followers (Brands)',
    type: [CategoryBreakdown],
  })
  topBrandNiches: CategoryBreakdown[];

  @ApiProperty({
    description: 'Niche with highest followers (Creators)',
    type: [CategoryBreakdown],
  })
  topCreatorNiches: CategoryBreakdown[];

  @ApiProperty({ description: 'Selected timeframe', example: '30_days' })
  timeframe: string;

  @ApiProperty({ description: 'Start date of period', example: 'Aug 1' })
  startDate: string;

  @ApiProperty({ description: 'End date of period', example: 'Sep 1' })
  endDate: string;
}
