import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserTypeEnum {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export class InstagramTokenDto {
  @ApiProperty({ description: 'Authorization code from Instagram OAuth' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: 'Redirect URI used in OAuth flow' })
  @IsNotEmpty()
  @IsString()
  redirect_uri: string;
}

export class InstagramTokenResponseDto {
  @ApiProperty({ description: 'Long-lived access token' })
  access_token: string;

  @ApiProperty({ description: 'Instagram user ID' })
  user_id: string | number;

  @ApiProperty({ description: 'Token expiration time in seconds' })
  expires_in: number;
}

export class InstagramRefreshTokenDto {
  @ApiProperty({ description: 'Current access token to refresh' })
  @IsNotEmpty()
  @IsString()
  access_token: string;
}

export class InstagramRefreshTokenResponseDto {
  @ApiProperty({ description: 'Refreshed access token' })
  access_token: string;

  @ApiProperty({ description: 'Token type (usually "bearer")' })
  token_type: string;

  @ApiProperty({ description: 'Token expiration time in seconds' })
  expires_in: number;
}

export class InstagramUserProfileDto {
  @ApiProperty({ description: 'Instagram user ID' })
  id: string;

  @ApiProperty({ description: 'Instagram username' })
  username: string;

  @ApiProperty({ description: 'Account type (e.g., BUSINESS, CREATOR)', required: false })
  @IsOptional()
  account_type?: string;

  @ApiProperty({ description: 'Number of followers', required: false })
  @IsOptional()
  followers_count?: number;

  @ApiProperty({ description: 'Number of accounts following', required: false })
  @IsOptional()
  follows_count?: number;

  @ApiProperty({ description: 'Number of media posts', required: false })
  @IsOptional()
  media_count?: number;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  @IsOptional()
  profile_picture_url?: string;

  @ApiProperty({ description: 'Biography/bio text', required: false })
  @IsOptional()
  biography?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsOptional()
  website?: string;

  @ApiProperty({ description: 'Full name', required: false })
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Whether the account is verified by Instagram (blue checkmark)', required: false })
  @IsOptional()
  is_verified?: boolean;
}

export class InstagramMediaDto {
  @ApiProperty({ description: 'Media ID' })
  id: string;

  @ApiProperty({ description: 'Media caption/text', required: false })
  @IsOptional()
  caption?: string;

  @ApiProperty({ description: 'Media type (IMAGE, VIDEO, CAROUSEL_ALBUM)', required: false })
  @IsOptional()
  media_type?: string;

  @ApiProperty({ description: 'Media URL', required: false })
  @IsOptional()
  media_url?: string;

  @ApiProperty({ description: 'Thumbnail URL (for videos)', required: false })
  @IsOptional()
  thumbnail_url?: string;

  @ApiProperty({ description: 'Permalink/URL to the post', required: false })
  @IsOptional()
  permalink?: string;

  @ApiProperty({ description: 'Timestamp when posted', required: false })
  @IsOptional()
  timestamp?: string;

  @ApiProperty({ description: 'Like count', required: false })
  @IsOptional()
  like_count?: number;

  @ApiProperty({ description: 'Comments count', required: false })
  @IsOptional()
  comments_count?: number;
}

export class InstagramMediaListResponseDto {
  @ApiProperty({ description: 'List of media items', type: [InstagramMediaDto] })
  data: InstagramMediaDto[];

  @ApiProperty({ description: 'Pagination info', required: false })
  @IsOptional()
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

export class InstagramInsightValueDto {
  @ApiProperty({ description: 'Metric value' })
  value: number;
}

export class InstagramInsightDto {
  @ApiProperty({ description: 'Metric name' })
  name: string;

  @ApiProperty({ description: 'Time period (lifetime, day, etc.)' })
  period: string;

  @ApiProperty({ description: 'Metric values', type: [InstagramInsightValueDto] })
  values: InstagramInsightValueDto[];

  @ApiProperty({ description: 'Metric title', required: false })
  @IsOptional()
  title?: string;

  @ApiProperty({ description: 'Metric description', required: false })
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Metric ID', required: false })
  @IsOptional()
  id?: string;
}

export class InstagramMediaInsightsResponseDto {
  @ApiProperty({ description: 'List of insights', type: [InstagramInsightDto] })
  data: InstagramInsightDto[];
}
