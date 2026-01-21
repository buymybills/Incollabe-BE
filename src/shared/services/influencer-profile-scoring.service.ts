import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramProfileAnalysis } from '../models/instagram-profile-analysis.model';
import { InstagramMediaInsight } from '../models/instagram-media-insight.model';
import { InstagramMedia } from '../models/instagram-media.model';
import { InstagramProfileGrowth } from '../models/instagram-profile-growth.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { GeminiAIService } from './gemini-ai.service';

// ==================== INTERFACES ====================

export interface ProfileScore {
  totalScore: number;
  maxScore: 60; // 10 points per category × 6 categories
  categories: {
    audienceQuality: AudienceQualityScore;
    contentRelevance: ContentRelevanceScore;
    contentQuality: ContentQualityScore;
    engagementStrength: EngagementStrengthScore;
    growthMomentum: GrowthMomentumScore;
    monetisation: MonetisationScore;
  };
  calculatedAt: Date;
  influencerId: number;
  instagramUsername: string;
}

// Category 1: Audience Quality (10 points)
export interface AudienceQualityScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    followerAuthenticity: { score: number; weight: 65; details: any };
    demographicsSnapshot: { score: number; weight: 20; details: any };
    geoRelevance: { score: number; weight: 15; details: any };
  };
}

// Category 2: Content Relevance (10 points)
export interface ContentRelevanceScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    platformRelevance: { score: number; weight: 35; details: any };
    contentMix: { score: number; weight: 5; details: any };
    contentStyle: { score: number; weight: 10; details: any };
    topPerformingPosts: { score: number; weight: 10; details: any };
    worstPerformingPosts: { score: number; weight: 10; details: any };
    topNicheBreakdown: { score: number; weight: 10; details: any };
    hashtagEffectiveness: { score: number; weight: 10; details: any };
    languageMarketFit: { score: number; weight: 10; details: any };
  };
}

// Category 3: Content Quality (10 points)
export interface ContentQualityScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    visualQuality: { score: number; weight: 60; details: any };
    colorPaletteMood: { score: number; weight: 20; details: any };
    captionSentiment: { score: number; weight: 10; details: any };
    ctaUsage: { score: number; weight: 10; details: any };
  };
}

// Category 4: Engagement Strength (10 points)
export interface EngagementStrengthScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    engagementOverview: { score: number; weight: 50; details: any };
    performanceConsistency: { score: number; weight: 30; details: any };
    retentionOverview: { score: number; weight: 20; details: any };
  };
}

// Category 5: Growth Momentum (10 points)
export interface GrowthMomentumScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    growthTrend: { score: number; weight: 50; details: any };
    peakFollowerGain: { score: number; weight: 30; details: any };
    postingBehaviour: { score: number; weight: 20; details: any };
  };
}

// Category 6: Monetisation (10 points)
export interface MonetisationScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    monetisationSignals: { score: number; weight: 40; details: any };
    brandTrustSignal: { score: number; weight: 30; details: any };
    audienceSentiment: { score: number; weight: 20; details: any };
    brandAlignment: { score: number; weight: 10; details: any };
  };
}

@Injectable()
export class InfluencerProfileScoringService {
  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(InstagramProfileAnalysis)
    private instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    @InjectModel(InstagramMediaInsight)
    private instagramMediaInsightModel: typeof InstagramMediaInsight,
    @InjectModel(InstagramMedia)
    private instagramMediaModel: typeof InstagramMedia,
    @InjectModel(InstagramProfileGrowth)
    private instagramProfileGrowthModel: typeof InstagramProfileGrowth,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    private geminiAIService: GeminiAIService,
  ) {}

  /**
   * MASTER API: Get complete profile score with all 6 categories
   */
  async getCompleteProfileScore(influencerId: number): Promise<ProfileScore> {
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }

    // Calculate all 6 categories in parallel
    const [
      audienceQuality,
      contentRelevance,
      contentQuality,
      engagementStrength,
      growthMomentum,
      monetisation,
    ] = await Promise.all([
      this.calculateAudienceQuality(influencer),
      this.calculateContentRelevance(influencer),
      this.calculateContentQuality(influencer),
      this.calculateEngagementStrength(influencer),
      this.calculateGrowthMomentum(influencer),
      this.calculateMonetisation(influencer),
    ]);

    const totalScore =
      audienceQuality.score +
      contentRelevance.score +
      contentQuality.score +
      engagementStrength.score +
      growthMomentum.score +
      monetisation.score;

    return {
      totalScore: Number(totalScore.toFixed(2)),
      maxScore: 60,
      categories: {
        audienceQuality,
        contentRelevance,
        contentQuality,
        engagementStrength,
        growthMomentum,
        monetisation,
      },
      calculatedAt: new Date(),
      influencerId,
      instagramUsername: influencer.instagramUsername || '',
    };
  }

  // ==================== CATEGORY 1: AUDIENCE QUALITY (10 pts) ====================

  async calculateAudienceQuality(influencer: Influencer): Promise<AudienceQualityScore> {
    const followerAuthenticity = await this.calculateFollowerAuthenticity(influencer);
    const demographicsSnapshot = await this.calculateDemographicsSnapshot(influencer);
    const geoRelevance = await this.calculateGeoRelevance(influencer);

    // Weighted average: 65% + 20% + 15% = 100%
    const score =
      (followerAuthenticity.score * 0.65) +
      (demographicsSnapshot.score * 0.20) +
      (geoRelevance.score * 0.15);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        followerAuthenticity: { score: followerAuthenticity.score, weight: 65, details: followerAuthenticity.details },
        demographicsSnapshot: { score: demographicsSnapshot.score, weight: 20, details: demographicsSnapshot.details },
        geoRelevance: { score: geoRelevance.score, weight: 15, details: geoRelevance.details },
      },
    };
  }

  /**
   * 1.1 Follower Authenticity (65%)
   * Uses stored 30-day snapshots from credibility scoring
   */
  private async calculateFollowerAuthenticity(influencer: Influencer): Promise<{ score: number; details: any }> {
    const latestSync = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSync || !latestSync.activeFollowersPercentage) {
      return {
        score: 0,
        details: {
          authenticityPercentage: 0,
          message: 'No sync data available',
        },
      };
    }

    const authenticityPercentage = latestSync.activeFollowersPercentage;

    // Convert authenticity % to 0-10 scale
    // 25%+ active = 10/10, scales down linearly
    const score = Math.min((authenticityPercentage / 25) * 10, 10);

    return {
      score: Number(score.toFixed(2)),
      details: {
        authenticityPercentage: Number(authenticityPercentage.toFixed(2)),
        totalFollowers: latestSync.totalFollowers,
        activeFollowers: latestSync.activeFollowers,
        syncDate: latestSync.syncDate,
      },
    };
  }

  /**
   * 1.2 Demographics Snapshot (20%)
   * Uses demographic stability from credibility scoring
   */
  private async calculateDemographicsSnapshot(influencer: Influencer): Promise<{ score: number; details: any }> {
    const snapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 5,
    });

    const historicalSnapshots = snapshots.filter(
      snapshot => snapshot.audienceAgeGender && snapshot.audienceAgeGender.length > 0
    );

    if (historicalSnapshots.length < 2) {
      return {
        score: 10, // Full points for new accounts
        details: {
          message: 'First sync completed. Demographic stability will be calculated after next sync.',
          snapshotsFound: historicalSnapshots.length,
        },
      };
    }

    // Calculate variance across demographics
    const segmentVariances: { [key: string]: number[] } = {};

    for (const snapshot of historicalSnapshots) {
      if (!snapshot.audienceAgeGender) continue;

      for (const segment of snapshot.audienceAgeGender) {
        const key = `${segment.ageRange}_${segment.gender || 'ALL'}`;
        if (!segmentVariances[key]) {
          segmentVariances[key] = [];
        }
        segmentVariances[key].push(segment.percentage);
      }
    }

    const varianceScores: number[] = [];

    for (const percentages of Object.values(segmentVariances)) {
      if (percentages.length < 2) continue;

      const mean = percentages.reduce((sum, val) => sum + val, 0) / percentages.length;
      const variance = percentages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / percentages.length;
      const stdDev = Math.sqrt(variance);
      const normalizedVariance = Math.min(stdDev / 10, 1);
      varianceScores.push(normalizedVariance);
    }

    const varianceIndex = varianceScores.length > 0
      ? varianceScores.reduce((sum, v) => sum + v, 0) / varianceScores.length
      : 0.25;

    // Convert to 0-10 scale (lower variance = higher score)
    const score = (1 - varianceIndex) * 10;

    return {
      score: Number(score.toFixed(2)),
      details: {
        snapshotsAnalyzed: historicalSnapshots.length,
        varianceIndex: Number(varianceIndex.toFixed(4)),
        stability: score >= 8 ? 'High' : score >= 6 ? 'Medium' : 'Low',
      },
    };
  }

  /**
   * 1.3 Geo Relevance (15%)
   * Target geography: India
   */
  private async calculateGeoRelevance(influencer: Influencer): Promise<{ score: number; details: any }> {
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSnapshot || !latestSnapshot.audienceCountries || latestSnapshot.audienceCountries.length === 0) {
      return {
        score: 0,
        details: {
          targetCountry: 'India',
          targetAudiencePercentage: 0,
          message: 'No demographic data available',
        },
      };
    }

    const indiaAudience = latestSnapshot.audienceCountries.find((c: any) => c.location === 'IN');
    const indiaPercentage = indiaAudience?.percentage || 0;

    // Convert India % to 0-10 scale (100% India = 10/10)
    const score = (indiaPercentage / 100) * 10;

    return {
      score: Number(score.toFixed(2)),
      details: {
        targetCountry: 'India',
        targetAudiencePercentage: indiaPercentage,
        topCountries: latestSnapshot.audienceCountries.slice(0, 5),
      },
    };
  }

  // ==================== CATEGORY 2: CONTENT RELEVANCE (10 pts) ====================

  async calculateContentRelevance(influencer: Influencer): Promise<ContentRelevanceScore> {
    const [
      platformRelevance,
      contentMix,
      contentStyle,
      topPerformingPosts,
      worstPerformingPosts,
      topNicheBreakdown,
      hashtagEffectiveness,
      languageMarketFit,
    ] = await Promise.all([
      this.calculatePlatformRelevance(influencer),
      this.calculateContentMix(influencer),
      this.calculateContentStyle(influencer),
      this.calculateTopPerformingPosts(influencer),
      this.calculateWorstPerformingPosts(influencer),
      this.calculateTopNicheBreakdown(influencer),
      this.calculateHashtagEffectiveness(influencer),
      this.calculateLanguageMarketFit(influencer),
    ]);

    const score =
      (platformRelevance.score * 0.35) +
      (contentMix.score * 0.05) +
      (contentStyle.score * 0.10) +
      (topPerformingPosts.score * 0.10) +
      (worstPerformingPosts.score * 0.10) +
      (topNicheBreakdown.score * 0.10) +
      (hashtagEffectiveness.score * 0.10) +
      (languageMarketFit.score * 0.10);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        platformRelevance: { score: platformRelevance.score, weight: 35, details: platformRelevance.details },
        contentMix: { score: contentMix.score, weight: 5, details: contentMix.details },
        contentStyle: { score: contentStyle.score, weight: 10, details: contentStyle.details },
        topPerformingPosts: { score: topPerformingPosts.score, weight: 10, details: topPerformingPosts.details },
        worstPerformingPosts: { score: worstPerformingPosts.score, weight: 10, details: worstPerformingPosts.details },
        topNicheBreakdown: { score: topNicheBreakdown.score, weight: 10, details: topNicheBreakdown.details },
        hashtagEffectiveness: { score: hashtagEffectiveness.score, weight: 10, details: hashtagEffectiveness.details },
        languageMarketFit: { score: languageMarketFit.score, weight: 10, details: languageMarketFit.details },
      },
    };
  }

  /**
   * 2.1 Platform Relevance (35%)
   * AI rates content on scale of 1-10 based on trends, topics, niche relevance
   */
  private async calculatePlatformRelevance(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0, // Default good score
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available for analysis' } };
      }

      // Use AI to analyze trend relevance
      const captions = recentMedia.map(m => m.caption);
      const trendAnalysis = await this.geminiAIService.analyzeTrendRelevance(captions);

      return {
        score: Number(trendAnalysis.score.toFixed(2)), // AI returns 1-10
        details: trendAnalysis,
      };
    } catch (error) {
      return {
        score: 7.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 2.2 Content Mix (5%)
   * Reel percentage scoring
   */
  private async calculateContentMix(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allPosts = await this.instagramMediaModel.count({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const reelPosts = await this.instagramMediaModel.count({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
        mediaType: 'VIDEO', // Reels are videos
      },
    });

    if (allPosts === 0) {
      return { score: 0, details: { message: 'No posts in last 30 days' } };
    }

    const reelPercentage = (reelPosts / allPosts) * 100;

    let score = 0;
    if (reelPercentage >= 90) score = 2;
    else if (reelPercentage >= 60) score = 5;
    else score = 3;

    // Convert to 0-10 scale
    const normalizedScore = (score / 5) * 10;

    return {
      score: Number(normalizedScore.toFixed(2)),
      details: {
        totalPosts: allPosts,
        reelPosts,
        reelPercentage: Number(reelPercentage.toFixed(2)),
        rawScore: score,
      },
    };
  }

  /**
   * 2.3 Content Style (10%)
   * % of posts with face/person content
   */
  private async calculateContentStyle(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      let faceContentCount = 0;
      for (const media of recentMedia.slice(0, 10)) {
        try {
          const hasFace = await this.geminiAIService.detectFaceInContent(media.mediaUrl);
          if (hasFace) faceContentCount++;
        } catch (error) {
          // Continue on error
        }
      }

      const facePercentage = (faceContentCount / Math.min(recentMedia.length, 10)) * 100;
      const score = (facePercentage / 100) * 10; // 100% face = 10/10

      return {
        score: Number(score.toFixed(2)),
        details: {
          imagesAnalyzed: Math.min(recentMedia.length, 10),
          faceContentCount,
          facePercentage: Number(facePercentage.toFixed(2)),
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 2.4 Top Performing Posts (10%)
   * % of posts where reach > avg reach
   */
  private async calculateTopPerformingPosts(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
      }],
    });

    if (recentInsights.length === 0) {
      return { score: 0, details: { message: 'No insights available' } };
    }

    const avgReach = recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length;
    const topPostsCount = recentInsights.filter(i => (i.reach || 0) > avgReach).length;
    const topPostsPercentage = (topPostsCount / recentInsights.length) * 100;

    let rawScore = 0;
    if (topPostsPercentage === 0) rawScore = 3;
    else if (topPostsPercentage <= 30) rawScore = 6;
    else if (topPostsPercentage <= 44) rawScore = 8;
    else rawScore = 10;

    return {
      score: Number(rawScore.toFixed(2)),
      details: {
        totalPosts: recentInsights.length,
        topPostsCount,
        topPostsPercentage: Number(topPostsPercentage.toFixed(2)),
        avgReach: Math.round(avgReach),
      },
    };
  }

  /**
   * 2.5 Worst Performing Posts (10%)
   * % of posts where reach < avg reach
   */
  private async calculateWorstPerformingPosts(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
      }],
    });

    if (recentInsights.length === 0) {
      return { score: 0, details: { message: 'No insights available' } };
    }

    const avgReach = recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length;
    const worstPostsCount = recentInsights.filter(i => (i.reach || 0) < avgReach).length;
    const worstPostsPercentage = (worstPostsCount / recentInsights.length) * 100;

    let rawScore = 0;
    if (worstPostsPercentage <= 15) rawScore = 10;
    else if (worstPostsPercentage <= 30) rawScore = 8;
    else if (worstPostsPercentage <= 45) rawScore = 6;
    else rawScore = 3;

    return {
      score: Number(rawScore.toFixed(2)),
      details: {
        totalPosts: recentInsights.length,
        worstPostsCount,
        worstPostsPercentage: Number(worstPostsPercentage.toFixed(2)),
        avgReach: Math.round(avgReach),
      },
    };
  }

  /**
   * 2.6 Top Niche Breakdown (10%)
   * Count of matching niches
   */
  private async calculateTopNicheBreakdown(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const captions = recentMedia.map(m => m.caption);
      const nicheResult = await this.geminiAIService.detectNiche(captions, []);

      const topNiches = ['fashion', 'beauty', 'lifestyle', 'food', 'electronics', 'travel', 'business', 'finance', 'education', 'fitness', 'sports', 'spiritual', 'motivator'];

      const matchCount = [nicheResult.primaryNiche, ...nicheResult.secondaryNiches]
        .filter(niche => topNiches.includes(niche.toLowerCase()))
        .length;

      let rawScore = 0;
      if (matchCount === 0) rawScore = 3;
      else if (matchCount === 1) rawScore = 6;
      else if (matchCount <= 4) rawScore = 8;
      else rawScore = 10;

      return {
        score: Number(rawScore.toFixed(2)),
        details: {
          primaryNiche: nicheResult.primaryNiche,
          secondaryNiches: nicheResult.secondaryNiches,
          matchCount,
          topNiches,
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 2.7 Hashtag Effectiveness (10%)
   * AI rates hashtag strategy
   */
  private async calculateHashtagEffectiveness(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const captions = recentMedia.map(m => m.caption);
      const hashtagAnalysis = await this.geminiAIService.analyzeHashtagEffectiveness(captions);

      // Map AI rating to score
      const scoreMap = {
        'outperforming': 10,
        'effective': 8,
        'medium': 5,
        'need_improvement': 2,
      };

      const score = scoreMap[hashtagAnalysis.rating] || 5;

      return {
        score: Number(score.toFixed(2)),
        details: hashtagAnalysis,
      };
    } catch (error) {
      return {
        score: 7.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 2.8 Language & Market Fit (10%)
   * Target languages: Hindi + English
   */
  private async calculateLanguageMarketFit(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 8.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);
      if (captions.length === 0) {
        return { score: 0, details: { message: 'No captions available' } };
      }

      const languageResult = await this.geminiAIService.analyzeLanguage(captions);

      const targetLanguages = ['Hindi', 'English'];
      let targetLanguagePercentage = 0;

      for (const lang of targetLanguages) {
        if (languageResult.languagePercentages[lang]) {
          targetLanguagePercentage += languageResult.languagePercentages[lang];
        }
      }

      const score = (targetLanguagePercentage / 100) * 10;

      return {
        score: Number(score.toFixed(2)),
        details: {
          primaryLanguage: languageResult.primaryLanguage,
          languagePercentages: languageResult.languagePercentages,
          targetLanguagePercentage: Number(targetLanguagePercentage.toFixed(2)),
        },
      };
    } catch (error) {
      return {
        score: 8.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  // ==================== CATEGORY 3: CONTENT QUALITY (10 pts) ====================

  async calculateContentQuality(influencer: Influencer): Promise<ContentQualityScore> {
    const [
      visualQuality,
      colorPaletteMood,
      captionSentiment,
      ctaUsage,
    ] = await Promise.all([
      this.calculateVisualQuality(influencer),
      this.calculateColorPaletteMood(influencer),
      this.calculateCaptionSentiment(influencer),
      this.calculateCTAUsage(influencer),
    ]);

    const score =
      (visualQuality.score * 0.60) +
      (colorPaletteMood.score * 0.20) +
      (captionSentiment.score * 0.10) +
      (ctaUsage.score * 0.10);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        visualQuality: { score: visualQuality.score, weight: 60, details: visualQuality.details },
        colorPaletteMood: { score: colorPaletteMood.score, weight: 20, details: colorPaletteMood.details },
        captionSentiment: { score: captionSentiment.score, weight: 10, details: captionSentiment.details },
        ctaUsage: { score: ctaUsage.score, weight: 10, details: ctaUsage.details },
      },
    };
  }

  /**
   * 3.1 Visual Quality (60%)
   * AI-based production quality analysis
   */
  private async calculateVisualQuality(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.5,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const visualAnalyses: any[] = [];
      for (const media of recentMedia.slice(0, 10)) {
        try {
          const visual = await this.geminiAIService.analyzeVisualQuality(media.mediaUrl);
          visualAnalyses.push(visual);
        } catch (error) {
          // Continue on error
        }
      }

      if (visualAnalyses.length === 0) {
        return { score: 0, details: { message: 'Visual analysis failed' } };
      }

      const avgOverallQuality = visualAnalyses.reduce((sum, v) => sum + v.overallQuality, 0) / visualAnalyses.length;
      const avgProfessionalScore = visualAnalyses.reduce((sum, v) => sum + v.professionalScore, 0) / visualAnalyses.length;

      // Combine and normalize to 0-10 scale
      const score = ((avgOverallQuality + avgProfessionalScore) / 200) * 10;

      return {
        score: Number(score.toFixed(2)),
        details: {
          imagesAnalyzed: visualAnalyses.length,
          avgOverallQuality: Number(avgOverallQuality.toFixed(2)),
          avgProfessionalScore: Number(avgProfessionalScore.toFixed(2)),
        },
      };
    } catch (error) {
      return {
        score: 7.5,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 3.2 Color Palette & Mood (20%)
   * AI rates aesthetic consistency (1-20 scale)
   */
  private async calculateColorPaletteMood(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const aestheticAnalysis = await this.geminiAIService.analyzeColorPaletteMood(recentMedia.map(m => m.mediaUrl).slice(0, 10));

      // AI returns 1-20, convert to 0-10
      const score = (aestheticAnalysis.rating / 20) * 10;

      return {
        score: Number(score.toFixed(2)),
        details: aestheticAnalysis,
      };
    } catch (error) {
      return {
        score: 7.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 3.3 Caption Sentiment (10%)
   * % of positive sentiment posts
   */
  private async calculateCaptionSentiment(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 8.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);
      if (captions.length === 0) {
        return { score: 0, details: { message: 'No captions available' } };
      }

      const sentimentScore = await this.geminiAIService.analyzeSentiment(captions);

      // Convert -100 to +100 to percentage (0 = 50%, +100 = 100%, -100 = 0%)
      const positivePercentage = ((sentimentScore + 100) / 200) * 100;

      let rawScore = 0;
      if (positivePercentage <= 30) rawScore = 4;
      else if (positivePercentage <= 50) rawScore = 6;
      else if (positivePercentage <= 75) rawScore = 8;
      else rawScore = 10;

      return {
        score: Number(rawScore.toFixed(2)),
        details: {
          sentimentScore,
          positivePercentage: Number(positivePercentage.toFixed(2)),
          captionsAnalyzed: captions.length,
        },
      };
    } catch (error) {
      return {
        score: 8.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 3.4 CTA Usage (10%)
   * AI rates call-to-action effectiveness
   */
  private async calculateCTAUsage(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);
      if (captions.length === 0) {
        return { score: 0, details: { message: 'No captions available' } };
      }

      const ctaAnalysis = await this.geminiAIService.analyzeCTAUsage(captions);

      // Map AI rating to score
      const scoreMap = {
        'good': 10,
        'medium': 7,
        'less': 4,
      };

      const score = scoreMap[ctaAnalysis.rating] || 7;

      return {
        score: Number(score.toFixed(2)),
        details: ctaAnalysis,
      };
    } catch (error) {
      return {
        score: 7.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  // ==================== CATEGORY 4: ENGAGEMENT STRENGTH (10 pts) ====================

  async calculateEngagementStrength(influencer: Influencer): Promise<EngagementStrengthScore> {
    const [
      engagementOverview,
      performanceConsistency,
      retentionOverview,
    ] = await Promise.all([
      this.calculateEngagementOverview(influencer),
      this.calculatePerformanceConsistency(influencer),
      this.calculateRetentionOverview(influencer),
    ]);

    const score =
      (engagementOverview.score * 0.50) +
      (performanceConsistency.score * 0.30) +
      (retentionOverview.score * 0.20);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        engagementOverview: { score: engagementOverview.score, weight: 50, details: engagementOverview.details },
        performanceConsistency: { score: performanceConsistency.score, weight: 30, details: performanceConsistency.details },
        retentionOverview: { score: retentionOverview.score, weight: 20, details: retentionOverview.details },
      },
    };
  }

  /**
   * 4.1 Engagement Overview (50%)
   * Overall engagement rate (likes + comments + saves + shares / reach)
   */
  private async calculateEngagementOverview(influencer: Influencer): Promise<{ score: number; details: any }> {
    const latestSync = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSync || !latestSync.avgEngagementRate) {
      return {
        score: 0,
        details: { message: 'No engagement data available' },
      };
    }

    const engagementRate = latestSync.avgEngagementRate;
    const benchmark = 3; // 3% is good engagement

    // Convert to 0-10 scale (3% or higher = 10/10)
    const score = Math.min((engagementRate / benchmark) * 10, 10);

    return {
      score: Number(score.toFixed(2)),
      details: {
        engagementRate: Number(engagementRate.toFixed(2)),
        benchmark,
        postsAnalyzed: latestSync.postsAnalyzed,
      },
    };
  }

  /**
   * 4.2 Performance Consistency (30%)
   * Coefficient of variation in reach
   */
  private async calculatePerformanceConsistency(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
      }],
    });

    if (recentInsights.length < 5) {
      return {
        score: 0,
        details: { message: 'Insufficient posts for consistency calculation' },
      };
    }

    const reaches = recentInsights.map(i => i.reach || 0);
    const avgReach = reaches.reduce((sum, r) => sum + r, 0) / reaches.length;
    const variance = reaches.reduce((sum, r) => sum + Math.pow(r - avgReach, 2), 0) / reaches.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgReach > 0 ? stdDev / avgReach : 0;

    // Lower CV = higher consistency
    // Convert to 0-10 scale (CV of 0 = 10, CV of 2+ = 0)
    const consistencyScore = 1 / (1 + cv);
    const score = consistencyScore * 10;

    return {
      score: Number(score.toFixed(2)),
      details: {
        coefficientOfVariation: Number(cv.toFixed(3)),
        avgReach: Math.round(avgReach),
        stdDev: Math.round(stdDev),
        postsAnalyzed: reaches.length,
      },
    };
  }

  /**
   * 4.3 Retention Overview (20%)
   * Placeholder - video watch time when available
   */
  private async calculateRetentionOverview(_influencer: Influencer): Promise<{ score: number; details: any }> {
    return {
      score: 10.0, // Full points for now
      details: {
        message: 'Full points awarded. Video retention tracking will be implemented when Instagram video insights become available.',
      },
    };
  }

  // ==================== CATEGORY 5: GROWTH MOMENTUM (10 pts) ====================

  async calculateGrowthMomentum(influencer: Influencer): Promise<GrowthMomentumScore> {
    const [
      growthTrend,
      peakFollowerGain,
      postingBehaviour,
    ] = await Promise.all([
      this.calculateGrowthTrend(influencer),
      this.calculatePeakFollowerGain(influencer),
      this.calculatePostingBehaviour(influencer),
    ]);

    const score =
      (growthTrend.score * 0.50) +
      (peakFollowerGain.score * 0.30) +
      (postingBehaviour.score * 0.20);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        growthTrend: { score: growthTrend.score, weight: 50, details: growthTrend.details },
        peakFollowerGain: { score: peakFollowerGain.score, weight: 30, details: peakFollowerGain.details },
        postingBehaviour: { score: postingBehaviour.score, weight: 20, details: postingBehaviour.details },
      },
    };
  }

  /**
   * 5.1 Growth Trend (50%)
   * 30-day follower growth rate
   */
  private async calculateGrowthTrend(influencer: Influencer): Promise<{ score: number; details: any }> {
    const snapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 2,
    });

    if (snapshots.length < 2) {
      return {
        score: 10, // Full points for new accounts
        details: { message: 'First sync. Growth will be calculated after next sync.' },
      };
    }

    const latestFollowers = snapshots[0].totalFollowers || 0;
    const previousFollowers = snapshots[1].totalFollowers || 0;

    if (previousFollowers === 0) {
      return { score: 10, details: { message: 'No baseline data' } };
    }

    const growthRate = ((latestFollowers - previousFollowers) / previousFollowers) * 100;
    const benchmark = 2; // 2% monthly growth is good

    // Convert to 0-10 scale (2% or higher = 10/10)
    const score = Math.max(0, Math.min((growthRate / benchmark) * 10, 10));

    return {
      score: Number(score.toFixed(2)),
      details: {
        growthRate: Number(growthRate.toFixed(2)),
        benchmark,
        followersStart: previousFollowers,
        followersEnd: latestFollowers,
        growth: latestFollowers - previousFollowers,
      },
    };
  }

  /**
   * 5.2 Peak Follower Gain (30%)
   * Detect viral spike moments
   */
  private async calculatePeakFollowerGain(influencer: Influencer): Promise<{ score: number; details: any }> {
    const snapshots = await this.instagramProfileGrowthModel.findAll({
      where: { influencerId: influencer.id },
      order: [['snapshotDate', 'DESC']],
      limit: 30, // Last 30 snapshots
    });

    if (snapshots.length < 2) {
      return {
        score: 5.0, // Mid-range for new accounts
        details: { message: 'Insufficient growth history' },
      };
    }

    let maxGain = 0;
    for (let i = 0; i < snapshots.length - 1; i++) {
      const gain = (snapshots[i].followersCount || 0) - (snapshots[i + 1].followersCount || 0);
      if (gain > maxGain) maxGain = gain;
    }

    const currentFollowers = influencer.instagramFollowersCount || 0;
    const peakGainPercentage = currentFollowers > 0 ? (maxGain / currentFollowers) * 100 : 0;

    // Score based on peak gain (higher % = viral moments = better score)
    let score = 5.0; // Base score
    if (peakGainPercentage >= 5) score = 10;
    else if (peakGainPercentage >= 2) score = 8;
    else if (peakGainPercentage >= 1) score = 6;

    return {
      score: Number(score.toFixed(2)),
      details: {
        maxGain,
        peakGainPercentage: Number(peakGainPercentage.toFixed(2)),
        currentFollowers,
        snapshotsAnalyzed: snapshots.length,
      },
    };
  }

  /**
   * 5.3 Posting Behaviour (20%)
   * Posting frequency consistency
   */
  private async calculatePostingBehaviour(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await this.instagramMediaModel.count({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const actualFrequency = recentPosts / 30; // posts per day
    const idealFrequency = 4 / 7; // 4 posts/week

    // Convert to 0-10 scale (ideal frequency = 10/10)
    const score = Math.min((actualFrequency / idealFrequency) * 10, 10);

    return {
      score: Number(score.toFixed(2)),
      details: {
        actualPosts: recentPosts,
        actualFrequency: Number(actualFrequency.toFixed(3)),
        idealFrequency: Number(idealFrequency.toFixed(3)),
      },
    };
  }

  // ==================== CATEGORY 6: MONETISATION (10 pts) ====================

  async calculateMonetisation(influencer: Influencer): Promise<MonetisationScore> {
    const [
      monetisationSignals,
      brandTrustSignal,
      audienceSentiment,
      brandAlignment,
    ] = await Promise.all([
      this.calculateMonetisationSignals(influencer),
      this.calculateBrandTrustSignal(influencer),
      this.calculateAudienceSentiment(influencer),
      this.calculateBrandAlignmentScore(influencer),
    ]);

    const score =
      (monetisationSignals.score * 0.40) +
      (brandTrustSignal.score * 0.30) +
      (audienceSentiment.score * 0.20) +
      (brandAlignment.score * 0.10);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        monetisationSignals: { score: monetisationSignals.score, weight: 40, details: monetisationSignals.details },
        brandTrustSignal: { score: brandTrustSignal.score, weight: 30, details: brandTrustSignal.details },
        audienceSentiment: { score: audienceSentiment.score, weight: 20, details: audienceSentiment.details },
        brandAlignment: { score: brandAlignment.score, weight: 10, details: brandAlignment.details },
      },
    };
  }

  /**
   * 6.1 Monetisation Signals (40%)
   * Frequency of branded content and disclosure practices
   */
  private async calculateMonetisationSignals(influencer: Influencer): Promise<{ score: number; details: any }> {
    const allMedia = await this.instagramMediaModel.findAll({
      where: { influencerId: influencer.id },
      order: [['timestamp', 'DESC']],
      limit: 100,
    });

    if (allMedia.length === 0) {
      return {
        score: 5.0,
        details: { message: 'No posts available' },
      };
    }

    const disclosureKeywords = [
      '#ad', '#sponsored', '#partnership', '#collab', '#collaboration',
      '#gifted', '#paidpartnership', '#ambassador', '#brandpartner'
    ];

    const paidContentIndicators = [
      'use code', 'discount code', 'promo code', 'link in bio',
      'shop now', 'swipe up', 'check out', 'available at'
    ];

    let brandedPostsCount = 0;
    let properDisclosureCount = 0;

    for (const media of allMedia) {
      const caption = (media.caption || '').toLowerCase();

      const hasDisclosure = disclosureKeywords.some(kw => caption.includes(kw.toLowerCase()));
      const appearsPaid = paidContentIndicators.some(ind => caption.includes(ind.toLowerCase()));

      if (hasDisclosure || appearsPaid) {
        brandedPostsCount++;
        if (hasDisclosure) properDisclosureCount++;
      }
    }

    const brandedPercentage = (brandedPostsCount / allMedia.length) * 100;
    const disclosureRate = brandedPostsCount > 0 ? (properDisclosureCount / brandedPostsCount) * 100 : 100;

    // Score: balance between having branded content (shows monetization) and proper disclosure
    let score = 5.0;
    if (brandedPercentage > 10 && disclosureRate >= 80) score = 10;
    else if (brandedPercentage > 5 && disclosureRate >= 60) score = 8;
    else if (brandedPercentage > 0) score = 6;

    return {
      score: Number(score.toFixed(2)),
      details: {
        totalPosts: allMedia.length,
        brandedPostsCount,
        properDisclosureCount,
        brandedPercentage: Number(brandedPercentage.toFixed(2)),
        disclosureRate: Number(disclosureRate.toFixed(2)),
      },
    };
  }

  /**
   * 6.2 Brand Trust Signal (30%)
   * Policy compliance and account credibility
   */
  private async calculateBrandTrustSignal(influencer: Influencer): Promise<{ score: number; details: any }> {
    let trustScore = 5.0; // Base score

    // Account type bonus
    if (influencer.instagramAccountType === 'BUSINESS' || influencer.instagramAccountType === 'CREATOR') {
      trustScore += 2.0;
    }

    // Follower count bonus
    if (influencer.instagramFollowersCount && influencer.instagramFollowersCount > 50000) {
      trustScore += 2.0;
    } else if (influencer.instagramFollowersCount && influencer.instagramFollowersCount > 10000) {
      trustScore += 1.0;
    }

    const score = Math.min(trustScore, 10);

    return {
      score: Number(score.toFixed(2)),
      details: {
        accountType: influencer.instagramAccountType,
        followers: influencer.instagramFollowersCount,
        trustLevel: score >= 8 ? 'High' : score >= 6 ? 'Medium' : 'Low',
      },
    };
  }

  /**
   * 6.3 Audience Sentiment (20%)
   * Positive sentiment in content
   */
  private async calculateAudienceSentiment(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 8.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);
      if (captions.length === 0) {
        return { score: 0, details: { message: 'No captions available' } };
      }

      const sentimentScore = await this.geminiAIService.analyzeSentiment(captions);

      // Convert -100 to +100 scale to 0-10 scale
      const positiveSentimentRatio = (sentimentScore + 100) / 200;
      const score = positiveSentimentRatio * 10;

      return {
        score: Number(score.toFixed(2)),
        details: {
          sentimentScore,
          positiveSentimentRatio: Number((positiveSentimentRatio * 100).toFixed(2)),
        },
      };
    } catch (error) {
      return {
        score: 8.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  /**
   * 6.4 Brand Alignment (10%)
   * Brand safety score from AI
   */
  private async calculateBrandAlignmentScore(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 9.0,
        details: { message: 'AI not available - using default score' },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const brandSafetyScores: number[] = [];
      for (const media of recentMedia.slice(0, 10)) {
        try {
          const visual = await this.geminiAIService.analyzeVisualQuality(media.mediaUrl);
          brandSafetyScores.push(visual.brandSafetyScore);
        } catch (error) {
          // Continue on error
        }
      }

      if (brandSafetyScores.length === 0) {
        return { score: 0, details: { message: 'Brand safety analysis failed' } };
      }

      const avgBrandSafetyScore = brandSafetyScores.reduce((sum, s) => sum + s, 0) / brandSafetyScores.length;

      // Convert 0-100 to 0-10 scale
      const score = (avgBrandSafetyScore / 100) * 10;

      return {
        score: Number(score.toFixed(2)),
        details: {
          avgBrandSafetyScore: Number(avgBrandSafetyScore.toFixed(2)),
          imagesAnalyzed: brandSafetyScores.length,
        },
      };
    } catch (error) {
      return {
        score: 9.0,
        details: { message: 'AI analysis failed - using default', error: error.message },
      };
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get recent media with captions and URLs for AI analysis
   */
  private async getRecentMediaForAI(influencerId: number, limit: number = 20): Promise<Array<{ caption: string; mediaUrl: string }>> {
    const mediaRecords = await this.instagramMediaModel.findAll({
      where: { influencerId },
      order: [['timestamp', 'DESC']],
      limit,
    });

    return mediaRecords
      .filter(m => m.mediaUrl && m.mediaType !== 'VIDEO')
      .map(m => ({
        caption: m.caption || '',
        mediaUrl: m.mediaUrl || '',
      }));
  }
}
