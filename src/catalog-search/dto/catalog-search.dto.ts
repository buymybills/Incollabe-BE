import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CatalogSearchRequestDto {
  @ApiProperty({ description: 'Search query', example: 'oversized tee white' })
  @IsString()
  q: string;

  @ApiPropertyOptional({
    description: 'Filter by gender',
    enum: ['men', 'women', 'unisex'],
  })
  @IsOptional()
  @IsIn(['men', 'women', 'unisex'])
  gender?: 'men' | 'women' | 'unisex';

  @ApiPropertyOptional({
    description: 'Filter by category (e.g. tee, jeans, sneakers)',
    example: 'tee',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Max results per brand (default 5)',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limitPerBrand?: number = 5;
}

export class CatalogProduct {
  brand: string;
  title: string;
  category: string;
  image: string | null;
  url: string;
  priceInr: number | null;
  score: number;
}
