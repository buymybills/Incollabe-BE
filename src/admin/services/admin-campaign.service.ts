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

  // Transform campaign response to match API requirements
  private transformCampaignResponse(campaignData: any): any {
    const response: any = {
      ...campaignData,
      deliverables: campaignData.deliverableFormat,
      collaborationCost: campaignData.deliverables,
    };
    delete response.deliverableFormat;
    return response;
  }

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
    const influencer = application.influencer;

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
    const successRate = Math.round(
      (successfulCount / experiences.length) * 100,
    );

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

    return campaignCities
      .map((cc) => (cc.city as any)?.name || '')
      .filter(Boolean);
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

  /**
   * Get campaigns with various filters similar to influencers/brands
   */
  async getCampaigns(filters: any): Promise<any> {
    const {
      campaignFilter,
      statusFilter,
      searchQuery,
      brandSearch,
      locationSearch,
      campaignType,
      sortBy = 'createdAt',
      page = 1,
      limit = 20,
    } = filters;

    // Build base where conditions
    const whereConditions: any = {};

    // Apply campaign filter (invite type: all, open, invite-only)
    switch (campaignFilter) {
      case 'openCampaigns':
        whereConditions.isInviteOnly = false;
        break;
      case 'inviteCampaigns':
        whereConditions.isInviteOnly = true;
        break;
      case 'allCampaigns':
      default:
        // No invite filter for all campaigns
        break;
    }

    // Apply status filter (active, draft, completed, paused, cancelled)
    if (statusFilter) {
      whereConditions.status = statusFilter;
    }

    // Apply campaign name search
    if (searchQuery && searchQuery.trim()) {
      whereConditions.name = { [Op.iLike]: `%${searchQuery.trim()}%` };
    }

    // Apply campaign type filter
    if (campaignType) {
      whereConditions.type = campaignType;
    }

    // Note: Budget filters removed as Campaign model doesn't have budget field
    // minBudget and maxBudget parameters kept for future use

    // Build include for brand search
    const brandInclude: any = {
      association: 'brand',
      attributes: ['id', 'brandName', 'username'],
    };
    if (brandSearch && brandSearch.trim()) {
      brandInclude.where = {
        [Op.or]: [
          { brandName: { [Op.iLike]: `%${brandSearch.trim()}%` } },
          { username: { [Op.iLike]: `%${brandSearch.trim()}%` } },
        ],
      };
      brandInclude.required = true;
    }

    // Build include for cities (via CampaignCity join table)
    const cityInclude: any = {
      model: CampaignCity,
      as: 'cities',
      required: false,
      include: [
        {
          model: City,
          as: 'city',
          attributes: ['id', 'name'],
        },
      ],
    };
    if (locationSearch && locationSearch.trim()) {
      cityInclude.include[0].where = {
        name: { [Op.iLike]: `%${locationSearch.trim()}%` },
      };
      cityInclude.required = true;
    }

    // Determine sort order
    let order: any = [['createdAt', 'DESC']];
    switch (sortBy) {
      case 'createdAt':
        order = [['createdAt', 'DESC']];
        break;
      case 'title':
        order = [['name', 'ASC']];
        break;
      case 'applications':
        // Will sort in application code after counting applications
        order = [['createdAt', 'DESC']];
        break;
      // Note: budget, startDate, endDate sorts removed as Campaign model doesn't have these fields
      default:
        order = [['createdAt', 'DESC']];
        break;
    }

    // Fetch campaigns with pagination
    const { rows: campaigns, count: total } =
      await this.campaignModel.findAndCountAll({
        where: whereConditions,
        include: [brandInclude, cityInclude],
        order,
        limit,
        offset: (page - 1) * limit,
        distinct: true,
      });

    // Enrich campaigns with application counts and other metrics
    const enrichedCampaigns = await Promise.all(
      campaigns.map(async (campaign) => {
        const applicationsCount = await this.campaignApplicationModel.count({
          where: { campaignId: campaign.id },
        });

        const selectedCount = await this.campaignApplicationModel.count({
          where: {
            campaignId: campaign.id,
            status: ApplicationStatus.SELECTED,
          },
        });

        // Fetch niche names based on nicheIds
        let nicheNames: string[] = [];
        if (campaign.nicheIds && campaign.nicheIds.length > 0) {
          const niches = await this.nicheModel.findAll({
            where: {
              id: { [Op.in]: campaign.nicheIds },
            },
            attributes: ['name'],
          });
          nicheNames = niches.map((n) => n.name);
        }

        // Extract city names from the cities association
        const cityNames =
          campaign.cities?.map((cc) => cc.city?.name).filter(Boolean) || [];

        const campaignData = {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          type: campaign.type,
          status: campaign.status,
          category: campaign.category,
          isInviteOnly: campaign.isInviteOnly,
          isPanIndia: campaign.isPanIndia,
          createdAt: campaign.createdAt,
          brand: campaign.brand
            ? {
                id: campaign.brand.id,
                brandName: campaign.brand.brandName,
                username: campaign.brand.username,
              }
            : null,
          niches: nicheNames,
          cities: cityNames,
          applicationsCount,
          selectedCount,
          deliverableFormat: campaign.deliverableFormat,
          deliverables: campaign.deliverables,
        };

        return this.transformCampaignResponse(campaignData);
      }),
    );

    // Sort by applications if requested
    if (sortBy === 'applications') {
      enrichedCampaigns.sort(
        (a, b) => b.applicationsCount - a.applicationsCount,
      );
    }

    const totalPages = Math.ceil(total / limit);

    return {
      campaigns: enrichedCampaigns,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
