import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsEnum, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum LogFilterMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

export enum LogFilterUserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
  ADMIN = 'admin',
  EXTERNAL = 'external',
}

export enum LogFilterStatus {
  SUCCESS = 'success',      // 2xx
  CLIENT_ERROR = 'client_error',  // 4xx
  SERVER_ERROR = 'server_error',  // 5xx
}

export class GetApiActivityLogsDto {
  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, description: 'Items per page (max 200)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ enum: LogFilterMethod, description: 'Filter by HTTP method' })
  @IsOptional()
  @IsEnum(LogFilterMethod)
  method?: LogFilterMethod;

  @ApiPropertyOptional({ description: 'Filter by endpoint (exact match or partial)' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({ enum: LogFilterUserType, description: 'Filter by user type' })
  @IsOptional()
  @IsEnum(LogFilterUserType)
  userType?: LogFilterUserType;

  @ApiPropertyOptional({ description: 'Filter by specific user ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ enum: LogFilterStatus, description: 'Filter by response status category' })
  @IsOptional()
  @IsEnum(LogFilterStatus)
  status?: LogFilterStatus;

  @ApiPropertyOptional({ description: 'Filter by specific status code (e.g., 404, 500)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ description: 'Show only errors (status >= 400)' })
  @IsOptional()
  @Type(() => Boolean)
  errorsOnly?: boolean;

  @ApiPropertyOptional({ description: 'Show only slow requests (> 5s)' })
  @IsOptional()
  @Type(() => Boolean)
  slowOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search in endpoint, error message, or user email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({
    enum: ['created_at', 'response_time_ms'],
    default: 'created_at',
    description: 'Sort field'
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    description: 'Sort direction'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ApiActivityLogStatsDto {
  @ApiPropertyOptional({ description: 'Start date for stats (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for stats (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: LogFilterUserType, description: 'Filter by user type' })
  @IsOptional()
  @IsEnum(LogFilterUserType)
  userType?: LogFilterUserType;
}
