import { Controller, Get, Patch, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiProperty,
  ApiBody,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, IsOptional, Min, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ReportService } from '../../shared/services/report.service';

class GetReportedUsersQuery {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ required: false, enum: ['influencer', 'brand'], description: 'Filter by user type' })
  @IsOptional()
  @IsIn(['influencer', 'brand'])
  type?: 'influencer' | 'brand';

  @ApiProperty({ required: false, example: 'john', description: 'Search by name or username' })
  @IsOptional()
  @IsString()
  search?: string;
}

class SetUserStatusBody {
  @ApiProperty({ enum: ['activate', 'suspend'], description: 'Action to perform on the user' })
  @IsNotEmpty()
  @IsIn(['activate', 'suspend'])
  action: 'activate' | 'suspend';
}

class GetReportsQuery {
  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ required: false, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

@ApiTags('Admin - Reports')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/reports')
export class AdminReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reported users with report count' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ['influencer', 'brand'] })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or username' })
  @ApiResponse({
    status: 200,
    description: 'Reported users list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        reportedUsers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              reportedUser: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 42 },
                  name: { type: 'string', example: 'John Doe' },
                  username: { type: 'string', example: 'john_doe' },
                  profileImage: { type: 'string', nullable: true },
                  isActive: { type: 'boolean', example: true },
                  userType: { type: 'string', example: 'influencer' },
                },
              },
              reportCount: { type: 'number', example: 3 },
              lastReportedAt: { type: 'string', example: '2026-04-28T10:00:00Z' },
            },
          },
        },
        total: { type: 'number', example: 10 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 1 },
      },
    },
  })
  getAllReportedUsers(@Query() query: GetReportedUsersQuery) {
    return this.reportService.getAllReportedUsers(query.page, query.limit, query.type, query.search);
  }

  @Get(':type/:id')
  @ApiOperation({ summary: 'Get all reports filed against a specific user' })
  @ApiParam({ name: 'type', enum: ['influencer', 'brand'], description: 'User type' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        reports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              reportId: { type: 'number', example: 1 },
              reason: { type: 'string', example: 'spam' },
              description: { type: 'string', nullable: true, example: 'Kept sending unsolicited messages' },
              reportedAt: { type: 'string', example: '2026-04-28T10:00:00Z' },
              reporter: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 42 },
                  name: { type: 'string', example: 'Jane Doe' },
                  username: { type: 'string', example: 'jane_doe' },
                  profileImage: { type: 'string', nullable: true },
                  userType: { type: 'string', example: 'influencer' },
                },
              },
            },
          },
        },
        total: { type: 'number', example: 3 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 1 },
      },
    },
  })
  getReportsAgainstUser(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetReportsQuery,
  ) {
    return this.reportService.getReportsAgainstUser(id, type as 'influencer' | 'brand', query.page, query.limit);
  }

  @Patch(':type/:id/status')
  @ApiOperation({ summary: 'Activate or suspend a user account' })
  @ApiParam({ name: 'type', enum: ['influencer', 'brand'], description: 'User type' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiBody({ type: SetUserStatusBody })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User activated successfully' },
      },
    },
  })
  setUserStatus(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetUserStatusBody,
  ) {
    return this.reportService.setUserStatus(id, type as 'influencer' | 'brand', body.action);
  }
}
