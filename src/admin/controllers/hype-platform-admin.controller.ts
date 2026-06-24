import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { HypePlatformAdminService } from '../services/hype-platform-admin.service';

@ApiTags('Admin - HYPE Platform')
@Controller('admin')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class HypePlatformAdminController {
  constructor(private readonly hypePlatformAdminService: HypePlatformAdminService) {}

  @Get('hype-influencers')
  @ApiOperation({ summary: 'List HYPE influencers with level, reels, and earnings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'HYPE influencers list' })
  async listHypeInfluencers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.hypePlatformAdminService.listHypeInfluencers(+page, +limit, search);
  }

  @Patch('hype-influencers/:id/level')
  @ApiOperation({ summary: 'Manually override influencer HYPE level' })
  @ApiParam({ name: 'id', type: Number, description: 'Influencer ID' })
  @ApiResponse({ status: 200, description: 'Level updated successfully' })
  @ApiResponse({ status: 404, description: 'HYPE influencer not found' })
  async updateHypeInfluencerLevel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { level: number },
  ) {
    return this.hypePlatformAdminService.updateHypeInfluencerLevel(id, body.level);
  }

  @Get('hype-reels')
  @ApiOperation({ summary: 'List HYPE reels for moderation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'all'] })
  @ApiResponse({ status: 200, description: 'HYPE reels list' })
  async listHypeReels(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.hypePlatformAdminService.listHypeReels(+page, +limit, status);
  }

  @Patch('hype-reels/:id/status')
  @ApiOperation({ summary: 'Approve, reject, or flag a HYPE reel' })
  @ApiParam({ name: 'id', type: Number, description: 'Post ID' })
  @ApiResponse({ status: 200, description: 'Reel status updated' })
  @ApiResponse({ status: 404, description: 'HYPE reel not found' })
  async updateHypeReelStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: 'approve' | 'reject' | 'flag' },
  ) {
    return this.hypePlatformAdminService.updateHypeReelStatus(id, body.action);
  }

  @Get('affiliate-payouts')
  @ApiOperation({ summary: 'List pending affiliate payout requests' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Pending affiliate payouts' })
  async listAffiliatePendingPayouts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.hypePlatformAdminService.listAffiliatePendingPayouts(+page, +limit);
  }

  @Patch('affiliate-payouts/:id/process')
  @ApiOperation({ summary: 'Mark affiliate payout as processed or failed' })
  @ApiParam({ name: 'id', type: Number, description: 'Affiliate earning ID' })
  @ApiResponse({ status: 200, description: 'Payout processed' })
  @ApiResponse({ status: 404, description: 'Affiliate earning not found' })
  async processAffiliatePayout(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: 'processed' | 'failed' },
  ) {
    return this.hypePlatformAdminService.processAffiliatePayout(id, body.action);
  }
}
