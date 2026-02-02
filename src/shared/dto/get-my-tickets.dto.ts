import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, ReportType } from '../models/support-ticket.model';

export class GetMyTicketsDto {
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
    description:
      'Search in ticket subject and description (case-insensitive, partial match)',
    example: 'payment issue',
  })
  @IsString()
  @IsOptional()
  searchQuery?: string;

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
