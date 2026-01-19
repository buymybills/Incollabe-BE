import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramService } from './instagram.service';
import { GeminiAIService } from './gemini-ai.service';
import { InstagramMediaInsight } from '../models/instagram-media-insight.model';
import { InstagramProfileGrowth } from '../models/instagram-profile-growth.model';
import { InstagramProfileAnalysis } from '../models/instagram-profile-analysis.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { InstagramMedia } from '../models/instagram-media.model';
import { InfluencerCredibilityScore } from '../models/influencer-credibility-score.model';

export interface CredibilityScore {
  // Overall Score
  totalScore: number;
  maxScore: 100;

  // Category Scores
  audienceQuality: AudienceQualityScore;
  contentPerformance: ContentPerformanceScore;
  consistencyReliability: ConsistencyReliabilityScore;
  contentIntelligence: ContentIntelligenceScore;
  brandSafetyTrust: BrandSafetyTrustScore;

  // Metadata
  calculatedAt: Date;
  influencerId: number;
  instagramUsername: string;
}

export interface AudienceQualityScore {
  total: number;
  maxPoints: 25;
  breakdown: {
    followerAuthenticity: { score: number; maxPoints: 8; details: any };
    engagementRatio: { score: number; maxPoints: 7; details: any };
    followerGrowthTrend: { score: number; maxPoints: 5; details: any };
    audienceGeoRelevance: { score: number; maxPoints: 3; details: any };
    demographicStability: { score: number; maxPoints: 2; details: any };
  };
}

export interface ContentPerformanceScore {
  total: number;
  maxPoints: 25;
  breakdown: {
    reachToFollowerRatio: { score: number; maxPoints: 8; details: any };
    saveShareImpact: { score: number; maxPoints: 7; details: any };
    retentionProxy: { score: number; maxPoints: 5; details: any };
    storyEngagement: { score: number; maxPoints: 3; details: any };
    performanceConsistency: { score: number; maxPoints: 2; details: any };
  };
}

export interface ConsistencyReliabilityScore {
  total: number;
  maxPoints: 20;
  breakdown: {
    postingConsistency: { score: number; maxPoints: 6; details: any };
    campaignCompletionRate: { score: number; maxPoints: 6; details: any };
    incomeConsistency: { score: number; maxPoints: 4; details: any };
    responsiveness: { score: number; maxPoints: 2; details: any };
    inactivityPenalty: { score: number; maxPoints: 2; details: any };
  };
}

export interface ContentIntelligenceScore {
  total: number;
  maxPoints: 20;
  breakdown: {
    nicheClarity: { score: number; maxPoints: 6; details: any };
    visualProductionQuality: { score: number; maxPoints: 6; details: any };
    languageMarketFit: { score: number; maxPoints: 4; details: any };
    brandAlignment: { score: number; maxPoints: 4; details: any };
  };
}

export interface BrandSafetyTrustScore {
  total: number;
  maxPoints: 10;
  breakdown: {
    policyCompliance: { score: number; maxPoints: 4; details: any };
    sentimentStability: { score: number; maxPoints: 3; details: any };
    disclosureDiscipline: { score: number; maxPoints: 2; details: any };
    platformTrustSignals: { score: number; maxPoints: 1; details: any };
  };
}

@Injectable()
export class InfluencerCredibilityScoringService {
  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(InstagramMediaInsight)
    private instagramMediaInsightModel: typeof InstagramMediaInsight,
    @InjectModel(InstagramProfileGrowth)
    private instagramProfileGrowthModel: typeof InstagramProfileGrowth,
    @InjectModel(InstagramProfileAnalysis)
    private instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(InstagramMedia)
    private instagramMediaModel: typeof InstagramMedia,
    @InjectModel(InfluencerCredibilityScore)
    private influencerCredibilityScoreModel: typeof InfluencerCredibilityScore,
    private instagramService: InstagramService,
    private geminiAIService: GeminiAIService,
  ) {}

  /**
   * Calculate comprehensive credibility score for an influencer
   */
  async calculateCredibilityScore(influencerId: number): Promise<CredibilityScore> {
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }

    if (!influencer.instagramUserId) {
      throw new BadRequestException('Influencer must have Instagram connected to calculate credibility score');
    }

    // Calculate all category scores in parallel
    const [
      audienceQuality,
      contentPerformance,
      consistencyReliability,
      contentIntelligence,
      brandSafetyTrust,
    ] = await Promise.all([
      this.calculateAudienceQuality(influencer),
      this.calculateContentPerformance(influencer),
      this.calculateConsistencyReliability(influencer),
      this.calculateContentIntelligence(influencer),
      this.calculateBrandSafetyTrust(influencer),
    ]);

    const totalScore =
      audienceQuality.total +
      contentPerformance.total +
      consistencyReliability.total +
      contentIntelligence.total +
      brandSafetyTrust.total;

    return {
      totalScore: Number(totalScore.toFixed(2)),
      maxScore: 100,
      audienceQuality,
      contentPerformance,
      consistencyReliability,
      contentIntelligence,
      brandSafetyTrust,
      calculatedAt: new Date(),
      influencerId,
      instagramUsername: influencer.instagramUsername || '',
    };
  }

  /**
   * 1. AUDIENCE QUALITY (25 points)
   */
  private async calculateAudienceQuality(influencer: Influencer): Promise<AudienceQualityScore> {
    // 1.1 Follower Authenticity (8 pts) - Assumes 90% real followers (placeholder)
    const followerAuthenticity = await this.calculateFollowerAuthenticity(influencer);

    // 1.2 Engagement Ratio (7 pts)
    const engagementRatio = await this.calculateEngagementRatio(influencer);

    // 1.3 Follower Growth Trend (5 pts)
    const followerGrowthTrend = await this.calculateFollowerGrowthTrend(influencer);

    // 1.4 Audience Geo Relevance (3 pts)
    const audienceGeoRelevance = await this.calculateAudienceGeoRelevance(influencer);

    // 1.5 Demographic Stability (2 pts)
    const demographicStability = await this.calculateDemographicStability(influencer);

    const total =
      followerAuthenticity.score +
      engagementRatio.score +
      followerGrowthTrend.score +
      audienceGeoRelevance.score +
      demographicStability.score;

    return {
      total: Number(total.toFixed(2)),
      maxPoints: 25,
      breakdown: {
        followerAuthenticity,
        engagementRatio,
        followerGrowthTrend,
        audienceGeoRelevance,
        demographicStability,
      },
    };
  }

  /**
   * 1.1 Follower Authenticity (8 points)
   * Formula: Authenticity Score = (% Real Followers) × 8
   * Enhanced with multiple signals: engagement rate, follower/following ratio, growth pattern
   */
  private async calculateFollowerAuthenticity(influencer: Influencer): Promise<{ score: number; maxPoints: 8; details: any }> {
    const recentInsights = await this.getRecentMediaInsights(influencer.id, 10);

    if (recentInsights.length === 0 || !influencer.instagramFollowersCount) {
      return {
        score: 0,
        maxPoints: 8,
        details: { authenticityPercentage: 0, method: 'No data available' },
      };
    }

    // Signal 1: Engagement Rate (40% weight)
    const avgEngagement = this.calculateAverageEngagement(recentInsights, influencer.instagramFollowersCount);
    let engagementScore = 0.5; // Default 50%
    if (avgEngagement > 5) engagementScore = 0.9;
    else if (avgEngagement >= 3) engagementScore = 0.7;
    else if (avgEngagement >= 1) engagementScore = 0.6;

    // Signal 2: Follower/Following Ratio (30% weight)
    const followersCount = influencer.instagramFollowersCount || 1;
    const followingCount = influencer.instagramFollowsCount || 1;
    const ratio = followersCount / followingCount;
    let ratioScore = 0.5; // Default 50%
    if (ratio > 10) ratioScore = 1.0; // Strong signal of authenticity
    else if (ratio > 5) ratioScore = 0.85;
    else if (ratio > 2) ratioScore = 0.7;
    else if (ratio > 1) ratioScore = 0.6;
    else ratioScore = 0.4; // Following more than followers = suspicious

    // Signal 3: Growth Pattern (30% weight)
    const growthData = await this.instagramProfileGrowthModel.findAll({
      where: { influencerId: influencer.id },
      order: [['snapshotDate', 'DESC']],
      limit: 30, // Last 30 days
    });

    let growthScore = 0.75; // Default assuming organic growth
    if (growthData.length >= 7) {
      // Check for sudden spikes (indicating bought followers)
      const dailyGrowths: number[] = [];
      for (let i = 0; i < growthData.length - 1; i++) {
        const growth = (growthData[i].followersCount || 0) - (growthData[i + 1].followersCount || 0);
        dailyGrowths.push(growth);
      }

      if (dailyGrowths.length > 0) {
        const avgDailyGrowth = dailyGrowths.reduce((sum, g) => sum + g, 0) / dailyGrowths.length;
        const maxGrowth = Math.max(...dailyGrowths);

        // If any day has >10x average growth, suspicious
        if (maxGrowth > avgDailyGrowth * 10 && avgDailyGrowth > 0) {
          growthScore = 0.5; // Suspicious spike
        } else if (maxGrowth > avgDailyGrowth * 5) {
          growthScore = 0.65; // Moderate spike
        } else {
          growthScore = 0.9; // Steady organic growth
        }
      }
    }

    // Weighted average: engagement (40%) + ratio (30%) + growth (30%)
    const authenticityPercentage = (
      engagementScore * 0.4 +
      ratioScore * 0.3 +
      growthScore * 0.3
    ) * 100;

    const score = (authenticityPercentage / 100) * 8;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 8,
      details: {
        authenticityPercentage: Number(authenticityPercentage.toFixed(2)),
        method: 'Multi-signal authenticity analysis',
        avgEngagement: Number(avgEngagement.toFixed(2)),
        followerFollowingRatio: Number(ratio.toFixed(2)),
        growthPattern: growthScore > 0.8 ? 'organic' : growthScore > 0.6 ? 'moderate' : 'suspicious',
        signals: {
          engagementScore: Number((engagementScore * 100).toFixed(1)),
          ratioScore: Number((ratioScore * 100).toFixed(1)),
          growthScore: Number((growthScore * 100).toFixed(1)),
        },
      },
    };
  }

  /**
   * 1.2 Engagement Ratio (7 points)
   * Formula: Engagement Score = min(Engagement Rate / Benchmark, 1) × 7
   */
  private async calculateEngagementRatio(influencer: Influencer): Promise<{ score: number; maxPoints: 7; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [['fetchedAt', 'DESC']],
    });

    if (recentInsights.length === 0 || !influencer.instagramFollowersCount) {
      return {
        score: 0,
        maxPoints: 7,
        details: { engagementRate: 0, benchmark: 3, timeWindow: 'Last 30 days' },
      };
    }

    const avgEngagement = this.calculateAverageEngagement(recentInsights, influencer.instagramFollowersCount);
    const benchmark = 3; // 3% is a good engagement rate benchmark

    const score = Math.min(avgEngagement / benchmark, 1) * 7;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 7,
      details: {
        engagementRate: Number(avgEngagement.toFixed(2)),
        benchmark,
        totalPosts: recentInsights.length,
        timeWindow: 'Last 30 days',
      },
    };
  }

  /**
   * 1.3 Follower Growth Trend (5 points)
   * Formula: Growth Score = clamp(Growth Rate / Expected Growth, 0, 1) × 5
   */
  private async calculateFollowerGrowthTrend(influencer: Influencer): Promise<{ score: number; maxPoints: 5; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const growthData = await this.instagramProfileGrowthModel.findAll({
      where: {
        influencerId: influencer.id,
        snapshotDate: { [Op.gte]: thirtyDaysAgo },
      },
      order: [['snapshotDate', 'ASC']],
    });

    if (growthData.length < 2) {
      return {
        score: 0,
        maxPoints: 5,
        details: { growthRate: 0, message: 'Insufficient growth data' },
      };
    }

    const oldestFollowers = growthData[0].followersCount || 0;
    const latestFollowers = growthData[growthData.length - 1].followersCount || 0;

    const growthRate = oldestFollowers > 0
      ? ((latestFollowers - oldestFollowers) / oldestFollowers) * 100
      : 0;

    const expectedGrowth = 5; // 5% monthly growth is good
    const score = Math.max(0, Math.min(growthRate / expectedGrowth, 1)) * 5;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 5,
      details: {
        growthRate: Number(growthRate.toFixed(2)),
        expectedGrowth,
        followersStart: oldestFollowers,
        followersEnd: latestFollowers,
      },
    };
  }

  /**
   * 1.4 Audience Geo Relevance (3 points)
   * Formula: Geo Score = (% Target Geography Audience) × 3
   */
  private async calculateAudienceGeoRelevance(influencer: Influencer): Promise<{ score: number; maxPoints: 3; details: any }> {
    try {
      const demographics = await this.instagramService.getAudienceDemographics(influencer.id, 'influencer');

      const indiaAudience = demographics.countries.find((c: any) => c.code === 'IN');
      const indiaPercentage = indiaAudience?.percentage || 0;

      const score = (indiaPercentage / 100) * 3;

      return {
        score: Number(score.toFixed(2)),
        maxPoints: 3,
        details: {
          targetCountry: 'India',
          targetAudiencePercentage: indiaPercentage,
          topCountries: demographics.countries.slice(0, 5),
        },
      };
    } catch (error) {
      return {
        score: 0,
        maxPoints: 3,
        details: { error: 'Unable to fetch demographics' },
      };
    }
  }

  /**
   * 1.5 Demographic Stability (2 points)
   * Formula: Stability Score = (1 – Demographic Variance Index) × 2
   * Measures volatility in age/gender mix over time
   */
  private async calculateDemographicStability(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    try {
      // Fetch historical demographic snapshots (last 30 days, need at least 2 snapshots)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
        where: {
          influencerId: influencer.id,
          createdAt: { [Op.gte]: thirtyDaysAgo },
        },
        order: [['createdAt', 'ASC']],
        limit: 10, // Last 10 snapshots max
      });

      // Filter to only include snapshots with demographic data
      const historicalSnapshots = allSnapshots.filter(
        snapshot => snapshot.audienceAgeGender && snapshot.audienceAgeGender.length > 0
      );

      // Need at least 2 snapshots to calculate variance
      if (historicalSnapshots.length < 2) {
        return {
          score: 1.5, // Default score when insufficient data
          maxPoints: 2,
          details: {
            method: 'Insufficient historical data (need at least 2 snapshots)',
            snapshotsFound: historicalSnapshots.length,
            variance: 0.25,
          },
        };
      }

      // Build a map of demographic segments across all snapshots
      const segmentVariances: { [key: string]: number[] } = {};

      for (const snapshot of historicalSnapshots) {
        if (!snapshot.audienceAgeGender || snapshot.audienceAgeGender.length === 0) continue;

        for (const segment of snapshot.audienceAgeGender) {
          const key = `${segment.ageRange}_${segment.gender || 'ALL'}`;
          if (!segmentVariances[key]) {
            segmentVariances[key] = [];
          }
          segmentVariances[key].push(segment.percentage);
        }
      }

      // Calculate variance for each demographic segment
      const varianceScores: number[] = [];

      for (const [segmentKey, percentages] of Object.entries(segmentVariances)) {
        if (percentages.length < 2) continue; // Need at least 2 data points

        // Calculate standard deviation
        const mean = percentages.reduce((sum, val) => sum + val, 0) / percentages.length;
        const squaredDiffs = percentages.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / percentages.length;
        const stdDev = Math.sqrt(variance);

        // Normalize to 0-1 scale (assuming max reasonable std dev is 10 percentage points)
        const normalizedVariance = Math.min(stdDev / 10, 1);
        varianceScores.push(normalizedVariance);
      }

      // Calculate average variance index
      let varianceIndex = 0;
      if (varianceScores.length > 0) {
        varianceIndex = varianceScores.reduce((sum, v) => sum + v, 0) / varianceScores.length;
      } else {
        // No valid segments found, assume moderate stability
        varianceIndex = 0.25;
      }

      // Apply formula: Stability Score = (1 – Demographic Variance Index) × 2
      const stabilityScore = (1 - varianceIndex) * 2;

      return {
        score: Number(stabilityScore.toFixed(2)),
        maxPoints: 2,
        details: {
          method: 'Calculated from historical demographic variance',
          snapshotsAnalyzed: historicalSnapshots.length,
          segmentsTracked: Object.keys(segmentVariances).length,
          varianceIndex: Number(varianceIndex.toFixed(4)),
          formula: 'Stability Score = (1 – Demographic Variance Index) × 2',
        },
      };
    } catch (error) {
      // Fallback to default if calculation fails
      return {
        score: 1.5,
        maxPoints: 2,
        details: {
          method: 'Error calculating variance, using default',
          error: error.message,
          variance: 0.25,
        },
      };
    }
  }

  /**
   * 2. CONTENT PERFORMANCE (25 points)
   */
  private async calculateContentPerformance(influencer: Influencer): Promise<ContentPerformanceScore> {
    // 2.1 Reach-to-Follower Ratio (8 pts)
    const reachToFollowerRatio = await this.calculateReachToFollowerRatio(influencer);

    // 2.2 Saves & Shares Impact (7 pts)
    const saveShareImpact = await this.calculateSaveShareImpact(influencer);

    // 2.3 Retention Proxy (5 pts)
    const retentionProxy = await this.calculateRetentionProxy(influencer);

    // 2.4 Story Engagement (3 pts)
    const storyEngagement = await this.calculateStoryEngagement(influencer);

    // 2.5 Performance Consistency (2 pts)
    const performanceConsistency = await this.calculatePerformanceConsistency(influencer);

    const total =
      reachToFollowerRatio.score +
      saveShareImpact.score +
      retentionProxy.score +
      storyEngagement.score +
      performanceConsistency.score;

    return {
      total: Number(total.toFixed(2)),
      maxPoints: 25,
      breakdown: {
        reachToFollowerRatio,
        saveShareImpact,
        retentionProxy,
        storyEngagement,
        performanceConsistency,
      },
    };
  }

  /**
   * 2.1 Reach-to-Follower Ratio (8 points)
   * Formula: Virality Ratio = Avg Reach / Followers, Score = min(Ratio / 1.0, 1) × 8
   */
  private async calculateReachToFollowerRatio(influencer: Influencer): Promise<{ score: number; maxPoints: 8; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [['fetchedAt', 'DESC']],
    });

    if (recentInsights.length === 0 || !influencer.instagramFollowersCount) {
      return {
        score: 0,
        maxPoints: 8,
        details: { viralityRatio: 0, timeWindow: 'Last 30 days' },
      };
    }

    const totalReach = recentInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
    const avgReach = totalReach / recentInsights.length;
    const viralityRatio = avgReach / influencer.instagramFollowersCount;

    const score = Math.min(viralityRatio / 1.0, 1) * 8;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 8,
      details: {
        viralityRatio: Number(viralityRatio.toFixed(2)),
        avgReach: Math.round(avgReach),
        followers: influencer.instagramFollowersCount,
        postsAnalyzed: recentInsights.length,
        timeWindow: 'Last 30 days',
      },
    };
  }

  /**
   * 2.2 Saves & Shares Impact (7 points)
   * Formula: Save+Share Rate = (Avg Saves + Shares) / Reach, Score = min(Rate / Benchmark, 1) × 7
   */
  private async calculateSaveShareImpact(influencer: Influencer): Promise<{ score: number; maxPoints: 7; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [['fetchedAt', 'DESC']],
    });

    if (recentInsights.length === 0) {
      return {
        score: 0,
        maxPoints: 7,
        details: { saveShareRate: 0, timeWindow: 'Last 30 days' },
      };
    }

    const totalSaves = recentInsights.reduce((sum, insight) => sum + (insight.saved || 0), 0);
    const totalShares = recentInsights.reduce((sum, insight) => sum + (insight.shares || 0), 0);
    const totalReach = recentInsights.reduce((sum, insight) => sum + (insight.reach || 1), 0);

    const saveShareRate = ((totalSaves + totalShares) / totalReach) * 100;
    const benchmark = 5; // 5% save+share rate is good

    const score = Math.min(saveShareRate / benchmark, 1) * 7;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 7,
      details: {
        saveShareRate: Number(saveShareRate.toFixed(2)),
        benchmark,
        avgSaves: Math.round(totalSaves / recentInsights.length),
        avgShares: Math.round(totalShares / recentInsights.length),
        postsAnalyzed: recentInsights.length,
        timeWindow: 'Last 30 days',
      },
    };
  }

  /**
   * 2.3 Retention Proxy (5 points)
   * TEMPORARY: Full points awarded to all influencers
   * TODO: Implement proper retention tracking when video insights are available
   */
  private async calculateRetentionProxy(_influencer: Influencer): Promise<{ score: number; maxPoints: 5; details: any }> {
    return {
      score: 5.0,
      maxPoints: 5,
      details: {
        method: 'Default full score - retention tracking not yet implemented',
        note: 'All influencers receive full 5 points until video play metrics are properly tracked',
      },
    };
  }

  /**
   * 2.4 Story Engagement (3 points)
   * TEMPORARY: Full points awarded to all influencers
   * TODO: Implement proper story insights tracking when Facebook Page connection is available
   */
  private async calculateStoryEngagement(_influencer: Influencer): Promise<{ score: number; maxPoints: 3; details: any }> {
    return {
      score: 3.0,
      maxPoints: 3,
      details: {
        method: 'Default full score - story insights not yet available',
        note: 'All influencers receive full 3 points until Instagram Story insights are properly tracked',
      },
    };
  }

  /**
   * 2.5 Performance Consistency (2 points)
   * Formula: Consistency Score = 1 / (1 + CV) × 2
   * CV (Coefficient of Variation) = Std Dev / Avg Reach
   */
  private async calculatePerformanceConsistency(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
      order: [['fetchedAt', 'DESC']],
    });

    if (recentInsights.length < 5) {
      return {
        score: 0,
        maxPoints: 2,
        details: { message: 'Insufficient data for consistency calculation (need at least 5 posts in last 30 days)' },
      };
    }

    const reaches = recentInsights.map(i => i.reach || 0);
    const avgReach = reaches.reduce((sum, r) => sum + r, 0) / reaches.length;
    const variance = reaches.reduce((sum, r) => sum + Math.pow(r - avgReach, 2), 0) / reaches.length;
    const stdDev = Math.sqrt(variance);

    // Calculate Coefficient of Variation (CV)
    const cv = avgReach > 0 ? stdDev / avgReach : 0;

    // Apply corrected formula: Consistency Score = 1 / (1 + CV)
    const consistencyScore = 1 / (1 + cv);
    const score = consistencyScore * 2;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 2,
      details: {
        coefficientOfVariation: Number(cv.toFixed(3)),
        consistencyScore: Number((consistencyScore * 100).toFixed(2)),
        avgReach: Math.round(avgReach),
        stdDev: Math.round(stdDev),
        postsAnalyzed: reaches.length,
        timeWindow: 'Last 30 days',
        formula: 'Consistency Score = 1 / (1 + CV) × 2',
      },
    };
  }

  /**
   * 3. CONSISTENCY & RELIABILITY (20 points)
   */
  private async calculateConsistencyReliability(influencer: Influencer): Promise<ConsistencyReliabilityScore> {
    // 3.1 Posting Consistency (6 pts)
    const postingConsistency = await this.calculatePostingConsistency(influencer);

    // 3.2 Campaign Completion Rate (6 pts)
    const campaignCompletionRate = await this.calculateCampaignCompletionRate(influencer);

    // 3.3 Income Consistency (4 pts)
    const incomeConsistency = await this.calculateIncomeConsistency(influencer);

    // 3.4 Responsiveness (2 pts)
    const responsiveness = await this.calculateResponsiveness(influencer);

    // 3.5 Inactivity Penalty (2 pts)
    const inactivityPenalty = await this.calculateInactivityPenalty(influencer);

    const total =
      postingConsistency.score +
      campaignCompletionRate.score +
      incomeConsistency.score +
      responsiveness.score +
      inactivityPenalty.score;

    return {
      total: Number(total.toFixed(2)),
      maxPoints: 20,
      breakdown: {
        postingConsistency,
        campaignCompletionRate,
        incomeConsistency,
        responsiveness,
        inactivityPenalty,
      },
    };
  }

  /**
   * 3.1 Posting Consistency (6 points)
   * Formula: Posting Score = min(Actual Posts / Ideal Posts, 1) × 6
   */
  private async calculatePostingConsistency(influencer: Influencer): Promise<{ score: number; maxPoints: 6; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await this.instagramMediaInsightModel.count({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const idealPosts = 12; // 3-4 posts per week
    const score = Math.min(recentPosts / idealPosts, 1) * 6;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 6,
      details: {
        actualPosts: recentPosts,
        idealPosts,
        period: '30 days',
      },
    };
  }

  /**
   * 3.2 Campaign Completion Rate (6 points)
   * Formula: Completion Score = (Non-Withdrawn Selected / Total Selected) × 6
   */
  private async calculateCampaignCompletionRate(influencer: Influencer): Promise<{ score: number; maxPoints: 6; details: any }> {
    const selectedApplications = await this.campaignApplicationModel.count({
      where: {
        influencerId: influencer.id,
        status: 'selected',
      },
    });

    const withdrawnApplications = await this.campaignApplicationModel.count({
      where: {
        influencerId: influencer.id,
        status: 'withdrawn',
      },
    });

    if (selectedApplications === 0) {
      return {
        score: 3, // Default mid-range for new influencers
        maxPoints: 6,
        details: { message: 'No campaign history' },
      };
    }

    // Assume selected campaigns that weren't withdrawn were completed
    const completedCampaigns = selectedApplications;
    const totalCampaigns = selectedApplications + withdrawnApplications;
    const completionRate = totalCampaigns > 0 ? completedCampaigns / totalCampaigns : 1;
    const score = completionRate * 6;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 6,
      details: {
        completionRate: Number((completionRate * 100).toFixed(2)),
        selectedCampaigns: selectedApplications,
        withdrawnCampaigns: withdrawnApplications,
        totalCampaigns,
      },
    };
  }

  /**
   * 3.3 Income Consistency (4 points)
   * Formula: Income Score = (1 – Income Variance) × 4
   * Using campaign completion rate + posting consistency as proxy
   */
  private async calculateIncomeConsistency(influencer: Influencer): Promise<{ score: number; maxPoints: 4; details: any }> {
    // Proxy approach: High campaign completion + consistent posting = consistent income

    // Get campaign completion rate
    const selectedApplications = await this.campaignApplicationModel.count({
      where: {
        influencerId: influencer.id,
        status: 'selected',
      },
    });

    const withdrawnApplications = await this.campaignApplicationModel.count({
      where: {
        influencerId: influencer.id,
        status: 'withdrawn',
      },
    });

    let campaignCompletionRate = 1; // Default 100%
    const totalCampaigns = selectedApplications + withdrawnApplications;
    if (totalCampaigns > 0) {
      campaignCompletionRate = selectedApplications / totalCampaigns;
    }

    // Get posting consistency (from last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await this.instagramMediaInsightModel.count({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const idealPosts = 12; // 3-4 posts per week
    const postingConsistencyRate = Math.min(recentPosts / idealPosts, 1);

    // Income consistency = 70% campaign completion + 30% posting consistency
    // Consistent campaigns + consistent output = consistent income
    const consistencyScore = campaignCompletionRate * 0.7 + postingConsistencyRate * 0.3;
    const score = consistencyScore * 4;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 4,
      details: {
        method: 'Campaign completion + posting consistency proxy',
        campaignCompletionRate: Number((campaignCompletionRate * 100).toFixed(2)),
        postingConsistencyRate: Number((postingConsistencyRate * 100).toFixed(2)),
        totalCampaigns,
        selectedCampaigns: selectedApplications,
        withdrawnCampaigns: withdrawnApplications,
        recentPosts,
        formula: 'Income Consistency ≈ (Campaign Completion × 0.7) + (Posting Consistency × 0.3)',
        note: 'Using proxy until earnings tracking is implemented',
      },
    };
  }

  /**
   * 3.4 Responsiveness (2 points)
   * Formula: Response Time Score = (1 – Avg Response Time / Max Acceptable Time) × 2
   * Using last login activity + posting frequency as proxy
   */
  private async calculateResponsiveness(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    // Proxy approach: Recent activity = likely responsive

    const now = Date.now();
    const lastLogin = influencer.updatedAt.getTime();
    const daysSinceLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));

    // Score based on last login
    let loginScore = 0;
    if (daysSinceLogin < 3) loginScore = 1.0; // Very active
    else if (daysSinceLogin < 7) loginScore = 0.85; // Active
    else if (daysSinceLogin < 14) loginScore = 0.65; // Moderately active
    else if (daysSinceLogin < 30) loginScore = 0.45; // Less active
    else loginScore = 0.25; // Inactive

    // Check posting frequency (recent activity indicator)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPosts = await this.instagramMediaInsightModel.count({
      where: {
        influencerId: influencer.id,
        fetchedAt: { [Op.gte]: sevenDaysAgo },
      },
    });

    let postingScore = 0;
    if (recentPosts >= 3) postingScore = 1.0; // Very active poster
    else if (recentPosts >= 2) postingScore = 0.8; // Active poster
    else if (recentPosts >= 1) postingScore = 0.6; // Moderate poster
    else postingScore = 0.4; // Less active

    // Responsiveness = 60% login activity + 40% posting activity
    const responsivenessScore = loginScore * 0.6 + postingScore * 0.4;
    const score = responsivenessScore * 2;

    let activityLevel = 'inactive';
    if (responsivenessScore > 0.8) activityLevel = 'very active';
    else if (responsivenessScore > 0.6) activityLevel = 'active';
    else if (responsivenessScore > 0.4) activityLevel = 'moderate';

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 2,
      details: {
        method: 'Last login + posting activity proxy',
        daysSinceLogin,
        recentPosts: recentPosts,
        activityLevel,
        loginScore: Number((loginScore * 100).toFixed(1)),
        postingScore: Number((postingScore * 100).toFixed(1)),
        formula: 'Responsiveness ≈ (Login Activity × 0.6) + (Posting Activity × 0.4)',
        note: 'Using proxy until message tracking is implemented',
      },
    };
  }

  /**
   * 3.5 Inactivity Penalty (2 points)
   * Formula: Inactivity Score = max(0, 1 – Inactive Days / Threshold) × 2
   */
  private async calculateInactivityPenalty(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    const lastLogin = influencer.updatedAt; // Using updatedAt as proxy
    const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

    const threshold = 30; // 30 days threshold
    const score = Math.max(0, 1 - (daysSinceLogin / threshold)) * 2;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 2,
      details: {
        daysSinceLogin,
        threshold,
      },
    };
  }

  /**
   * 4. CONTENT INTELLIGENCE (AI) (20 points)
   */
  private async calculateContentIntelligence(influencer: Influencer): Promise<ContentIntelligenceScore> {
    // 4.1 Niche Clarity (6 pts)
    const nicheClarity = await this.calculateNicheClarity(influencer);

    // 4.2 Visual & Production Quality (6 pts)
    const visualProductionQuality = await this.calculateVisualProductionQuality(influencer);

    // 4.3 Language & Market Fit (4 pts)
    const languageMarketFit = await this.calculateLanguageMarketFit(influencer);

    // 4.4 Brand Alignment (4 pts)
    const brandAlignment = await this.calculateBrandAlignment(influencer);

    const total =
      nicheClarity.score +
      visualProductionQuality.score +
      languageMarketFit.score +
      brandAlignment.score;

    return {
      total: Number(total.toFixed(2)),
      maxPoints: 20,
      breakdown: {
        nicheClarity,
        visualProductionQuality,
        languageMarketFit,
        brandAlignment,
      },
    };
  }

  /**
   * 4.1 Niche Clarity (6 points)
   * Formula: Niche Score = (1 – Entropy) × 6
   */
  private async calculateNicheClarity(influencer: Influencer): Promise<{ score: number; maxPoints: 6; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      // Fallback when AI is not available
      const nicheEntropy = 0.3;
      const score = (1 - nicheEntropy) * 6;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 6,
        details: {
          nicheEntropy,
          method: 'AI not available - using default',
        },
      };
    }

    try {
      // Fetch recent media for analysis
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);

      if (recentMedia.length === 0) {
        return {
          score: 0,
          maxPoints: 6,
          details: { method: 'No media available for analysis' },
        };
      }

      // Extract captions and analyze first 5 images
      const captions = recentMedia.map(m => m.caption);
      const visualAnalyses: any[] = [];

      for (const media of recentMedia.slice(0, 5)) {
        try {
          const visual = await this.geminiAIService.analyzeVisualQuality(media.mediaUrl);
          visualAnalyses.push(visual);
        } catch (error) {
          // Continue even if some images fail
        }
      }

      // Detect niche using Gemini AI
      const nicheResult = await this.geminiAIService.detectNiche(captions, visualAnalyses);

      // Calculate entropy from confidence
      // High confidence (e.g., 90%) = low entropy (0.1), focused niche
      // Low confidence (e.g., 30%) = high entropy (0.7), unfocused
      const nicheEntropy = 1 - (nicheResult.confidence / 100);
      const score = (1 - nicheEntropy) * 6;

      return {
        score: Number(score.toFixed(2)),
        maxPoints: 6,
        details: {
          method: 'AI-powered niche detection',
          primaryNiche: nicheResult.primaryNiche,
          secondaryNiches: nicheResult.secondaryNiches,
          confidence: nicheResult.confidence,
          keywords: nicheResult.keywords,
          nicheEntropy: Number(nicheEntropy.toFixed(3)),
          formula: 'Niche Score = (1 – Entropy) × 6',
        },
      };
    } catch (error) {
      // Fallback on error
      const nicheEntropy = 0.3;
      const score = (1 - nicheEntropy) * 6;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 6,
        details: {
          nicheEntropy,
          method: 'AI analysis failed - using default',
          error: error.message,
        },
      };
    }
  }

  /**
   * 4.2 Visual & Production Quality (6 points)
   * Formula: Quality Score = Avg(AI Subscores) × 6
   */
  private async calculateVisualProductionQuality(influencer: Influencer): Promise<{ score: number; maxPoints: 6; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      // Fallback when AI is not available
      const avgQualityScore = 0.75;
      const score = avgQualityScore * 6;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 6,
        details: {
          avgQualityScore,
          method: 'AI not available - using default',
        },
      };
    }

    try {
      // Fetch recent media for analysis
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);

      if (recentMedia.length === 0) {
        return {
          score: 0,
          maxPoints: 6,
          details: { method: 'No media available for analysis' },
        };
      }

      // Analyze visual quality of first 5-10 images
      const visualAnalyses: any[] = [];
      for (const media of recentMedia.slice(0, 10)) {
        try {
          const visual = await this.geminiAIService.analyzeVisualQuality(media.mediaUrl);
          visualAnalyses.push(visual);
        } catch (error) {
          // Continue even if some images fail
        }
      }

      if (visualAnalyses.length === 0) {
        return {
          score: 0,
          maxPoints: 6,
          details: { method: 'Visual analysis failed for all images' },
        };
      }

      // Calculate average quality score (0-100 -> 0-1)
      const avgOverallQuality = visualAnalyses.reduce((sum, v) => sum + v.overallQuality, 0) / visualAnalyses.length;
      const avgProfessionalScore = visualAnalyses.reduce((sum, v) => sum + v.professionalScore, 0) / visualAnalyses.length;

      // Combine overall quality and professional score (both are 0-100)
      const avgQualityScore = (avgOverallQuality + avgProfessionalScore) / 200; // Normalize to 0-1

      const score = avgQualityScore * 6;

      // Calculate detailed aesthetics averages
      const avgComposition = visualAnalyses.reduce((sum, v) => sum + v.aesthetics.composition, 0) / visualAnalyses.length;
      const avgLighting = visualAnalyses.reduce((sum, v) => sum + v.aesthetics.lighting, 0) / visualAnalyses.length;
      const avgColorHarmony = visualAnalyses.reduce((sum, v) => sum + v.aesthetics.colorHarmony, 0) / visualAnalyses.length;
      const avgClarity = visualAnalyses.reduce((sum, v) => sum + v.aesthetics.clarity, 0) / visualAnalyses.length;

      return {
        score: Number(score.toFixed(2)),
        maxPoints: 6,
        details: {
          method: 'AI-powered visual quality analysis',
          imagesAnalyzed: visualAnalyses.length,
          avgQualityScore: Number((avgQualityScore * 100).toFixed(2)),
          avgOverallQuality: Number(avgOverallQuality.toFixed(2)),
          avgProfessionalScore: Number(avgProfessionalScore.toFixed(2)),
          aesthetics: {
            composition: Number(avgComposition.toFixed(2)),
            lighting: Number(avgLighting.toFixed(2)),
            colorHarmony: Number(avgColorHarmony.toFixed(2)),
            clarity: Number(avgClarity.toFixed(2)),
          },
          formula: 'Quality Score = Avg(AI Subscores) × 6',
        },
      };
    } catch (error) {
      // Fallback on error
      const avgQualityScore = 0.75;
      const score = avgQualityScore * 6;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 6,
        details: {
          avgQualityScore,
          method: 'AI analysis failed - using default',
          error: error.message,
        },
      };
    }
  }

  /**
   * 4.3 Language & Market Fit (4 points)
   * Formula: Language Match Score = % Content in Target Language × 4
   */
  private async calculateLanguageMarketFit(influencer: Influencer): Promise<{ score: number; maxPoints: 4; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      // Fallback when AI is not available
      const targetLanguagePercentage = 80;
      const score = (targetLanguagePercentage / 100) * 4;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 4,
        details: {
          targetLanguagePercentage,
          targetLanguages: ['Hindi', 'English'],
          method: 'AI not available - using default',
        },
      };
    }

    try {
      // Fetch recent media for analysis
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);

      if (recentMedia.length === 0) {
        return {
          score: 0,
          maxPoints: 4,
          details: { method: 'No media available for analysis' },
        };
      }

      // Extract captions for language analysis
      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);

      if (captions.length === 0) {
        return {
          score: 0,
          maxPoints: 4,
          details: { method: 'No captions available for language analysis' },
        };
      }

      // Analyze language using Gemini AI
      const languageResult = await this.geminiAIService.analyzeLanguage(captions);

      // Calculate target language percentage (Hindi + English for India market)
      const targetLanguages = ['Hindi', 'English'];
      let targetLanguagePercentage = 0;

      for (const lang of targetLanguages) {
        if (languageResult.languagePercentages[lang]) {
          targetLanguagePercentage += languageResult.languagePercentages[lang];
        }
      }

      // Apply formula: Language Match Score = % Content in Target Language × 4
      const score = (targetLanguagePercentage / 100) * 4;

      return {
        score: Number(score.toFixed(2)),
        maxPoints: 4,
        details: {
          method: 'AI-powered language detection',
          primaryLanguage: languageResult.primaryLanguage,
          languagePercentages: languageResult.languagePercentages,
          targetLanguages,
          targetLanguagePercentage: Number(targetLanguagePercentage.toFixed(2)),
          marketFit: languageResult.marketFit,
          formula: 'Language Match Score = % Content in Target Language × 4',
        },
      };
    } catch (error) {
      // Fallback on error
      const targetLanguagePercentage = 80;
      const score = (targetLanguagePercentage / 100) * 4;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 4,
        details: {
          targetLanguagePercentage,
          targetLanguages: ['Hindi', 'English'],
          method: 'AI analysis failed - using default',
          error: error.message,
        },
      };
    }
  }

  /**
   * 4.4 Brand Alignment (4 points)
   * Formula: Brand Fit Score = (1 – Risk Content Ratio) × 4
   */
  private async calculateBrandAlignment(influencer: Influencer): Promise<{ score: number; maxPoints: 4; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      // Fallback when AI is not available
      const riskContentRatio = 0.05;
      const score = (1 - riskContentRatio) * 4;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 4,
        details: {
          riskContentRatio: Number((riskContentRatio * 100).toFixed(2)),
          method: 'AI not available - using default',
        },
      };
    }

    try {
      // Fetch recent media for analysis
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);

      if (recentMedia.length === 0) {
        return {
          score: 0,
          maxPoints: 4,
          details: { method: 'No media available for analysis' },
        };
      }

      // Analyze visual quality and brand safety
      const brandSafetyScores: number[] = [];
      for (const media of recentMedia.slice(0, 10)) {
        try {
          const visual = await this.geminiAIService.analyzeVisualQuality(media.mediaUrl);
          brandSafetyScores.push(visual.brandSafetyScore); // 0-100 score
        } catch (error) {
          // Continue even if some images fail
        }
      }

      if (brandSafetyScores.length === 0) {
        return {
          score: 0,
          maxPoints: 4,
          details: { method: 'Brand safety analysis failed for all images' },
        };
      }

      // Calculate average brand safety score (0-100)
      const avgBrandSafetyScore = brandSafetyScores.reduce((sum, s) => sum + s, 0) / brandSafetyScores.length;

      // Convert brand safety score to risk ratio
      // Brand safety score 100 = 0% risk, score 0 = 100% risk
      const riskContentRatio = (100 - avgBrandSafetyScore) / 100;

      // Apply formula: Brand Fit Score = (1 – Risk Content Ratio) × 4
      const score = (1 - riskContentRatio) * 4;

      return {
        score: Number(score.toFixed(2)),
        maxPoints: 4,
        details: {
          method: 'AI-powered brand safety analysis',
          imagesAnalyzed: brandSafetyScores.length,
          avgBrandSafetyScore: Number(avgBrandSafetyScore.toFixed(2)),
          riskContentRatio: Number((riskContentRatio * 100).toFixed(2)),
          formula: 'Brand Fit Score = (1 – Risk Content Ratio) × 4',
        },
      };
    } catch (error) {
      // Fallback on error
      const riskContentRatio = 0.05;
      const score = (1 - riskContentRatio) * 4;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 4,
        details: {
          riskContentRatio: Number((riskContentRatio * 100).toFixed(2)),
          method: 'AI analysis failed - using default',
          error: error.message,
        },
      };
    }
  }

  /**
   * 5. BRAND SAFETY & TRUST (10 points)
   */
  private async calculateBrandSafetyTrust(influencer: Influencer): Promise<BrandSafetyTrustScore> {
    // 5.1 Policy Compliance (4 pts)
    const policyCompliance = await this.calculatePolicyCompliance(influencer);

    // 5.2 Sentiment Stability (3 pts)
    const sentimentStability = await this.calculateSentimentStability(influencer);

    // 5.3 Disclosure Discipline (2 pts)
    const disclosureDiscipline = await this.calculateDisclosureDiscipline(influencer);

    // 5.4 Platform Trust Signals (1 pt)
    const platformTrustSignals = await this.calculatePlatformTrustSignals(influencer);

    const total =
      policyCompliance.score +
      sentimentStability.score +
      disclosureDiscipline.score +
      platformTrustSignals.score;

    return {
      total: Number(total.toFixed(2)),
      maxPoints: 10,
      breakdown: {
        policyCompliance,
        sentimentStability,
        disclosureDiscipline,
        platformTrustSignals,
      },
    };
  }

  /**
   * 5.1 Policy Compliance (4 points)
   * Formula: Compliance Score = (1 – Violation Rate) × 4
   * Starts with perfect score, uses AI to detect potential violations
   */
  private async calculatePolicyCompliance(influencer: Influencer): Promise<{ score: number; maxPoints: 4; details: any }> {
    // Start with perfect compliance (innocent until proven guilty)
    let violationScore = 0;
    const violations: string[] = [];

    // Optional: Use AI to scan for potential policy violations
    if (this.geminiAIService.isAvailable()) {
      try {
        const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);

        if (recentMedia.length > 0) {
          // Scan captions for policy violations (hate speech, misleading content, spam)
          const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);

          if (captions.length > 0) {
            // Use AI to detect inappropriate content
            const analysis = await this.analyzeContentForViolations(captions);
            violations.push(...analysis.violations);
            violationScore = analysis.violationScore;
          }
        }
      } catch (error) {
        // If AI analysis fails, maintain perfect score
        violationScore = 0;
      }
    }

    // Calculate violation rate
    const violationRate = violationScore;
    const score = (1 - violationRate) * 4;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 4,
      details: {
        violationRate: Number((violationRate * 100).toFixed(2)),
        violations: violations.length,
        violationTypes: violations,
        method: this.geminiAIService.isAvailable()
          ? 'AI content screening + manual violations'
          : 'Manual violations only (AI not available)',
        note: 'Starts with perfect score, deducts for detected violations',
      },
    };
  }

  /**
   * Helper: Analyze captions for policy violations using AI
   */
  private async analyzeContentForViolations(captions: string[]): Promise<{ violations: string[]; violationScore: number }> {
    // This is a simple implementation - can be enhanced
    const violations: string[] = [];
    let violationScore = 0;

    // Check for spam patterns
    const spamKeywords = ['click here', 'dm for paid promotion', 'buy followers', 'follow back', 'f4f', 'l4l'];
    const spamCount = captions.filter(caption =>
      spamKeywords.some(keyword => caption.toLowerCase().includes(keyword))
    ).length;

    if (spamCount > captions.length * 0.3) {
      violations.push('High spam indicator');
      violationScore += 0.2;
    }

    // Check for excessive promotional content
    const promoKeywords = ['buy now', 'limited offer', 'discount code', 'use code', 'shop now'];
    const promoCount = captions.filter(caption =>
      promoKeywords.some(keyword => caption.toLowerCase().includes(keyword))
    ).length;

    if (promoCount > captions.length * 0.7) {
      violations.push('Excessive promotional content');
      violationScore += 0.1;
    }

    return { violations, violationScore: Math.min(violationScore, 0.5) }; // Cap at 50% violation
  }

  /**
   * 5.2 Sentiment Stability (3 points)
   * Formula: Sentiment Score = Positive Sentiment Ratio × 3
   */
  private async calculateSentimentStability(influencer: Influencer): Promise<{ score: number; maxPoints: 3; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      // Fallback when AI is not available
      const positiveSentimentRatio = 0.85;
      const score = positiveSentimentRatio * 3;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 3,
        details: {
          positiveSentimentRatio: Number((positiveSentimentRatio * 100).toFixed(2)),
          method: 'AI not available - using default',
        },
      };
    }

    try {
      // Fetch recent media for analysis
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);

      if (recentMedia.length === 0) {
        return {
          score: 0,
          maxPoints: 3,
          details: { method: 'No media available for analysis' },
        };
      }

      // Extract captions for sentiment analysis
      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);

      if (captions.length === 0) {
        return {
          score: 0,
          maxPoints: 3,
          details: { method: 'No captions available for sentiment analysis' },
        };
      }

      // Analyze sentiment using Gemini AI
      const sentimentScore = await this.geminiAIService.analyzeSentiment(captions);

      // Convert sentiment score (-100 to +100) to positive ratio (0 to 1)
      // -100 = 0% positive, 0 = 50% positive, +100 = 100% positive
      const positiveSentimentRatio = (sentimentScore + 100) / 200;

      // Apply formula: Sentiment Score = Positive Sentiment Ratio × 3
      const score = positiveSentimentRatio * 3;

      return {
        score: Number(score.toFixed(2)),
        maxPoints: 3,
        details: {
          method: 'AI-powered sentiment analysis',
          captionsAnalyzed: captions.length,
          sentimentScore, // -100 to +100
          positiveSentimentRatio: Number((positiveSentimentRatio * 100).toFixed(2)),
          formula: 'Sentiment Score = Positive Sentiment Ratio × 3',
        },
      };
    } catch (error) {
      // Fallback on error
      const positiveSentimentRatio = 0.85;
      const score = positiveSentimentRatio * 3;
      return {
        score: Number(score.toFixed(2)),
        maxPoints: 3,
        details: {
          positiveSentimentRatio: Number((positiveSentimentRatio * 100).toFixed(2)),
          method: 'AI analysis failed - using default',
          error: error.message,
        },
      };
    }
  }

  /**
   * 5.3 Disclosure Discipline (2 points)
   * Formula: Disclosure Score = Proper Disclosure Rate × 2
   * INSTAGRAM-ONLY: Analyzes disclosure patterns from Instagram posts only
   */
  private async calculateDisclosureDiscipline(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    // Get all Instagram media posts (NO dependency on platform campaigns)
    const allMedia = await this.instagramMediaModel.findAll({
      where: { influencerId: influencer.id },
      order: [['timestamp', 'DESC']],
      limit: 100,
    });

    if (allMedia.length === 0) {
      return {
        score: 1.8, // Default good score if no posts yet
        maxPoints: 2,
        details: {
          properDisclosureRate: 90,
          method: 'Default - no Instagram posts available',
        },
      };
    }

    // Disclosure hashtags to look for
    const disclosureKeywords = [
      '#ad', '#sponsored', '#partnership', '#collab', '#collaboration',
      '#gifted', '#paidpartnership', '#ambassador', '#brandpartner'
    ];

    // Promotional keywords that indicate paid content
    const paidContentIndicators = [
      'use code', 'discount code', 'promo code', 'link in bio',
      'shop now', 'swipe up', 'check out', 'available at',
      'thank you', 'thanks to', 'partnering with', 'proud to partner'
    ];

    // Analyze all posts
    let postsWithDisclosure = 0;
    let suspectedPaidPosts = 0;
    let totalPosts = allMedia.length;

    for (const media of allMedia) {
      const caption = (media.caption || '').toLowerCase();

      // Check if post has disclosure
      const hasDisclosure = disclosureKeywords.some(keyword =>
        caption.includes(keyword.toLowerCase())
      );

      // Check if post appears to be paid content
      const appearsPaid = paidContentIndicators.some(indicator =>
        caption.includes(indicator.toLowerCase())
      );

      if (appearsPaid || hasDisclosure) {
        suspectedPaidPosts++;
        if (hasDisclosure) {
          postsWithDisclosure++;
        }
      }
    }

    // If no suspected paid content found, assume good disclosure practices
    if (suspectedPaidPosts === 0) {
      return {
        score: 1.8, // 90% - benefit of doubt
        maxPoints: 2,
        details: {
          properDisclosureRate: 90,
          totalPosts,
          suspectedPaidPosts: 0,
          method: 'No paid content detected - good organic profile',
          note: 'Score based on Instagram content only, independent of platform campaigns',
        },
      };
    }

    // Calculate disclosure rate: (posts with disclosure / suspected paid posts)
    const properDisclosureRate = postsWithDisclosure / suspectedPaidPosts;
    const score = properDisclosureRate * 2;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 2,
      details: {
        properDisclosureRate: Number((properDisclosureRate * 100).toFixed(2)),
        totalPosts,
        postsWithDisclosure,
        suspectedPaidPosts,
        organicPosts: totalPosts - suspectedPaidPosts,
        method: 'Instagram caption analysis (platform-independent)',
        disclosureKeywords,
        note: 'Analyzes Instagram posts only, not dependent on CollabKaroo campaigns',
      },
    };
  }

  /**
   * 5.4 Platform Trust Signals (1 point)
   * Formula: Trust Score = Trust Index × 1
   */
  private async calculatePlatformTrustSignals(influencer: Influencer): Promise<{ score: number; maxPoints: 1; details: any }> {
    // Check if account is verified, has business account, etc.
    let trustIndex = 0.5; // Base score

    if (influencer.instagramAccountType === 'BUSINESS' || influencer.instagramAccountType === 'CREATOR') {
      trustIndex += 0.3;
    }

    if (influencer.instagramFollowersCount && influencer.instagramFollowersCount > 10000) {
      trustIndex += 0.2;
    }

    const score = Math.min(trustIndex, 1) * 1;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 1,
      details: {
        trustIndex,
        accountType: influencer.instagramAccountType,
        followers: influencer.instagramFollowersCount,
      },
    };
  }

  /**
   * Helper: Get recent media insights
   */
  private async getRecentMediaInsights(influencerId: number, limit: number): Promise<InstagramMediaInsight[]> {
    return await this.instagramMediaInsightModel.findAll({
      where: { influencerId },
      order: [['fetchedAt', 'DESC']],
      limit,
    });
  }

  /**
   * Helper: Calculate average engagement rate
   */
  private calculateAverageEngagement(insights: InstagramMediaInsight[], followers: number): number {
    if (insights.length === 0 || followers === 0) return 0;

    const totalEngagement = insights.reduce((sum, insight) => {
      return sum + (insight.likes || 0) + (insight.comments || 0) + (insight.shares || 0);
    }, 0);

    const avgEngagement = totalEngagement / insights.length;
    return (avgEngagement / followers) * 100;
  }

  /**
   * Helper: Get recent media with captions and URLs for AI analysis
   */
  private async getRecentMediaForAI(influencerId: number, limit: number = 20): Promise<Array<{ caption: string; mediaUrl: string }>> {
    const mediaRecords = await this.instagramMediaModel.findAll({
      where: { influencerId },
      order: [['timestamp', 'DESC']],
      limit,
    });

    return mediaRecords
      .filter(m => m.mediaUrl && m.mediaType !== 'VIDEO') // Filter videos for now (images only)
      .map(m => ({
        caption: m.caption || '',
        mediaUrl: m.mediaUrl || '',
      }));
  }

  /**
   * Get aggregate analytics for influencer (last 30 days with growth comparison)
   */
  async getAggregateAnalytics(influencerId: number) {
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get insights for current period (last 30 days)
    const currentInsights = await this.instagramMediaInsightModel.findAll({
      where: {
        influencerId,
        fetchedAt: { [Op.gte]: thirtyDaysAgo },
      },
    });

    // Get insights for previous period (31-60 days ago)
    const previousInsights = await this.instagramMediaInsightModel.findAll({
      where: {
        influencerId,
        fetchedAt: {
          [Op.gte]: sixtyDaysAgo,
          [Op.lt]: thirtyDaysAgo,
        },
      },
    });

    // Calculate current period totals
    const currentTotalPosts = currentInsights.length;
    const currentTotalReach = currentInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
    const currentTotalLikes = currentInsights.reduce((sum, insight) => sum + (insight.likes || 0), 0);
    const currentTotalShares = currentInsights.reduce((sum, insight) => sum + (insight.shares || 0), 0);
    const currentTotalSaves = currentInsights.reduce((sum, insight) => sum + (insight.saved || 0), 0);
    const currentTotalComments = currentInsights.reduce((sum, insight) => sum + (insight.comments || 0), 0);

    // Calculate previous period totals
    const previousTotalPosts = previousInsights.length;
    const previousTotalReach = previousInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
    const previousTotalLikes = previousInsights.reduce((sum, insight) => sum + (insight.likes || 0), 0);
    const previousTotalShares = previousInsights.reduce((sum, insight) => sum + (insight.shares || 0), 0);
    const previousTotalSaves = previousInsights.reduce((sum, insight) => sum + (insight.saved || 0), 0);
    const previousTotalComments = previousInsights.reduce((sum, insight) => sum + (insight.comments || 0), 0);

    // Get follower growth (compare with 30 days ago snapshot)
    const growthSnapshot = await this.instagramProfileGrowthModel.findOne({
      where: {
        influencerId,
        snapshotDate: { [Op.gte]: thirtyDaysAgo },
      },
      order: [['snapshotDate', 'ASC']],
    });

    const followersGrowth = growthSnapshot
      ? (influencer.instagramFollowersCount || 0) - (growthSnapshot.followersCount || 0)
      : 0;
    const followingGrowth = growthSnapshot
      ? (influencer.instagramFollowsCount || 0) - (growthSnapshot.followsCount || 0)
      : 0;

    return {
      timeWindow: 'Last 30 days',
      profile: {
        followers: {
          current: influencer.instagramFollowersCount || 0,
          growth: followersGrowth,
        },
        following: {
          current: influencer.instagramFollowsCount || 0,
          growth: followingGrowth,
        },
        posts: {
          current: currentTotalPosts,
          growth: currentTotalPosts - previousTotalPosts,
        },
        username: influencer.instagramUsername || '',
      },
      engagement: {
        views: {
          current: currentTotalReach,
          growth: currentTotalReach - previousTotalReach,
        },
        likes: {
          current: currentTotalLikes,
          growth: currentTotalLikes - previousTotalLikes,
        },
        shares: {
          current: currentTotalShares,
          growth: currentTotalShares - previousTotalShares,
        },
        saves: {
          current: currentTotalSaves,
          growth: currentTotalSaves - previousTotalSaves,
        },
        comments: {
          current: currentTotalComments,
          growth: currentTotalComments - previousTotalComments,
        },
      },
      averages: {
        avgReach: currentTotalPosts > 0 ? Math.round(currentTotalReach / currentTotalPosts) : 0,
        avgLikes: currentTotalPosts > 0 ? Math.round(currentTotalLikes / currentTotalPosts) : 0,
        avgComments: currentTotalPosts > 0 ? Math.round(currentTotalComments / currentTotalPosts) : 0,
        avgShares: currentTotalPosts > 0 ? Math.round(currentTotalShares / currentTotalPosts) : 0,
        avgSaves: currentTotalPosts > 0 ? Math.round(currentTotalSaves / currentTotalPosts) : 0,
      },
    };
  }
}
