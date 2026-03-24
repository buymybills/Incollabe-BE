import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export enum CashbackType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class CreateCashbackTierDto {
  @ApiProperty({
    description: 'Tier name (e.g., "Nano Influencers", "Micro Influencers")',
    example: 'Micro Influencers',
  })
  @IsString()
  tierName: string;

  @ApiProperty({
    description: 'Minimum follower count for this tier',
    example: 10000,
  })
  @IsInt()
  @Min(0)
  minFollowers: number;

  @ApiProperty({
    description: 'Maximum follower count for this tier (null = no limit)',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @ApiProperty({
    description:
      'Cashback type: percentage (of order amount) or fixed (flat amount per order)',
    enum: CashbackType,
    example: 'percentage',
  })
  @IsEnum(CashbackType)
  cashbackType: CashbackType;

  @ApiProperty({
    description:
      'Cashback value - depends on type. For percentage: 5.00 = 5%. For fixed: 500.00 = Rs 500',
    example: 5.0,
  })
  @IsNumber()
  @Min(0)
  cashbackValue: number;

  @ApiProperty({
    description: 'Minimum cashback amount in rupees (platform default: Rs 2000)',
    example: 2000,
    default: 2000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  minCashbackAmount?: number;

  @ApiProperty({
    description: 'Maximum cashback amount in rupees (brand sets this)',
    example: 12000,
    default: 12000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  maxCashbackAmount?: number;

  @ApiProperty({
    description:
      'Priority for tier matching (higher priority = processed first if influencer matches multiple tiers)',
    example: 1,
    default: 0,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdateCashbackTierDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tierName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxFollowers?: number;

  @ApiProperty({ required: false, enum: CashbackType })
  @IsOptional()
  @IsEnum(CashbackType)
  cashbackType?: CashbackType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashbackValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  minCashbackAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(2000)
  maxCashbackAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CashbackTierResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  hypeStoreId: number;

  @ApiProperty({ example: 'Micro Influencers' })
  tierName: string;

  @ApiProperty({ example: 10000 })
  minFollowers: number;

  @ApiProperty({ example: 50000, nullable: true })
  maxFollowers: number;

  @ApiProperty({ example: 'percentage', enum: CashbackType })
  cashbackType: CashbackType;

  @ApiProperty({ example: 5.0 })
  cashbackValue: number;

  @ApiProperty({ example: 2000.0 })
  minCashbackAmount: number;

  @ApiProperty({ example: 12000.0 })
  maxCashbackAmount: number;

  @ApiProperty({ example: 1 })
  priority: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  updatedAt: Date;
}
