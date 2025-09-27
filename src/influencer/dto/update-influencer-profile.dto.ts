import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CollaborationCostsDto } from './collaboration-costs.dto';

export class UpdateInfluencerProfileDto {

  @ApiProperty({ description: 'Bio/description', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 1000, { message: 'Bio must be between 10 and 1000 characters' })
  bio?: string;

  @ApiProperty({ description: 'Profile headline', required: false })
  @IsOptional()
  @IsString()
  @Length(10, 200, {
    message: 'Profile headline must be between 10 and 200 characters',
  })
  profileHeadline?: string;

  @ApiProperty({ description: 'Country ID', required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  countryId?: number;

  @ApiProperty({ description: 'City ID', required: false })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  cityId?: number;

  @ApiProperty({ description: 'WhatsApp number', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'Please provide a valid Indian WhatsApp number',
  })
  whatsappNumber?: string;

  @ApiProperty({ description: 'Instagram profile URL', required: false })
  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @ApiProperty({ description: 'YouTube channel URL', required: false })
  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @ApiProperty({ description: 'Facebook profile URL', required: false })
  @IsOptional()
  @IsString()
  facebookUrl?: string;

  @ApiProperty({ description: 'LinkedIn profile URL', required: false })
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiProperty({ description: 'Twitter/X profile URL', required: false })
  @IsOptional()
  @IsString()
  twitterUrl?: string;


  @ApiProperty({
    description: 'Collaboration costs for different platforms',
    required: false,
    type: CollaborationCostsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CollaborationCostsDto)
  collaborationCosts?: CollaborationCostsDto;
}
