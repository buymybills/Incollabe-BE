import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsInt,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, UserType, ReportType } from '../models/support-ticket.model';

export class GetSupportTicketsDto {
  @ApiPropertyOptional({
    description: 'Filter by ticket status',
    enum: TicketStatus,
    example: TicketStatus.UNRESOLVED,
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    description: 'Filter by report type',
    enum: ReportType,
    example: ReportType.TECHNICAL_ISSUE,
  })
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @ApiPropertyOptional({
    description: 'Filter by user type (who created the ticket)',
    enum: UserType,
    example: UserType.INFLUENCER,
  })
  @IsEnum(UserType)
  @IsOptional()
  userType?: UserType;

  @ApiPropertyOptional({
    description: 'Search in subject and description',
    example: 'payment',
  })
  @IsString()
  @IsOptional()
  searchQuery?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
