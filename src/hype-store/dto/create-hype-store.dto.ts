import { IsOptional, IsNumber, IsBoolean, IsUrl, Min, Max } from 'class-validator';

export class CreateHypeStoreDto {
  // Banner image can be customized
  @IsOptional()
  @IsUrl()
  bannerImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  monthlyCreatorLimit?: number;

  // Cashback Config
  @IsOptional()
  @IsNumber()
  @Min(0)
  reelPostMaxCashback?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  storyMaxCashback?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  monthlyClaimCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cashbackPercentage?: number;
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
  @IsNumber()
  @Min(1)
  @Max(100)
  monthlyCreatorLimit?: number;
}
