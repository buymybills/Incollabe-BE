import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TicketStatus,
  UserType,
  ReportType,
} from '../models/support-ticket.model';

// Enum for sortable fields
export enum SortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  STATUS = 'status',
  REPORT_TYPE = 'reportType',
}

// Enum for sort order
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class GetSupportTicketsDto {
  @ApiPropertyOptional({
    description:
      'Filter by ticket status (unresolved, in_progress, resolved, closed)',
    enum: TicketStatus,
    example: TicketStatus.UNRESOLVED,
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    description:
      'Filter by report type (technical_issue, account_issue, payment_issue, etc.)',
    enum: ReportType,
    example: ReportType.TECHNICAL_ISSUE,
  })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @ApiPropertyOptional({
    description: 'Filter by user type who created the ticket (influencer/brand)',
    enum: UserType,
    example: UserType.INFLUENCER,
  })
  @IsEnum(UserType)
  @IsOptional()
  userType?: UserType;

  @ApiPropertyOptional({
    description:
      'Search across subject, description, reporter name, and username (case-insensitive, partial match)',
    example: 'payment issue',
  })
  @IsString()
  @IsOptional()
  searchQuery?: string;

  @ApiPropertyOptional({
    description:
      "Filter by reporter's profile name (case-insensitive, partial match)",
    example: 'Sneha',
  })
  @IsString()
  @IsOptional()
  profileName?: string;

  @ApiPropertyOptional({
    description:
      "Filter by reporter's username (case-insensitive, partial match)",
    example: 'sneha_s19',
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    description:
      'Filter tickets created from this date onwards (ISO 8601 format: YYYY-MM-DD or full timestamp)',
    example: '2025-09-01',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'Filter tickets created until this date (ISO 8601 format: YYYY-MM-DD or full timestamp)',
    example: '2025-10-31',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Field to sort by (createdAt, updatedAt, status, reportType)',
    enum: SortBy,
    example: SortBy.CREATED_AT,
    default: SortBy.CREATED_AT,
  })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy = SortBy.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order (ASC for ascending, DESC for descending)',
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC,
  })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max: 100)',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
