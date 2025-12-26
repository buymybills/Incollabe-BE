import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsEnum, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// MAXX SUBSCRIPTION STATISTICS
// ============================================

export class MaxxSubscriptionStatisticsDto {
  @ApiProperty({
    description: 'Total number of Maxx (Pro) profiles ever created',
    example: 200,
  })
  totalMaxxProfiles: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: 36.0,
  })
  totalMaxxProfilesGrowth: number;

  @ApiProperty({
    description: 'Number of currently active subscriptions',
    example: 100,
  })
  activeMaxxProfiles: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: -2.9,
  })
  activeMaxxProfilesGrowth: number;

  @ApiProperty({
    description: 'Number of inactive/expired subscriptions',
    example: 100,
  })
  inactiveMaxxProfiles: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: -2.9,
  })
  inactiveMaxxProfilesGrowth: number;

  @ApiProperty({
    description: 'Number of cancelled subscriptions',
    example: 20,
  })
  subscriptionCancelled: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: -2.9,
  })
  subscriptionCancelledGrowth: number;

  @ApiProperty({
    description: 'Average subscription duration in months',
    example: 3.5,
  })
  averageUsageDuration: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: 36.0,
  })
  averageUsageDurationGrowth: number;

  @ApiProperty({
    description: 'Number of subscriptions using autopay',
    example: 100,
  })
  autopaySubscriptionCount: number;

  @ApiProperty({
    description: 'Percentage change vs last month',
    example: -2.9,
  })
  autopaySubscriptionCountGrowth: number;
}

// ============================================
// SUBSCRIPTION FILTERS
// ============================================

export enum ProfileStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_FAILED = 'payment_failed',
}

export enum PaymentTypeFilter {
  ALL = 'all',
  MONTHLY = 'monthly',
  AUTOPAY = 'autopay',
}

export class GetMaxxSubscriptionsDto {
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
    description: 'Filter by subscription status',
    enum: ProfileStatusFilter,
    required: false,
    example: ProfileStatusFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProfileStatusFilter)
  profileStatus?: ProfileStatusFilter;

  @ApiProperty({
    description: 'Filter by payment type',
    enum: PaymentTypeFilter,
    required: false,
    example: PaymentTypeFilter.AUTOPAY,
  })
  @IsOptional()
  @IsEnum(PaymentTypeFilter)
  paymentType?: PaymentTypeFilter;

  @ApiProperty({
    description: 'Search by profile name, username, or location',
    required: false,
    example: 'sneha',
  })
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Sort by field',
    enum: ['usageMonths', 'validTill', 'paymentType', 'createdAt'],
    required: false,
    example: 'usageMonths',
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
    description: 'Start date for filtering subscription creation date (YYYY-MM-DD)',
    required: false,
    example: '2025-06-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for filtering subscription creation date (YYYY-MM-DD)',
    required: false,
    example: '2025-10-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Start date for filtering by valid till date (YYYY-MM-DD)',
    required: false,
    example: '2025-10-01',
  })
  @IsOptional()
  @IsDateString()
  validTillStartDate?: string;

  @ApiProperty({
    description: 'End date for filtering by valid till date (YYYY-MM-DD)',
    required: false,
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  validTillEndDate?: string;
}

export class MaxxSubscriptionItemDto {
  @ApiProperty({ example: 123, description: 'Subscription ID' })
  id: number;

  @ApiProperty({ example: 456, description: 'Influencer ID' })
  influencerId: number;

  @ApiProperty({ example: 'Sneha Shah', description: 'Profile name' })
  profileName: string;

  @ApiProperty({ example: '@sneha_s19', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'Navi Mumbai', description: 'Location' })
  location: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'paused', 'cancelled', 'payment_pending', 'payment_failed'],
    description: 'Profile/subscription status',
  })
  profileStatus: string;

  @ApiProperty({ example: 4, description: 'Subscription duration in months' })
  usageMonths: number;

  @ApiProperty({
    example: 'autopay',
    enum: ['monthly', 'autopay'],
    description: 'Payment type',
  })
  paymentType: string;

  @ApiProperty({
    example: '2025-10-02T23:59:00.000Z',
    description: 'Subscription valid till date (IST)',
    nullable: true,
  })
  validTillDate: string | null;

  @ApiProperty({
    example: '2025-06-02T12:00:00.000Z',
    description: 'Subscription start date (IST)',
  })
  subscriptionStartDate: string | null;

  @ApiProperty({
    example: 'https://example.com/profile.jpg',
    description: 'Profile image URL',
    nullable: true,
  })
  profileImage: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether auto-renewal is enabled',
  })
  isAutoRenew: boolean;

  @ApiProperty({
    example: 'sub_MNpJx1234567890',
    description: 'Razorpay subscription ID',
    nullable: true,
  })
  razorpaySubscriptionId: string | null;
}

export class MaxxSubscriptionsResponseDto {
  @ApiProperty({
    description: 'List of Maxx subscriptions',
    type: [MaxxSubscriptionItemDto],
  })
  data: MaxxSubscriptionItemDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 200,
      totalPages: 10,
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
// SUBSCRIPTION DETAILS
// ============================================

export class PaymentHistoryItemDto {
  @ApiProperty({ example: 789, description: 'Invoice ID' })
  invoiceId: number;

  @ApiProperty({ example: 'INV-202509-00123', description: 'Invoice number' })
  invoiceNumber: string;

  @ApiProperty({ example: 199, description: 'Amount in Rs' })
  amount: number;

  @ApiProperty({
    example: '2025-09-02T14:30:00.000Z',
    description: 'Payment date (IST)',
    nullable: true,
  })
  paymentDate: string | null;

  @ApiProperty({
    example: 'paid',
    enum: ['pending', 'paid', 'failed', 'refunded'],
    description: 'Payment status',
  })
  paymentStatus: string;

  @ApiProperty({
    example: 'pay_ABC123',
    description: 'Razorpay payment ID',
    nullable: true,
  })
  razorpayPaymentId: string | null;
}

export class SubscriptionDetailsDto {
  @ApiProperty({ example: 123, description: 'Subscription ID' })
  id: number;

  @ApiProperty({ example: 456, description: 'Influencer ID' })
  influencerId: number;

  @ApiProperty({
    description: 'Influencer details',
    example: {
      id: 456,
      name: 'Sneha Shah',
      username: '@sneha_s19',
      location: 'Navi Mumbai',
      profileImage: 'https://...',
      isVerified: true,
    },
  })
  influencer: {
    id: number;
    name: string;
    username: string;
    location: string;
    profileImage: string | null;
    isVerified: boolean;
  };

  @ApiProperty({
    example: 'active',
    enum: ['active', 'paused', 'expired', 'cancelled', 'payment_pending', 'payment_failed'],
    description: 'Subscription status',
  })
  subscriptionStatus: string;

  @ApiProperty({
    example: 'autopay',
    enum: ['monthly', 'autopay'],
    description: 'Payment type',
  })
  paymentType: string;

  @ApiProperty({
    example: 'sub_MNpJx1234567890',
    description: 'Razorpay subscription ID',
    nullable: true,
  })
  razorpaySubscriptionId: string | null;

  @ApiProperty({
    example: '2025-06-02T12:00:00.000Z',
    description: 'Subscription start date (IST)',
  })
  subscriptionStartDate: string | null;

  @ApiProperty({
    example: '2025-10-02T23:59:00.000Z',
    description: 'Subscription end date (IST)',
    nullable: true,
  })
  subscriptionEndDate: string | null;

  @ApiProperty({ example: 4, description: 'Usage duration in months' })
  usageMonths: number;

  @ApiProperty({ example: 796, description: 'Total amount paid (in Rs)' })
  totalAmount: number;

  @ApiProperty({ example: 199, description: 'Amount per month (in Rs)' })
  amountPerMonth: number;

  @ApiProperty({ example: true, description: 'Auto-renewal enabled' })
  isAutoRenew: boolean;

  @ApiProperty({
    example: '2025-10-02T00:00:00.000Z',
    description: 'Next billing date (IST)',
    nullable: true,
  })
  nextBillingDate: string | null;

  @ApiProperty({
    example: '2025-09-02T14:30:00.000Z',
    description: 'Last payment date (IST)',
    nullable: true,
  })
  lastPaymentDate: string | null;

  @ApiProperty({
    description: 'Payment history',
    type: [PaymentHistoryItemDto],
  })
  paymentHistory: PaymentHistoryItemDto[];

  @ApiProperty({
    example: false,
    description: 'Whether subscription is currently paused',
  })
  isPaused: boolean;

  @ApiProperty({
    example: '2025-06-02T12:00:00.000Z',
    description: 'Subscription creation date (IST)',
  })
  createdAt: string | null;

  @ApiProperty({
    example: '2025-09-02T14:30:00.000Z',
    description: 'Last update date (IST)',
  })
  updatedAt: string | null;
}

// ============================================
// ADMIN ACTIONS
// ============================================

export class PauseSubscriptionDto {
  @ApiProperty({
    description: 'Reason for pausing the subscription',
    example: 'Payment issue - user requested',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Admin notes (internal)',
    example: 'User contacted support about financial constraints',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class ResumeSubscriptionDto {
  @ApiProperty({
    description: 'Admin notes (internal)',
    example: 'Issue resolved, resuming subscription',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class AdminCancelSubscriptionDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Policy violation',
    required: true,
  })
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Admin notes (internal)',
    example: 'Multiple complaints received',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiProperty({
    description: 'Refund amount in Rs',
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refundAmount?: number;

  @ApiProperty({
    description: 'Whether to cancel immediately or at period end',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  immediateEffect?: boolean;
}

export class SubscriptionActionResponseDto {
  @ApiProperty({ example: true, description: 'Whether the action was successful' })
  success: boolean;

  @ApiProperty({ example: 'Subscription paused successfully', description: 'Response message' })
  message: string;

  @ApiProperty({ example: 123, description: 'Subscription ID' })
  subscriptionId: number;

  @ApiProperty({ example: 'paused', description: 'New subscription status' })
  status: string;

  @ApiProperty({
    example: '2025-10-13T10:30:00.000Z',
    description: 'Timestamp of action',
    nullable: true,
  })
  timestamp: Date | null;
}
