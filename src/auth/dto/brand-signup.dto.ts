import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  MinLength,
  Length,
  Matches,
  Allow,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BrandSignupDto {
  @ApiProperty({
    description: 'Brand email address for login',
    example: 'brand@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'Password for brand account (min 10 chars, must include uppercase, lowercase, number, and special character)',
    example: 'SecurePassword123!',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Password must be at least 10 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-])[A-Za-z\d@$!%*?&._-]{10,}$/,
    {
      message:
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&._-)',
    },
  )
  password: string;

  @ApiProperty({
    description: 'Brand name (optional, can be empty)',
    example: 'Example Brand Inc.',
    required: false,
  })
  @Allow()
  @IsOptional()
  brandName?: string;

  @ApiProperty({
    description: 'Unique username for the brand (optional, can be empty)',
    example: 'example_brand',
    required: false,
  })
  @Allow()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: 'Legal entity name as registered (optional, can be empty)',
    example: 'Example Brand Private Limited',
    required: false,
  })
  @Allow()
  @IsOptional()
  legalEntityName?: string;

  @ApiProperty({
    description: 'Type of company registration',
    enum: [
      'Private Limited Company (Pvt. Ltd.)',
      'Public Limited Company (PLC)',
      'One-Person Company (OPC)',
      'Limited Liability Partnership (LLP)',
      'Partnership Firm',
    ],
    example: 'Private Limited Company (Pvt. Ltd.)',
    required: false,
  })
  @IsEnum([
    'Private Limited Company (Pvt. Ltd.)',
    'Public Limited Company (PLC)',
    'One-Person Company (OPC)',
    'Limited Liability Partnership (LLP)',
    'Partnership Firm',
  ])
  @IsOptional()
  companyType?: string;

  @ApiProperty({
    description: 'Brand official email address (optional, can be empty)',
    example: 'info@examplebrand.com',
    format: 'email',
    required: false,
  })
  @Allow()
  @IsOptional()
  brandEmailId?: string;

  @ApiProperty({
    description: 'Point of contact name (optional, can be empty)',
    example: 'John Smith',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocName?: string;

  @ApiProperty({
    description: 'Point of contact designation (optional, can be empty)',
    example: 'Marketing Manager',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocDesignation?: string;

  @ApiProperty({
    description: 'Point of contact email address (optional, can be empty)',
    example: 'john.smith@examplebrand.com',
    format: 'email',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocEmailId?: string;

  @ApiProperty({
    description: 'Point of contact phone number (optional, can be empty)',
    example: '+919876543210',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocContactNumber?: string;

  @ApiProperty({
    description: 'Brand bio or description (optional, can be empty or null)',
    example: 'We are a leading fashion brand focused on sustainable clothing.',
    required: false,
  })
  @Allow()
  @IsOptional()
  brandBio?: string;

  @ApiProperty({
    description: 'Array of niche IDs the brand is interested in',
    type: [Number],
    example: [1, 4, 12],
    required: false,
  })
  @IsArray()
  @IsOptional()
  nicheIds?: number[];

  @ApiProperty({
    description: 'URL of brand profile image (optional, can be empty)',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  @Allow()
  @IsOptional()
  profileImage?: string;

  @ApiProperty({
    description: 'URL of incorporation document (optional, can be empty)',
    example: 'https://example.com/incorporation.pdf',
    required: false,
  })
  @Allow()
  @IsOptional()
  incorporationDocument?: string;

  @ApiProperty({
    description: 'URL of GST registration document (optional, can be empty)',
    example: 'https://example.com/gst.pdf',
    required: false,
  })
  @Allow()
  @IsOptional()
  gstDocument?: string;

  @ApiProperty({
    description: 'URL of PAN document (optional, can be empty)',
    example: 'https://example.com/pan.pdf',
    required: false,
  })
  @Allow()
  @IsOptional()
  panDocument?: string;

  @ApiProperty({
    description: 'FCM token for push notifications (optional, can be empty)',
    required: false,
  })
  @IsOptional()
  @Allow()
  fcmToken?: string;
}
