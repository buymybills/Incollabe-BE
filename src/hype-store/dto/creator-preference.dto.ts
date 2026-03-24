import { IsArray, IsNumber, IsBoolean, IsOptional, IsEnum, Min, Max, IsInt } from 'class-validator';
import { InfluencerTierType, GenderPreference } from '../models/hype-store-creator-preference.model';

export class UpdateCreatorPreferenceDto {
  @IsOptional()
  @IsArray()
  @IsEnum(InfluencerTierType, { each: true })
  influencerTypes?: InfluencerTierType[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @IsInt()
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
