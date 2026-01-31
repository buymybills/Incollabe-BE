import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CheckReviewPromptDto {
  @ApiProperty({
    description: 'User ID (influencer or brand ID)',
    example: 123,
  })
  @IsNumber()
  user_id: number;

  @ApiProperty({
    description: 'User type',
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
  @IsEnum(['influencer', 'brand'])
  user_type: 'influencer' | 'brand';
}

export class CheckReviewPromptResponseDto {
  @ApiProperty({
    description: 'Whether the review prompt should be shown',
    example: true,
  })
  shouldShow: boolean;

  @ApiProperty({
    description: 'Reason for the decision',
    example: 'First prompt - user has reached campaign threshold',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Number of campaigns the user has',
    example: 5,
    required: false,
  })
  campaignCount?: number;

  @ApiProperty({
    description: 'Whether the user has already reviewed',
    example: false,
  })
  isReviewed: boolean;

  @ApiProperty({
    description: 'Date when the user was last prompted',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  lastPromptedAt?: Date;

  @ApiProperty({
    description: 'Number of times the user has been prompted',
    example: 2,
    required: false,
  })
  promptCount?: number;
}

export class RecordPromptShownDto {
  @ApiProperty({
    description: 'User ID (influencer or brand ID)',
    example: 123,
  })
  @IsNumber()
  user_id: number;

  @ApiHideProperty()
  @IsOptional()
  @IsEnum(['influencer', 'brand'])
  user_type?: 'influencer' | 'brand';

  @ApiProperty({
    description: 'Device ID - used to automatically determine user type from device_tokens table',
    example: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
  })
  @IsString()
  device_id: string;
}

export class MarkAsReviewedDto {
  @ApiProperty({
    description: 'User ID (influencer or brand ID)',
    example: 123,
  })
  @IsNumber()
  user_id: number;

  @ApiHideProperty()
  @IsOptional()
  @IsEnum(['influencer', 'brand'])
  user_type?: 'influencer' | 'brand';

  @ApiProperty({
    description: 'Device ID - used to automatically determine user type from device_tokens table',
    example: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
  })
  @IsString()
  device_id: string;
}

export class MarkAsReviewedResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Review status updated successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the user is now marked as reviewed',
    example: true,
  })
  isReviewed: boolean;

  @ApiProperty({
    description: 'Date when the review was completed',
    example: '2024-01-15T10:30:00Z',
  })
  reviewedAt: Date;
}
