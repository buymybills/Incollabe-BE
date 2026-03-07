import { IsOptional, IsNumber, IsBoolean, IsUrl, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHypeStoreDto {
  // Banner image will be handled as file upload in controller
  // No validation needed here

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  monthlyCreatorLimit?: number;

  // Cashback Config
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reelPostMinCashback?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reelPostMaxCashback: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  storyMinCashback?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  storyMaxCashback: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(6)
  monthlyClaimCount: number;
}

export class UpdateHypeStoreDto {
  // Only banner image can be updated
  @IsOptional()
  @IsUrl()
  bannerImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  monthlyCreatorLimit?: number;
}
