import { Controller, Get, Param, ParseIntPipe, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { InfluencerProfileScoringService } from '../services/influencer-profile-scoring.service';
import { AuthGuard } from '../../auth/guards/auth.guard';

@ApiTags('Influencer Profile Scoring')
@Controller('influencer/profile-score')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InfluencerProfileScoringController {
  constructor(
    private readonly profileScoringService: InfluencerProfileScoringService,
  ) {}

  /**
   * MASTER API: Get complete profile score with all 6 categories
   * GET /influencer/profile-score/:influencerId
   */
  @Get(':influencerId')
  @ApiOperation({
    summary: 'Get complete profile score (MASTER API)',
    description: 'Returns overall profile score (out of 60) with all 6 category breakdowns: Audience Quality, Content Relevance, Content Quality, Engagement Strength, Growth Momentum, and Monetisation. Use this as the primary endpoint for influencer profile scoring.'
  })
  @ApiParam({
    name: 'influencerId',
    type: 'number',
    description: 'The influencer ID',
    example: 123
  })
  @ApiResponse({
    status: 200,
    description: 'Profile score retrieved successfully',
    schema: {
      example: {
        influencerId: 123,
        totalScore: 47.5,
        maxScore: 60,
        percentage: 79.2,
        grade: 'B+',
        lastSyncDate: '2025-01-21T10:30:00Z',
        categories: [
          {
            name: 'Audience Quality',
            score: 8.5,
            maxScore: 10,
            percentage: 85,
            breakdown: {}
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Influencer not found'
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token'
  })
  async getCompleteProfileScore(@Param('influencerId', ParseIntPipe) influencerId: number) {
    return this.profileScoringService.getCompleteProfileScore(influencerId);
  }

  /**
   * API 1: Get Audience Quality score (10 points)
   * GET /influencer/profile-score/:influencerId/audience-quality
   */
  @Get(':influencerId/audience-quality')
  @ApiOperation({
    summary: 'Get Audience Quality score (10 points)',
    description: 'Evaluates audience quality based on follower count, engagement rate, active followers percentage, growth rate, and genuine interactions.'
  })
  @ApiParam({
    name: 'influencerId',
    type: 'number',
    description: 'The influencer ID'
  })
  @ApiResponse({
    status: 200,
    description: 'Audience quality score retrieved',
    schema: {
      example: {
        category: 'Audience Quality',
        score: 8.5,
        maxScore: 10,
        percentage: 85,
        breakdown: {
          followerCount: { score: 2.0, value: 15000 },
          engagementRate: { score: 2.5, value: 4.2 },
          activeFollowers: { score: 2.0, percentage: 65 },
          audienceGrowth: { score: 1.5, growth: 12 },
          genuineInteractions: { score: 0.5 }
        }
      }
    }
  })
  async getAudienceQuality(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateAudienceQuality(influencer);
  }

  /**
   * API 2: Get Content Relevance score (10 points)
   * GET /influencer/profile-score/:influencerId/content-relevance
   */
  @Get(':influencerId/content-relevance')
  @ApiOperation({
    summary: 'Get Content Relevance score (10 points)',
    description: 'Measures content relevance based on niche consistency, trending topics usage, hashtag effectiveness, target audience alignment, and seasonal awareness.'
  })
  @ApiParam({ name: 'influencerId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Content relevance score retrieved' })
  async getContentRelevance(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateContentRelevance(influencer);
  }

  /**
   * API 3: Get Content Quality score (10 points)
   * GET /influencer/profile-score/:influencerId/content-quality
   */
  @Get(':influencerId/content-quality')
  @ApiOperation({
    summary: 'Get Content Quality score (10 points)',
    description: 'Assesses content quality using AI analysis: visual aesthetics, caption quality, production value, faceless content appeal, and storytelling ability.'
  })
  @ApiParam({ name: 'influencerId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Content quality score retrieved' })
  async getContentQuality(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateContentQuality(influencer);
  }

  /**
   * API 4: Get Engagement Strength score (10 points)
   * GET /influencer/profile-score/:influencerId/engagement-strength
   */
  @Get(':influencerId/engagement-strength')
  @ApiOperation({
    summary: 'Get Engagement Strength score (10 points)',
    description: 'Evaluates engagement patterns: likes-to-followers ratio, comments quality, saves rate, shares count, and video completion rates.'
  })
  @ApiParam({ name: 'influencerId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Engagement strength score retrieved' })
  async getEngagementStrength(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateEngagementStrength(influencer);
  }

  /**
   * API 5: Get Growth Momentum score (10 points)
   * GET /influencer/profile-score/:influencerId/growth-momentum
   */
  @Get(':influencerId/growth-momentum')
  @ApiOperation({
    summary: 'Get Growth Momentum score (10 points)',
    description: 'Tracks growth trends: follower growth rate, engagement growth, posting consistency, reach expansion, and performance trajectory over 30-90 days.'
  })
  @ApiParam({ name: 'influencerId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Growth momentum score retrieved' })
  async getGrowthMomentum(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateGrowthMomentum(influencer);
  }

  /**
   * API 6: Get Monetisation score (10 points)
   * GET /influencer/profile-score/:influencerId/monetisation
   */
  @Get(':influencerId/monetisation')
  @ApiOperation({
    summary: 'Get Monetisation score (10 points)',
    description: 'Assesses monetisation readiness: brand collaboration history, sponsored content performance, audience trust, CTA effectiveness, and commercial appeal.'
  })
  @ApiParam({ name: 'influencerId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Monetisation score retrieved' })
  async getMonetisation(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateMonetisation(influencer);
  }
}
