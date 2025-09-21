import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
  IsNumber,
  IsArray,
  Length,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateBrandProfileDto {
  @ApiProperty({ description: 'Brand name', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 100, {
    message: 'Brand name must be between 2 and 100 characters',
  })
  brandName?: string;

  @ApiProperty({ description: 'Username', required: false })
  @IsOptional()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Username can only contain letters, numbers, dots and underscores',
  })
  username?: string;

  @ApiProperty({ description: 'Legal entity name', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 200, {
    message: 'Legal entity name must be between 2 and 200 characters',
  })
  legalEntityName?: string;

  @ApiProperty({
    description: 'Company type ID',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  companyTypeId?: number;

  @ApiProperty({ description: 'Brand email ID', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid brand email address' })
  brandEmailId?: string;

  @ApiProperty({ description: 'Point of contact name', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'POC name must be between 2 and 100 characters' })
  pocName?: string;

  @ApiProperty({ description: 'Point of contact designation', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 100, {
    message: 'POC designation must be between 2 and 100 characters',
  })
  pocDesignation?: string;

  @ApiProperty({ description: 'Point of contact email ID', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid POC email address' })
  pocEmailId?: string;

  @ApiProperty({
    description: 'Point of contact phone number',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Please provide a valid Indian phone number',
  })
  pocContactNumber?: string;

  @ApiProperty({ description: 'Brand bio/description', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 1000, {
    message: 'Brand bio must be between 10 and 1000 characters',
  })
  brandBio?: string;

  @ApiProperty({ description: 'Profile headline', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 200, {
    message: 'Profile headline must be between 10 and 200 characters',
  })
  profileHeadline?: string;

  @ApiProperty({ description: 'Brand website URL', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message: 'Website URL must be a valid HTTP/HTTPS URL',
  })
  websiteUrl?: string;

  @ApiProperty({ description: 'Founded year', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber({}, { message: 'Founded year must be a number' })
  @Min(1900, { message: 'Founded year must be 1900 or later' })
  @Max(2099, { message: 'Founded year must be 2099 or earlier' })
  foundedYear?: number;

  @ApiProperty({ description: 'Headquarter country ID', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  headquarterCountryId?: number;

  @ApiProperty({ description: 'Headquarter city ID', required: false })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  headquarterCityId?: number;

  @ApiProperty({
    description: 'Active regions for campaigns',
    required: false,
    type: [String],
    example: ['Asia', 'Europe', 'North America'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    // Handle both comma-separated strings and arrays
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsString({ each: true })
  activeRegions?: string[];

  @ApiProperty({ description: 'Facebook page URL', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message:
      'Facebook URL must be a valid URL starting with http:// or https://',
  })
  facebookUrl?: string;

  @ApiProperty({ description: 'Instagram profile URL', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message:
      'Instagram URL must be a valid URL starting with http:// or https://',
  })
  instagramUrl?: string;

  @ApiProperty({ description: 'YouTube channel URL', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message:
      'YouTube URL must be a valid URL starting with http:// or https://',
  })
  youtubeUrl?: string;

  @ApiProperty({ description: 'LinkedIn company page URL', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message:
      'LinkedIn URL must be a valid URL starting with http:// or https://',
  })
  linkedinUrl?: string;

  @ApiProperty({ description: 'Twitter/X profile URL', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+/, {
    message:
      'Twitter/X URL must be a valid URL starting with http:// or https://',
  })
  twitterUrl?: string;
}
