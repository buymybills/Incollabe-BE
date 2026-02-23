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
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

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

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isPanIndia?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  cityIds?: number[];

  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @IsOptional()
  @IsBoolean()
  isOpenToAllAges?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genderPreferences?: string[];

  @IsOptional()
  @IsBoolean()
  isOpenToAllGenders?: boolean;

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
      'below_1k, nano_1k_10k, micro_10k_100k, mid_tier_100k_500k, macro_500k_1m, mega_celebrity_1m_plus',
    example: ['micro_10k_100k', 'mid_tier_100k_500k'],
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  influencerTypes?: string[];

  @IsOptional()
  @IsString()
  customInfluencerRequirements?: string;

  @IsOptional()
  @IsString()
  performanceExpectations?: string;

  @IsOptional()
  @IsString()
  brandSupport?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCampaignDeliverableDto)
  deliverables?: CreateCampaignDeliverableDto[];
}
