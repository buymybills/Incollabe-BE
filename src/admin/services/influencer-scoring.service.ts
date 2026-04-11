import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Post } from '../../post/models/post.model';
import { Follow } from '../../post/models/follow.model';
import { CampaignApplication, ApplicationStatus } from '../../campaign/models/campaign-application.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { Experience } from '../../influencer/models/experience.model';
import { InfluencerNiche } from '../../auth/model/influencer-niche.model';
import { Niche } from '../../auth/model/niche.model';
import { City } from '../../shared/models/city.model';
import { Country } from '../../shared/models/country.model';
import { Conversation } from '../../shared/models/conversation.model';
import { Brand } from '../../brand/model/brand.model';
import { TopInfluencerScoreCache } from '../models/top-influencer-score-cache.model';
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

// Type for influencer with included associations
type InfluencerWithAssociations = Influencer & {
  niches?: Array<{ id: number; name: string }>;
  city?: { id: number; name: string } | null;
  country?: { id: number; name: string } | null;
};

@Injectable()
export class InfluencerScoringService {
  private readonly logger = new Logger(InfluencerScoringService.name);
  private isCacheRefreshRunning = false;

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(Follow)
    private followModel: typeof Follow,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(InfluencerNiche)
    private influencerNicheModel: typeof InfluencerNiche,
    @InjectModel(Conversation)
    private conversationModel: typeof Conversation,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(TopInfluencerScoreCache)
    private topInfluencerScoreCacheModel: typeof TopInfluencerScoreCache,
  ) {}

  /**
   * Get top 20 influencers with new scoring logic
   * Scoring Metrics (Total: 10 points):
   * 1. Campaign selection ratio: ((Selected / Applied) * 5) = max 5 points
   * 2. Content engagement ratio: ((Posts with engagement / Total posts) * 2) = max 2 points
   * 3. Brand direct contact ratio: ((Brand direct contacts / Total verified brands) * 1) = max 1 point
   * 4. Pro subscription (Max User): 0.5 points if isPro = true
   * 5. Followers metric: ((Followers / 1000) * 0.5) = max 0.5 points (capped at 0.5)
   * 6. Experience: 0 to 1 point based on number of completed campaigns
   */
  async getTopInfluencersNewScoring(
    limit: number = 20,
    searchQuery?: string,
    locationSearch?: string,
    nicheSearch?: string,
  ): Promise<TopInfluencersResponseDto> {
    // Step 1: Read top entries from cache table (already sorted by score, DB-level limit).
    // Never load all 9K influencers — only fetch what we need to display.
    const cachedScores = await this.topInfluencerScoreCacheModel.findAll({
      attributes: ['influencerId', 'overallScore', 'scoreBreakdown', 'calculatedAt'],
      order: [['overallScore', 'DESC']],
      limit: limit * 10, // Fetch extra to allow for search/location filtering below
    });

    if (cachedScores.length === 0) {
      this.logger.warn('Top influencer score cache is empty — run refresh-cache to populate.');
      return {
        influencers: [],
        total: 0,
        page: 1,
        limit,
        totalPages: 0,
        appliedWeights: { nicheMatchWeight: 0, engagementRateWeight: 20, audienceRelevanceWeight: 0, locationMatchWeight: 0, pastPerformanceWeight: 60, collaborationChargesWeight: 20 },
        cacheInfo: { cachedCount: 0, liveCount: 0, lastCacheRefresh: null },
      };
    }

    const cacheMap = new Map(cachedScores.map((c) => [c.influencerId, c]));
    const cachedInfluencerIds = cachedScores.map((c) => c.influencerId);

    // Step 2: Fetch only the cached influencers' profiles (small set, not all 9K)
    const whereConditions: any = {
      id: { [Op.in]: cachedInfluencerIds },
      isProfileCompleted: true,
      isActive: true,
    };

    if (searchQuery && searchQuery.trim()) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${searchQuery.trim()}%` } },
        { username: { [Op.iLike]: `%${searchQuery.trim()}%` } },
      ];
    }

    const cityInclude: any = { model: City, as: 'city', required: false };
    if (locationSearch && locationSearch.trim()) {
      cityInclude.where = { name: { [Op.iLike]: `%${locationSearch.trim()}%` } };
      cityInclude.required = true;
    }

    const nicheInclude: any = {
      model: Niche,
      as: 'niches',
      through: { attributes: [] },
      required: false,
    };
    if (nicheSearch && nicheSearch.trim()) {
      nicheInclude.where = { name: { [Op.iLike]: `%${nicheSearch.trim()}%` } };
      nicheInclude.required = true;
    }

    const influencers = await this.influencerModel.findAll({
      where: whereConditions,
      include: [nicheInclude, cityInclude, { model: Country, as: 'country', required: false }],
    });

    // Step 3: Map profiles + scores — no live computation, cache only
    const scoredInfluencers = influencers.map((inf) => {
      const influencer = inf as unknown as InfluencerWithAssociations;
      const cached = cacheMap.get(influencer.id);
      if (!cached) return null;

      const overallScore = Number(cached.overallScore);
      const scoreBreakdown = cached.scoreBreakdown || {};
      const instagramCosts = (influencer.collaborationCosts as Record<string, any>)?.instagram || {};
      const niches = influencer.niches?.map((niche) => niche.name) || [];

      const topInfluencer: TopInfluencerDto = {
        id: influencer.id,
        name: influencer.name,
        username: influencer.username,
        profileImage: influencer.profileImage || '',
        bio: influencer.bio || '',
        profileHeadline: influencer.profileHeadline || '',
        city: influencer.city?.name || '',
        country: influencer.country?.name || '',
        isVerified: influencer.isVerified || false,
        verifiedAt: influencer.verifiedAt || null,
        instagramIsVerified: influencer.instagramIsVerified || false,
        isInstagramConnected: !!influencer.instagramConnectedAt,
        isTopInfluencer: influencer.isTopInfluencer || false,
        followersCount: 0,
        engagementRate: ((scoreBreakdown.engagementRateScore ?? 0) / 2) * 100,
        postsCount: 0,
        completedCampaigns: 0,
        niches,
        instagramPostCost: instagramCosts.post || 0,
        instagramReelCost: instagramCosts.reel || 0,
        scoreBreakdown: {
          nicheMatchScore: 0,
          engagementRateScore: scoreBreakdown.engagementRateScore ?? 0,
          audienceRelevanceScore: 0,
          locationMatchScore: 0,
          pastPerformanceScore: scoreBreakdown.pastPerformanceScore ?? 0,
          collaborationChargesScore: 0,
          overallScore,
          recommendationLevel:
            overallScore >= 8 ? 'highly_recommended'
            : overallScore >= 6 ? 'recommended'
            : overallScore >= 4 ? 'consider'
            : 'not_recommended',
        },
        displayOrder: influencer.displayOrder || null,
        updatedAt: influencer.updatedAt,
        scoreSource: 'cache' as const,
        scoreCachedAt: cached.calculatedAt,
      };

      return topInfluencer;
    });

    const validInfluencers = scoredInfluencers
      .filter((inf): inf is TopInfluencerDto => inf !== null)
      .sort((a, b) => {
        const aOrder = a.displayOrder ?? null;
        const bOrder = b.displayOrder ?? null;
        if (aOrder !== null && bOrder !== null) {
          const orderDiff = aOrder - bOrder;
          if (orderDiff !== 0) return orderDiff;
          return b.scoreBreakdown.overallScore - a.scoreBreakdown.overallScore;
        }
        if (aOrder !== null) return -1;
        if (bOrder !== null) return 1;
        const scoreDiff = b.scoreBreakdown.overallScore - a.scoreBreakdown.overallScore;
        if (scoreDiff !== 0) return scoreDiff;
        if (a.updatedAt && b.updatedAt) {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
        return 0;
      })
      .slice(0, limit);

    const lastCacheRefresh = cachedScores.length > 0
      ? cachedScores.reduce((latest, c) =>
          c.calculatedAt > latest ? c.calculatedAt : latest,
          cachedScores[0].calculatedAt,
        )
      : null;

    return {
      influencers: validInfluencers,
      total: validInfluencers.length,
      page: 1,
      limit,
      totalPages: 1,
      appliedWeights: {
        nicheMatchWeight: 0,
        engagementRateWeight: 20,
        audienceRelevanceWeight: 0,
        locationMatchWeight: 0,
        pastPerformanceWeight: 60,
        collaborationChargesWeight: 20,
      },
      cacheInfo: {
        cachedCount: validInfluencers.length,
        liveCount: 0,
        lastCacheRefresh,
      },
    };
  }

  /**
   * Compute and persist scores for all eligible influencers into the cache table.
   * Called by the daily cron job.
   */
  async refreshTopInfluencerScoreCache(): Promise<{ updated: number; errors: number }> {
    if (this.isCacheRefreshRunning) {
      this.logger.warn('Cache refresh already in progress, skipping duplicate invocation');
      return { updated: 0, errors: 0 };
    }
    this.isCacheRefreshRunning = true;

    let updated = 0;
    let errors = 0;
    // Process in small pages so we never hold all influencer records in memory at once.
    // batch * 6 concurrent queries must stay well within pool max (30).
    const PAGE_SIZE = 4;
    let offset = 0;

    while (true) {
      const page = await this.influencerModel.findAll({
        where: { isProfileCompleted: true, isActive: true },
        attributes: ['id'],
        limit: PAGE_SIZE,
        offset,
        order: [['id', 'ASC']],
      });

      if (page.length === 0) break;

      await Promise.all(
        page.map(async (inf) => {
          try {
            const [
              campaignScore,
              engagementScore,
              brandContactScore,
              maxUserYesScore,
              followersScore,
              experienceScore,
            ] = await Promise.all([
              this.calculateCampaignSelectionScore(inf.id),
              this.calculateContentEngagementScore(inf.id),
              this.calculateBrandDirectContactScore(inf.id),
              this.calculateMaxUserYesScore(inf.id),
              this.calculateFollowersScore(inf.id),
              this.calculateExperienceScore(inf.id),
            ]);

            const overallScore = parseFloat(
              (campaignScore + engagementScore + brandContactScore + maxUserYesScore + followersScore + experienceScore).toFixed(5),
            );

            const scoreBreakdown = {
              engagementRateScore: parseFloat(engagementScore.toFixed(5)),
              pastPerformanceScore: parseFloat((campaignScore + experienceScore).toFixed(5)),
              campaignScore: parseFloat(campaignScore.toFixed(5)),
              brandContactScore: parseFloat(brandContactScore.toFixed(5)),
              maxUserYesScore: parseFloat(maxUserYesScore.toFixed(5)),
              followersScore: parseFloat(followersScore.toFixed(5)),
              experienceScore: parseFloat(experienceScore.toFixed(5)),
            };

            await this.topInfluencerScoreCacheModel.upsert({
              influencerId: inf.id,
              overallScore,
              scoreBreakdown,
              calculatedAt: new Date(),
            });

            updated++;
          } catch (error) {
            this.logger.warn(`Failed to cache score for influencer ${inf.id}: ${(error as Error).message}`);
            errors++;
          }
        }),
      );

      offset += PAGE_SIZE;

      // Pause between pages: lets GC run and avoids sustained DB pressure
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.isCacheRefreshRunning = false;
    return { updated, errors };
  }

  /**
   * 1. Campaign Selection Score (0-5 points)
   * Formula: ((Campaigns selected) / (Campaigns applied)) * 5
   */
  private async calculateCampaignSelectionScore(
    influencerId: number,
  ): Promise<number> {
    // Count total campaigns applied to
    const totalApplied = await this.campaignApplicationModel.count({
      where: { influencerId },
    });

    if (totalApplied === 0) {
      return 0; // No applications, score is 0
    }

    // Count campaigns where status is SELECTED
    const selected = await this.campaignApplicationModel.count({
      where: {
        influencerId,
        status: ApplicationStatus.SELECTED,
      },
    });

    const score = (selected / totalApplied) * 5;
    return parseFloat(score.toFixed(5));
  }

  /**
   * 2. Content Engagement Score (0-2 points)
   * Formula: ((Posts with engagement) / (Total posts)) * 2
   * Engagement = at least 1 like or share
   */
  private async calculateContentEngagementScore(
    influencerId: number,
  ): Promise<number> {
    // Count total posts
    const totalPosts = await this.postModel.count({
      where: { influencerId, isActive: true },
    });

    if (totalPosts === 0) {
      return 0; // No posts, score is 0
    }

    // Count posts with engagement (likes > 0 or shares > 0)
    const engagedPosts = await this.postModel.count({
      where: {
        influencerId,
        isActive: true,
        [Op.or]: [
          { likesCount: { [Op.gt]: 0 } },
          { sharesCount: { [Op.gt]: 0 } },
        ],
      },
    });

    const score = (engagedPosts / totalPosts) * 2;
    return parseFloat(score.toFixed(5));
  }

  /**
   * 3. Brand Direct Contact Score (0-1 point)
   * Formula: ((Brand direct contacts) / (Total verified brands)) * 1
   * Direct contact = personal (non-campaign) conversations between a brand and this influencer.
   * Note: participants are always normalised alphabetically ('brand' < 'influencer'),
   * so brand is always participant1 in every brand-influencer conversation.
   * Campaign-type conversations are excluded because they are created as part of the
   * campaign workflow, not as voluntary brand outreach.
   */
  private async calculateBrandDirectContactScore(
    influencerId: number,
  ): Promise<number> {
    // Count total verified brands
    const totalVerifiedBrands = await this.brandModel.count({
      where: { isVerified: true, isActive: true },
    });

    if (totalVerifiedBrands === 0) {
      return 0; // No verified brands, score is 0
    }

    // Count personal conversations between a brand and this influencer.
    // 'personal' type excludes campaign chats that are automatically created
    // as part of the campaign selection flow and do not represent direct brand outreach.
    const brandContacts = await this.conversationModel.count({
      where: {
        participant1Type: 'brand',
        participant2Type: 'influencer',
        participant2Id: influencerId,
        conversationType: 'personal',
      },
    });

    const score = (brandContacts / totalVerifiedBrands) * 1;
    return parseFloat(score.toFixed(5));
  }

  /**
   * 4. Max User Yes Score (0-0.5 points)
   * Fixed 0.5 points if influencer has a pro subscription (isPro = true)
   */
  private async calculateMaxUserYesScore(
    influencerId: number,
  ): Promise<number> {
    // Check if influencer has pro subscription
    const influencer = await this.influencerModel.findByPk(influencerId, {
      attributes: ['isPro'],
    });

    return influencer?.isPro ? 0.5 : 0;
  }

  /**
   * 5. Followers Score (0-0.5 points, capped at 0.5)
   * Formula: ((platform followers / 1000) * 0.5), capped at 0.5
   * Uses the in-app platform follow count (users following this influencer on the platform).
   */
  private async calculateFollowersScore(influencerId: number): Promise<number> {
    const followersCount = await this.getFollowersCount(influencerId);
    const score = Math.min((followersCount / 1000) * 0.5, 0.5);
    return parseFloat(score.toFixed(5));
  }

  /**
   * 6. Experience Score (0-1 point)
   * Based on number of completed experiences/campaigns:
   * 0 campaigns: 0 points
   * 1-3 campaigns: 0.3 points
   * 4-9 campaigns: 0.6 points
   * 10-14 campaigns: 0.8 points
   * >=15 campaigns: 1 point
   */
  private async calculateExperienceScore(
    influencerId: number,
  ): Promise<number> {
    const completedCampaigns = await this.experienceModel.count({
      where: { influencerId },
    });

    let score = 0;
    if (completedCampaigns === 0) {
      score = 0;
    } else if (completedCampaigns >= 1 && completedCampaigns <= 3) {
      score = 0.3;
    } else if (completedCampaigns >= 4 && completedCampaigns <= 9) {
      score = 0.6;
    } else if (completedCampaigns >= 10 && completedCampaigns <= 14) {
      score = 0.8;
    } else if (completedCampaigns >= 15) {
      score = 1;
    }

    return parseFloat(score.toFixed(5));
  }

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
      startDate,
      endDate,
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
      isTopInfluencer: true,
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

    // Apply date range filter on createdAt (skip when searching)
    if ((startDate || endDate) && !searchQuery?.trim()) {
      whereConditions.createdAt = {};
      if (startDate) {
        whereConditions.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereConditions.createdAt[Op.lte] = endDateTime;
      }
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
      influencers.map(async (inf) => {
        const influencer = inf as unknown as InfluencerWithAssociations;
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
        const niches = influencer.niches?.map((niche) => niche.name) || [];

        // Get collaboration costs
        const instagramCosts =
          (influencer.collaborationCosts as Record<string, any>)?.instagram || {};
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
          isVerified: influencer.isVerified || false,
          verifiedAt: influencer.verifiedAt || null,
          instagramIsVerified: influencer.instagramIsVerified || false,
          isInstagramConnected: !!influencer.instagramConnectedAt,
          isTopInfluencer: influencer.isTopInfluencer || false,
          followersCount,
          engagementRate: scoreBreakdown.engagementRateScore / 10, // Convert back to percentage
          postsCount,
          completedCampaigns,
          niches,
          instagramPostCost,
          instagramReelCost,
          scoreBreakdown,
          displayOrder: influencer.displayOrder || null,
          updatedAt: influencer.updatedAt,
          scoreSource: 'live' as const,
          scoreCachedAt: null,
        };

        return topInfluencer;
      }),
    );

    // Filter out null values and sort by displayOrder first, then by timestamp DESC (most recent first), then by score
    const validInfluencers = scoredInfluencers
      .filter((inf): inf is TopInfluencerDto => inf !== null)
      .sort((a, b) => {
        const aOrder = a.displayOrder ?? null;
        const bOrder = b.displayOrder ?? null;

        // If both have displayOrder
        if (aOrder !== null && bOrder !== null) {
          // Primary sort: displayOrder ASC
          const orderDiff = aOrder - bOrder;
          if (orderDiff !== 0) {
            return orderDiff;
          }
          // Tiebreaker: If same displayOrder, sort by updatedAt DESC (most recent first)
          if (a.updatedAt && b.updatedAt) {
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          }
          // If no timestamps, use score as final tiebreaker
          return b.scoreBreakdown.overallScore - a.scoreBreakdown.overallScore;
        }
        // If only 'a' has displayOrder, it comes first
        if (aOrder !== null && bOrder === null) {
          return -1;
        }
        // If only 'b' has displayOrder, it comes first
        if (aOrder === null && bOrder !== null) {
          return 1;
        }
        // If neither has displayOrder, sort by overall score DESC
        return b.scoreBreakdown.overallScore - a.scoreBreakdown.overallScore;
      });

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
      cacheInfo: { cachedCount: 0, liveCount: paginatedInfluencers.length, lastCacheRefresh: null },
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
      startDate,
      endDate,
    } = filters;

    // For topProfile, use the existing scoring logic
    if (profileFilter === ProfileFilter.TOP_PROFILE) {
      return await this.getTopInfluencers(filters as GetTopInfluencersDto);
    }

    // For other filters, build appropriate where conditions
    const whereConditions: any = {
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
        whereConditions.isProfileCompleted = true;
        whereConditions.isVerified = true;
        break;
      case ProfileFilter.UNVERIFIED_PROFILE:
        whereConditions.isVerified = false;
        break;
      case ProfileFilter.ALL_PROFILE:
      default:
        // For ALL_PROFILE, only filter by isActive (shows all active influencers regardless of profile completion)
        break;
    }

    // Apply date range filter on createdAt (skip when searching)
    if ((startDate || endDate) && !searchQuery?.trim()) {
      whereConditions.createdAt = {};
      if (startDate) {
        whereConditions.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereConditions.createdAt[Op.lte] = endDateTime;
      }
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
    // Note: displayOrder is NOT used here - it only affects topProfile filter
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
      order: [['createdAt', 'ASC']],
    });

    // Batch fetch all counts for all influencers (only 4 queries instead of N*4)
    const influencerIds = allInfluencers.map((inf) => inf.id);
    const [followersCounts, followingCounts, postsCounts, campaignsCounts] =
      await Promise.all([
        this.getBatchFollowersCounts(influencerIds),
        this.getBatchFollowingCounts(influencerIds),
        this.getBatchPostsCounts(influencerIds),
        this.getBatchCompletedCampaignsCounts(influencerIds),
      ]);

    // Calculate search priority helper function
    // Prioritizes matches by field (name first, then username), then by position
    const calculateSearchPriority = (
      name: string,
      username: string,
      searchTerm: string,
    ): number => {
      if (!searchTerm) return 0;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const lowerName = name.toLowerCase();
      const lowerUsername = username.toLowerCase();

      // Check position in name
      const nameIndex = lowerName.indexOf(lowerSearchTerm);
      // Check position in username
      const usernameIndex = lowerUsername.indexOf(lowerSearchTerm);

      // Priority tiers:
      // 1000-1999: Match in name (1000 = starts with, 1001 = position 1, etc.)
      // 2000-2999: Match in username (2000 = starts with, 2001 = position 1, etc.)
      // 9999: No match (shouldn't happen due to filtering)

      if (nameIndex >= 0) {
        // Match found in name - highest priority tier
        return 1000 + nameIndex;
      } else if (usernameIndex >= 0) {
        // Match found in username - lower priority tier
        return 2000 + usernameIndex;
      }

      return 9999; // No match found
    };

    // Map influencers and apply follower filters
    const mappedInfluencers = allInfluencers.map((inf) => {
      const influencer = inf as unknown as InfluencerWithAssociations;
      const followersCount = followersCounts.get(influencer.id) || 0;
      const followingCount = followingCounts.get(influencer.id) || 0;
      const postsCount = postsCounts.get(influencer.id) || 0;
      const completedCampaigns = campaignsCounts.get(influencer.id) || 0;

      // Apply follower filters
      if (filters.minFollowers && followersCount < filters.minFollowers)
        return null;
      if (filters.maxFollowers && followersCount > filters.maxFollowers)
        return null;

      // Get niche names
      const niches = influencer.niches?.map((niche) => niche.name) || [];

      // Get collaboration costs
      const instagramCosts =
        (influencer.collaborationCosts as Record<string, any>)?.instagram || {};
      const instagramPostCost = instagramCosts.post || 0;
      const instagramReelCost = instagramCosts.reel || 0;

      // Calculate search priority
      const searchPriority = calculateSearchPriority(
        influencer.name || '',
        influencer.username || '',
        searchQuery?.trim() || '',
      );

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

        const topInfluencer: TopInfluencerDto & { followingCount: number; searchPriority: number } = {
          id: influencer.id,
          name: influencer.name,
          username: influencer.username,
          profileImage: influencer.profileImage || '',
          bio: influencer.bio || '',
          profileHeadline: influencer.profileHeadline || '',
          city: influencer.city?.name || '',
          country: influencer.country?.name || '',
          isVerified: influencer.isVerified || false,
          verifiedAt: influencer.verifiedAt || null,
          instagramIsVerified: influencer.instagramIsVerified || false,
          isInstagramConnected: !!influencer.instagramConnectedAt,
          isTopInfluencer: influencer.isTopInfluencer || false,
          displayOrder: influencer.isTopInfluencer
            ? influencer.displayOrder
            : null,
          followersCount,
          followingCount,
          engagementRate: 0, // Not calculated for non-top profiles
          postsCount,
          completedCampaigns,
          niches,
          instagramPostCost,
          instagramReelCost,
          scoreBreakdown,
          searchPriority,
          scoreSource: 'live' as const,
          scoreCachedAt: null,
        };

      return topInfluencer;
    });

    // Filter out null values
    const validInfluencers = mappedInfluencers.filter(
      (inf): inf is TopInfluencerDto & { followingCount: number; searchPriority: number } =>
        inf !== null,
    );

    // Apply sorting based on sortBy parameter
    // When search query is present, prioritize by search relevance first
    const hasSearchQuery = searchQuery && searchQuery.trim();

    switch (sortBy) {
      case InfluencerSortBy.POSTS:
        validInfluencers.sort((a, b) => {
          if (hasSearchQuery && a.searchPriority !== b.searchPriority) {
            return a.searchPriority - b.searchPriority; // Lower priority number = higher relevance
          }
          return b.postsCount - a.postsCount;
        });
        break;
      case InfluencerSortBy.FOLLOWERS:
        validInfluencers.sort((a, b) => {
          if (hasSearchQuery && a.searchPriority !== b.searchPriority) {
            return a.searchPriority - b.searchPriority;
          }
          return b.followersCount - a.followersCount;
        });
        break;
      case InfluencerSortBy.FOLLOWING:
        validInfluencers.sort((a, b) => {
          if (hasSearchQuery && a.searchPriority !== b.searchPriority) {
            return a.searchPriority - b.searchPriority;
          }
          return b.followingCount - a.followingCount;
        });
        break;
      case InfluencerSortBy.CAMPAIGNS:
        validInfluencers.sort((a, b) => {
          if (hasSearchQuery && a.searchPriority !== b.searchPriority) {
            return a.searchPriority - b.searchPriority;
          }
          return b.completedCampaigns - a.completedCampaigns;
        });
        break;
      case InfluencerSortBy.CREATED_AT:
      default:
        // When search is active, sort by search priority first
        if (hasSearchQuery) {
          validInfluencers.sort((a, b) => a.searchPriority - b.searchPriority);
        }
        // Otherwise already sorted by createdAt ASC from database query
        break;
    }

    // Pagination
    const total = validInfluencers.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedInfluencersWithPriority = validInfluencers.slice(offset, offset + limit);

    // Remove searchPriority from response (only used internally for sorting)
    const paginatedInfluencers = paginatedInfluencersWithPriority.map(
      ({ searchPriority, ...influencer }) => influencer,
    );

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
      cacheInfo: { cachedCount: 0, liveCount: paginatedInfluencers.length, lastCacheRefresh: null },
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
      (influencer.collaborationCosts as Record<string, any>)?.instagram || {};
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

  /**
   * Batch Helper: Get followers count for multiple influencers
   */
  private async getBatchFollowersCounts(
    influencerIds: number[],
  ): Promise<Map<number, number>> {
    if (influencerIds.length === 0) return new Map();

    const counts = await this.followModel.findAll({
      attributes: [
        'followingInfluencerId',
        [this.followModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      where: { followingInfluencerId: influencerIds },
      group: ['followingInfluencerId'],
      raw: true,
    });

    const countsMap = new Map<number, number>();
    counts.forEach((row: any) => {
      countsMap.set(row.followingInfluencerId, parseInt(row.count));
    });
    return countsMap;
  }

  /**
   * Batch Helper: Get following count for multiple influencers
   */
  private async getBatchFollowingCounts(
    influencerIds: number[],
  ): Promise<Map<number, number>> {
    if (influencerIds.length === 0) return new Map();

    const counts = await this.followModel.findAll({
      attributes: [
        'followerInfluencerId',
        [this.followModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      where: {
        followerInfluencerId: influencerIds,
        followingInfluencerId: { [Op.not]: null },
      },
      group: ['followerInfluencerId'],
      raw: true,
    });

    const countsMap = new Map<number, number>();
    counts.forEach((row: any) => {
      countsMap.set(row.followerInfluencerId, parseInt(row.count));
    });
    return countsMap;
  }

  /**
   * Batch Helper: Get posts count for multiple influencers
   */
  private async getBatchPostsCounts(
    influencerIds: number[],
  ): Promise<Map<number, number>> {
    if (influencerIds.length === 0) return new Map();

    const counts = await this.postModel.findAll({
      attributes: [
        'influencerId',
        [this.postModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      where: { influencerId: influencerIds, isActive: true },
      group: ['influencerId'],
      raw: true,
    });

    const countsMap = new Map<number, number>();
    counts.forEach((row: any) => {
      countsMap.set(row.influencerId, parseInt(row.count));
    });
    return countsMap;
  }

  /**
   * Batch Helper: Get completed campaigns count for multiple influencers
   */
  private async getBatchCompletedCampaignsCounts(
    influencerIds: number[],
  ): Promise<Map<number, number>> {
    if (influencerIds.length === 0) return new Map();

    const counts = await this.experienceModel.findAll({
      attributes: [
        'influencerId',
        [this.experienceModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      where: { influencerId: influencerIds },
      group: ['influencerId'],
      raw: true,
    });

    const countsMap = new Map<number, number>();
    counts.forEach((row: any) => {
      countsMap.set(row.influencerId, parseInt(row.count));
    });
    return countsMap;
  }
}
