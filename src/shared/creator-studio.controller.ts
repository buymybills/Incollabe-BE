import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreatorStudioService, CreatorType } from './creator-studio.service';
import {
  CreatorStudioStatsRequestDto,
  CreatorStudioStatsResponseDto,
} from '../influencer/dto/creator-studio-stats.dto';
import type { RequestWithUser } from '../types/request.types';

@ApiTags('Creator Studio')
@Controller('creator-studio')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CreatorStudioController {
  constructor(private readonly creatorStudioService: CreatorStudioService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get Creator Studio statistics (Unified for both Influencers & Brands)',
    description:
      'Fetch profile insights and engagement metrics. Works for both influencers and brands based on authentication token.\n\n' +
      '**Profile Insight includes:**\n' +
      '- Profile views in the selected period\n' +
      '- Total posts count\n' +
      '- Total followers count\n' +
      '- Total following count (from Instagram for influencers, from platform for brands)\n' +
      '- Creator rating (0-5)\n\n' +
      '**Engagement Insight includes:**\n' +
      '- Post views in the selected period\n' +
      '- Total interactions (likes + shares) using actual database counts\n\n' +
      'The API automatically detects whether the authenticated user is an influencer or brand and returns appropriate metrics.',
  })
  @ApiQuery({
    name: 'timeFrame',
    required: false,
    enum: ['7_days', '15_days', '30_days'],
    description: 'Time frame for stats calculation (default: 30_days)',
    example: '30_days',
  })
  @ApiResponse({
    status: 200,
    description: 'Creator studio stats retrieved successfully',
    type: CreatorStudioStatsResponseDto,
    schema: {
      example: {
        profileInsight: {
          profileViews: 120000,
          posts: 40,
          followers: 1200,
          following: 1200,
          rating: 4.5,
        },
        engagementInsight: {
          postView: 100000,
          interactions: 100000,
        },
        timeFrame: '30_days',
        dateRange: 'Aug 1 - Sep 1',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Authentication required',
  })
  async getCreatorStudioStats(
    @Req() req: RequestWithUser,
    @Query() query: CreatorStudioStatsRequestDto,
  ): Promise<CreatorStudioStatsResponseDto> {
    const userId = req.user.id;
    const userType = req.user.userType;

    // Map userType to CreatorType
    let creatorType: CreatorType;
    if (userType === 'influencer') {
      creatorType = CreatorType.INFLUENCER;
    } else if (userType === 'brand') {
      creatorType = CreatorType.BRAND;
    } else {
      throw new BadRequestException('Invalid user type. Only influencers and brands can access Creator Studio.');
    }

    return await this.creatorStudioService.getCreatorStudioStats(
      userId,
      creatorType,
      query.timeFrame,
    );
  }
}
