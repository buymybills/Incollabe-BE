import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export enum TimeFrame {
  LAST_24_HOURS = 'last_24_hours',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
}

export class InfluencerDashboardStatsRequestDto {
  @ApiProperty({
    description: 'Time frame for daily active influencers chart',
    enum: TimeFrame,
    required: false,
    default: TimeFrame.LAST_7_DAYS,
  })
  @IsOptional()
  @IsEnum(TimeFrame)
  @Transform(({ value }) => value || TimeFrame.LAST_7_DAYS)
  timeFrame?: TimeFrame = TimeFrame.LAST_7_DAYS;
}

export class CityPresenceDto {
  @ApiProperty({ description: 'Total number of cities with influencers' })
  totalCities: number;

  @ApiProperty({ description: 'Change compared to last month', example: 4 })
  changeVsLastMonth: number;

  @ApiProperty({
    description: 'Percentage change compared to last month',
    example: 14.3,
  })
  percentageChange: number;
}

export class CityDistributionDto {
  @ApiProperty({ description: 'City name', example: 'Mumbai' })
  cityName: string;

  @ApiProperty({ description: 'Number of influencers in this city' })
  influencerCount: number;

  @ApiProperty({ description: 'Percentage of total influencers', example: 36 })
  percentage: number;
}

export class DailyActiveInfluencersDataPointDto {
  @ApiProperty({ description: 'Date', example: '2024-06-24' })
  date: string;

  @ApiProperty({ description: 'Verified profile count on this date' })
  verifiedCount: number;

  @ApiProperty({ description: 'Unverified profile count on this date' })
  unverifiedCount: number;

  @ApiProperty({ description: 'Total active influencers on this date' })
  totalCount: number;
}

export class DailyActiveInfluencersDto {
  @ApiProperty({ description: 'Current verified profile count' })
  currentVerifiedCount: number;

  @ApiProperty({ description: 'Current unverified profile count' })
  currentUnverifiedCount: number;

  @ApiProperty({
    description: 'Time series data',
    type: [DailyActiveInfluencersDataPointDto],
  })
  timeSeriesData: DailyActiveInfluencersDataPointDto[];
}

export class NicheDistributionDto {
  @ApiProperty({
    description: 'Niche category name',
    example: 'Fashion, Lifestyle, Beauty',
  })
  nicheName: string;

  @ApiProperty({ description: 'Number of influencers in this niche' })
  influencerCount: number;

  @ApiProperty({ description: 'Percentage of total influencers', example: 36 })
  percentage: number;

  @ApiProperty({ description: 'Whether this is a custom niche group' })
  isCustom: boolean;
}

export class InfluencerDashboardStatsResponseDto {
  @ApiProperty({ description: 'City presence metrics' })
  cityPresence: CityPresenceDto;

  @ApiProperty({
    description: 'Top cities with most active influencers',
    type: [CityDistributionDto],
  })
  cityDistribution: CityDistributionDto[];

  @ApiProperty({ description: 'Daily active influencers data' })
  dailyActiveInfluencers: DailyActiveInfluencersDto;

  @ApiProperty({
    description: 'Influencer distribution by niche',
    type: [NicheDistributionDto],
  })
  nicheDistribution: NicheDistributionDto[];
}
