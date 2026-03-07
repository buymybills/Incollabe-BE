import { IsArray, IsNumber, IsBoolean, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { InfluencerTierType, GenderPreference } from '../models/hype-store-creator-preference.model';

export class UpdateCreatorPreferenceDto {
  @IsOptional()
  @IsArray()
  @IsEnum(InfluencerTierType, { each: true })
  influencerTypes?: InfluencerTierType[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAge?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(GenderPreference, { each: true })
  genderPreference?: GenderPreference[];

  @IsOptional()
  @IsArray()
  nicheCategories?: string[];

  @IsOptional()
  @IsArray()
  preferredLocations?: string[];

  @IsOptional()
  @IsBoolean()
  isPanIndia?: boolean;
}
