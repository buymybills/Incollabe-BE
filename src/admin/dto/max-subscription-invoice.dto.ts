import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Unified Invoice Type Filter
export enum InvoiceTypeFilter {
  ALL = 'all',
  MAXX_SUBSCRIPTION = 'maxx_subscription',
  INVITE_CAMPAIGN = 'invite_campaign',
  MAXX_CAMPAIGN = 'maxx_campaign',
}

// Unified Statistics Response DTO
export class MaxSubscriptionInvoiceStatisticsDto {
  @ApiProperty({ example: 2000, description: 'Total Maxx purchases (all types)' })
  totalMaxxPurchased: number;

  @ApiProperty({ example: 36.0, description: 'Growth % vs last month' })
  totalMaxxPurchasedGrowth: number;

  @ApiProperty({ example: 100, description: 'Count of Maxx Subscription (Influencer Pro)' })
  maxxSubscription: number;

  @ApiProperty({ example: -2.9, description: 'Growth % vs last month' })
  maxxSubscriptionGrowth: number;

  @ApiProperty({ example: 100, description: 'Count of Invite Campaign purchases' })
  inviteCampaign: number;

  @ApiProperty({ example: -2.9, description: 'Growth % vs last month' })
  inviteCampaignGrowth: number;

  @ApiProperty({ example: 20, description: 'Count of Maxx Campaign purchases' })
  maxxCampaign: number;

  @ApiProperty({ example: -2.9, description: 'Growth % vs last month' })
  maxxCampaignGrowth: number;
}

// Unified Invoice Request DTO
export class GetMaxSubscriptionInvoicesDto {
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
    enum: InvoiceTypeFilter,
    description: 'Filter by invoice type (tab selection)',
  })
  @IsOptional()
  @IsEnum(InvoiceTypeFilter)
  invoiceType?: InvoiceTypeFilter;

  @ApiPropertyOptional({ description: 'Search by name, username, or campaign name' })
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

// Unified Invoice Item DTO
export class MaxSubscriptionInvoiceItemDto {
  @ApiProperty({ example: 1, description: 'Invoice/Subscription ID' })
  id: number;

  @ApiProperty({ example: 'Sneha Shah', description: 'Profile name (Brand or Influencer)' })
  profileName: string;

  @ApiProperty({ example: '@sneha_s19', description: 'Username' })
  username: string;

  @ApiProperty({ example: 'Brand', description: 'Profile type (Brand or Influencer)' })
  profileType: string;

  @ApiProperty({ example: 'Invite Campaign', description: 'Maxx type' })
  maxxType: string;

  @ApiProperty({ example: 499, description: 'Amount paid' })
  amount: number;

  @ApiProperty({ example: '000085752257', description: 'Transaction ID' })
  transactionId: string;

  @ApiProperty({ example: 'UPI Transfer', description: 'Payment method' })
  paymentMethod: string;

  @ApiProperty({ example: '23:59 PM | Oct 02, 2025', description: 'Purchase date and time' })
  purchaseDateTime: string;

  @ApiPropertyOptional({ example: 5, description: 'Campaign ID (only for brand campaigns)' })
  campaignId?: number;

  @ApiPropertyOptional({ example: 'Glow Like Never Before', description: 'Campaign name (only for brand campaigns)' })
  campaignName?: string;
}

// Unified Invoices Response DTO
export class MaxSubscriptionInvoicesResponseDto {
  @ApiProperty({ type: [MaxSubscriptionInvoiceItemDto] })
  data: MaxSubscriptionInvoiceItemDto[];

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
