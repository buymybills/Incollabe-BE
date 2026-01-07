import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CampaignType } from '../models/campaign.model';

export class CreateCampaignDto {
  @IsString()
  name: string;

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
      'Whether campaign is organic (true). Organic campaigns cannot be upgraded to Max Campaign or Invite-Only.',
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

  @IsBoolean()
  isPanIndia: boolean;

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

  @IsBoolean()
  isOpenToAllAges: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genderPreferences?: string[];

  @IsBoolean()
  isOpenToAllGenders: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @IsOptional()
  @IsString()
  customInfluencerRequirements?: string;

  @IsOptional()
  @IsString()
  performanceExpectations?: string;

  @IsOptional()
  @IsString()
  brandSupport?: string;

  @ApiProperty({
    description:
      'Array of deliverable format types. Use values from GET /campaign/deliverable-formats endpoint. ' +
      'For UGC/PAID/BARTER: social media formats (instagram_reel, youtube_short, etc.). ' +
      'For ENGAGEMENT: engagement formats (like_comment, playstore_review, etc.)',
    example: ['instagram_reel', 'instagram_story', 'youtube_short'],
    type: [String],
    isArray: true,
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one deliverable format is required' })
  @IsString({ each: true })
  deliverableFormat: string[];

  @ApiProperty({
    description:
      'Campaign budget in INR. Required for PAID, UGC, and ENGAGEMENT campaigns. Not applicable for BARTER campaigns.',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  campaignBudget?: number;

  @ApiProperty({
    description:
      'Product worth in INR for BARTER campaigns. Required only for BARTER type campaigns.',
    example: 5000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  barterProductWorth?: number;

  @ApiProperty({
    description:
      'Additional monetary payout in INR for BARTER campaigns (optional). This is extra cash payment on top of product.',
    example: 2000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalMonetaryPayout?: number;

  @ApiProperty({
    description:
      'Number of influencers the brand intends to hire for this campaign.',
    example: 10,
  })
  @IsNumber()
  @Min(1)
  numberOfInfluencers: number;
}
