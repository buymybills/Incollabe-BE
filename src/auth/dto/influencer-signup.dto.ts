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
import { ToLowercase } from '../../shared/decorators/to-lowercase.decorator';
import { IsValidUsername } from '../../shared/validators/is-valid-username.validator';

export class InfluencerSignupDto {
  @ApiProperty({
    description: 'Referral code of the influencer (optional)',
    required: false,
    example: 'REF12345',
  })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiProperty({
    description: 'Full name of the influencer',
    example: 'Dhruv Bhatia',
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters' })
  name: string;

  @ApiProperty({
    description:
      'Unique username for the influencer. Must be 3-30 characters, lowercase, and can only contain letters, numbers, dots, and underscores. Cannot start/end with dot or underscore, and cannot have consecutive dots or underscores.',
    example: 'dhruv_1109',
    pattern: '^[a-z0-9._]+$',
    minLength: 3,
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString({ message: 'Username must be a string' })
  @ToLowercase()
  @IsValidUsername()
  username: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1995-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  dateOfBirth?: string;

  @ApiProperty({
    description:
      'Gender of the influencer - can be Male, Female, or any custom gender option',
    example: Gender.MALE,
    enum: [Gender.MALE, Gender.FEMALE, ...OTHERS_GENDER_OPTIONS],
    required: false,
  })
  @IsOptional()
  @IsString()
  gender?: string;

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
      'Array of niche IDs that the influencer is interested in (max 5 total including custom niches)',
    example: [1, 4, 12],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one niche must be selected' })
  @IsNumber({}, { each: true, message: 'Each niche ID must be a number' })
  nicheIds: number[];

  @ApiProperty({
    description:
      'Array of custom niche names to create during signup (optional, max 5 total including regular niches)',
    example: ['Sustainable Fashion', 'Tech Reviews'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'Each custom niche must be a string' })
  @Length(2, 100, {
    each: true,
    message: 'Custom niche name must be between 2 and 100 characters',
  })
  customNiches?: string[];

  @ApiProperty({
    description: 'Profile image URL or base64 string (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  profileImage?: string;

  @ApiProperty({
    description: 'FCM token for push notifications (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  fcmToken?: string;
}
