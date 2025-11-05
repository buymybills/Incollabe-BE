import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditSection, AuditActionType } from '../models/audit-log.model';

export class GetAuditLogsDto {
  @ApiProperty({
    description: 'Filter by audit section',
    enum: AuditSection,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuditSection)
  section?: AuditSection;

  @ApiProperty({
    description: 'Filter by action type',
    enum: AuditActionType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuditActionType)
  actionType?: AuditActionType;

  @ApiProperty({
    description: 'Filter by admin/employee ID',
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  adminId?: number;

  @ApiProperty({
    description: 'Filter by target type (e.g., campaign, brand, influencer)',
    required: false,
  })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiProperty({
    description: 'Filter by target ID',
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetId?: number;

  @ApiProperty({
    description: 'Filter by start date (ISO format)',
    required: false,
    example: '2025-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Filter by end date (ISO format)',
    required: false,
    example: '2025-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Search in admin name, email, or details',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Page number',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class AuditLogResponseDto {
  @ApiProperty({ description: 'Audit log ID' })
  id: number;

  @ApiProperty({ description: 'Admin/employee name' })
  adminName: string;

  @ApiProperty({ description: 'Admin/employee email' })
  adminEmail: string;

  @ApiProperty({ description: 'Audit section', enum: AuditSection })
  section: AuditSection;

  @ApiProperty({ description: 'Action type', enum: AuditActionType })
  actionType: AuditActionType;

  @ApiProperty({ description: 'Action details', required: false })
  details?: string;

  @ApiProperty({ description: 'Target entity type', required: false })
  targetType?: string;

  @ApiProperty({ description: 'Target entity ID', required: false })
  targetId?: number;

  @ApiProperty({ description: 'IP address', required: false })
  ipAddress?: string;

  @ApiProperty({ description: 'User agent', required: false })
  userAgent?: string;

  @ApiProperty({ description: 'Timestamp' })
  createdAt: Date;
}

export class AuditLogListResponseDto {
  @ApiProperty({ description: 'List of audit logs', type: [AuditLogResponseDto] })
  logs: AuditLogResponseDto[];

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of audit logs' })
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Total number of admin users' })
  totalAdminUsers?: number;
}

export interface CreateAuditLogDto {
  adminId: number;
  adminName: string;
  adminEmail: string;
  section: AuditSection;
  actionType: AuditActionType;
  details?: string;
  targetType?: string;
  targetId?: number;
  ipAddress?: string;
  userAgent?: string;
}
