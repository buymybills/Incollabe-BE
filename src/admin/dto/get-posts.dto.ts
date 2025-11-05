import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserType } from '../../post/models/post.model';

export enum PostFilter {
  ALL_POSTS = 'allPosts',
  INFLUENCER_POSTS = 'influencerPosts',
  BRAND_POSTS = 'brandPosts',
}

export enum PostSortBy {
  CREATED_AT = 'createdAt',
  LIKES = 'likes',
  ENGAGEMENT = 'engagement',
}

export class GetPostsDto {
  @IsEnum(PostFilter)
  @ApiProperty({
    description:
      'Filter posts by user type (all posts, influencer posts, brand posts)',
    enum: PostFilter,
    example: PostFilter.ALL_POSTS,
  })
  postFilter: PostFilter;

  @ApiProperty({
    description: 'Search query to filter posts by content',
    required: false,
    example: 'fashion',
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({
    description: 'Search query to filter posts by user name (influencer or brand)',
    required: false,
    example: 'Sneha Sharma',
  })
  @IsOptional()
  @IsString()
  userSearch?: string;

  @ApiProperty({
    description: 'Search query to filter posts by location (city name)',
    required: false,
    example: 'Mumbai',
  })
  @IsOptional()
  @IsString()
  locationSearch?: string;

  @ApiProperty({
    description: 'Sort by metric (createdAt, likes, or engagement)',
    enum: PostSortBy,
    required: false,
    default: PostSortBy.CREATED_AT,
    example: PostSortBy.LIKES,
  })
  @IsOptional()
  @IsEnum(PostSortBy)
  sortBy?: PostSortBy = PostSortBy.CREATED_AT;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
