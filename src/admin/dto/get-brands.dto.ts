import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum BrandProfileFilter {
  ALL_PROFILE = 'allProfile',
  TOP_PROFILE = 'topProfile',
  VERIFIED_PROFILE = 'verifiedProfile',
  UNVERIFIED_PROFILE = 'unverifiedProfile',
}

export enum BrandSortBy {
  POSTS = 'posts',
  FOLLOWERS = 'followers',
  FOLLOWING = 'following',
  CAMPAIGNS = 'campaigns',
  CREATED_AT = 'createdAt',
  COMPOSITE = 'composite',
}

export class GetBrandsDto {
  @ApiProperty({
    description: 'Search by brand name or username',
    required: false,
    example: 'Nike',
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({
    description: 'Search by location (city)',
    required: false,
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  locationSearch?: string;

  @ApiProperty({
    description: 'Search by niche name',
    required: false,
    example: 'Fashion',
  })
  @IsOptional()
  @IsString()
  nicheSearch?: string;
  @ApiProperty({
    description: 'Profile filter type',
    enum: BrandProfileFilter,
    required: true,
    example: BrandProfileFilter.TOP_PROFILE,
  })
  @IsEnum(BrandProfileFilter)
  profileFilter: BrandProfileFilter;

  @ApiProperty({
    description: 'Sort by metric (only used with topProfile filter)',
    enum: BrandSortBy,
    required: false,
    default: BrandSortBy.COMPOSITE,
    example: BrandSortBy.COMPOSITE,
  })
  @IsOptional()
  @IsEnum(BrandSortBy)
  sortBy?: BrandSortBy = BrandSortBy.COMPOSITE;

  @ApiProperty({
    description: 'Minimum number of campaigns (optional filter)',
    required: false,
    example: 2,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  minCampaigns?: number;

  @ApiProperty({
    description: 'Minimum number of selected influencers (optional filter)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  minSelectedInfluencers?: number;

  @ApiProperty({
    description: 'Minimum composite score for topProfile filter (0-100)',
    required: false,
    example: 70,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  @Max(100)
  minCompositeScore?: number;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of results per page',
    required: false,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 20)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
