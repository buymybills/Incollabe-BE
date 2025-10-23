import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum UserType {
  ALL = 'all',
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export class SearchUsersDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(UserType)
  @IsOptional()
  type?: UserType = UserType.ALL;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}