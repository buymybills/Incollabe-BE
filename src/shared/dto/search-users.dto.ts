import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum UserType {
  ALL = 'all',
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export class SearchUsersDto {
  @ApiPropertyOptional({ description: 'Search query string' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'User type filter',
    enum: UserType,
    default: UserType.ALL,
  })
  @IsEnum(UserType)
  @IsOptional()
  type?: UserType = UserType.ALL;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
