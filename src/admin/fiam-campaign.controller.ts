import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import type { RequestWithAdmin } from './guards/admin-auth.guard';
import { FiamCampaignService } from './services/fiam-campaign.service';
import { FiamCampaignBroadcastService } from './services/fiam-campaign-broadcast.service';
import {
  CreateFiamCampaignDto,
  UpdateFiamCampaignDto,
  GetFiamCampaignsDto,
  FiamCampaignResponseDto,
  FiamCampaignListResponseDto,
  CampaignAnalyticsDto,
} from './dto/fiam-campaign.dto';
import { CampaignStatus } from '../shared/models/fiam-campaign.model';

// ============================================================================
// ADMIN CONTROLLER
// ============================================================================

@ApiTags('Admin - FIAM Campaigns')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/fiam-campaigns')
export class FiamCampaignController {
  constructor(
    private readonly fiamCampaignService: FiamCampaignService,
    private readonly fiamCampaignBroadcastService: FiamCampaignBroadcastService,
  ) {}

  // ============================================================================
  // CREATE
  // ============================================================================

  @Post()
  @ApiOperation({
    summary: 'Create new FIAM campaign',
    description: 'Create a new Firebase In-App Messaging campaign with rich UI and targeting',
  })
  @ApiResponse({
    status: 201,
    description: 'Campaign created successfully',
    type: FiamCampaignResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input or validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async createCampaign(
    @Body() dto: CreateFiamCampaignDto,
    @Req() req: RequestWithAdmin,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.createCampaign(dto, req.admin.id);
  }

  // ============================================================================
  // READ
  // ============================================================================

  @Get()
  @ApiOperation({
    summary: 'List all FIAM campaigns',
    description: 'Get paginated list of campaigns with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of campaigns',
    type: FiamCampaignListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getCampaigns(
    @Query() query: GetFiamCampaignsDto,
  ): Promise<FiamCampaignListResponseDto> {
    return this.fiamCampaignService.getCampaigns(query);
  }

  @Get('analytics/summary')
  @ApiOperation({
    summary: 'Get all campaigns analytics summary',
    description: 'Get aggregated analytics across all campaigns',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getAllCampaignsAnalytics(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageConversionRate: number;
    averageClickThroughRate: number;
  }> {
    return this.fiamCampaignService.getAllCampaignsAnalytics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get campaign by ID',
    description: 'Get detailed information about a specific campaign',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign details',
    type: FiamCampaignResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getCampaignById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.getCampaignById(id);
  }

  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get campaign analytics',
    description: 'Get detailed analytics for a specific campaign',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign analytics',
    type: CampaignAnalyticsDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async getCampaignAnalytics(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CampaignAnalyticsDto> {
    return this.fiamCampaignService.getCampaignAnalytics(id);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  @Patch(':id')
  @ApiOperation({
    summary: 'Update campaign',
    description: 'Update campaign configuration',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign updated successfully',
    type: FiamCampaignResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiBadRequestResponse({ description: 'Invalid input or validation error' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async updateCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFiamCampaignDto,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.updateCampaign(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update campaign status',
    description: 'Activate, pause, complete, or expire a campaign',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign status updated successfully',
    type: FiamCampaignResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async updateCampaignStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: CampaignStatus,
  ): Promise<FiamCampaignResponseDto> {
    return this.fiamCampaignService.updateCampaignStatus(id, status);
  }

  // ============================================================================
  // BROADCAST
  // ============================================================================

  @Post(':id/broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Broadcast campaign via FCM',
    description: 'Send campaign to eligible users via Firebase Cloud Messaging push notifications',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Broadcast initiated successfully',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async broadcastCampaign(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{
    success: boolean;
    totalSent: number;
    eligibleUsers: number;
    errors: number;
    message: string;
  }> {
    const result = await this.fiamCampaignBroadcastService.broadcastCampaign(id);
    return {
      ...result,
      message: `Broadcast complete: ${result.totalSent} notifications sent to ${result.eligibleUsers} users`,
    };
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete campaign',
    description: 'Soft delete campaign (marks as completed)',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async deleteCampaign(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.fiamCampaignService.deleteCampaign(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete campaign',
    description: 'Hard delete campaign from database (use with caution)',
  })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign permanently deleted',
  })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated as admin' })
  async permanentlyDeleteCampaign(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.fiamCampaignService.permanentlyDeleteCampaign(id);
  }
}
