import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import { FiamCampaignMobileService } from './services/fiam-campaign-mobile.service';
import {
  GetEligibleCampaignsDto,
  GetEligibleCampaignsResponseDto,
  TrackCampaignEventDto,
  TrackCampaignEventResponseDto,
} from './dto/fiam-campaign-mobile.dto';

// Request interface with user
interface RequestWithUser extends Request {
  user: {
    id: number;
    profileCompleted: boolean;
    userType: string;
    email?: string;
    username?: string;
    isExternal?: boolean;
    externalAppId?: string;
  };
}

// ============================================================================
// MOBILE CONTROLLER
// ============================================================================

@ApiTags('FIAM Campaigns (Mobile)')
@ApiBearerAuth()
@UseGuards(HybridAuthGuard)
@Controller('fiam/campaigns')
export class FiamCampaignMobileController {
  constructor(
    private readonly fiamCampaignMobileService: FiamCampaignMobileService,
  ) {}

  // ============================================================================
  // GET ELIGIBLE CAMPAIGNS
  // ============================================================================

  @Get('eligible')
  @ApiOperation({
    summary: 'Get eligible campaigns for current user',
    description:
      'Fetch campaigns eligible for display based on trigger event and user targeting',
  })
  @ApiResponse({
    status: 200,
    description: 'List of eligible campaigns sorted by priority',
    type: GetEligibleCampaignsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getEligibleCampaigns(
    @Query() dto: GetEligibleCampaignsDto,
    @Req() req: RequestWithUser,
  ): Promise<GetEligibleCampaignsResponseDto> {
    const userId = req.user.id;
    const userType = req.user.userType as 'influencer' | 'brand';

    return this.fiamCampaignMobileService.getEligibleCampaigns(
      dto,
      userId,
      userType,
    );
  }

  // ============================================================================
  // TRACK EVENTS
  // ============================================================================

  @Post(':campaignId/events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track campaign event',
    description:
      'Track user interaction with campaign (impression, click, dismiss, conversion)',
  })
  @ApiParam({ name: 'campaignId', description: 'Campaign ID' })
  @ApiResponse({
    status: 200,
    description: 'Event tracked successfully',
    type: TrackCampaignEventResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async trackCampaignEvent(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: TrackCampaignEventDto,
    @Req() req: RequestWithUser,
  ): Promise<TrackCampaignEventResponseDto> {
    const userId = req.user.id;
    const userType = req.user.userType as 'influencer' | 'brand';

    return this.fiamCampaignMobileService.trackCampaignEvent(
      campaignId,
      dto,
      userId,
      userType,
    );
  }
}
