import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Length,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateCustomNicheDto {
  @ApiProperty({
    description: 'Custom niche name',
    example: 'Sustainable Fashion Blogger',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @Length(2, 100, {
    message: 'Niche name must be between 2 and 100 characters',
  })
  name: string;

  @ApiProperty({
    description: 'Custom niche description (optional)',
    example: 'Content focused on eco-friendly and sustainable fashion choices',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Description cannot exceed 500 characters' })
  description?: string;
}

export class UpdateCustomNicheDto {
  @ApiProperty({
    description: 'Custom niche name',
    example: 'Updated Sustainable Fashion Blogger',
    required: false,
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(2, 100, {
    message: 'Niche name must be between 2 and 100 characters',
  })
  name?: string;

  @ApiProperty({
    description: 'Custom niche description',
    example: 'Updated description for eco-friendly fashion content',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiProperty({
    description: 'Whether the custom niche is active',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CustomNicheResponseDto {
  @ApiProperty({ description: 'Custom niche ID' })
  id: number;

  @ApiProperty({ description: 'Custom niche name' })
  name: string;

  @ApiProperty({ description: 'Custom niche description' })
  description?: string;

  @ApiProperty({ description: 'Whether the custom niche is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Custom niche creation date' })
  createdAt: string;

  @ApiProperty({ description: 'Custom niche last update date' })
  updatedAt: string;
}

export class CustomNicheListResponseDto {
  @ApiProperty({
    description: 'List of user custom niches',
    type: [CustomNicheResponseDto],
  })
  customNiches: CustomNicheResponseDto[];

  @ApiProperty({ description: 'Total count of custom niches' })
  total: number;
}
