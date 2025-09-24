import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsObject,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class InstagramCostsDto {
  @ApiProperty({ description: 'Price for Instagram Reel', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  reel?: number;

  @ApiProperty({ description: 'Price for Instagram Story', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  story?: number;

  @ApiProperty({ description: 'Price for Instagram Post', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  post?: number;
}

export class YouTubeCostsDto {
  @ApiProperty({ description: 'Price for YouTube Short', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  short?: number;

  @ApiProperty({ description: 'Price for YouTube Long Video', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  longVideo?: number;
}

export class FacebookCostsDto {
  @ApiProperty({ description: 'Price for Facebook Post', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  post?: number;

  @ApiProperty({ description: 'Price for Facebook Story', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  story?: number;
}

export class LinkedInCostsDto {
  @ApiProperty({ description: 'Price for LinkedIn Post', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  post?: number;
}

export class TwitterCostsDto {
  @ApiProperty({ description: 'Price for Twitter/X Post', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsNumber()
  @Min(0, { message: 'Price must be a positive number' })
  post?: number;
}

export class CollaborationCostsDto {
  @ApiProperty({
    description: 'Instagram collaboration costs',
    required: false,
    type: InstagramCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InstagramCostsDto)
  instagram?: InstagramCostsDto;

  @ApiProperty({
    description: 'YouTube collaboration costs',
    required: false,
    type: YouTubeCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => YouTubeCostsDto)
  youtube?: YouTubeCostsDto;

  @ApiProperty({
    description: 'Facebook collaboration costs',
    required: false,
    type: FacebookCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FacebookCostsDto)
  facebook?: FacebookCostsDto;

  @ApiProperty({
    description: 'LinkedIn collaboration costs',
    required: false,
    type: LinkedInCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LinkedInCostsDto)
  linkedin?: LinkedInCostsDto;

  @ApiProperty({
    description: 'Twitter collaboration costs',
    required: false,
    type: TwitterCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TwitterCostsDto)
  twitter?: TwitterCostsDto;
}
