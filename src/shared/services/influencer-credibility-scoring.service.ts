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

  // AI Analyst Summary
  analystSummary: string; // 40-character positive summary from analyst perspective

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

    // Generate AI analyst summary (40 chars max)
    const analystSummary = await this.generateAnalystSummary(
      totalScore,
      influencer,
      audienceQuality,
      contentPerformance,
    );

    return {
      totalScore: Number(totalScore.toFixed(2)),
      maxScore: 100,
      audienceQuality,
      contentPerformance,
      consistencyReliability,
      contentIntelligence,
      brandSafetyTrust,
      analystSummary, // AI-generated 40-char positive summary
      calculatedAt: new Date(),
      influencerId,
      instagramUsername: influencer.instagramUsername || '',
    };
  }

  /**
   * Generate AI Analyst Summary (40 characters max)
   * Positive tone, written as an Instagram analyst would describe the account
   */
  private async generateAnalystSummary(
    totalScore: number,
    _influencer: Influencer,
    _audienceQuality: AudienceQualityScore,
    _contentPerformance: ContentPerformanceScore,
  ): Promise<string> {
    if (!this.geminiAIService.isAvailable()) {
      // Fallback based on score ranges
      if (totalScore >= 85) return 'Exceptional influencer with strong metrics';
      if (totalScore >= 70) return 'High-quality creator, great potential';
      if (totalScore >= 55) return 'Solid profile with growth opportunity';
      if (totalScore >= 40) return 'Developing creator, needs improvement';
      return 'Early-stage account, high-risk profile';
    }

    // Generate score-based summary (fallback - AI generation disabled for performance)
    // Future: Can enable AI when needed for more personalized summaries
    if (totalScore >= 85) {
      return 'Exceptional creator, top-tier metrics';
    } else if (totalScore >= 75) {
      return 'High-quality profile, strong performer';
    } else if (totalScore >= 65) {
      return 'Solid influencer with good engagement';
    } else if (totalScore >= 55) {
      return 'Growing creator with solid potential';
    } else if (totalScore >= 45) {
      return 'Developing account, needs improvement';
    } else if (totalScore >= 35) {
      return 'Early-stage profile, high-risk choice';
    } else {
      return 'New account, limited credibility data';
    }
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
   * Formula: Authenticity Score = (Active Followers / Total Followers) × 100 × 8
   * Uses stored 30-day snapshots of online_followers metric
   */
  private async calculateFollowerAuthenticity(influencer: Influencer): Promise<{ score: number; maxPoints: 8; details: any }> {
    // Get sync history (30-day snapshots)
    const syncHistory = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 5, // Get last 5 syncs for trend analysis
    });

    if (syncHistory.length === 0) {
      return {
        score: 0,
        maxPoints: 8,
        details: {
          authenticityPercentage: 0,
          method: 'No sync data available',
          message: 'Please run a 30-day sync first to calculate authenticity score',
        },
      };
    }

    // Get latest sync data
    const latestSync = syncHistory[0];
    const totalFollowers = latestSync.totalFollowers || 0;
    const activeFollowers = latestSync.activeFollowers || 0;
    const authenticityPercentage = Number(latestSync.activeFollowersPercentage) || 0;

    if (totalFollowers === 0) {
      return {
        score: 0,
        maxPoints: 8,
        details: {
          authenticityPercentage: 0,
          method: 'No follower data available',
        },
      };
    }

    // Calculate base score: (Authenticity % / 100) × 8 points
    let score = Math.min((authenticityPercentage / 100) * 8, 8);

    // Determine rating based on percentage
    let rating = 'Very Low';
    if (authenticityPercentage >= 25) rating = 'Excellent';
    else if (authenticityPercentage >= 15) rating = 'Good';
    else if (authenticityPercentage >= 10) rating = 'Average';
    else if (authenticityPercentage >= 5) rating = 'Low';

    // Interpretation message
    let interpretation = '';
    if (authenticityPercentage >= 25) {
      interpretation = 'Highly engaged real followers. Excellent authenticity.';
    } else if (authenticityPercentage >= 15) {
      interpretation = 'Good authenticity. Most followers are real and active.';
    } else if (authenticityPercentage >= 10) {
      interpretation = 'Average authenticity. Some inactive or fake followers may exist.';
    } else if (authenticityPercentage >= 5) {
      interpretation = 'Low authenticity. Significant portion may be fake/inactive followers.';
    } else {
      interpretation = 'Very low authenticity. High likelihood of purchased followers.';
    }

    // ENHANCED: Compare with previous syncs if available
    let growthAnalysis: any = null;
    let suspiciousPatternDetected = false;

    if (syncHistory.length >= 2) {
      const previousSync = syncHistory[1];
      growthAnalysis = this.analyzeActiveFollowersGrowth(previousSync, latestSync, syncHistory);

      // Apply penalty if suspicious pattern detected
      if (growthAnalysis && (growthAnalysis.pattern === 'suspicious_spike' || growthAnalysis.pattern === 'bought_followers')) {
        score = score * 0.5; // 50% penalty for suspicious patterns
        suspiciousPatternDetected = true;
        interpretation = `⚠️ ${growthAnalysis.interpretation}`;
        rating = 'Suspicious';
      } else if (growthAnalysis && growthAnalysis.pattern === 'follower_cleanup') {
        // Bonus for cleaning up fake followers
        score = Math.min(score * 1.1, 8); // 10% bonus, capped at 8
        interpretation = `✅ ${growthAnalysis.interpretation}`;
      }
    }

    // Calculate days until next sync
    const daysSinceLastSync = Math.floor(
      (new Date().getTime() - new Date(latestSync.syncDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilNextSync = Math.max(0, 30 - daysSinceLastSync);

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 8,
      details: {
        authenticityPercentage: Number(authenticityPercentage.toFixed(2)),
        method: 'Active Followers Analysis (30-day snapshots)',
        totalFollowers,
        activeFollowers,
        peakOnlinePercentage: Number(authenticityPercentage.toFixed(2)),
        rating,
        interpretation,
        syncCount: syncHistory.length,
        latestSyncDate: latestSync.syncDate,
        daysSinceLastSync,
        daysUntilNextSync,
        growthAnalysis,
        suspiciousPatternDetected,
        dataMaturity: syncHistory.length >= 3 ? 'mature' : syncHistory.length >= 2 ? 'developing' : 'initial',
      },
    };
  }

  /**
   * Analyze active followers growth between syncs to detect suspicious patterns
   */
  private analyzeActiveFollowersGrowth(previousSync: any, currentSync: any, allSyncs: any[]): any {
    const followerGrowth = currentSync.totalFollowers - previousSync.totalFollowers;
    const followerGrowthPercent = previousSync.totalFollowers > 0
      ? (followerGrowth / previousSync.totalFollowers) * 100
      : 0;

    const activeFollowersChange = currentSync.activeFollowersPercentage - previousSync.activeFollowersPercentage;

    let pattern = 'normal';
    let interpretation = '';
    let severity = 'none';

    // RED FLAG: Followers increased but active followers % dropped significantly
    if (followerGrowth > 0 && activeFollowersChange < -5) {
      pattern = 'bought_followers';
      severity = 'high';
      interpretation = `Suspicious: Gained ${followerGrowth} followers but active followers dropped from ${previousSync.activeFollowersPercentage}% to ${currentSync.activeFollowersPercentage}%. Likely bought fake followers.`;
    }
    // RED FLAG: Massive follower spike
    else if (followerGrowthPercent > 100 && activeFollowersChange < 0) {
      pattern = 'suspicious_spike';
      severity = 'high';
      interpretation = `Suspicious: Followers doubled (+${followerGrowthPercent.toFixed(1)}%) but engagement quality dropped. Indicates purchased followers.`;
    }
    // YELLOW FLAG: Large growth but active % stable or slight drop
    else if (followerGrowthPercent > 50 && activeFollowersChange >= -2) {
      pattern = 'rapid_growth';
      severity = 'medium';
      interpretation = `Rapid growth (+${followerGrowthPercent.toFixed(1)}%). Monitor for authenticity in next sync.`;
    }
    // GOOD: Followers dropped but active % increased (cleaning fake followers)
    else if (followerGrowth < 0 && activeFollowersChange > 3) {
      pattern = 'follower_cleanup';
      severity = 'none';
      interpretation = `Positive: Removed ${Math.abs(followerGrowth)} followers and active % improved from ${previousSync.activeFollowersPercentage}% to ${currentSync.activeFollowersPercentage}%. Cleaned up fake followers.`;
    }
    // GOOD: Organic growth
    else if (followerGrowthPercent > 0 && followerGrowthPercent <= 50 && activeFollowersChange >= -1) {
      pattern = 'organic_growth';
      severity = 'none';
      interpretation = `Healthy growth: +${followerGrowth} followers with stable active follower ratio.`;
    }
    // NEUTRAL: Stagnant
    else if (Math.abs(followerGrowthPercent) < 5) {
      pattern = 'stagnant';
      severity = 'none';
      interpretation = `Stable follower count with minimal change.`;
    }

    return {
      pattern,
      severity,
      interpretation,
      followerGrowth,
      followerGrowthPercent: Number(followerGrowthPercent.toFixed(2)),
      activeFollowersChange: Number(activeFollowersChange.toFixed(2)),
      previousSync: {
        totalFollowers: previousSync.totalFollowers,
        activePercentage: previousSync.activeFollowersPercentage,
        syncDate: previousSync.syncDate,
      },
      currentSync: {
        totalFollowers: currentSync.totalFollowers,
        activePercentage: currentSync.activeFollowersPercentage,
        syncDate: currentSync.syncDate,
      },
    };
  }

  /**
   * 1.2 Engagement Ratio (7 points)
   * Formula: Engagement Score = min(Engagement Rate / Benchmark, 1) × 7
   * Uses stored 30-day snapshots and includes saves in calculation
   */
  private async calculateEngagementRatio(influencer: Influencer): Promise<{ score: number; maxPoints: 7; details: any }> {
    // Get latest sync snapshot
    const latestSync = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSync || !latestSync.avgEngagementRate) {
      return {
        score: 0,
        maxPoints: 7,
        details: {
          engagementRate: 0,
          benchmark: 3,
          totalPosts: 0,
          timeWindow: 'Last 30 days',
          message: 'No engagement data available. Please run a 30-day sync first.',
        },
      };
    }

    const engagementRate = Number(latestSync.avgEngagementRate) || 0;
    const benchmark = 3; // Fixed 3% benchmark

    const score = Math.min(engagementRate / benchmark, 1) * 7;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 7,
      details: {
        engagementRate: Number(engagementRate.toFixed(2)),
        benchmark,
        totalPosts: latestSync.postsAnalyzed || 0,
        timeWindow: 'Last 30 days',
        syncDate: latestSync.syncDate,
        includesSaves: true, // Now includes saves in calculation
      },
    };
  }

  /**
   * 1.3 Follower Growth Trend (5 points)
   * Formula: Growth Score = clamp(Growth Rate / Expected Growth, 0, 1) × 5
   * Uses 30-day snapshots from instagram_profile_analysis
   * Gives full points if only 1 snapshot exists (first sync)
   */
  private async calculateFollowerGrowthTrend(influencer: Influencer): Promise<{ score: number; maxPoints: 5; details: any }> {
    // Get latest 2 snapshots (30 days apart)
    const snapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 2,
    });

    // If only 1 snapshot exists, give full points (first sync, calculate next month)
    if (snapshots.length < 2) {
      return {
        score: 5, // Full points temporarily
        maxPoints: 5,
        details: {
          growthRate: null,
          benchmark: 2,
          message: 'First sync completed. Growth trend will be calculated after next sync (30 days).',
          nextCalculationDate: snapshots[0] ? new Date(new Date(snapshots[0].syncDate).getTime() + 30 * 24 * 60 * 60 * 1000) : null,
        },
      };
    }

    // Get follower counts from latest 2 snapshots
    const latestSnapshot = snapshots[0]; // Most recent
    const previousSnapshot = snapshots[1]; // 30 days ago

    const latestFollowers = latestSnapshot.totalFollowers || influencer.instagramFollowersCount || 0;
    const previousFollowers = previousSnapshot.totalFollowers || 0;

    if (previousFollowers === 0) {
      return {
        score: 5, // Give full points if no baseline
        maxPoints: 5,
        details: {
          growthRate: null,
          benchmark: 2,
          message: 'Previous snapshot has no follower data. Will calculate on next sync.',
        },
      };
    }

    // Calculate growth rate (30-day period)
    const growthRate = ((latestFollowers - previousFollowers) / previousFollowers) * 100;

    const benchmark = 2; // 2% monthly growth benchmark
    const score = Math.max(0, Math.min(growthRate / benchmark, 1)) * 5;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 5,
      details: {
        growthRate: Number(growthRate.toFixed(2)),
        benchmark,
        followersStart: previousFollowers,
        followersEnd: latestFollowers,
        timeWindow: '30 days',
        latestSyncDate: latestSnapshot.syncDate,
        previousSyncDate: previousSnapshot.syncDate,
      },
    };
  }

  /**
   * 1.4 Audience Geo Relevance (3 points)
   * Formula: Geo Score = (% Target Geography Audience) × 3
   * Uses stored 30-day snapshot demographics
   */
  private async calculateAudienceGeoRelevance(influencer: Influencer): Promise<{ score: number; maxPoints: 3; details: any }> {
    // Get latest snapshot with demographic data
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSnapshot || !latestSnapshot.audienceCountries || latestSnapshot.audienceCountries.length === 0) {
      return {
        score: 0,
        maxPoints: 3,
        details: {
          targetCountry: 'India',
          targetAudiencePercentage: 0,
          message: 'No demographic data available. Please run a 30-day sync first.',
        },
      };
    }

    // Find India audience percentage
    const indiaAudience = latestSnapshot.audienceCountries.find((c: any) => c.location === 'IN');
    const indiaPercentage = indiaAudience?.percentage || 0;

    const score = (indiaPercentage / 100) * 3;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 3,
      details: {
        targetCountry: 'India',
        targetAudiencePercentage: indiaPercentage,
        topCountries: latestSnapshot.audienceCountries.slice(0, 5),
        syncDate: latestSnapshot.syncDate,
        timeWindow: '30 days',
      },
    };
  }

  /**
   * 1.5 Demographic Stability (2 points)
   * Formula: Stability Score = (1 – Demographic Variance Index) × 2
   * Measures volatility in age/gender mix over time using 30-day snapshots
   * Gives full points if only 1 snapshot exists (first sync)
   */
  private async calculateDemographicStability(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    try {
      // Get latest 5 snapshots (up to 5 months of 30-day data)
      const snapshots = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId: influencer.id },
        order: [['syncDate', 'DESC']],
        limit: 5,
      });

      // Filter to only include snapshots with demographic data
      const historicalSnapshots = snapshots.filter(
        snapshot => snapshot.audienceAgeGender && snapshot.audienceAgeGender.length > 0
      );

      // If only 1 snapshot, give full points (first sync, calculate next month)
      if (historicalSnapshots.length < 2) {
        return {
          score: 2, // Full points temporarily
          maxPoints: 2,
          details: {
            message: 'First sync completed. Demographic stability will be calculated after next sync (30 days).',
            snapshotsFound: historicalSnapshots.length,
            nextCalculationDate: historicalSnapshots[0]?.syncDate
              ? new Date(new Date(historicalSnapshots[0].syncDate).getTime() + 30 * 24 * 60 * 60 * 1000)
              : null,
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

      for (const percentages of Object.values(segmentVariances)) {
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
          snapshotsAnalyzed: historicalSnapshots.length,
          segmentsTracked: Object.keys(segmentVariances).length,
          varianceIndex: Number(varianceIndex.toFixed(4)),
          timeWindow: `${historicalSnapshots.length} 30-day snapshots`,
          latestSyncDate: historicalSnapshots[0]?.syncDate,
          oldestSyncDate: historicalSnapshots[historicalSnapshots.length - 1]?.syncDate,
        },
      };
    } catch (error) {
      // Fallback to default if calculation fails
      return {
        score: 1.5,
        maxPoints: 2,
        details: {
          error: 'Error calculating variance, using default',
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
   * Uses stored 30-day snapshot data
   */
  private async calculateReachToFollowerRatio(influencer: Influencer): Promise<{ score: number; maxPoints: 8; details: any }> {
    // Get latest snapshot with reach data
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSnapshot || !latestSnapshot.avgReach || !latestSnapshot.totalFollowers) {
      return {
        score: 0,
        maxPoints: 8,
        details: {
          viralityRatio: 0,
          message: 'No reach data available. Please run a 30-day sync first.',
        },
      };
    }

    const avgReach = latestSnapshot.avgReach;
    const followers = latestSnapshot.totalFollowers;
    const viralityRatio = avgReach / followers;

    const benchmark = 1.0; // 100% reach-to-follower ratio benchmark
    const score = Math.min(viralityRatio / benchmark, 1) * 8;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 8,
      details: {
        viralityRatio: Number(viralityRatio.toFixed(4)),
        avgReach,
        followers,
        benchmark,
        postsAnalyzed: latestSnapshot.postsAnalyzed || 0,
        timeWindow: '30 days',
        syncDate: latestSnapshot.syncDate,
      },
    };
  }

  /**
   * 2.2 Saves & Shares Impact (7 points)
   * Formula: Save+Share Rate = ((Avg Saves + Avg Shares) / Avg Reach) × 100, Score = min(Rate / Benchmark, 1) × 7
   * Uses stored 30-day snapshot data
   */
  private async calculateSaveShareImpact(influencer: Influencer): Promise<{ score: number; maxPoints: 7; details: any }> {
    // Get latest snapshot with saves/shares data
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSnapshot || !latestSnapshot.avgReach || !latestSnapshot.postsAnalyzed) {
      return {
        score: 0,
        maxPoints: 7,
        details: {
          saveShareRate: 0,
          message: 'No saves/shares data available. Please run a 30-day sync first.',
        },
      };
    }

    const totalSaves = latestSnapshot.totalSaves || 0;
    const totalShares = latestSnapshot.totalShares || 0;
    const avgReach = latestSnapshot.avgReach;
    const postsAnalyzed = latestSnapshot.postsAnalyzed;

    const avgSaves = postsAnalyzed > 0 ? totalSaves / postsAnalyzed : 0;
    const avgShares = postsAnalyzed > 0 ? totalShares / postsAnalyzed : 0;

    // Calculate save+share rate: (avg saves + avg shares) / avg reach × 100
    const saveShareRate = ((avgSaves + avgShares) / avgReach) * 100;

    const benchmark = 5; // 5% save+share rate is good
    const score = Math.min(saveShareRate / benchmark, 1) * 7;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 7,
      details: {
        saveShareRate: Number(saveShareRate.toFixed(2)),
        benchmark,
        avgSaves: Number(avgSaves.toFixed(2)),
        avgShares: Number(avgShares.toFixed(2)),
        avgReach,
        postsAnalyzed,
        timeWindow: '30 days',
        syncDate: latestSnapshot.syncDate,
      },
    };
  }

  /**
   * 2.3 Retention Proxy (5 points)
   * Measures video retention rate (average watch time)
   * Currently gives full points - will be implemented when video insights are available
   */
  private async calculateRetentionProxy(_influencer: Influencer): Promise<{ score: number; maxPoints: 5; details: any }> {
    return {
      score: 5.0,
      maxPoints: 5,
      details: {
        message: 'Full points awarded. Video retention tracking will be implemented when Instagram video insights become available.',
        note: 'Requires video play metrics (average watch time, completion rate)',
      },
    };
  }

  /**
   * 2.4 Story Engagement (3 points)
   * Measures Instagram Story engagement (views, replies, shares)
   * Currently gives full points - will be implemented when story insights are available
   */
  private async calculateStoryEngagement(_influencer: Influencer): Promise<{ score: number; maxPoints: 3; details: any }> {
    return {
      score: 3.0,
      maxPoints: 3,
      details: {
        message: 'Full points awarded. Story engagement tracking will be implemented when Instagram Story insights become available.',
        note: 'Requires story-specific metrics (views, taps forward/back, replies, shares)',
      },
    };
  }

  /**
   * 2.5 Performance Consistency (2 points)
   * Formula: Consistency Score = 1 / (1 + CV) × 2
   * CV (Coefficient of Variation) = Std Dev / Avg Reach
   * Uses 30-day window aligned with snapshot system
   */
  private async calculatePerformanceConsistency(influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: {
          timestamp: { [Op.gte]: thirtyDaysAgo },
        },
      }],
      order: [['instagramMedia', 'timestamp', 'DESC']],
    });

    if (recentInsights.length < 2) {
      return {
        score: 0, // 0 points if insufficient data
        maxPoints: 2,
        details: {
          message: 'Insufficient posts for consistency calculation. Need at least 2 posts in last 30 days.',
          postsFound: recentInsights.length,
        },
      };
    }

    const reaches = recentInsights.map(i => i.reach || 0);
    const avgReach = reaches.reduce((sum, r) => sum + r, 0) / reaches.length;
    const variance = reaches.reduce((sum, r) => sum + Math.pow(r - avgReach, 2), 0) / reaches.length;
    const stdDev = Math.sqrt(variance);

    // Calculate Coefficient of Variation (CV)
    const cv = avgReach > 0 ? stdDev / avgReach : 0;

    // Apply formula: Consistency Score = 1 / (1 + CV) × 2
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
        timeWindow: '30 days',
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
   * Formula: Posting Score = min(Actual Frequency / Ideal Frequency, 1) × 6
   * Ideal = 4 posts/week = 0.571 posts/day
   * Uses 30-day window aligned with snapshot system
   */
  private async calculatePostingConsistency(influencer: Influencer): Promise<{ score: number; maxPoints: 6; details: any }> {
    // Step 1: Count posts in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await this.instagramMediaModel.count({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
      },
    });

    // Step 2: Days in period
    const daysInPeriod = 30;

    // Step 3: Calculate actual posting frequency (posts per day)
    const actualFrequency = recentPosts / daysInPeriod;

    // Step 4: Ideal frequency = 4 posts/week = 4/7 posts/day
    const idealFrequency = 4 / 7; // 0.571 posts/day

    // Step 5: Calculate ratio
    const ratio = actualFrequency / idealFrequency;

    // Step 6: Cap at 1
    const cappedRatio = Math.min(ratio, 1);

    // Step 7: Multiply by 6 points
    const score = cappedRatio * 6;

    return {
      score: Number(score.toFixed(2)),
      maxPoints: 6,
      details: {
        actualPosts: recentPosts,
        daysInPeriod,
        actualFrequency: Number(actualFrequency.toFixed(3)),
        idealFrequency: Number(idealFrequency.toFixed(3)),
        ratio: Number(ratio.toFixed(3)),
        timeWindow: '30 days',
        formula: 'Score = min(Actual Frequency / Ideal Frequency, 1) × 6',
        note: 'Ideal = 4 posts/week = 0.571 posts/day',
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
   * Measures month-to-month consistency of campaign earnings on CollabKaroo platform
   * Currently gives full points until payment tracking is implemented
   */
  private async calculateIncomeConsistency(_influencer: Influencer): Promise<{ score: number; maxPoints: 4; details: any }> {
    // TODO: Implement actual earnings tracking
    // This metric should measure consistency of influencer earnings on the platform
    // Calculate coefficient of variation of monthly earnings over 6-month period
    // Lower variance = higher consistency = better score

    // For now, give full points to all users until payment tracking is implemented
    return {
      score: 4.0,
      maxPoints: 4,
      details: {
        message: 'Full points awarded. Income consistency will be calculated after implementing platform payment tracking.',
        note: 'This metric should track month-to-month variance in campaign earnings on CollabKaroo platform',
        futureImplementation: {
          dataSource: 'Platform campaign payments to influencers',
          formula: 'Income Score = (1 – Income Variance) × 4',
          calculationMethod: 'Calculate coefficient of variation (CV) of monthly earnings over 6-month rolling window',
          example: 'CV = Standard Deviation / Mean Monthly Earnings',
        },
      },
    };
  }

  /**
   * 3.4 Responsiveness (2 points)
   * Formula: Response Time Score = (1 – Avg Response Time / Max Acceptable Time) × 2
   * Measures how quickly influencer responds to brand messages on CollabKaroo platform
   * Currently gives full points until message response tracking is implemented
   */
  private async calculateResponsiveness(_influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    // TODO: Implement actual message response time tracking
    // This metric should measure how quickly influencers respond to brand messages on platform
    // Calculate average response time for brand inquiries and campaign communications
    // Faster response = higher score

    // For now, give full points to all users until message tracking is implemented
    return {
      score: 2.0,
      maxPoints: 2,
      details: {
        message: 'Full points awarded. Responsiveness will be calculated after implementing platform message tracking.',
        note: 'This metric should track response time to brand messages and campaign communications on CollabKaroo platform',
        futureImplementation: {
          dataSource: 'Platform message/chat response times between influencers and brands',
          formula: 'Response Time Score = (1 – Avg Response Time / Max Acceptable Time) × 2',
          calculationMethod: 'Track time between brand message sent and influencer first response',
          example: 'Max acceptable time: 24 hours. Response in <6 hours = full points, 24+ hours = 0 points',
        },
      },
    };
  }

  /**
   * 3.5 Inactivity Penalty (2 points)
   * Formula: Inactivity Score = max(0, 1 – Inactive Days / Threshold) × 2
   * Benchmark: 30 days
   * Currently gives full points - will be implemented with proper activity tracking
   */
  private async calculateInactivityPenalty(_influencer: Influencer): Promise<{ score: number; maxPoints: 2; details: any }> {
    return {
      score: 2.0,
      maxPoints: 2,
      details: {
        message: 'Full points awarded. Inactivity tracking will be implemented with daily app activity logging.',
        note: 'Requires tracking unique active days in 30-day rolling window',
        futureFormula: 'Inactivity Score = max(0, 1 – Inactive Days / 30) × 2',
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

      // Extract captions and analyze first 5 images (skip videos)
      const captions = recentMedia.map(m => m.caption);
      const visualAnalyses: any[] = [];

      // Only analyze IMAGE and CAROUSEL_ALBUM media, skip VIDEO
      const imageMedia = recentMedia.filter(m =>
        (m.mediaType === 'IMAGE' || m.mediaType === 'CAROUSEL_ALBUM') &&
        m.mediaUrl &&
        m.mediaUrl.trim().length > 0
      ).slice(0, 5);

      for (const media of imageMedia) {
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

      // Analyze visual quality of first 5-10 images (skip videos)
      const visualAnalyses: any[] = [];

      // Only analyze IMAGE and CAROUSEL_ALBUM media, skip VIDEO
      const imageMedia = recentMedia.filter(m =>
        (m.mediaType === 'IMAGE' || m.mediaType === 'CAROUSEL_ALBUM') &&
        m.mediaUrl &&
        m.mediaUrl.trim().length > 0
      ).slice(0, 10);

      for (const media of imageMedia) {
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

      // Analyze visual quality and brand safety (skip videos)
      const brandSafetyScores: number[] = [];

      // Only analyze IMAGE and CAROUSEL_ALBUM media, skip VIDEO
      const imageMedia = recentMedia.filter(m =>
        (m.mediaType === 'IMAGE' || m.mediaType === 'CAROUSEL_ALBUM') &&
        m.mediaUrl &&
        m.mediaUrl.trim().length > 0
      ).slice(0, 10);

      for (const media of imageMedia) {
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
      const sentimentResult = await this.geminiAIService.analyzeSentiment(captions);
      const sentimentScore = sentimentResult.score;

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
   * Helper: Get recent media with captions and URLs for AI analysis
   */
  private async getRecentMediaForAI(influencerId: number, limit: number = 20): Promise<Array<{ id: number; caption: string; mediaUrl: string; mediaType: string }>> {
    const mediaRecords = await this.instagramMediaModel.findAll({
      where: { influencerId },
      order: [['timestamp', 'DESC']],
      limit,
    });

    return mediaRecords
      .filter(m => m.mediaUrl) // Include all media types (images, videos, carousels)
      .map(m => ({
        id: m.id,
        caption: m.caption || '',
        mediaUrl: m.mediaUrl || '',
        mediaType: m.mediaType || 'IMAGE',
      }));
  }

  /**
   * Get aggregate analytics for influencer (all-time totals with 90-day growth comparison)
   */
  async getAggregateAnalytics(influencerId: number) {
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const oneEightyDaysAgo = new Date();
    oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

    // Get ALL insights for account (all-time totals)
    const allInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId },
    });

    // Get insights for last 90 days (for growth comparison)
    const currentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: {
          timestamp: { [Op.gte]: ninetyDaysAgo },
        },
      }],
    });

    // Get insights for previous period (91-180 days ago) for growth comparison
    const previousInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: {
          timestamp: {
            [Op.gte]: oneEightyDaysAgo,
            [Op.lt]: ninetyDaysAgo,
          },
        },
      }],
    });

    // Calculate ALL-TIME totals
    const totalPosts = allInsights.length;
    const totalReach = allInsights.reduce((sum, insight) => sum + (insight.reach || 0), 0);
    const totalLikes = allInsights.reduce((sum, insight) => sum + (insight.likes || 0), 0);
    const totalShares = allInsights.reduce((sum, insight) => sum + (insight.shares || 0), 0);
    const totalSaves = allInsights.reduce((sum, insight) => sum + (insight.saved || 0), 0);
    const totalComments = allInsights.reduce((sum, insight) => sum + (insight.comments || 0), 0);

    // Calculate last 90 days totals
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

    // Get follower growth (compare with 90 days ago snapshot)
    const growthSnapshot = await this.instagramProfileGrowthModel.findOne({
      where: {
        influencerId,
        snapshotDate: { [Op.gte]: ninetyDaysAgo },
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
      profile: {
        followers: {
          total: influencer.instagramFollowersCount || 0,
          growth: followersGrowth,
        },
        following: {
          total: influencer.instagramFollowsCount || 0,
          growth: followingGrowth,
        },
        posts: {
          total: totalPosts, // All-time total posts
          growth: currentTotalPosts - previousTotalPosts, // Growth in last 90 days
        },
        username: influencer.instagramUsername || '',
      },
      engagement: {
        views: {
          total: totalReach, // All-time total
          growth: currentTotalReach - previousTotalReach, // Last 90 days growth
        },
        likes: {
          total: totalLikes, // All-time total
          growth: currentTotalLikes - previousTotalLikes, // Last 90 days growth
        },
        shares: {
          total: totalShares, // All-time total
          growth: currentTotalShares - previousTotalShares, // Last 90 days growth
        },
        saves: {
          total: totalSaves, // All-time total
          growth: currentTotalSaves - previousTotalSaves, // Last 90 days growth
        },
        comments: {
          total: totalComments, // All-time total
          growth: currentTotalComments - previousTotalComments, // Last 90 days growth
        },
      },
      last90Days: {
        posts: currentTotalPosts,
        views: currentTotalReach,
        likes: currentTotalLikes,
        shares: currentTotalShares,
        saves: currentTotalSaves,
        comments: currentTotalComments,
        averages: {
          avgReach: currentTotalPosts > 0 ? Math.round(currentTotalReach / currentTotalPosts) : 0,
          avgLikes: currentTotalPosts > 0 ? Math.round(currentTotalLikes / currentTotalPosts) : 0,
          avgComments: currentTotalPosts > 0 ? Math.round(currentTotalComments / currentTotalPosts) : 0,
          avgShares: currentTotalPosts > 0 ? Math.round(currentTotalShares / currentTotalPosts) : 0,
          avgSaves: currentTotalPosts > 0 ? Math.round(currentTotalSaves / currentTotalPosts) : 0,
        },
      },
    };
  }
}
