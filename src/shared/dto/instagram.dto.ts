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
}
