import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetFollowersDto {
  @ApiPropertyOptional({
    description: 'Search by name or username',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class GetFollowingDto {
  @ApiPropertyOptional({
    description: 'Search by name or username',
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

// Response DTOs
export class FollowerResponseDto {
  id: number;
  type: 'influencer' | 'brand';
  name: string;
  username: string;
  profileImage: string | null;
  followedAt: Date;
}

export class FollowingResponseDto {
  id: number;
  type: 'influencer' | 'brand';
  name: string;
  username: string;
  profileImage: string | null;
  followedAt: Date;
}

export class GetFollowersResponseDto {
  followers: FollowerResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class GetFollowingResponseDto {
  following: FollowingResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
