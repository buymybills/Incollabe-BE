import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  IsNumber,
} from 'class-validator';

export class CreateExperienceDto {
  @ApiProperty({
    description:
      'Campaign ID to associate the experience with (optional - if not provided, will create external campaign)',
    example: 123,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  campaignId?: number;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Festive Glam Essentials',
  })
  @IsString()
  campaignName: string;

  @ApiProperty({
    description: 'Brand or company name',
    example: 'Nykaa',
  })
  @IsString()
  brandName: string;

  @ApiProperty({
    description: 'Campaign category',
    example: 'Skincare + Makeup',
  })
  @IsString()
  campaignCategory: string;

  @ApiProperty({
    description: 'Deliverable format',
    example: '2 Instagram reels, 3 story posts',
  })
  @IsString()
  deliverableFormat: string;

  @ApiProperty({
    description: 'Whether the campaign was successfully completed',
    example: true,
  })
  @IsBoolean()
  successfullyCompleted: boolean;

  @ApiProperty({
    description: 'Role description in the campaign',
    example: 'Content creator for skincare products',
    required: false,
  })
  @IsOptional()
  @IsString()
  roleDescription?: string;

  @ApiProperty({
    description: 'Key results achieved',
    example:
      'Reach: 150K, Engagement Rate: 6.1%, Conversions (Dr.Vaid Mkt): 150+ clicks',
    required: false,
  })
  @IsOptional()
  @IsString()
  keyResultAchieved?: string;

  @ApiProperty({
    description: 'Campaign completion date',
    example: '2024-03-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @ApiProperty({
    description: 'Social media links related to the campaign',
    example: [
      {
        platform: 'instagram',
        contentType: 'post',
        url: 'https://instagram.com/p/xyz',
      },
      {
        platform: 'instagram',
        contentType: 'reel',
        url: 'https://instagram.com/reel/abc',
      },
      {
        platform: 'youtube',
        contentType: 'video',
        url: 'https://youtube.com/watch?v=def',
      },
    ],
    required: false,
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  socialLinks?: {
    platform: 'instagram' | 'youtube' | 'facebook' | 'twitter' | 'linkedin';
    contentType: 'post' | 'reel' | 'video' | 'shorts';
    url: string;
  }[];
}
