import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHypeStoreDto {
  @ApiProperty({
    description: 'Store name',
    example: 'Nike Official Store',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  storeName: string;

  @ApiProperty({
    description: 'Store description',
    example: 'Official Nike store for authentic products',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeDescription?: string;

  @ApiProperty({
    description: 'Store logo URL',
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeLogo?: string;

  @ApiProperty({
    description: 'Store banner URL',
    example: 'https://example.com/banner.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeBanner?: string;

  @ApiProperty({
    description: 'Minimum order value',
    example: 500,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiProperty({
    description: 'Maximum order value',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxOrderValue?: number;
}

export class UpdateHypeStoreDto {
  @ApiProperty({
    description: 'Store name',
    example: 'Nike Official Store',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  storeName?: string;

  @ApiProperty({
    description: 'Store description',
    example: 'Official Nike store for authentic products',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeDescription?: string;

  @ApiProperty({
    description: 'Store logo URL',
    example: 'https://example.com/logo.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeLogo?: string;

  @ApiProperty({
    description: 'Store banner URL',
    example: 'https://example.com/banner.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeBanner?: string;

  @ApiProperty({
    description: 'Is store active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Minimum order value',
    example: 500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderValue?: number;

  @ApiProperty({
    description: 'Maximum order value',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxOrderValue?: number;
}

export class HypeStoreResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 123 })
  brandId: number;

  @ApiProperty({ example: 'Nike Official Store' })
  storeName: string;

  @ApiProperty({ example: 'nike-official-store' })
  storeSlug: string;

  @ApiProperty({ example: 'Official Nike store for authentic products' })
  storeDescription: string;

  @ApiProperty({ example: 'https://example.com/logo.png' })
  storeLogo: string;

  @ApiProperty({ example: 'https://example.com/banner.jpg' })
  storeBanner: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty({ example: 500 })
  minOrderValue: number;

  @ApiProperty({ example: 50000 })
  maxOrderValue: number;

  @ApiProperty({ example: 150 })
  totalOrders: number;

  @ApiProperty({ example: 250000 })
  totalRevenue: number;

  @ApiProperty({ example: 12500 })
  totalCashbackGiven: number;

  @ApiProperty({ example: '2026-03-05T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-05T10:00:00Z' })
  updatedAt: Date;
}
