import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsArray, IsEnum, MinLength, Length, Matches, Allow } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BrandSignupMultipartDto {
  @ApiProperty({
    description: 'Indian mobile number (10 digits)',
    example: '9467289789',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Phone number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid Indian mobile number starting with 6, 7, 8, or 9'
  })
  phone: string;

  @ApiProperty({
    description: 'Brand email address for login',
    example: 'brand@example.com',
    type: 'string',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Password for brand account',
    example: 'SecurePassword123!',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Brand name (optional, can be empty)',
    example: 'Example Brand Inc.',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  brandName?: string;

  @ApiProperty({
    description: 'Unique username for the brand (optional, can be empty)',
    example: 'example_brand',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: 'Legal entity name as registered (optional, can be empty)',
    example: 'Example Brand Private Limited',
    type: 'string',
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
      'Partnership Firm'
    ],
    example: 'Private Limited Company (Pvt. Ltd.)',
    type: 'string',
    required: false,
  })
  @IsEnum([
    'Private Limited Company (Pvt. Ltd.)',
    'Public Limited Company (PLC)',
    'One-Person Company (OPC)',
    'Limited Liability Partnership (LLP)',
    'Partnership Firm'
  ])
  @IsOptional()
  companyType?: string;

  @ApiProperty({
    description: 'Brand official email address (optional, can be empty)',
    example: 'info@examplebrand.com',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  brandEmailId?: string;

  @ApiProperty({
    description: 'Point of contact name (optional, can be empty)',
    example: 'John Smith',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocName?: string;

  @ApiProperty({
    description: 'Point of contact designation (optional, can be empty)',
    example: 'Marketing Manager',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocDesignation?: string;

  @ApiProperty({
    description: 'Point of contact email address (optional, can be empty)',
    example: 'john.smith@examplebrand.com',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocEmailId?: string;

  @ApiProperty({
    description: 'Point of contact phone number (optional, can be empty)',
    example: '+919876543210',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  pocContactNumber?: string;

  @ApiProperty({
    description: 'Brand bio or description (optional, can be empty or null)',
    example: 'We are a leading fashion brand focused on sustainable clothing.',
    type: 'string',
    required: false,
  })
  @Allow()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return value;
  })
  brandBio?: string;

  @ApiProperty({
    description: 'Array of niche IDs the brand is interested in. Accepts JSON array "[1,4,12]" or comma-separated "1,4,12"',
    example: '[1,4,12]',
    type: 'string',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        // Try parsing as JSON first
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(Number) : [Number(parsed)];
      } catch {
        // If JSON parsing fails, try comma-separated values
        return value.split(',').map((id: string) => Number(id.trim())).filter(Boolean);
      }
    }
    return Array.isArray(value) ? value.map(Number) : [];
  })
  @IsArray()
  nicheIds?: number[];

}