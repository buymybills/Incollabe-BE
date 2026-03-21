import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum RatingsTimeframeType {
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  ALL_TIME = 'all_time',
}

export class GetRatingsDto {
  @ApiPropertyOptional({
    description: 'Timeframe for ratings',
    enum: RatingsTimeframeType,
    default: RatingsTimeframeType.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(RatingsTimeframeType)
  timeframe?: RatingsTimeframeType;

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

export class CampaignRatingItemDto {
  @ApiProperty({ description: 'Campaign review ID', example: 123 })
  id: number;

  @ApiProperty({ description: 'Campaign ID', example: 456 })
  campaignId: number;

  @ApiProperty({ description: 'Campaign application ID', example: 789 })
  campaignApplicationId: number;

  @ApiPropertyOptional({
    description: 'Conversation ID - Use this to submit a review via POST /api/chat/campaign-conversations/:conversationId/review',
    example: 321,
    nullable: true,
  })
  conversationId: number | null;

  @ApiProperty({ description: 'Campaign title', example: 'Spring Street Style Edit' })
  campaignTitle: string;

  @ApiProperty({ description: 'Brand ID', example: 789 })
  brandId: number;

  @ApiProperty({ description: 'Brand name', example: 'H&M' })
  brandName: string;

  @ApiProperty({ description: 'Brand logo URL', example: 'https://...' })
  brandLogo: string;

  @ApiProperty({ description: 'Brand niche', example: 'Fashion + Lifestyle' })
  brandNiche: string;

  @ApiProperty({ description: 'Deliverable format', example: 'Insta Reel, Insta Story, YT...' })
  deliverableFormat: string;

  @ApiProperty({ description: 'Payment status', example: 'Paid' })
  paymentStatus: string;

  @ApiProperty({ description: 'Completion date', example: 'Mar 24, 2026' })
  completedDate: string;

  @ApiProperty({ description: 'Rating received from brand (1-5)', example: 4.5 })
  ratingReceived: number;

  @ApiProperty({ description: 'Review text from brand', example: 'Lorem ipsum...', required: false })
  reviewFromBrand?: string;

  @ApiProperty({ description: 'Did user rate the brand', example: true })
  hasUserRated: boolean;

  @ApiProperty({ description: 'User rating for brand (1-5)', example: 4.5, required: false })
  userRatingForBrand?: number;

  @ApiProperty({ description: 'User review for brand', example: 'Great experience!', required: false })
  userReviewForBrand?: string;
}

export class UserRatingsStatsDto {
  @ApiProperty({ description: 'Average rating', example: 4.5 })
  averageRating: number;

  @ApiProperty({ description: 'Total number of campaigns rated', example: 12 })
  totalCampaigns: number;

  @ApiProperty({ description: 'Timeframe used', example: 'Aug 1 - Sep 1' })
  timeframe: string;

  @ApiProperty({ description: 'Start date', example: '2024-08-01' })
  startDate: string;

  @ApiProperty({ description: 'End date', example: '2024-09-01' })
  endDate: string;

  @ApiProperty({
    description: 'List of campaign ratings',
    type: [CampaignRatingItemDto],
  })
  ratings: CampaignRatingItemDto[];
}
