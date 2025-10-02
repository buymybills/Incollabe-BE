import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  FOLLOWERS = 'followers',
  VERIFICATION_STATUS = 'isVerified',
}

export class AdminSearchDto {
  @ApiProperty({
    description: 'Search query for name, username, or email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'User type to filter by',
    enum: UserType,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @ApiProperty({
    description: 'Verification status filter',
    enum: VerificationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiProperty({
    description: 'Filter by top influencer status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isTopInfluencer?: boolean;

  @ApiProperty({
    description: 'Filter by niche IDs',
    required: false,
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  nicheIds?: number[];

  @ApiProperty({
    description: 'Filter by country ID',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  countryId?: number;

  @ApiProperty({
    description: 'Filter by city ID',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cityId?: number;

  @ApiProperty({
    description: 'Sort field',
    enum: SortField,
    required: false,
    default: SortField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortField)
  sortBy?: SortField = SortField.CREATED_AT;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    required: false,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiProperty({
    description: 'Page number (1-based)',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminSearchResultDto {
  @ApiProperty({ description: 'Search results' })
  data: any[];

  @ApiProperty({ description: 'Total count of results' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;

  @ApiProperty({ description: 'Has next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Has previous page' })
  hasPrevious: boolean;
}
