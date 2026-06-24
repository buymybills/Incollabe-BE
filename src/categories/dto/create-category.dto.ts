import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Fashion' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'fashion', description: 'URL-friendly slug' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSubcategoryDto {
  @ApiProperty({ example: 'Ethnic' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'ethnic' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSubcategoryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
