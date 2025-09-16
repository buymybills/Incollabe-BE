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
import type { GenderType, OthersGenderType } from '../types/gender.enum';
import { Transform } from 'class-transformer';

export class InfluencerSignupMultipartDto {
  @ApiProperty({
    description: 'Full name of the influencer',
    example: 'Dhruv Bhatia',
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100, { message: 'Name must be between 1 and 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Unique username for the influencer',
    example: 'dhruv_1109',
    pattern: '^[a-zA-Z0-9_]+$',
    minLength: 3,
    maxLength: 30,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @ApiProperty({
    description: 'Indian mobile number (10 digits)',
    example: '9467289789',
    pattern: '^[6-9]\\d{9}$',
    minLength: 10,
    maxLength: 10,
  })
  @IsNotEmpty()
  @IsString()
  @Length(10, 10, { message: 'Phone number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, {
    message:
      'Phone number must be a valid Indian mobile number starting with 6, 7, 8, or 9',
  })
  phone: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1995-01-15',
  })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  dateOfBirth: string;

  @ApiProperty({
    description: 'Gender of the influencer',
    example: Gender.MALE,
    enum: GENDER_OPTIONS,
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsEnum(GENDER_OPTIONS)
  gender: GenderType;

  @ApiProperty({
    description: 'Specific gender option when "Others" is selected',
    example: 'Abinary',
    enum: OTHERS_GENDER_OPTIONS,
    required: false,
  })
  @ValidateIf((obj) => obj.gender === Gender.OTHERS)
  @IsNotEmpty({ message: 'othersGender is required when gender is "Others"' })
  @IsEnum(OTHERS_GENDER_OPTIONS)
  othersGender?: OthersGenderType;

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
    description: 'Device token for push notifications (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  deviceToken?: string;
}
