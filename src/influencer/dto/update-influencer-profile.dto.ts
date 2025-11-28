import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
  IsObject,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CollaborationCostsDto } from './collaboration-costs.dto';

export class UpdateInfluencerProfileDto {
  @ApiProperty({ description: 'Bio/description', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 1000, { message: 'Bio must be between 10 and 1000 characters' })
  bio?: string;

  @ApiProperty({ description: 'Profile headline', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 200, {
    message: 'Profile headline must be between 10 and 200 characters',
  })
  profileHeadline?: string;

  @ApiProperty({ description: 'Country ID', required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  countryId?: number;

  @ApiProperty({ description: 'City ID', required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  cityId?: number;

  @ApiProperty({ description: 'WhatsApp number', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Please provide a valid Indian WhatsApp number',
  })
  whatsappNumber?: string;

  @ApiProperty({
    description: 'UPI ID for receiving referral credits',
    required: false,
    example: 'username@paytm',
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    return value || undefined;
  })
  @IsString()
  @Matches(/^$|^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, {
    message: 'Please provide a valid UPI ID (e.g., username@paytm)',
  })
  upiId?: string;

  @ApiProperty({ description: 'Instagram profile URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    return value || undefined;
  })
  @IsString()
  instagramUrl?: string;

  @ApiProperty({ description: 'YouTube channel URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    return value || undefined;
  })
  @IsString()
  youtubeUrl?: string;

  @ApiProperty({ description: 'Facebook profile URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    return value || undefined;
  })
  @IsString()
  facebookUrl?: string;

  @ApiProperty({ description: 'LinkedIn profile URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    return value || undefined;
  })
  @IsString()
  linkedinUrl?: string;

  @ApiProperty({ description: 'Twitter/X profile URL', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    // Keep empty string to allow clearing the field
    if (value === '') return '';
    return value || undefined;
  })
  @IsString()
  twitterUrl?: string;

  @ApiProperty({
    description: 'Collaboration costs for different platforms',
    required: false,
    type: CollaborationCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollaborationCostsDto)
  collaborationCosts?: CollaborationCostsDto;

  @ApiProperty({
    description: 'FCM token for push notifications',
    required: false,
  })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiProperty({
    description:
      'Set to true to clear/remove the profile banner. If false or not provided, existing banner is preserved unless a new file is uploaded.',
    required: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  clearProfileBanner?: boolean;

  @ApiProperty({
    description:
      'Array of niche IDs. Accepts JSON array "[1,4,12]" or comma-separated "1,4,12"',
    example: '[1,4,12]',
    required: false,
  })
  @IsOptional()
  @IsString()
  nicheIds?: string;

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
