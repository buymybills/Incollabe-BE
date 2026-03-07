import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsInt,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsString,
} from 'class-validator';

export enum InfluencerType {
  NANO = 'nano', // 1K - 10K
  MICRO = 'micro', // 10K - 50K
  MID = 'mid', // 50K - 500K
  MACRO = 'macro', // 500K - 1M
  MEGA = 'mega', // 1M+
}

export class SetCreatorPreferencesDto {
  @ApiProperty({
    description:
      'Allowed influencer types (null or empty = all allowed). Types: nano (1K-10K), micro (10K-50K), mid (50K-500K), macro (500K-1M), mega (1M+)',
    example: ['micro', 'mid', 'macro'],
    required: false,
    enum: InfluencerType,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(InfluencerType, { each: true })
  allowedInfluencerTypes?: InfluencerType[];

  @ApiProperty({
    description: 'Minimum follower count required',
    example: 10000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @ApiProperty({
    description: 'Maximum follower count allowed (null = no limit)',
    example: 500000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @ApiProperty({
    description:
      'Allowed niche IDs (null or empty = all niches allowed). Influencer must have at least one matching niche.',
    example: [1, 2, 5, 8],
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  allowedNicheIds?: number[];

  @ApiProperty({
    description: 'Allowed city IDs (null or empty = all cities allowed)',
    example: [1, 2, 3],
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  allowedCityIds?: number[];

  @ApiProperty({
    description: 'Allowed states (null or empty = all states allowed)',
    example: ['Maharashtra', 'Delhi', 'Karnataka'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedStates?: string[];

  @ApiProperty({
    description: 'Minimum engagement rate percentage required',
    example: 2.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minEngagementRate?: number;
}

export class CreatorPreferenceResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  hypeStoreId: number;

  @ApiProperty({ example: ['micro', 'mid'], nullable: true })
  allowedInfluencerTypes: string[];

  @ApiProperty({ example: 10000 })
  minFollowers: number;

  @ApiProperty({ example: 500000, nullable: true })
  maxFollowers: number;

  @ApiProperty({ example: [1, 2, 5], nullable: true })
  allowedNicheIds: number[];

  @ApiProperty({ example: [1, 2, 3], nullable: true })
  allowedCityIds: number[];

  @ApiProperty({ example: ['Maharashtra', 'Delhi'], nullable: true })
  allowedStates: string[];

  @ApiProperty({ example: 2.5, nullable: true })
  minEngagementRate: number;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  updatedAt: Date;
}

export class GetEligibleInfluencersDto {
  @ApiProperty({ description: 'Page number', example: 1, default: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Search by name or username',
    required: false,
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
