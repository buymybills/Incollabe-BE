import { IsEmail, IsNotEmpty, IsString, IsOptional, IsArray, IsEnum, MinLength, Length, Matches } from 'class-validator';

export class BrandSignupDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Phone number must be exactly 10 digits' })
  @Matches(/^[6-9]\d{9}$/, { 
    message: 'Phone number must be a valid Indian mobile number starting with 6, 7, 8, or 9' 
  })
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  brandName?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  legalEntityName?: string;

  @IsEnum([
    'Private Limited Company (Pvt. Ltd.)',
    'Public Limited Company (PLC)',
    'One-Person Company (OPC)',
    'Limited Liability Partnership (LLP)',
    'Partnership Firm'
  ])
  @IsOptional()
  companyType?: string;

  @IsEmail()
  @IsOptional()
  brandEmailId?: string;

  @IsString()
  @IsOptional()
  pocName?: string;

  @IsString()
  @IsOptional()
  pocDesignation?: string;

  @IsEmail()
  @IsOptional()
  pocEmailId?: string;

  @IsString()
  @IsOptional()
  pocContactNumber?: string;

  @IsString()
  @IsOptional()
  brandBio?: string;

  @IsArray()
  @IsOptional()
  nicheIds?: number[];

  @IsString()
  @IsOptional()
  profileImage?: string;

  @IsString()
  @IsOptional()
  incorporationDocument?: string;

  @IsString()
  @IsOptional()
  gstDocument?: string;

  @IsString()
  @IsOptional()
  panDocument?: string;
}