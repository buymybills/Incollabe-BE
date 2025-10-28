import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsBoolean,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum ProfileFilter {
  ALL_PROFILE = 'allProfile',
  TOP_PROFILE = 'topProfile',
  VERIFIED_PROFILE = 'verifiedProfile',
  UNVERIFIED_PROFILE = 'unverifiedProfile',
}

export enum InfluencerSortBy {
  POSTS = 'posts',
  FOLLOWERS = 'followers',
  FOLLOWING = 'following',
  CAMPAIGNS = 'campaigns',
  CREATED_AT = 'createdAt',
}

export class GetInfluencersDto {
  @ApiProperty({
    description: 'Profile filter type',
    enum: ProfileFilter,
    required: true,
    example: ProfileFilter.TOP_PROFILE,
  })
  @IsEnum(ProfileFilter)
  profileFilter: ProfileFilter;

  @ApiProperty({
    description: 'Search query to filter influencers by profile name or username',
    required: false,
    example: 'John',
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({
    description: 'Search query to filter influencers by location (city name)',
    required: false,
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  locationSearch?: string;

  @ApiProperty({
    description: 'Search query to filter influencers by niche name',
    required: false,
    example: 'Fashion',
  })
  @IsOptional()
  @IsString()
  nicheSearch?: string;

  @ApiProperty({
    description: 'Sort by metric (posts, followers, following, campaigns, or createdAt)',
    enum: InfluencerSortBy,
    required: false,
    default: InfluencerSortBy.CREATED_AT,
    example: InfluencerSortBy.FOLLOWERS,
  })
  @IsOptional()
  @IsEnum(InfluencerSortBy)
  sortBy?: InfluencerSortBy = InfluencerSortBy.CREATED_AT;

  @ApiProperty({
    description: 'Target niche IDs for matching (only used with topProfile filter)',
    required: false,
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    }
    if (Array.isArray(value)) {
      return value.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id));
    }
    return undefined;
  })
  @IsArray()
  nicheIds?: number[];

  @ApiProperty({
    description: 'Target city IDs for location matching (only used with topProfile filter)',
    required: false,
    type: [Number],
    example: [1, 5, 10],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
    }
    if (Array.isArray(value)) {
      return value.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id));
    }
    return undefined;
  })
  @IsArray()
  cityIds?: number[];

  @ApiProperty({
    description: 'Is Pan India (only used with topProfile filter)',
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPanIndia?: boolean;

  @ApiProperty({
    description: 'Minimum follower count',
    required: false,
    example: 10000,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  minFollowers?: number;

  @ApiProperty({
    description: 'Maximum follower count',
    required: false,
    example: 1000000,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  maxFollowers?: number;

  @ApiProperty({
    description: 'Minimum budget per post in INR (only used with topProfile filter)',
    required: false,
    example: 5000,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  minBudget?: number;

  @ApiProperty({
    description: 'Maximum budget per post in INR (only used with topProfile filter)',
    required: false,
    example: 50000,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  maxBudget?: number;

  @ApiProperty({
    description: 'Minimum overall score percentage (only used with topProfile filter)',
    required: false,
    example: 70,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(0)
  @Max(100)
  minScore?: number;

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

  @ApiProperty({
    description: 'Weight for niche match score (only used with topProfile filter, default: 30)',
    required: false,
    default: 30,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 30))
  @IsNumber()
  @Min(0)
  @Max(100)
  nicheMatchWeight?: number = 30;

  @ApiProperty({
    description: 'Weight for engagement rate score (only used with topProfile filter, default: 25)',
    required: false,
    default: 25,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 25))
  @IsNumber()
  @Min(0)
  @Max(100)
  engagementRateWeight?: number = 25;

  @ApiProperty({
    description: 'Weight for audience relevance score (only used with topProfile filter, default: 15)',
    required: false,
    default: 15,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 15))
  @IsNumber()
  @Min(0)
  @Max(100)
  audienceRelevanceWeight?: number = 15;

  @ApiProperty({
    description: 'Weight for location match score (only used with topProfile filter, default: 15)',
    required: false,
    default: 15,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 15))
  @IsNumber()
  @Min(0)
  @Max(100)
  locationMatchWeight?: number = 15;

  @ApiProperty({
    description: 'Weight for past performance score (only used with topProfile filter, default: 10)',
    required: false,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 10))
  @IsNumber()
  @Min(0)
  @Max(100)
  pastPerformanceWeight?: number = 10;

  @ApiProperty({
    description: 'Weight for collaboration charges match score (only used with topProfile filter, default: 5)',
    required: false,
    default: 5,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 5))
  @IsNumber()
  @Min(0)
  @Max(100)
  collaborationChargesWeight?: number = 5;
}
