import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { IsIn, IsInt, IsPositive, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { HybridAuthGuard } from '../../auth/guards/hybrid-auth.guard';
import { ReportService } from '../services/report.service';
import { ReportReason } from '../models/reported-user.model';
import type { RequestWithUser } from '../../types/request.types';

class ReportUserDto {
  @ApiProperty({ description: 'ID of the user to report', example: 42 })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  reportedId: number;

  @ApiProperty({
    description: 'Type of the user to report',
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
  @IsIn(['influencer', 'brand'])
  reportedType: 'influencer' | 'brand';

  @ApiProperty({
    description: 'Reason for reporting',
    enum: ReportReason,
    example: ReportReason.SPAM,
  })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiProperty({
    description: 'Optional description',
    example: 'This user is sending spam messages',
    required: false,
  })
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

@ApiTags('Report')
@ApiBearerAuth()
@UseGuards(HybridAuthGuard)
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Report a user' })
  @ApiBody({ type: ReportUserDto })
  @ApiResponse({
    status: 201,
    description: 'User reported successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User reported successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot report yourself or already reported' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async reportUser(@Req() req: RequestWithUser, @Body() body: ReportUserDto) {
    return this.reportService.reportUser(
      req.user.id,
      req.user.userType as 'influencer' | 'brand',
      body.reportedId,
      body.reportedType,
      body.reason,
      body.description,
    );
  }
}
