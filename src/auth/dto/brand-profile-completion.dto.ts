import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  Length,
  Matches,
  Allow,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BrandProfileCompletionDto {
  @ApiProperty({
    description: 'Indian mobile number (10 digits)',
    example: '9467289789',
    pattern: '^[6-9]\\d{9}$',
    minLength: 10,
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Phone number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, {
    message:
      'Phone number must be a valid Indian mobile number starting with 6, 7, 8, or 9',
  })
  phone: string;

  @ApiProperty({
    description: 'Brand name',
    example: 'Example Brand Inc.',
  })
  @IsString()
  @IsNotEmpty()
  brandName: string;

  @ApiProperty({
    description: 'Unique username for the brand',
    example: 'example_brand',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Legal entity name as registered',
    example: 'Example Brand Private Limited',
  })
  @IsString()
  @IsNotEmpty()
  legalEntityName: string;

  @ApiProperty({
    description: 'Type of company registration',
    enum: [
      'Private Limited Company (Pvt. Ltd.)',
      'Public Limited Company (PLC)',
      'One-Person Company (OPC)',
      'Limited Liability Partnership (LLP)',
      'Partnership Firm',
      'Sole Proprietorship',
      'Joint Venture (JV)',
      'Section 8 Company',
      'Foreign Company',
    ],
    example: 'Private Limited Company (Pvt. Ltd.)',
  })
  @IsEnum([
    'Private Limited Company (Pvt. Ltd.)',
    'Public Limited Company (PLC)',
    'One-Person Company (OPC)',
    'Limited Liability Partnership (LLP)',
    'Partnership Firm',
    'Sole Proprietorship',
    'Joint Venture (JV)',
    'Section 8 Company',
    'Foreign Company',
  ])
  @IsNotEmpty()
  companyType: string;

  @ApiProperty({
    description: 'Point of contact name',
    example: 'John Smith',
  })
  @IsString()
  @IsNotEmpty()
  pocName: string;

  @ApiProperty({
    description: 'Point of contact designation',
    example: 'Marketing Manager',
  })
  @IsString()
  @IsNotEmpty()
  pocDesignation: string;

  @ApiProperty({
    description: 'Point of contact email address',
    example: 'john.smith@examplebrand.com',
    format: 'email',
  })
  @IsString()
  @IsNotEmpty()
  pocEmailId: string;

  @ApiProperty({
    description: 'Point of contact phone number',
    example: '+919876543210',
  })
  @IsString()
  @IsNotEmpty()
  pocContactNumber: string;

  @ApiProperty({
    description: 'Brand bio or description (optional)',
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
  })
  @IsArray()
  @IsNotEmpty()
  nicheIds: number[];
}
