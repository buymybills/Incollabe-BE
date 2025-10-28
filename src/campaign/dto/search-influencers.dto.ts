import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchInfluencersDto {
  @ApiProperty({
    description: 'Search query for influencer name or username',
    required: false,
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Minimum follower count',
    required: false,
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minFollowers?: number;

  @ApiProperty({
    description: 'Maximum follower count',
    required: false,
    example: 100000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxFollowers?: number;

  @ApiProperty({
    description:
      'City IDs for location-based filtering. Accepts comma-separated values (e.g., "1,2,3") or array format',
    required: false,
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v));
    }
    return [value];
  })
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  cityIds?: number[];

  @ApiProperty({
    description:
      'Niche IDs for category-based filtering. Accepts comma-separated values (e.g., "1,2") or array format',
    required: false,
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v));
    }
    return [value];
  })
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @ApiProperty({
    description: 'Gender preference',
    required: false,
    enum: ['Male', 'Female', 'Other'],
    example: 'Female',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({
    description: 'Minimum age',
    required: false,
    example: 18,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @ApiProperty({
    description: 'Maximum age',
    required: false,
    example: 35,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of influencers per page',
    required: false,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
