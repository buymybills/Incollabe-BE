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

  @ApiProperty({
    description: 'Array of custom niche names (optional)',
    type: [String],
    example: ['Sustainable Fashion', 'Tech Reviews'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(2, 100, {
    each: true,
    message: 'Custom niche name must be between 2 and 100 characters',
  })
  customNiches?: string[];
}
