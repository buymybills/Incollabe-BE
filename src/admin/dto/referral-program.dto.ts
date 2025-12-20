import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsEnum, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// REFERRAL PROGRAM STATISTICS
// ============================================

export class ReferralProgramStatisticsDto {
  @ApiProperty({
    description: 'Total number of referral codes generated',
    example: 3200,
  })
  totalReferralCodesGenerated: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: 36,
  })
  totalReferralCodesGeneratedGrowth: number;

  @ApiProperty({
    description: 'Total number of accounts created using referral codes',
    example: 1200,
  })
  accountsCreatedWithReferral: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: -2.9,
  })
  accountsCreatedWithReferralGrowth: number;

  @ApiProperty({
    description: 'Total amount spent on referral rewards (in Rs)',
    example: 120000,
  })
  amountSpentInReferral: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: -2.9,
  })
  amountSpentInReferralGrowth: number;

  @ApiProperty({
    description: 'Total number of redeem requests raised',
    example: 32,
  })
  redeemRequestsRaised: number;
}

// ============================================
// NEW ACCOUNTS WITH REFERRAL
// ============================================

export enum ProfileStatusFilter {
  ALL = 'all',
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
}

export class GetNewAccountsWithReferralDto {
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
    description: 'Number of records per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by profile verification status',
    enum: ProfileStatusFilter,
    required: false,
    example: ProfileStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(ProfileStatusFilter)
  profileStatus?: ProfileStatusFilter;

  @ApiProperty({
    description: 'Search by profile name, username, or referral code',
    required: false,
    example: 'sneha',
  })
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Start date for filtering (YYYY-MM-DD)',
    required: false,
    example: '2025-10-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for filtering (YYYY-MM-DD)',
    required: false,
    example: '2025-10-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class NewAccountWithReferralItemDto {
  @ApiProperty({ example: 123, description: 'Influencer ID' })
  id: number;

  @ApiProperty({ example: 'Sneha Shah', description: 'Profile name' })
  profileName: string;

  @ApiProperty({ example: '@sneha_s19', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'Navi Mumbai', description: 'Location' })
  location: string;

  @ApiProperty({
    example: 'verified',
    enum: ['verified', 'unverified'],
    description: 'Profile verification status',
  })
  profileStatus: string;

  @ApiProperty({ example: '@john_doe', description: 'Referred by username' })
  referredBy: string;

  @ApiProperty({ example: 'JOHN123', description: 'Referral code used' })
  referralCode: string;

  @ApiProperty({
    example: 15,
    description: 'Number of times referrer clicked "Invite Friend" button',
  })
  referrerInviteClickCount: number;

  @ApiProperty({
    example: '2025-10-02T12:28:00.000Z',
    description: 'Account creation date',
  })
  referralDate: Date;

  @ApiProperty({
    example: 'https://example.com/profile.jpg',
    description: 'Profile image URL',
    nullable: true,
  })
  profileImage: string | null;
}

export class NewAccountsWithReferralResponseDto {
  @ApiProperty({
    description: 'List of new accounts created with referral',
    type: [NewAccountWithReferralItemDto],
  })
  data: NewAccountWithReferralItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 1200,
      totalPages: 60,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// ACCOUNT REFERRER (INFLUENCERS WHO REFERRED)
// ============================================

export class GetAccountReferrersDto {
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
    description: 'Number of records per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search by referrer name, username, or referral code',
    required: false,
    example: 'john',
  })
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Sort by field',
    enum: ['totalReferrals', 'totalEarnings', 'createdAt'],
    required: false,
    example: 'totalReferrals',
  })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    required: false,
    example: 'DESC',
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';
}

export class AccountReferrerItemDto {
  @ApiProperty({ example: 456, description: 'Influencer ID' })
  id: number;

  @ApiProperty({ example: 'John Doe', description: 'Referrer name' })
  profileName: string;

  @ApiProperty({ example: '@john_doe', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'Mumbai', description: 'Location' })
  location: string;

  @ApiProperty({
    example: 'verified',
    enum: ['verified', 'unverified'],
    description: 'Profile verification status',
  })
  profileStatus: string;

  @ApiProperty({ example: 'JOHN123', description: 'Referral code' })
  referralCode: string;

  @ApiProperty({ example: 25, description: 'Total number of successful referrals' })
  totalReferrals: number;

  @ApiProperty({
    example: 42,
    description: 'Number of times clicked "Invite Friend" button',
  })
  inviteClickCount: number;

  @ApiProperty({
    example: 2500,
    description: 'Total earnings from referrals (in Rs)',
  })
  totalEarnings: number;

  @ApiProperty({
    example: 1500,
    description: 'Amount redeemed (in Rs)',
  })
  redeemed: number;

  @ApiProperty({
    example: 1000,
    description: 'Amount pending redemption (in Rs)',
  })
  pending: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Account creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: 'https://example.com/profile.jpg',
    description: 'Profile image URL',
    nullable: true,
  })
  profileImage: string | null;
}

export class AccountReferrersResponseDto {
  @ApiProperty({
    description: 'List of account referrers',
    type: [AccountReferrerItemDto],
  })
  data: AccountReferrerItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 500,
      totalPages: 25,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// TRANSACTION HISTORY
// ============================================

export class GetReferralTransactionsDto {
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
    description: 'Number of records per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by payment status',
    enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
    required: false,
  })
  @IsOptional()
  paymentStatus?: string;

  @ApiProperty({
    description: 'Search by influencer name or username',
    required: false,
    example: 'john',
  })
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Start date for filtering (YYYY-MM-DD)',
    required: false,
    example: '2025-10-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for filtering (YYYY-MM-DD)',
    required: false,
    example: '2025-10-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ReferralTransactionItemDto {
  @ApiProperty({ example: 789, description: 'Transaction ID' })
  id: number;

  @ApiProperty({ example: 456, description: 'Influencer ID' })
  influencerId: number;

  @ApiProperty({ example: 'John Doe', description: 'Influencer name' })
  influencerName: string;

  @ApiProperty({ example: '@john_doe', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'JOHN123', description: 'Referral code' })
  referralCode: string;

  @ApiProperty({
    example: 'referral_bonus',
    description: 'Transaction type',
  })
  transactionType: string;

  @ApiProperty({ example: 100, description: 'Amount (in Rs)' })
  amount: number;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
    description: 'Payment status',
  })
  paymentStatus: string;

  @ApiProperty({ example: 'john.doe@upi', description: 'UPI ID', nullable: true })
  upiId: string | null;

  @ApiProperty({
    example: 'TXN123456789',
    description: 'Payment reference ID',
    nullable: true,
  })
  paymentReferenceId: string | null;

  @ApiProperty({
    example: '2025-10-15T10:30:00.000Z',
    description: 'Transaction creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-10-16T14:20:00.000Z',
    description: 'Payment completion date',
    nullable: true,
  })
  paidAt: Date | null;

  @ApiProperty({
    example: 'Verified and processed',
    description: 'Admin notes',
    nullable: true,
  })
  adminNotes: string | null;
}

export class ReferralTransactionsResponseDto {
  @ApiProperty({
    description: 'List of referral transactions',
    type: [ReferralTransactionItemDto],
  })
  data: ReferralTransactionItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 150,
      totalPages: 8,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// REDEMPTION REQUESTS
// ============================================

export enum RedemptionStatusFilter {
  ALL = 'all',
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export class GetRedemptionRequestsDto {
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
    description: 'Number of records per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search by influencer name or username',
    required: false,
    example: 'sneha',
  })
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Sort by field',
    enum: ['amount', 'createdAt'],
    required: false,
    example: 'createdAt',
  })
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    required: false,
    example: 'DESC',
  })
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC';

  @ApiProperty({
    description: 'Start date for filtering (YYYY-MM-DD)',
    required: false,
    example: '2025-11-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for filtering (YYYY-MM-DD)',
    required: false,
    example: '2025-11-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RedemptionRequestItemDto {
  @ApiProperty({ example: 123, description: 'Transaction ID' })
  id: number;

  @ApiProperty({ example: 456, description: 'Influencer ID' })
  influencerId: number;

  @ApiProperty({ example: 'Sneha Sharma', description: 'Influencer name' })
  influencerName: string;

  @ApiProperty({ example: '@sneha_s19', description: 'Username' })
  username: string;

  @ApiProperty({ example: '7073250472@yescred', description: 'UPI ID' })
  upiId: string;

  @ApiProperty({ example: 1000, description: 'Requested amount (in Rs)' })
  amount: number;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
    description: 'Redemption status',
  })
  status: string;

  @ApiProperty({
    example: 'Nov 10, 2025 at 01:23 AM',
    description: 'Request creation date',
  })
  requestedAt: string;

  @ApiProperty({
    example: 'https://example.com/profile.jpg',
    description: 'Profile image URL',
    nullable: true,
  })
  profileImage: string | null;

  @ApiProperty({
    example: 'TXN123456789',
    description: 'Payment reference ID',
    nullable: true,
  })
  paymentReferenceId: string | null;
}

export class RedemptionRequestsResponseDto {
  @ApiProperty({
    description: 'List of redemption requests',
    type: [RedemptionRequestItemDto],
  })
  data: RedemptionRequestItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 32,
      totalPages: 2,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ProcessRedemptionDto {
  @ApiProperty({
    description: 'Payment reference/transaction ID',
    example: 'TXN123456789',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentReferenceId?: string;

  @ApiProperty({
    description: 'Admin notes (internal)',
    example: 'Payment processed successfully via UPI',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class ProcessRedemptionResponseDto {
  @ApiProperty({ example: true, description: 'Whether the process was successful' })
  success: boolean;

  @ApiProperty({
    example: 'Redemption processed successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({ example: 123, description: 'Transaction ID' })
  transactionId: number;

  @ApiProperty({ example: 'paid', description: 'New redemption status' })
  status: string;

  @ApiProperty({
    example: '2025-11-10T10:30:00.000Z',
    description: 'Timestamp of processing',
  })
  processedAt: Date;
}
