import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export enum StatsTimeFrame {
  LAST_7_DAYS = '7_days',
  LAST_15_DAYS = '15_days',
  LAST_30_DAYS = '30_days',
}

export class CreatorStudioStatsRequestDto {
  @ApiProperty({
    description: 'Time frame for stats calculation',
    enum: StatsTimeFrame,
    required: false,
    default: StatsTimeFrame.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(StatsTimeFrame)
  @Transform(({ value }) => value || StatsTimeFrame.LAST_30_DAYS)
  timeFrame?: StatsTimeFrame = StatsTimeFrame.LAST_30_DAYS;
}

export class ProfileInsightDto {
  @ApiProperty({ description: 'Profile views in the selected period', example: 120000 })
  profileViews: number;

  @ApiProperty({ description: 'Total posts count', example: 40 })
  posts: number;

  @ApiProperty({ description: 'Total followers count', example: 1200 })
  followers: number;

  @ApiProperty({ description: 'Total following count', example: 1200 })
  following: number;

  @ApiProperty({ description: 'Creator rating (0-5)', example: 4.5 })
  rating: number;
}

export class EngagementInsightDto {
  @ApiProperty({ description: 'Total post views in the selected period', example: 100000 })
  postView: number;

  @ApiProperty({ description: 'Total interactions (likes + shares)', example: 100000 })
  interactions: number;
}

export class CreatorStudioStatsResponseDto {
  @ApiProperty({ description: 'Profile insight metrics' })
  profileInsight: ProfileInsightDto;

  @ApiProperty({ description: 'Engagement insight metrics' })
  engagementInsight: EngagementInsightDto;

  @ApiProperty({ description: 'Time frame used for the stats' })
  timeFrame: StatsTimeFrame;

  @ApiProperty({ description: 'Date range label', example: 'Aug 1 - Sep 1' })
  dateRange: string;
}
