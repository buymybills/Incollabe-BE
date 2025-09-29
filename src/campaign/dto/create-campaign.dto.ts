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
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignType } from '../models/campaign.model';
import { CreateCampaignDeliverableDto } from './create-campaign-deliverable.dto';

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
  @IsString()
  deliverableFormat?: string;

  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCampaignDeliverableDto)
  deliverables: CreateCampaignDeliverableDto[];
}
