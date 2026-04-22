import { IsOptional, IsNumber, IsBoolean, IsUrl, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHypeStoreDto {
  // Banner image will be handled as file upload in controller
  // No validation needed here

  @IsOptional()
  @IsUrl()
  storeLink?: string;

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

  // Coupon code suffix (cashback percentage for display in coupon)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(99)
  cashbackPercentage?: number;

  // Return window in days — used to lock cashback until the return period closes
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  returnPeriodDays?: number;
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

  // Return window in days — can be updated post-creation
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(90)
  returnPeriodDays?: number;
}
