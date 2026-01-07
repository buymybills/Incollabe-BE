import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum MaxPurchaseTypeFilter {
  ALL = 'all',
  INVITE_CAMPAIGN = 'invite_campaign',
  MAXX_CAMPAIGN = 'maxx_campaign',
}

export enum MaxCampaignStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
}

// Statistics Response DTO
export class MaxSubscriptionBrandStatisticsDto {
  @ApiProperty({ example: 200, description: 'Total Max Campaign profiles purchased' })
  totalMaxxProfile: number;

  @ApiProperty({ example: 36.0, description: 'Growth % vs last month' })
  totalMaxxProfileGrowth: number;

  @ApiProperty({ example: 100, description: 'Currently active Max Campaign profiles' })
  activeMaxxProfiles: number;

  @ApiProperty({ example: -2.9, description: 'Growth % vs last month' })
  activeMaxxProfilesGrowth: number;

  @ApiProperty({ example: 100, description: 'Inactive Max Campaign profiles' })
  inactiveMaxxProfiles: number;

  @ApiProperty({ example: -2.9, description: 'Growth % vs last month' })
  inactiveMaxxProfilesGrowth: number;

  @ApiProperty({ example: 20, description: 'Cancelled subscriptions' })
  subscriptionCancelled: number;

  @ApiProperty({ example: -2.9, description: 'Growth % vs last month' })
  subscriptionCancelledGrowth: number;
}

// Get Max Purchases DTO
export class GetMaxPurchasesDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: MaxPurchaseTypeFilter,
    description: 'Filter by purchase type (tab selection)',
  })
  @IsOptional()
  @IsEnum(MaxPurchaseTypeFilter)
  purchaseType?: MaxPurchaseTypeFilter;

  @ApiPropertyOptional({
    enum: MaxCampaignStatusFilter,
    description: 'Filter by campaign status',
  })
  @IsOptional()
  @IsEnum(MaxCampaignStatusFilter)
  status?: MaxCampaignStatusFilter;

  @ApiPropertyOptional({ description: 'Search by brand name, username, or campaign name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by payment method' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    enum: ['createdAt', 'amount'],
    description: 'Sort field',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    description: 'Sort order',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// Max Purchase Item DTO
export class MaxPurchaseItemDto {
  @ApiProperty({ example: 1, description: 'Invoice ID' })
  id: number;

  @ApiProperty({ example: 5, description: 'Campaign ID' })
  campaignId: number;

  @ApiProperty({ example: 'Sneha Shah', description: 'Brand name' })
  brandName: string;

  @ApiProperty({ example: '@sneha_s19', description: 'Brand username' })
  username: string;

  @ApiProperty({ example: 'Glow Like Never Before', description: 'Campaign name' })
  campaignName: string;

  @ApiProperty({ example: 'Invite Campaign', description: 'Max campaign type' })
  maxxType: string;

  @ApiProperty({ example: 499, description: 'Amount paid' })
  amount: number;

  @ApiProperty({ example: '23:59 PM | Oct 02, 2025', description: 'Purchase date and time' })
  purchaseDateTime: string;

  @ApiProperty({ example: 'active', description: 'Campaign status' })
  status: string;

  @ApiProperty({ example: 'INV-202510-00123', description: 'Invoice number' })
  invoiceNumber: string;

  @ApiProperty({ example: 'razorpay', description: 'Payment method' })
  paymentMethod: string;
}

// Max Purchases Response DTO
export class MaxPurchasesResponseDto {
  @ApiProperty({ type: [MaxPurchaseItemDto] })
  data: MaxPurchaseItemDto[];

  @ApiProperty({
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
