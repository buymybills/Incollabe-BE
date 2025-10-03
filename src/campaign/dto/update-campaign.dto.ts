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
  @IsString()
  deliverableFormat?: string;

  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @ApiProperty({
    description: 'Whether campaign is invite-only (true) or open for all influencers (false)',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isInviteOnly?: boolean;

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
