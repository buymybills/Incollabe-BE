import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ReportService } from '../../shared/services/report.service';

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

  @Get(':type/:id')
  @ApiOperation({ summary: 'Get all reports filed against a user' })
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
    const userType = type as 'influencer' | 'brand';
    return this.reportService.getReportsAgainstUser(id, userType, query.page, query.limit);
  }
}
