import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { InfluencerProfileScoringService } from '../services/influencer-profile-scoring.service';
import { AuthGuard } from '../../auth/guards/auth.guard';

@Controller('influencer/profile-score')
@UseGuards(AuthGuard)
export class InfluencerProfileScoringController {
  constructor(
    private readonly profileScoringService: InfluencerProfileScoringService,
  ) {}

  /**
   * MASTER API: Get complete profile score with all 6 categories
   * GET /influencer/profile-score/:influencerId
   */
  @Get(':influencerId')
  async getCompleteProfileScore(@Param('influencerId', ParseIntPipe) influencerId: number) {
    return this.profileScoringService.getCompleteProfileScore(influencerId);
  }

  /**
   * API 1: Get Audience Quality score (10 points)
   * GET /influencer/profile-score/:influencerId/audience-quality
   */
  @Get(':influencerId/audience-quality')
  async getAudienceQuality(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateAudienceQuality(influencer);
  }

  /**
   * API 2: Get Content Relevance score (10 points)
   * GET /influencer/profile-score/:influencerId/content-relevance
   */
  @Get(':influencerId/content-relevance')
  async getContentRelevance(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateContentRelevance(influencer);
  }

  /**
   * API 3: Get Content Quality score (10 points)
   * GET /influencer/profile-score/:influencerId/content-quality
   */
  @Get(':influencerId/content-quality')
  async getContentQuality(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateContentQuality(influencer);
  }

  /**
   * API 4: Get Engagement Strength score (10 points)
   * GET /influencer/profile-score/:influencerId/engagement-strength
   */
  @Get(':influencerId/engagement-strength')
  async getEngagementStrength(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateEngagementStrength(influencer);
  }

  /**
   * API 5: Get Growth Momentum score (10 points)
   * GET /influencer/profile-score/:influencerId/growth-momentum
   */
  @Get(':influencerId/growth-momentum')
  async getGrowthMomentum(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateGrowthMomentum(influencer);
  }

  /**
   * API 6: Get Monetisation score (10 points)
   * GET /influencer/profile-score/:influencerId/monetisation
   */
  @Get(':influencerId/monetisation')
  async getMonetisation(@Param('influencerId', ParseIntPipe) influencerId: number) {
    const influencer = await this.profileScoringService['influencerModel'].findByPk(influencerId);
    if (!influencer) {
      throw new Error(`Influencer with ID ${influencerId} not found`);
    }
    return this.profileScoringService.calculateMonetisation(influencer);
  }
}
