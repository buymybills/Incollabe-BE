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

export class InfluencerSignupDto {
  @ApiProperty({
    description: 'Full name of the influencer',
    example: 'Dhruv Bhatia',
  })
  @IsNotEmpty()
  @IsString()
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters' })
  name: string;

  @ApiProperty({
    description: 'Unique username for the influencer',
    example: 'dhruv_1109',
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
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
    description: 'Array of niche IDs that the influencer is interested in',
    example: [1, 4, 12],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one niche must be selected' })
  @IsNumber({}, { each: true, message: 'Each niche ID must be a number' })
  nicheIds: number[];

  @ApiProperty({
    description: 'Profile image URL or base64 string (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  profileImage?: string;

  @ApiProperty({
    description: 'Device token for push notifications (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  deviceToken?: string;
}
