import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateCashbackConfigDto {
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
}
