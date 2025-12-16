import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetReferralRewardsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of referrals per page',
    example: 10,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class ReferralHistoryItemDto {
  @ApiProperty({ example: 132, description: 'Referred influencer ID' })
  id: number;

  @ApiProperty({ example: 'Sneha Sharma', description: 'Referred influencer name' })
  name: string;

  @ApiProperty({ example: 'sneha_s09', description: 'Referred influencer username' })
  username: string;

  @ApiProperty({
    example: 'https://incollabstaging.s3.ap-south-1.amazonaws.com/...',
    description: 'Profile image URL',
  })
  profileImage: string | null;

  @ApiProperty({ example: true, description: 'Whether profile is verified' })
  isVerified: boolean;

  @ApiProperty({
    example: '2025-11-10T01:23:00.000Z',
    description: 'When the influencer joined',
  })
  joinedAt: Date;

  @ApiProperty({ example: 100, description: 'Reward earned for this referral (in Rs)' })
  rewardEarned: number;

  @ApiProperty({
    example: 'paid',
    enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
    description: 'Payment status for this referral reward',
  })
  rewardStatus: string;

  @ApiProperty({ example: 123, description: 'Credit transaction ID' })
  creditTransactionId: number | null;
}

export class ReferralRewardsSummaryDto {
  @ApiProperty({ example: 2300, description: 'Total lifetime rewards earned (in Rs)' })
  lifetimeReward: number;

  @ApiProperty({
    example: 1200,
    description: 'Amount already redeemed/paid out (in Rs)',
  })
  redeemed: number;

  @ApiProperty({
    example: 1100,
    description: 'Amount available to redeem (in Rs)',
  })
  redeemable: number;
}

export class ReferralRewardsResponseDto {
  @ApiProperty({ description: 'Rewards summary' })
  summary: ReferralRewardsSummaryDto;

  @ApiProperty({
    description: 'List of referrals',
    type: [ReferralHistoryItemDto],
  })
  referralHistory: ReferralHistoryItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 10,
      total: 23,
      totalPages: 3,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
