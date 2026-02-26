import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CampaignType } from '../models/campaign.model';
import { CreateCampaignDeliverableDto } from './create-campaign-deliverable.dto';

export class UpdateCampaignDto {
  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Fashion Campaign',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Campaign description',
    example: 'Promote new summer fashion collection',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Campaign category',
    example: 'Fashion',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    description: 'Campaign type',
    example: 'paid',
    enum: CampaignType,
    required: false,
  })
  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @ApiProperty({
    description:
      'Whether campaign is invite-only (true) or open for all influencers (false)',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isInviteOnly?: boolean;

  @ApiProperty({
    description:
      'Whether campaign is organic (true). Organic campaigns cannot be upgraded to Max Campaign or Invite-Only. Setting this to true will cancel any pending payment upgrades.',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isOrganic?: boolean;

  @ApiProperty({
    description: 'Campaign start date',
    example: '2024-06-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Campaign end date',
    example: '2024-07-31T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Whether campaign targets all of India (true) or specific cities (false)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPanIndia?: boolean;

  @ApiProperty({
    description: 'Array of city IDs to target. Required if isPanIndia is false. Use GET /campaign/cities/search to find city IDs.',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  cityIds?: number[];

  @ApiProperty({
    description: 'Minimum age for influencers (13-100). Required if isOpenToAllAges is false.',
    example: 18,
    minimum: 13,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @ApiProperty({
    description: 'Maximum age for influencers (13-100). Required if isOpenToAllAges is false.',
    example: 35,
    minimum: 13,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @ApiProperty({
    description: 'Whether campaign is open to influencers of all ages (true) or specific age range (false)',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isOpenToAllAges?: boolean;

  @ApiProperty({
    description: 'Array of gender preferences. Available options: Male, Female, Others. Required if isOpenToAllGenders is false.',
    example: ['Female', 'Male'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genderPreferences?: string[];

  @ApiProperty({
    description: 'Whether campaign is open to influencers of all genders (true) or specific genders (false)',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isOpenToAllGenders?: boolean;

  @ApiProperty({
    description: 'Array of niche IDs to target. Required if selectAllNiches is false. Use GET /niche to get available niches.',
    example: [1, 2, 5],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @ApiProperty({
    description:
      'If true, campaign will be visible to influencers of all niches (ignores nicheIds). If false, only specified nicheIds will be used.',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  selectAllNiches?: boolean;

  @ApiProperty({
    description:
      'Influencer types by follower count ranges. Available options: ' +
      'below_1k, nano_1k_10k, micro_10k_100k, mid_tier_100k_500k, macro_500k_1m, mega_celebrity_1m_plus. ' +
      'Use GET /campaign/influencer-types to get the full list.',
    example: ['micro_10k_100k', 'mid_tier_100k_500k'],
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  influencerTypes?: string[];

  @ApiProperty({
    description: 'Custom requirements for influencers (e.g., content style, previous experience, engagement rate)',
    example: 'Fashion influencers with style-focused content and minimum 10K followers',
    required: false,
  })
  @IsOptional()
  @IsString()
  customInfluencerRequirements?: string;

  @ApiProperty({
    description: 'Expected performance metrics and deliverables (e.g., views, engagement rate, conversion goals)',
    example: 'Target: 50K+ total video views, minimum 5% engagement rate, authentic comments and saves',
    required: false,
  })
  @IsOptional()
  @IsString()
  performanceExpectations?: string;

  @ApiProperty({
    description: 'Support and resources brand will provide to influencers (e.g., content brief, product samples, approval process)',
    example: 'Content brief + brand guidelines provided, professional product images, dedicated brand contact for creative support',
    required: false,
  })
  @IsOptional()
  @IsString()
  brandSupport?: string;

  @ApiProperty({
    description: 'Array of campaign deliverables with platform, type, budget, quantity, and specifications',
    type: [CreateCampaignDeliverableDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCampaignDeliverableDto)
  deliverables?: CreateCampaignDeliverableDto[];
}
