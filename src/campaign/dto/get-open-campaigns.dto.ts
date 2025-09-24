import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GetOpenCampaignsDto {
  @ApiProperty({
    description: 'Search query for campaign name or brand',
    required: false,
    example: 'beauty',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by city IDs where influencer is located',
    required: false,
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  cityIds?: number[];

  @ApiProperty({
    description: 'Filter by niche IDs',
    required: false,
    type: [Number],
    example: [1, 2],
  })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @ApiProperty({
    description: 'Minimum budget per deliverable',
    required: false,
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @ApiProperty({
    description: 'Maximum budget per deliverable',
    required: false,
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

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
    description: 'Number of campaigns per page',
    required: false,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
