import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
} from '../../campaign/models/campaign.model';
import {
  CampaignApplication,
  ApplicationStatus,
} from '../../campaign/models/campaign-application.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Niche } from '../../auth/model/niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { CampaignCity } from '../../campaign/models/campaign-city.model';
import { Experience } from '../../influencer/models/experience.model';
import { Follow, FollowingType } from '../../post/models/follow.model';
import { Post, UserType } from '../../post/models/post.model';
import { AIScoringService } from './ai-scoring.service';
import {
  AIScore,
  ScoredApplication,
} from '../interfaces/scored-application.interface';

@Injectable()
export class AdminCampaignService {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(CampaignCity)
    private readonly campaignCityModel: typeof CampaignCity,
    @InjectModel(Experience)
    private readonly experienceModel: typeof Experience,
    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    private readonly aiScoringService: AIScoringService,
  ) {}

  async getCampaignApplicationsWithAI(
    campaignId: number,
    options?: {
      sortBy?: 'relevance' | 'date' | 'engagement' | 'followers';
      filter?: 'all' | 'highly_recommended' | 'recommended' | 'consider';
      page?: number;
      limit?: number;
    },
  ) {
    const {
      sortBy = 'relevance',
      filter = 'all',
      page = 1,
      limit = 50,
    } = options || {};

    // Get campaign details
    const campaign = await this.campaignModel.findByPk(campaignId, {
      include: [
        {
          model: CampaignCity,
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'tier'],
            },
          ],
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Get all applications for this campaign
    const applications = await this.campaignApplicationModel.findAll({
      where: { campaignId },
      include: [
        {
          model: Influencer,
          include: [
            {
              model: Niche,
              as: 'niches',
              attributes: ['id', 'name'],
            },
            {
              model: Country,
              attributes: ['id', 'name', 'code'],
            },
            {
              model: City,
              attributes: ['id', 'name', 'state', 'tier'],
            },
          ],
        },
      ],
    });

    // Calculate AI scores for each application
    const scoredApplications: ScoredApplication[] = await Promise.all(
      applications.map(async (app) =>
        this.calculateAIScore(app, campaign as any),
      ),
    );

    // Apply filters
    let filteredApplications = scoredApplications;
    if (filter !== 'all') {
      filteredApplications = scoredApplications.filter(
        (app) => app.recommendation.toLowerCase().replace(' ', '_') === filter,
      );
    }

    // Sort applications
    filteredApplications = this.sortApplications(filteredApplications, sortBy);

    // Separate top matches (highly recommended)
    const topMatches = filteredApplications.filter(
      (app) => app.recommendation === 'Highly Recommended',
    );
    const otherApplications = filteredApplications.filter(
      (app) => app.recommendation !== 'Highly Recommended',
    );

    // Pagination
    const offset = (page - 1) * limit;
    const paginatedOther = otherApplications.slice(offset, offset + limit);

    return {
      campaignId,
      totalApplications: applications.length,
      topMatches: topMatches.slice(0, 10), // Top 10 matches
      otherApplications: paginatedOther,
      pagination: {
        page,
        limit,
        total: otherApplications.length,
        totalPages: Math.ceil(otherApplications.length / limit),
      },
    };
  }

  private async calculateAIScore(
    application: CampaignApplication,
    campaign: Campaign,
  ): Promise<ScoredApplication> {
    const influencer = application.influencer as Influencer;

    // Get follower count for this influencer
    const followerCount = await this.getFollowerCount(influencer.id);

    // Get post performance data
    const postPerformance = await this.getPostPerformance(influencer.id);

    // Get past campaign performance
    const pastCampaigns = await this.getPastCampaignStats(influencer.id);

    // Get campaign cities
    const campaignCities = await this.getCampaignCities(campaign.id);

    // Get campaign niches
    const campaignNiches = await this.getCampaignNiches(campaign.nicheIds);

    // Prepare data for AI scoring
    const influencerData = {
      id: influencer.id,
      name: influencer.name,
      username: influencer.username,
      followers: followerCount,
      niches: (influencer.niches || []).map((n) => n.name),
      location: influencer.city?.name || 'N/A',
      isVerified: influencer.isVerified || false,
      bio: influencer.bio || '',
      pastCampaigns,
      postPerformance: postPerformance || undefined,
    };

    const campaignData = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      niches: campaignNiches,
      targetCities: campaignCities,
      isPanIndia: campaign.isPanIndia,
      campaignType: campaign.type,
    };

    // Use AI to score the match
    const aiResult = await this.aiScoringService.scoreInfluencerForCampaign(
      influencerData,
      campaignData,
    );

    return {
      applicationId: application.id,
      influencer: {
        id: influencer.id,
        name: influencer.name,
        username: influencer.username,
        profileImage: influencer.profileImage,
        followers: followerCount,
        engagementRate: postPerformance?.engagementRate || 0,
        niches: (influencer.niches || []).map((n) => n.name),
        location: influencer.city?.name || 'N/A',
      },
      aiScore: aiResult.overall,
      recommendation: aiResult.recommendation,
      strengths: aiResult.strengths,
      concerns: aiResult.concerns,
      appliedAt: application.createdAt,
      status: application.status,
      scoreBreakdown: {
        overall: aiResult.overall,
        nicheMatch: aiResult.nicheMatch,
        audienceRelevance: aiResult.audienceRelevance,
        engagementRate: aiResult.engagementRate,
        locationMatch: aiResult.locationMatch,
        pastPerformance: aiResult.pastPerformance,
        contentQuality: aiResult.contentQuality,
      },
    };
  }

  private async getFollowerCount(influencerId: number): Promise<number> {
    return await this.followModel.count({
      where: {
        followingType: FollowingType.INFLUENCER,
        followingInfluencerId: influencerId,
      },
    });
  }

  private async getPostPerformance(influencerId: number): Promise<{
    totalPosts: number;
    averageLikes: number;
    engagementRate: number;
  } | null> {
    const posts = await this.postModel.findAll({
      where: {
        userType: UserType.INFLUENCER,
        influencerId,
        isActive: true,
      },
      attributes: ['likesCount'],
      raw: true,
    });

    if (posts.length === 0) return null;

    const totalLikes = posts.reduce(
      (sum, post: any) => sum + (post.likesCount || 0),
      0,
    );
    const averageLikes = Math.round(totalLikes / posts.length);

    // Get follower count for engagement rate calculation
    const followerCount = await this.getFollowerCount(influencerId);
    const engagementRate =
      followerCount > 0 ? (averageLikes / followerCount) * 100 : 0;

    return {
      totalPosts: posts.length,
      averageLikes,
      engagementRate: Math.round(engagementRate * 100) / 100,
    };
  }

  private async getPastCampaignStats(
    influencerId: number,
  ): Promise<{ total: number; successRate: number }> {
    const experiences = await this.experienceModel.findAll({
      where: { influencerId },
    });

    if (experiences.length === 0) {
      return { total: 0, successRate: 0 };
    }

    const successfulCount = experiences.filter(
      (exp) => exp.successfullyCompleted,
    ).length;
    const successRate = Math.round((successfulCount / experiences.length) * 100);

    return {
      total: experiences.length,
      successRate,
    };
  }

  private async getCampaignCities(campaignId: number): Promise<string[]> {
    const campaignCities = await this.campaignCityModel.findAll({
      where: { campaignId },
      include: [
        {
          model: City,
          attributes: ['name'],
        },
      ],
    });

    return campaignCities.map((cc) => (cc.city as any)?.name || '').filter(Boolean);
  }

  private async getCampaignNiches(nicheIds: number[]): Promise<string[]> {
    if (!nicheIds || nicheIds.length === 0) return [];

    const niches = await this.nicheModel.findAll({
      where: { id: nicheIds },
      attributes: ['name'],
    });

    return niches.map((n) => n.name);
  }

  private sortApplications(
    applications: ScoredApplication[],
    sortBy: string,
  ): ScoredApplication[] {
    switch (sortBy) {
      case 'relevance':
        return applications.sort((a, b) => b.aiScore - a.aiScore);
      case 'date':
        return applications.sort(
          (a, b) => b.appliedAt.getTime() - a.appliedAt.getTime(),
        );
      case 'engagement':
        return applications.sort(
          (a, b) => b.influencer.engagementRate - a.influencer.engagementRate,
        );
      case 'followers':
        return applications.sort(
          (a, b) => b.influencer.followers - a.influencer.followers,
        );
      default:
        return applications;
    }
  }
}
