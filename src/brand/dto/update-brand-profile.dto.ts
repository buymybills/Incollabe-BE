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
import { ToLowercase } from '../../shared/decorators/to-lowercase.decorator';
import { IsValidUsername } from '../../shared/validators/is-valid-username.validator';

export class UpdateBrandProfileDto {
  @ApiProperty({ description: 'Brand name', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 100, {
    message: 'Brand name must be between 2 and 100 characters',
  })
  brandName?: string;

  @ApiProperty({
    description:
      'Username. Must be 3-30 characters, lowercase, and can only contain letters, numbers, dots, and underscores. Cannot start/end with dot or underscore, and cannot have consecutive dots or underscores.',
    required: false,
    pattern: '^[a-z0-9._]+$',
    minLength: 3,
    maxLength: 30,
  })
  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  @ToLowercase()
  @IsValidUsername()
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
  @Min(1800, { message: 'Founded year must be 1800 or later' })
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
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    if (!value || value === 'string' || !value.startsWith('http'))
      return undefined;
    return value;
  })
  @IsString()
  @Matches(/^(https?:\/\/.+|)$/, {
    message:
      'Facebook URL must be a valid URL starting with http:// or https://, or empty to clear',
  })
  facebookUrl?: string;

  @ApiProperty({ description: 'Instagram profile URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    if (!value || value === 'string' || !value.startsWith('http'))
      return undefined;
    return value;
  })
  @IsString()
  @Matches(/^(https?:\/\/.+|)$/, {
    message:
      'Instagram URL must be a valid URL starting with http:// or https://, or empty to clear',
  })
  instagramUrl?: string;

  @ApiProperty({ description: 'YouTube channel URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    if (!value || value === 'string' || !value.startsWith('http'))
      return undefined;
    return value;
  })
  @IsString()
  @Matches(/^(https?:\/\/.+|)$/, {
    message:
      'YouTube URL must be a valid URL starting with http:// or https://, or empty to clear',
  })
  youtubeUrl?: string;

  @ApiProperty({ description: 'LinkedIn company page URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    if (!value || value === 'string' || !value.startsWith('http'))
      return undefined;
    return value;
  })
  @IsString()
  @Matches(/^(https?:\/\/.+|)$/, {
    message:
      'LinkedIn URL must be a valid URL starting with http:// or https://, or empty to clear',
  })
  linkedinUrl?: string;

  @ApiProperty({ description: 'Twitter/X profile URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    if (!value || value === 'string' || !value.startsWith('http'))
      return undefined;
    return value;
  })
  @IsString()
  @Matches(/^(https?:\/\/.+|)$/, {
    message:
      'Twitter/X URL must be a valid URL starting with http:// or https://, or empty to clear',
  })
  twitterUrl?: string;

  @ApiProperty({
    description: 'FCM token for push notifications',
    required: false,
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiProperty({
    description: 'Array of regular niche IDs (1-5 niches allowed)',
    type: [Number],
    example: [1, 2, 3],
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      // Handle comma-separated string "1,2,3"
      if (value.includes(',')) {
        return value
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));
      }
      // Handle single ID "1"
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? undefined : [parsed];
    }
    if (Array.isArray(value)) {
      return value
        .map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
        .filter((id) => !isNaN(id));
    }
    return undefined;
  })
  @IsArray()
  @IsNumber({}, { each: true, message: 'Each niche ID must be a number' })
  nicheIds?: number[];

  @ApiProperty({
    description:
      'Array of custom niche names for bulk replacement. Accepts JSON array ["Sustainable Fashion","Tech Reviews"] or comma-separated "Sustainable Fashion,Tech Reviews". Will replace ALL existing custom niches.',
    example: '["Sustainable Fashion","Tech Reviews"]',
    required: false,
  })
  @Transform(({ value }) => {
    if (!value) return undefined; // undefined means don't update custom niches
    if (typeof value === 'string') {
      if (value.trim() === '') return []; // empty string means delete all custom niches
      // Try to parse as JSON array first
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      // Handle comma-separated string
      if (value.includes(',')) {
        return value
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0);
      }
      // Handle single string
      return value.trim() ? [value.trim()] : [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    return undefined;
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each custom niche must be a string' })
  @Length(2, 100, {
    each: true,
    message: 'Custom niche name must be between 2 and 100 characters',
  })
  customNiches?: string[];
}
