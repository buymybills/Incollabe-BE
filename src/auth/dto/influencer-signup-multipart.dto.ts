import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  Length,
  Matches,
  ArrayMinSize,
  ValidateIf,
  Allow,
} from 'class-validator';
import {
  Gender,
  GENDER_OPTIONS,
  OTHERS_GENDER_OPTIONS,
} from '../types/gender.enum';
import { Transform } from 'class-transformer';
import { Username } from '../../shared/decorators/username.decorator';

export class InfluencerSignupMultipartDto {
  @ApiProperty({
    description: 'Referral or campus ambassador code (optional). Accepts either:\n- Campus Ambassador Code: CA-XXXX format (e.g., CA-0001)\n- Influencer Referral Code: 8-character alphanumeric (e.g., ABC12XYZ)',
    required: false,
    examples: {
      campusAmbassador: {
        value: 'CA-0001',
        summary: 'Campus Ambassador Code'
      },
      influencerReferral: {
        value: 'ABC12XYZ',
        summary: 'Influencer Referral Code'
      }
    }
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:CA-\d{4}|[A-Z0-9]{8})$/, {
    message: 'Code must be either a campus ambassador code (CA-XXXX) or an 8-character influencer referral code'
  })
  referralCode?: string;

  @ApiProperty({
    description: 'Full name of the influencer',
    example: 'Dhruv Bhatia',
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters' })
  name: string;

  @Username({ example: 'dhruv_1109' })
  username: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1995-01-15',
  })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  dateOfBirth: string;

  @ApiProperty({
    description:
      'Gender of the influencer - can be Male, Female, or any custom gender option',
    example: Gender.MALE,
    enum: [Gender.MALE, Gender.FEMALE, ...OTHERS_GENDER_OPTIONS],
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsString()
  gender: string;

  @ApiProperty({
    description:
      'Bio or description about the influencer (optional, can be empty)',
    example: 'Fashion and lifestyle influencer based in Mumbai',
    required: false,
  })
  @IsOptional()
  @Allow()
  bio?: string;

  @ApiProperty({
    description:
      'Array of niche IDs that the influencer is interested in. Accepts JSON array string like "[1,4,12]" or comma-separated string like "1,4,12"',
    example: '[1,4,12]',
    type: 'string',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Try to parse as JSON array first
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.map(Number) : [];
        } catch {
          return [];
        }
      }
      // Handle comma-separated string
      if (value.includes(',')) {
        return value
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id));
      }
      // Handle single number as string
      const singleNumber = Number(value.trim());
      return !isNaN(singleNumber) ? [singleNumber] : [];
    }
    if (Array.isArray(value)) {
      return value.map(Number);
    }
    return [];
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one niche must be selected' })
  @IsNumber({}, { each: true, message: 'Each niche ID must be a number' })
  nicheIds: number[];

  @ApiProperty({
    description: 'Profile image file (optional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  profileImage?: any;

  @ApiProperty({
    description: 'FCM token for push notifications (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  fcmToken?: string;

  @ApiProperty({
    description:
      'Array of custom niche names. Accepts JSON array string like ["Sustainable Fashion","Tech Reviews"] or comma-separated string like "Sustainable Fashion,Tech Reviews" (optional, max 5 total including regular niches)',
    example: '["Sustainable Fashion","Tech Reviews"]',
    type: 'string',
    required: false,
  })
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') {
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
    return [];
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
