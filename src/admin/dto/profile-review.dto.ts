import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ProfileType, ReviewStatus } from '../models/profile-review.model';

export class ApproveProfileDto {
  @ApiProperty({
    description: 'Optional admin comments for approval',
    example: 'Profile looks good. All documents are verified.',
    required: false,
  })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectProfileDto {
  @ApiProperty({
    description: 'Reason for profile rejection',
    example:
      'Profile images are not clear. Please upload high-quality images showing clear face visibility.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, {
    message: 'Rejection reason must be at least 10 characters long',
  })
  reason: string;

  @ApiProperty({
    description: 'Optional admin comments',
    example:
      'Need better quality photos for verification. Also ensure all social media links are working.',
    required: false,
  })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class PendingProfileDto {
  @ApiProperty({
    description: 'Profile review ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Profile ID being reviewed',
    example: 123,
  })
  profileId: number;

  @ApiProperty({
    description: 'Type of profile',
    enum: ProfileType,
    example: ProfileType.INFLUENCER,
  })
  profileType: ProfileType;

  @ApiProperty({
    description: 'Review status',
    enum: ReviewStatus,
    example: ReviewStatus.PENDING,
  })
  status: ReviewStatus;

  @ApiProperty({
    description: 'When profile was submitted for review',
    example: '2024-01-15T10:30:00Z',
  })
  submittedAt: Date;

  @ApiProperty({
    description: 'Profile data',
    type: 'object',
    properties: {
      id: { type: 'number', example: 123 },
      name: { type: 'string', example: 'John Doe' },
      email: { type: 'string', example: 'john@example.com' },
      phone: { type: 'string', example: '+919876543210' },
      isProfileCompleted: { type: 'boolean', example: true },
    },
  })
  profile: any;
}

export class ProfileDetailsDto {
  @ApiProperty({
    description: 'Complete profile information',
    type: 'object',
    additionalProperties: true,
  })
  profile: any;

  @ApiProperty({
    description: 'Review information',
    type: 'object',
    properties: {
      id: { type: 'number', example: 1 },
      status: { type: 'string', example: 'pending' },
      submittedAt: { type: 'string', example: '2024-01-15T10:30:00Z' },
      reviewer: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: 'Admin Name' },
          email: { type: 'string', example: 'admin@collabkaroo.com' },
        },
      },
    },
  })
  review: any;
}

export class DashboardStatsDto {
  @ApiProperty({
    description: 'Dashboard statistics',
    type: 'object',
    properties: {
      pendingReviews: {
        type: 'number',
        example: 5,
        description: 'Number of profiles pending review',
      },
      approvedToday: {
        type: 'number',
        example: 12,
        description: 'Number of profiles approved today',
      },
      rejectedToday: {
        type: 'number',
        example: 3,
        description: 'Number of profiles rejected today',
      },
      totalBrands: {
        type: 'number',
        example: 150,
        description: 'Total number of brands',
      },
      totalInfluencers: {
        type: 'number',
        example: 500,
        description: 'Total number of influencers',
      },
    },
  })
  stats: {
    pendingReviews: number;
    approvedToday: number;
    rejectedToday: number;
    totalBrands: number;
    totalInfluencers: number;
  };
}

export class ProfileReviewDto {
  @ApiProperty({
    description: 'Review status',
    enum: ReviewStatus,
    example: ReviewStatus.APPROVED,
  })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @ApiProperty({
    description: 'Admin comments',
    example: 'Profile looks good',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminComments?: string;

  @ApiProperty({
    description: 'ID of the admin reviewing',
    example: 1,
  })
  @IsNumber()
  reviewedBy: number;

  @ApiProperty({
    description: 'Rejection reason (required for rejections)',
    example: 'Profile information incomplete',
    required: false,
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ReviewActionResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Profile approved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Updated review record',
    type: 'object',
    additionalProperties: true,
  })
  review: any;
}
