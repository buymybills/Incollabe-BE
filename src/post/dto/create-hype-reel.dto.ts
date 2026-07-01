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
  @ApiProperty({ description: 'HypeStore order ID (if tagging a purchased product)', required: false })
  @IsOptional()
  @IsInt()
  hypeStoreOrderId?: number;

  // --- Catalog product fields (used when tagging directly from catalog search) ---

  @ApiProperty({ description: 'Product name', required: false })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty({ description: 'Brand name', required: false })
  @IsOptional()
  @IsString()
  productBrand?: string;

  @ApiProperty({ description: 'Product thumbnail image URL', required: false })
  @IsOptional()
  @IsString()
  productThumbnailUrl?: string;

  @ApiProperty({ description: 'Product URL / affiliate link', required: false })
  @IsOptional()
  @IsString()
  affiliateLink?: string;

  @ApiProperty({ description: 'Product size/variant', required: false })
  @IsOptional()
  @IsString()
  productSize?: string;

  @ApiProperty({ description: 'Influencer rating 0-5', required: false })
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
