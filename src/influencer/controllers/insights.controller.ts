import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsightsService } from '../services/insights.service';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('Influencer - Insights')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('influencer/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Top-level 4-metric summary' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  getSummary(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.insightsService.getSummary(req.user.id, period, dateFrom, dateTo);
  }

  @Get('views')
  @ApiOperation({ summary: 'Views breakdown with audience data' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  getViews(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.insightsService.getViewsInsights(req.user.id, period, dateFrom, dateTo);
  }

  @Get('followers')
  @ApiOperation({ summary: 'Followers breakdown with trends' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  getFollowers(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.insightsService.getFollowersInsights(req.user.id, period, dateFrom, dateTo);
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Earnings breakdown with top products' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  getEarnings(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.insightsService.getEarningsInsights(req.user.id, period, dateFrom, dateTo);
  }

  @Get('products')
  @ApiOperation({ summary: 'Products listed with per-reel stats' })
  getProducts(@Req() req: any) {
    return this.insightsService.getProductsInsights(req.user.id);
  }

  @Get('hype/:postId')
  @ApiOperation({ summary: 'Single HYPE reel full insights' })
  async getReelInsights(
    @Req() req: any,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    const result = await this.insightsService.getReelInsights(req.user.id, postId);
    if (!result) throw new NotFoundException('HYPE reel not found');
    return result;
  }
}
