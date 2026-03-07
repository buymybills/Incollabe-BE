import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  IsArray,
} from 'class-validator';

export class GenerateCouponDto {
  @ApiProperty({ description: 'Influencer ID to generate coupon for', example: 123 })
  @IsInt()
  influencerId: number;

  @ApiProperty({
    description: 'Custom coupon code (optional, auto-generated if not provided)',
    required: false,
    example: 'CUSTOMCODE2026',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({
    description: 'Maximum number of times this coupon can be used',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiProperty({
    description: 'Coupon valid from date (ISO format)',
    required: false,
    example: '2026-03-06T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({
    description: 'Coupon valid until date (ISO format)',
    required: false,
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class BulkGenerateCouponsDto {
  @ApiProperty({
    description: 'List of influencer IDs to generate coupons for',
    example: [123, 456, 789],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  influencerIds: number[];

  @ApiProperty({
    description: 'Maximum uses per coupon',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiProperty({
    description: 'Valid from date for all coupons',
    required: false,
    example: '2026-03-06T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({
    description: 'Valid until date for all coupons',
    required: false,
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class GetCouponResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  hypeStoreId: number;

  @ApiProperty({ example: 123 })
  influencerId: number;

  @ApiProperty({ example: 'MYNTRA-000123-A3F2B1' })
  couponCode: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 5 })
  totalUses: number;

  @ApiProperty({ example: 100, nullable: true })
  maxUses: number;

  @ApiProperty({ example: 2500.0, nullable: true })
  potentialCashback: number;

  @ApiProperty({ example: '2026-03-06T00:00:00Z', nullable: true })
  validFrom: Date;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', nullable: true })
  validUntil: Date;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-06T10:30:00Z' })
  updatedAt: Date;
}

export class GetCouponsQueryDto {
  @ApiProperty({ description: 'Page number', example: 1, default: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: 'Items per page', example: 20, default: 20, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ description: 'Filter by active status', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Filter by influencer ID', required: false })
  @IsOptional()
  @IsInt()
  influencerId?: number;
}
