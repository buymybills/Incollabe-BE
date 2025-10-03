import {
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStatus } from '../models/campaign-application.model';
import { Gender } from '../../auth/types/gender.enum';

export class GetCampaignApplicationsDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  niche?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ageMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ageMax?: number;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'application_new_old',
    'application_old_new',
    'followers_high_low',
    'followers_low_high',
    'campaign_charges_lowest',
  ])
  sortBy?: string = 'application_new_old';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
