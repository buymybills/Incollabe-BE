import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ required: false, example: 'john', description: 'Search by name or username' })
  @IsOptional()
  @IsString()
  search?: string;
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

class SetUserStatusBody {
  @ApiProperty({ enum: ['activate', 'suspend'], example: 'activate' })
  @IsIn(['activate', 'suspend'])
  action: 'activate' | 'suspend';
}

@ApiTags('Admin - Reports')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/reports')
export class AdminReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'Get all reported users with report counts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or username' })
  @ApiResponse({
    status: 200,
    description: 'Reported users list',
    schema: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userType: { type: 'string', example: 'influencer' },
              name: { type: 'string' },
              username: { type: 'string' },
              profileImage: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
              isSuspended: { type: 'boolean' },
              reportCount: { type: 'number' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  getAllReportedUsers(@Query() query: GetReportedUsersQuery) {
    return this.reportService.getAllReportedUsers(query.page, query.limit, query.search);
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
              description: { type: 'string', nullable: true },
              isOverruled: { type: 'boolean' },
              overruledAt: { type: 'string', nullable: true },
              reportedAt: { type: 'string', example: '2026-04-28T10:00:00Z' },
              reporter: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                  username: { type: 'string' },
                  profileImage: { type: 'string', nullable: true },
                  userType: { type: 'string', example: 'influencer' },
                },
              },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  getReportsAgainstUser(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: GetReportsQuery,
  ) {
    const userType = type as 'influencer' | 'brand';
    return this.reportService.getReportsAgainstUser(id, userType, query.page, query.limit);
  }

  @Patch(':type/:id/status')
  @ApiOperation({ summary: 'Activate or suspend a reported user' })
  @ApiParam({ name: 'type', enum: ['influencer', 'brand'], description: 'User type' })
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiBody({ type: SetUserStatusBody })
  @ApiResponse({ status: 200, description: 'User status updated', schema: { type: 'object', properties: { message: { type: 'string' } } } })
  setUserStatus(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetUserStatusBody,
  ) {
    const userType = type as 'influencer' | 'brand';
    return this.reportService.setUserStatus(id, userType, body.action);
  }
}
