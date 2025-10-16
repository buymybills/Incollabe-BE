import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum TopBrandsSortBy {
  CAMPAIGNS = 'campaigns',
  NICHES = 'niches',
  INFLUENCERS = 'influencers',
  PAYOUT = 'payout',
  COMPOSITE = 'composite',
}

export enum TopBrandsTimeframe {
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  ALL_TIME = 'all',
}

export class TopBrandsRequestDto {
  @ApiPropertyOptional({
    description: 'Sort by metric',
    enum: TopBrandsSortBy,
    default: TopBrandsSortBy.COMPOSITE,
    example: TopBrandsSortBy.COMPOSITE,
  })
  @IsOptional()
  @IsEnum(TopBrandsSortBy)
  sortBy?: TopBrandsSortBy = TopBrandsSortBy.COMPOSITE;

  @ApiPropertyOptional({
    description: 'Timeframe for campaign activity',
    enum: TopBrandsTimeframe,
    default: TopBrandsTimeframe.ALL_TIME,
    example: TopBrandsTimeframe.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(TopBrandsTimeframe)
  timeframe?: TopBrandsTimeframe = TopBrandsTimeframe.ALL_TIME;

  @ApiPropertyOptional({
    description: 'Number of top brands to return',
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

export class TopBrandMetrics {
  @ApiProperty({
    description: 'Total number of campaigns launched',
    example: 15,
  })
  totalCampaigns: number;

  @ApiProperty({
    description: 'Number of unique niches targeted',
    example: 8,
  })
  uniqueNichesCount: number;

  @ApiProperty({
    description: 'Total number of influencers selected',
    example: 45,
  })
  selectedInfluencersCount: number;

  @ApiProperty({
    description: 'Average payout per campaign in rupees',
    example: 25000.5,
  })
  averagePayout: number;

  @ApiProperty({
    description: 'Composite score (0-100)',
    example: 85.5,
  })
  compositeScore: number;
}

export class TopBrandDto {
  @ApiProperty({
    description: 'Brand ID',
    example: 123,
  })
  id: number;

  @ApiProperty({
    description: 'Brand name',
    example: 'Nike India',
  })
  brandName: string;

  @ApiProperty({
    description: 'Brand username',
    example: 'nikeindia',
  })
  username: string;

  @ApiProperty({
    description: 'Brand email',
    example: 'contact@nike.com',
  })
  email: string;

  @ApiProperty({
    description: 'Profile image URL',
    example: 'https://s3.amazonaws.com/brand-profile.jpg',
    nullable: true,
  })
  profileImage: string | null;

  @ApiProperty({
    description: 'Brand bio',
    example: 'Leading sports brand in India',
    nullable: true,
  })
  brandBio: string | null;

  @ApiProperty({
    description: 'Website URL',
    example: 'https://nike.com',
    nullable: true,
  })
  websiteUrl: string | null;

  @ApiProperty({
    description: 'Verification status',
    example: true,
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'Top brand metrics',
    type: TopBrandMetrics,
  })
  metrics: TopBrandMetrics;

  @ApiProperty({
    description: 'Account created date',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}

export class TopBrandsResponseDto {
  @ApiProperty({
    description: 'List of top brands',
    type: [TopBrandDto],
  })
  brands: TopBrandDto[];

  @ApiProperty({
    description: 'Total number of brands that qualified',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Sort metric used',
    enum: TopBrandsSortBy,
    example: TopBrandsSortBy.COMPOSITE,
  })
  sortBy: TopBrandsSortBy;

  @ApiProperty({
    description: 'Timeframe used',
    enum: TopBrandsTimeframe,
    example: TopBrandsTimeframe.ALL_TIME,
  })
  timeframe: TopBrandsTimeframe;

  @ApiProperty({
    description: 'Number of brands returned',
    example: 10,
  })
  limit: number;
}
