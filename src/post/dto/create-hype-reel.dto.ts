import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HypeReelProductDto {
  @ApiProperty({ description: 'HypeStore order ID to attach' })
  @IsInt()
  hypeStoreOrderId: number;

  @ApiProperty({ description: 'Influencer rating 1-5', required: false })
  @IsOptional()
  @IsNumber()
  productRating?: number;

  @ApiProperty({ description: 'Display sort order', required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateHypeReelDto {
  @ApiProperty({ description: 'Post caption/content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ description: 'Array of media URLs (video URL first)', type: [String] })
  @IsArray()
  mediaUrls: string[];

  @ApiProperty({ description: 'Category ID', required: false })
  @IsOptional()
  @IsInt()
  postCategoryId?: number;

  @ApiProperty({ description: 'Subcategory ID', required: false })
  @IsOptional()
  @IsInt()
  postSubcategoryId?: number;

  @ApiProperty({ description: 'Thumbnail image URL', required: false })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiProperty({ description: 'Video duration in seconds', required: false })
  @IsOptional()
  @IsInt()
  videoDurationSeconds?: number;

  @ApiProperty({ description: 'Collaborator influencer ID', required: false })
  @IsOptional()
  @IsInt()
  collaboratorId?: number;

  @ApiProperty({ description: 'Products to attach', type: [HypeReelProductDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HypeReelProductDto)
  products?: HypeReelProductDto[];
}
