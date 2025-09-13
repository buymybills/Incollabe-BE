import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsDateString,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  Length,
  Matches,
  ArrayMinSize,
} from 'class-validator';

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
    message: 'Phone number must be a valid Indian mobile number starting with 6, 7, 8, or 9' 
  })
  phone: string;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '1995-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Gender of the influencer',
    example: 'Male',
    enum: ['Male', 'Female', 'Others'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['Male', 'Female', 'Others'])
  gender?: 'Male' | 'Female' | 'Others';

  @ApiProperty({
    description: 'Bio or description about the influencer',
    example: 'Fashion and lifestyle influencer based in Mumbai',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Bio must not exceed 500 characters' })
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
    description: 'Profile image URL or base64 string',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiProperty({
    description: 'Device token for push notifications',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}