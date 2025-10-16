import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Length,
  Matches,
  Allow,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class BrandProfileCompletionMultipartDto {
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
    description:
      'Array of niche IDs. Accepts JSON array string like "[1,4,12]" or comma-separated string like "1,4,12"',
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
  @IsNotEmpty({ message: 'At least one niche must be selected' })
  @IsNumber({}, { each: true, message: 'Each niche ID must be a number' })
  nicheIds: number[];

  @ApiProperty({
    description:
      'Array of custom niche names. Accepts JSON array ["Sustainable Fashion","Tech Reviews"] or comma-separated "Sustainable Fashion,Tech Reviews" (optional)',
    example: '["Sustainable Fashion","Tech Reviews"]',
    type: 'string',
    required: false,
  })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      if (value.trim() === '') return [];
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

  @ApiProperty({
    description: 'Profile image file (optional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  profileImage?: any;

  @ApiProperty({
    description: 'Incorporation document file (optional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  incorporationDocument?: any;

  @ApiProperty({
    description: 'GST registration document file (optional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  gstDocument?: any;

  @ApiProperty({
    description: 'PAN document file (optional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  panDocument?: any;
}
