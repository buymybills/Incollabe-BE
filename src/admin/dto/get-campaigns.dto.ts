import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CampaignStatus,
  CampaignType,
} from '../../campaign/models/campaign.model';

export enum CampaignFilter {
  ALL_CAMPAIGNS = 'allCampaigns',
  ACTIVE_CAMPAIGNS = 'activeCampaigns',
  DRAFT_CAMPAIGNS = 'draftCampaigns',
  COMPLETED_CAMPAIGNS = 'completedCampaigns',
  PAUSED_CAMPAIGNS = 'pausedCampaigns',
  CANCELLED_CAMPAIGNS = 'cancelledCampaigns',
}

export enum CampaignSortBy {
  CREATED_AT = 'createdAt',
  APPLICATIONS = 'applications',
  TITLE = 'title',
}

export class GetCampaignsDto {
  @ApiProperty({
    description: 'Campaign filter type',
    enum: CampaignFilter,
    required: true,
    example: CampaignFilter.ALL_CAMPAIGNS,
  })
  @IsEnum(CampaignFilter)
  campaignFilter: CampaignFilter;

  @ApiProperty({
    description: 'Search query to filter campaigns by title',
    required: false,
    example: 'Summer Fashion',
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({
    description: 'Search query to filter campaigns by brand name',
    required: false,
    example: 'Nike',
  })
  @IsOptional()
  @IsString()
  brandSearch?: string;

  @ApiProperty({
    description: 'Search query to filter campaigns by location (city name)',
    required: false,
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  locationSearch?: string;

  @ApiProperty({
    description: 'Search query to filter campaigns by niche name',
    required: false,
    example: 'Fashion',
  })
  @IsOptional()
  @IsString()
  nicheSearch?: string;

  @ApiProperty({
    description: 'Filter by campaign type (paid/barter)',
    enum: CampaignType,
    required: false,
  })
  @IsOptional()
  @IsEnum(CampaignType)
  campaignType?: CampaignType;

  @ApiProperty({
    description: 'Sort by metric (createdAt, applications, or title)',
    enum: CampaignSortBy,
    required: false,
    default: CampaignSortBy.CREATED_AT,
    example: CampaignSortBy.APPLICATIONS,
  })
  @IsOptional()
  @IsEnum(CampaignSortBy)
  sortBy?: CampaignSortBy = CampaignSortBy.CREATED_AT;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of campaigns per page',
    required: false,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
