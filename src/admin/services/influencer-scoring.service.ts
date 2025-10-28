import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Post } from '../../post/models/post.model';
import { Follow } from '../../post/models/follow.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { Experience } from '../../influencer/models/experience.model';
import { InfluencerNiche } from '../../auth/model/influencer-niche.model';
import { Niche } from '../../auth/model/niche.model';
import { City } from '../../shared/models/city.model';
import { Country } from '../../shared/models/country.model';
import { GetTopInfluencersDto } from '../dto/get-top-influencers.dto';
import {
  GetInfluencersDto,
  ProfileFilter,
  InfluencerSortBy,
} from '../dto/get-influencers.dto';
import {
  TopInfluencerDto,
  TopInfluencersResponseDto,
  InfluencerScoreBreakdown,
} from '../dto/top-influencer-response.dto';
import { Op } from 'sequelize';

interface ScoringWeights {
  nicheMatchWeight: number;
  engagementRateWeight: number;
  audienceRelevanceWeight: number;
  locationMatchWeight: number;
  pastPerformanceWeight: number;
  collaborationChargesWeight: number;
}

@Injectable()
export class InfluencerScoringService {
  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Follow)
    private followModel: typeof Follow,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(InfluencerNiche)
    private influencerNicheModel: typeof InfluencerNiche,
  ) {}

  /**
   * Get top influencers with scoring based on multiple criteria
   */
  async getTopInfluencers(
    filters: GetTopInfluencersDto,
  ): Promise<TopInfluencersResponseDto> {
    const {
      searchQuery,
      locationSearch,
      nicheSearch,
      nicheIds,
      cityIds,
      isPanIndia,
      minFollowers,
      maxFollowers,
      minBudget,
      maxBudget,
      minScore,
      page = 1,
      limit = 20,
      nicheMatchWeight = 30,
      engagementRateWeight = 25,
      audienceRelevanceWeight = 15,
      locationMatchWeight = 15,
      pastPerformanceWeight = 10,
      collaborationChargesWeight = 5,
    } = filters;

    const weights: ScoringWeights = {
      nicheMatchWeight,
      engagementRateWeight,
      audienceRelevanceWeight,
      locationMatchWeight,
      pastPerformanceWeight,
      collaborationChargesWeight,
    };

    // Build base query for influencers
    const whereConditions: any = {
      isProfileCompleted: true,
      isActive: true,
    };

    // Apply search query if provided
    if (searchQuery && searchQuery.trim()) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${searchQuery.trim()}%` } },
        { username: { [Op.iLike]: `%${searchQuery.trim()}%` } },
      ];
    }

    // Apply city filter if provided and not Pan India
    if (cityIds && cityIds.length > 0 && !isPanIndia) {
      whereConditions.cityId = { [Op.in]: cityIds };
    }

    // Build include conditions for City and Niche with search
    const cityInclude: any = {
      model: City,
      as: 'city',
    };
    if (locationSearch && locationSearch.trim()) {
      cityInclude.where = {
        name: { [Op.iLike]: `%${locationSearch.trim()}%` },
      };
      cityInclude.required = true; // Inner join to filter results
    }

    const nicheInclude: any = {
      model: Niche,
      as: 'niches',
      through: { attributes: [] }, // Exclude join table attributes
    };
    if (nicheSearch && nicheSearch.trim()) {
      nicheInclude.where = {
        name: { [Op.iLike]: `%${nicheSearch.trim()}%` },
      };
      nicheInclude.required = true; // Inner join to filter results
    }

    // Fetch all eligible influencers with their related data
    const influencers = await this.influencerModel.findAll({
      where: whereConditions,
      include: [
        nicheInclude,
        cityInclude,
        {
          model: Country,
          as: 'country',
        },
      ],
    });

    // Score each influencer
    const scoredInfluencers = await Promise.all(
      influencers.map(async (influencer) => {
        const scoreBreakdown = await this.calculateInfluencerScore(
          influencer,
          filters,
          weights,
        );

        const followersCount = await this.getFollowersCount(influencer.id);
        const postsCount = await this.getPostsCount(influencer.id);
        const completedCampaigns = await this.getCompletedCampaignsCount(
          influencer.id,
        );

        // Get niche names
        const niches =
          (influencer as any).niches?.map((niche: any) => niche.name) || [];

        // Get collaboration costs
        const instagramCosts =
          (influencer.collaborationCosts as any)?.instagram || {};
        const instagramPostCost = instagramCosts.post || 0;
        const instagramReelCost = instagramCosts.reel || 0;

        // Apply filters
        if (minFollowers && followersCount < minFollowers) return null;
        if (maxFollowers && followersCount > maxFollowers) return null;
        if (minBudget && instagramPostCost > 0 && instagramPostCost < minBudget)
          return null;
        if (maxBudget && instagramPostCost > 0 && instagramPostCost > maxBudget)
          return null;
        if (minScore && scoreBreakdown.overallScore < minScore) return null;

        const topInfluencer: TopInfluencerDto = {
          id: influencer.id,
          name: influencer.name,
          username: influencer.username,
          profileImage: influencer.profileImage || '',
          bio: influencer.bio || '',
          profileHeadline: influencer.profileHeadline || '',
          city: influencer.city?.name || '',
          country: influencer.country?.name || '',
          followersCount,
          engagementRate: scoreBreakdown.engagementRateScore / 10, // Convert back to percentage
          postsCount,
          completedCampaigns,
          niches,
          instagramPostCost,
          instagramReelCost,
          scoreBreakdown,
        };

        return topInfluencer;
      }),
    );

    // Filter out null values and sort by overall score
    const validInfluencers = scoredInfluencers
      .filter((inf): inf is TopInfluencerDto => inf !== null)
      .sort(
        (a, b) => b.scoreBreakdown.overallScore - a.scoreBreakdown.overallScore,
      );

    // Pagination
    const total = validInfluencers.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedInfluencers = validInfluencers.slice(offset, offset + limit);

    return {
      influencers: paginatedInfluencers,
      total,
      page,
      limit,
      totalPages,
      appliedWeights: weights,
    };
  }

  /**
   * Get influencers with different profile filters
   * - allProfile: All profiles ordered by createdAt asc
   * - topProfile: Top profiles using scoring metrics (same as getTopInfluencers)
   * - verifiedProfile: Verified profiles ordered by createdAt asc
   * - unverifiedProfile: Unverified profiles ordered by createdAt asc
   */
  async getInfluencers(
    filters: GetInfluencersDto,
  ): Promise<TopInfluencersResponseDto> {
    const {
      profileFilter,
      page = 1,
      limit = 20,
      searchQuery,
      locationSearch,
      nicheSearch,
      sortBy = InfluencerSortBy.CREATED_AT,
    } = filters;

    // For topProfile, use the existing scoring logic
    if (profileFilter === ProfileFilter.TOP_PROFILE) {
      return await this.getTopInfluencers(filters as GetTopInfluencersDto);
    }

    // For other filters, build appropriate where conditions
    const whereConditions: any = {
      isProfileCompleted: true,
      isActive: true,
    };

    // Apply search query if provided
    if (searchQuery && searchQuery.trim()) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${searchQuery.trim()}%` } },
        { username: { [Op.iLike]: `%${searchQuery.trim()}%` } },
      ];
    }

    // Apply profile filter
    switch (profileFilter) {
      case ProfileFilter.VERIFIED_PROFILE:
        whereConditions.isVerified = true;
        break;
      case ProfileFilter.UNVERIFIED_PROFILE:
        whereConditions.isVerified = false;
        break;
      case ProfileFilter.ALL_PROFILE:
      default:
        // No additional filter for all profiles
        break;
    }

    // Apply follower count filters if provided
    if (filters.minFollowers || filters.maxFollowers) {
      // We need to count followers using a subquery or fetch and filter
      // For now, we'll fetch all and filter in application code
    }

    // Build include conditions for City and Niche with search
    const cityInclude: any = {
      model: City,
      as: 'city',
    };
    if (locationSearch && locationSearch.trim()) {
      cityInclude.where = {
        name: { [Op.iLike]: `%${locationSearch.trim()}%` },
      };
      cityInclude.required = true; // Inner join to filter results
    }

    const nicheInclude: any = {
      model: Niche,
      as: 'niches',
      through: { attributes: [] },
    };
    if (nicheSearch && nicheSearch.trim()) {
      nicheInclude.where = {
        name: { [Op.iLike]: `%${nicheSearch.trim()}%` },
      };
      nicheInclude.required = true; // Inner join to filter results
    }

    // Fetch influencers ordered by createdAt asc
    const allInfluencers = await this.influencerModel.findAll({
      where: whereConditions,
      include: [
        nicheInclude,
        cityInclude,
        {
          model: Country,
          as: 'country',
        },
      ],
      order: [['createdAt', 'ASC']], // Default order, will be re-sorted based on sortBy
    });

    // Map influencers and apply follower filters
    const mappedInfluencers = await Promise.all(
      allInfluencers.map(async (influencer) => {
        const followersCount = await this.getFollowersCount(influencer.id);
        const followingCount = await this.getFollowingCount(influencer.id);
        const postsCount = await this.getPostsCount(influencer.id);
        const completedCampaigns = await this.getCompletedCampaignsCount(
          influencer.id,
        );

        // Apply follower filters
        if (filters.minFollowers && followersCount < filters.minFollowers)
          return null;
        if (filters.maxFollowers && followersCount > filters.maxFollowers)
          return null;

        // Get niche names
        const niches =
          (influencer as any).niches?.map((niche: any) => niche.name) || [];

        // Get collaboration costs
        const instagramCosts =
          (influencer.collaborationCosts as any)?.instagram || {};
        const instagramPostCost = instagramCosts.post || 0;
        const instagramReelCost = instagramCosts.reel || 0;

        // For non-top profiles, we don't calculate scores
        // But we still return the same structure with default/null scores
        const scoreBreakdown: InfluencerScoreBreakdown = {
          nicheMatchScore: 0,
          engagementRateScore: 0,
          audienceRelevanceScore: 0,
          locationMatchScore: 0,
          pastPerformanceScore: 0,
          collaborationChargesScore: 0,
          overallScore: 0,
          recommendationLevel: 'not_recommended',
        };

        const topInfluencer: TopInfluencerDto & { followingCount: number } = {
          id: influencer.id,
          name: influencer.name,
          username: influencer.username,
          profileImage: influencer.profileImage || '',
          bio: influencer.bio || '',
          profileHeadline: influencer.profileHeadline || '',
          city: influencer.city?.name || '',
          country: influencer.country?.name || '',
          followersCount,
          followingCount,
          engagementRate: 0, // Not calculated for non-top profiles
          postsCount,
          completedCampaigns,
          niches,
          instagramPostCost,
          instagramReelCost,
          scoreBreakdown,
        };

        return topInfluencer;
      }),
    );

    // Filter out null values
    const validInfluencers = mappedInfluencers.filter(
      (inf): inf is TopInfluencerDto & { followingCount: number } =>
        inf !== null,
    );

    // Apply sorting based on sortBy parameter
    switch (sortBy) {
      case InfluencerSortBy.POSTS:
        validInfluencers.sort((a, b) => b.postsCount - a.postsCount);
        break;
      case InfluencerSortBy.FOLLOWERS:
        validInfluencers.sort((a, b) => b.followersCount - a.followersCount);
        break;
      case InfluencerSortBy.FOLLOWING:
        validInfluencers.sort((a, b) => b.followingCount - a.followingCount);
        break;
      case InfluencerSortBy.CAMPAIGNS:
        validInfluencers.sort(
          (a, b) => b.completedCampaigns - a.completedCampaigns,
        );
        break;
      case InfluencerSortBy.CREATED_AT:
      default:
        // Already sorted by createdAt ASC from database query
        break;
    }

    // Pagination
    const total = validInfluencers.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedInfluencers = validInfluencers.slice(offset, offset + limit);

    return {
      influencers: paginatedInfluencers,
      total,
      page,
      limit,
      totalPages,
      appliedWeights: {
        nicheMatchWeight: 0,
        engagementRateWeight: 0,
        audienceRelevanceWeight: 0,
        locationMatchWeight: 0,
        pastPerformanceWeight: 0,
        collaborationChargesWeight: 0,
      },
    };
  }

  /**
   * Calculate comprehensive score for an influencer
   */
  private async calculateInfluencerScore(
    influencer: Influencer,
    filters: GetTopInfluencersDto,
    weights: ScoringWeights,
  ): Promise<InfluencerScoreBreakdown> {
    // Calculate individual scores
    const nicheMatchScore = await this.calculateNicheMatchScore(
      influencer,
      filters.nicheIds,
    );
    const engagementRateScore =
      await this.calculateEngagementRateScore(influencer);
    const audienceRelevanceScore =
      await this.calculateAudienceRelevanceScore(influencer);
    const locationMatchScore = this.calculateLocationMatchScore(
      influencer,
      filters.cityIds,
      filters.isPanIndia,
    );
    const pastPerformanceScore =
      await this.calculatePastPerformanceScore(influencer);
    const collaborationChargesScore = this.calculateCollaborationChargesScore(
      influencer,
      filters.minBudget,
      filters.maxBudget,
    );

    // Calculate overall weighted score
    const overallScore =
      (nicheMatchScore * weights.nicheMatchWeight +
        engagementRateScore * weights.engagementRateWeight +
        audienceRelevanceScore * weights.audienceRelevanceWeight +
        locationMatchScore * weights.locationMatchWeight +
        pastPerformanceScore * weights.pastPerformanceWeight +
        collaborationChargesScore * weights.collaborationChargesWeight) /
      100;

    // Determine recommendation level
    let recommendationLevel: string;
    if (overallScore >= 80) recommendationLevel = 'highly_recommended';
    else if (overallScore >= 60) recommendationLevel = 'recommended';
    else if (overallScore >= 40) recommendationLevel = 'consider';
    else recommendationLevel = 'not_recommended';

    return {
      nicheMatchScore: Math.round(nicheMatchScore * 10) / 10,
      engagementRateScore: Math.round(engagementRateScore * 10) / 10,
      audienceRelevanceScore: Math.round(audienceRelevanceScore * 10) / 10,
      locationMatchScore: Math.round(locationMatchScore * 10) / 10,
      pastPerformanceScore: Math.round(pastPerformanceScore * 10) / 10,
      collaborationChargesScore:
        Math.round(collaborationChargesScore * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
      recommendationLevel,
    };
  }

  /**
   * 1. Niche Match Score (30% weight)
   * How well the influencer's niches align with target requirements
   */
  private async calculateNicheMatchScore(
    influencer: Influencer,
    targetNicheIds?: number[],
  ): Promise<number> {
    if (!targetNicheIds || targetNicheIds.length === 0) {
      return 70; // Default score if no target niches specified
    }

    const influencerNiches = await this.influencerNicheModel.findAll({
      where: { influencerId: influencer.id },
    });

    const influencerNicheIds = influencerNiches.map(
      (nicheRel) => nicheRel.nicheId,
    );

    if (influencerNicheIds.length === 0) {
      return 30; // Low score if influencer has no niches
    }

    // Calculate intersection
    const matchingNiches = influencerNicheIds.filter((nicheId) =>
      targetNicheIds.includes(nicheId),
    );

    if (matchingNiches.length === 0) {
      return 30; // No match
    }

    // Calculate match percentage
    const matchPercentage =
      (matchingNiches.length / targetNicheIds.length) * 100;

    // If all target niches match, return 100
    if (matchingNiches.length >= targetNicheIds.length) {
      return 100;
    }

    // Partial match: scale from 50-100
    return 50 + matchPercentage / 2;
  }

  /**
   * 2. Engagement Rate Score (25% weight)
   * Based on actual post performance data
   * Formula: (average likes / follower count) × 100
   */
  private async calculateEngagementRateScore(
    influencer: Influencer,
  ): Promise<number> {
    // Get influencer's posts
    const posts = await this.postModel.findAll({
      where: {
        influencerId: influencer.id,
        isActive: true,
      },
      attributes: ['likesCount'],
      limit: 20, // Consider last 20 posts for average
      order: [['createdAt', 'DESC']],
    });

    if (posts.length === 0) {
      return 50; // Default score if no posts
    }

    // Calculate average likes
    const totalLikes = posts.reduce((sum, post) => sum + post.likesCount, 0);
    const averageLikes = totalLikes / posts.length;

    // Get follower count
    const followersCount = await this.getFollowersCount(influencer.id);

    if (followersCount === 0) {
      return 50; // Default if no followers
    }

    // Calculate engagement rate
    const engagementRate = (averageLikes / followersCount) * 100;

    // Score engagement rate (normalize to 0-100)
    // Excellent engagement rate is typically 3-6% for influencers
    // Scale: 0% = 0, 1% = 20, 2% = 40, 3% = 60, 4% = 75, 5% = 85, 6%+ = 95-100
    if (engagementRate >= 6) return 100;
    if (engagementRate >= 5) return 85 + (engagementRate - 5) * 15;
    if (engagementRate >= 4) return 75 + (engagementRate - 4) * 10;
    if (engagementRate >= 3) return 60 + (engagementRate - 3) * 15;
    if (engagementRate >= 2) return 40 + (engagementRate - 2) * 20;
    if (engagementRate >= 1) return 20 + (engagementRate - 1) * 20;
    return engagementRate * 20; // 0-1% range
  }

  /**
   * 3. Audience Relevance Score (15% weight)
   * Based on follower count size
   */
  private async calculateAudienceRelevanceScore(
    influencer: Influencer,
  ): Promise<number> {
    const followersCount = await this.getFollowersCount(influencer.id);

    // Score based on follower count tiers
    if (followersCount >= 1000000) return 100; // Mega influencer (1M+)
    if (followersCount >= 500000) return 95; // Major influencer (500K-1M)
    if (followersCount >= 100000) return 90; // Macro influencer (100K-500K)
    if (followersCount >= 50000) return 80; // Mid-tier influencer (50K-100K)
    if (followersCount >= 10000) return 70; // Micro influencer (10K-50K)
    if (followersCount >= 5000) return 60; // Nano influencer (5K-10K)
    if (followersCount >= 1000) return 50; // Emerging (1K-5K)
    return 40; // Below 1K
  }

  /**
   * 4. Location Match Score (15% weight)
   * Geographic alignment
   */
  private calculateLocationMatchScore(
    influencer: Influencer,
    targetCityIds?: number[],
    isPanIndia?: boolean,
  ): number {
    // If campaign is Pan India, perfect match
    if (isPanIndia) {
      return 100;
    }

    // If no target cities specified, neutral score
    if (!targetCityIds || targetCityIds.length === 0) {
      return 100;
    }

    // Check if influencer's city matches any target city
    if (targetCityIds.includes(influencer.cityId)) {
      return 100;
    }

    // No match
    return 50;
  }

  /**
   * 5. Past Performance Score (10% weight)
   * Based on past campaign statistics
   */
  private async calculatePastPerformanceScore(
    influencer: Influencer,
  ): Promise<number> {
    // Get completed experiences
    const experiences = await this.experienceModel.count({
      where: { influencerId: influencer.id },
    });

    // Get campaign applications
    const totalApplications = await this.campaignApplicationModel.count({
      where: {
        influencerId: influencer.id,
      },
    });

    const acceptedApplications = await this.campaignApplicationModel.count({
      where: {
        influencerId: influencer.id,
        status: 'selected',
      },
    });

    // Calculate success rate
    let successRate = 0;
    if (totalApplications > 0) {
      successRate = (acceptedApplications / totalApplications) * 100;
    }

    // Score based on experience and success rate
    let score = 50; // Base score

    // Add points for number of campaigns (max +30)
    if (experiences >= 20) score += 30;
    else if (experiences >= 10) score += 25;
    else if (experiences >= 5) score += 20;
    else if (experiences >= 3) score += 15;
    else if (experiences >= 1) score += 10;

    // Add points for success rate (max +20)
    if (successRate >= 80) score += 20;
    else if (successRate >= 60) score += 15;
    else if (successRate >= 40) score += 10;
    else if (successRate >= 20) score += 5;

    return Math.min(score, 100);
  }

  /**
   * 6. Collaboration Charges Match Score (5% weight)
   * How well the influencer's rates match the budget
   */
  private calculateCollaborationChargesScore(
    influencer: Influencer,
    minBudget?: number,
    maxBudget?: number,
  ): number {
    const instagramCosts =
      (influencer.collaborationCosts as any)?.instagram || {};
    const postCost = instagramCosts.post || 0;

    // If no budget specified or influencer hasn't set rates
    if (!minBudget && !maxBudget) return 70;
    if (postCost === 0) return 50; // No rates set

    // If only min budget specified
    if (minBudget && !maxBudget) {
      if (postCost >= minBudget && postCost <= minBudget * 2) return 100;
      if (postCost < minBudget) return 70; // Below budget (good for brand)
      if (postCost <= minBudget * 3) return 60; // Slightly over
      return 40; // Too expensive
    }

    // If only max budget specified
    if (!minBudget && maxBudget) {
      if (postCost <= maxBudget) return 100;
      if (postCost <= maxBudget * 1.2) return 70; // Slightly over
      return 40; // Too expensive
    }

    // Both min and max specified
    if (minBudget && maxBudget) {
      if (postCost >= minBudget && postCost <= maxBudget) return 100; // Perfect match
      if (postCost < minBudget) return 80; // Below range (still good)
      if (postCost <= maxBudget * 1.2) return 60; // Slightly over
      return 30; // Too expensive
    }

    return 70; // Default
  }

  /**
   * Helper: Get followers count for an influencer
   */
  private async getFollowersCount(influencerId: number): Promise<number> {
    return await this.followModel.count({
      where: { followingInfluencerId: influencerId },
    });
  }

  /**
   * Helper: Get following count for an influencer
   */
  private async getFollowingCount(influencerId: number): Promise<number> {
    return await this.followModel.count({
      where: {
        followerInfluencerId: influencerId,
        followingInfluencerId: { [Op.not]: null },
      },
    });
  }

  /**
   * Helper: Get posts count for an influencer
   */
  private async getPostsCount(influencerId: number): Promise<number> {
    return await this.postModel.count({
      where: { influencerId, isActive: true },
    });
  }

  /**
   * Helper: Get completed campaigns count
   */
  private async getCompletedCampaignsCount(
    influencerId: number,
  ): Promise<number> {
    return await this.experienceModel.count({
      where: { influencerId },
    });
  }
}
