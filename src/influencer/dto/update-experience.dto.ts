import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { CampaignType } from '../../campaign/models/campaign.model';

export class UpdateExperienceDto {
  @ApiProperty({
    description: 'Campaign ID to associate the experience with',
    example: 123,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  campaignId?: number;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Festive Glam Essentials',
    required: false,
  })
  @IsOptional()
  @IsString()
  campaignName?: string;

  @ApiProperty({
    description: 'Brand or company name',
    example: 'Nykaa',
    required: false,
  })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiProperty({
    description: 'Campaign category (type)',
    enum: CampaignType,
    example: CampaignType.PAID,
    required: false,
  })
  @IsOptional()
  @IsEnum(CampaignType)
  campaignCategory?: CampaignType;

  @ApiProperty({
    description:
      'Array of deliverable format types. Use values from GET /campaign/deliverable-formats endpoint. ' +
      'For UGC/PAID/BARTER: social media formats (instagram_reel, youtube_short, etc.). ' +
      'For ENGAGEMENT: engagement formats (like_comment, playstore_review, etc.)',
    example: ['instagram_reel', 'instagram_story'],
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverableFormat?: string[];

  @ApiProperty({
    description: 'Whether the campaign was successfully completed',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  successfullyCompleted?: boolean;

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
