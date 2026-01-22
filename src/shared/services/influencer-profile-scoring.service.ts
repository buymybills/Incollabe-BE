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

// Category 1: Audience Quality (100 points for UI display)
export interface AudienceQualityScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
  breakdown: {
    followerAuthenticity: { score: number; weight: 65; details: any };
    demographicsSnapshot: { score: number; weight: 20; details: any };
    geoRelevance: { score: number; weight: 15; details: any };
  };
}

// Category 2: Content Relevance (100 points for UI display)
export interface ContentRelevanceScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
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

// Category 3: Content Quality (100 points for UI display)
export interface ContentQualityScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
  breakdown: {
    visualQuality: { score: number; weight: 60; details: any };
    colorPaletteMood: { score: number; weight: 20; details: any };
    captionSentiment: { score: number; weight: 10; details: any };
    ctaUsage: { score: number; weight: 10; details: any };
    topKeywords?: { score: number; weight: 0; details: any };
  };
}

// Category 4: Engagement Strength (100 points for UI display)
export interface EngagementStrengthScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
  breakdown: {
    engagementOverview: { score: number; weight: 70; details: any };
    performanceConsistency: { score: number; weight: 30; details: any };
  };
}

// Category 5: Growth Momentum (10 points)
export interface GrowthMomentumScore {
  score: number; // 0-10
  maxScore: 10;
  breakdown: {
    growthTrend: { score: number; weight: 60; details: any };
    postingBehaviour: { score: number; weight: 40; details: any };
  };
}

// Category 6: Monetisation (100 points for UI display)
export interface MonetisationScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
  breakdown: {
    monetisationSignals: { score: number; weight: 50; details: any };
    brandTrustSignal: { score: number; weight: 30; details: any };
    audienceSentiment: { score: number; weight: 20; details: any };
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

    // Convert to 0-100 scale for UI
    const scoreOut100 = score * 10;

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      breakdown: {
        followerAuthenticity: { score: followerAuthenticity.score * 10, weight: 65, details: followerAuthenticity.details },
        demographicsSnapshot: { score: demographicsSnapshot.score * 10, weight: 20, details: demographicsSnapshot.details },
        geoRelevance: { score: geoRelevance.score * 10, weight: 15, details: geoRelevance.details },
      },
    };
  }

  /**
   * 1.1 Follower Authenticity (65%)
   * Uses stored 30-day snapshots from credibility scoring
   */
  private async calculateFollowerAuthenticity(influencer: Influencer): Promise<{ score: number; details: any }> {
    const snapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 2,
    });

    if (snapshots.length === 0 || !snapshots[0].activeFollowersPercentage) {
      return {
        score: 0,
        details: {
          authenticityPercentage: 0,
          message: 'No sync data available',
        },
      };
    }

    const latestSync = snapshots[0];
    const previousSync = snapshots.length > 1 ? snapshots[1] : null;

    const authenticityPercentage = Number(latestSync.activeFollowersPercentage) || 0;
    const activeFollowers = latestSync.activeFollowers || 0;
    const totalFollowers = latestSync.totalFollowers || 0;

    // Calculate change from previous sync
    let change = 0;
    if (previousSync && previousSync.activeFollowersPercentage) {
      const previousPercentage = Number(previousSync.activeFollowersPercentage) || 0;
      change = Number((authenticityPercentage - previousPercentage).toFixed(2));
    }

    // Convert authenticity % to 0-10 scale
    // 25%+ active = 10/10, scales down linearly
    const score = Math.min((authenticityPercentage / 25) * 10, 10);

    // Determine rating title based on percentage
    let rating = '';
    if (authenticityPercentage >= 70) {
      rating = 'Excellent Follower Base';
    } else if (authenticityPercentage >= 50) {
      rating = 'Strong Follower Base';
    } else if (authenticityPercentage >= 30) {
      rating = 'Good Follower Base';
    } else if (authenticityPercentage >= 15) {
      rating = 'Moderate Follower Base';
    } else {
      rating = 'Weak Follower Base';
    }

    // Generate AI feedback
    let feedback = '';
    if (authenticityPercentage >= 60 && Math.abs(change) < 5) {
      feedback = 'Your follower base shows healthy activity with no abnormal spikes.';
    } else if (authenticityPercentage >= 60 && change > 5) {
      feedback = 'Strong follower growth with healthy engagement patterns.';
    } else if (authenticityPercentage < 30) {
      feedback = 'Low active follower percentage may indicate fake followers or inactive audience.';
    } else if (change < -5) {
      feedback = 'Declining active follower rate - review content strategy and engagement.';
    } else {
      feedback = 'Stable follower base with room for improvement in engagement.';
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        authenticityPercentage: Number(authenticityPercentage.toFixed(2)),
        totalFollowers,
        activeFollowers,
        rating,
        feedback,
        change,
        syncDate: latestSync.syncDate,
      },
    };
  }

  /**
   * 1.2 Demographics Snapshot (20%)
   * Uses demographic stability from credibility scoring with detailed breakdown
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

    const latestSnapshot = historicalSnapshots[0];
    const totalFollowers = latestSnapshot?.totalFollowers || influencer.instagramFollowersCount || 0;

    // Calculate gender breakdown
    const genderBreakdown = {
      male: { count: 0, percentage: 0 },
      female: { count: 0, percentage: 0 },
      others: { count: 0, percentage: 0 },
    };

    const ageBreakdown: Array<{
      ageRange: string;
      percentage: number;
      malePercentage: number;
      femalePercentage: number;
      othersPercentage: number;
    }> = [];

    if (latestSnapshot && latestSnapshot.audienceAgeGender) {
      // Aggregate by gender
      const genderTotals: { [key: string]: number } = {};
      const ageRangeTotals: { [key: string]: { total: number; male: number; female: number; others: number } } = {};

      for (const segment of latestSnapshot.audienceAgeGender) {
        const gender = segment.gender?.toLowerCase() || 'unknown';
        const ageRange = segment.ageRange || 'unknown';
        const percentage = segment.percentage || 0;

        // Gender totals
        if (gender === 'male' || gender === 'm') {
          genderTotals.male = (genderTotals.male || 0) + percentage;
        } else if (gender === 'female' || gender === 'f') {
          genderTotals.female = (genderTotals.female || 0) + percentage;
        } else {
          genderTotals.others = (genderTotals.others || 0) + percentage;
        }

        // Age range breakdown
        if (!ageRangeTotals[ageRange]) {
          ageRangeTotals[ageRange] = { total: 0, male: 0, female: 0, others: 0 };
        }
        ageRangeTotals[ageRange].total += percentage;

        if (gender === 'male' || gender === 'm') {
          ageRangeTotals[ageRange].male += percentage;
        } else if (gender === 'female' || gender === 'f') {
          ageRangeTotals[ageRange].female += percentage;
        } else {
          ageRangeTotals[ageRange].others += percentage;
        }
      }

      // Calculate gender breakdown with counts
      genderBreakdown.male.percentage = Number((genderTotals.male || 0).toFixed(2));
      genderBreakdown.male.count = Math.round((totalFollowers * genderBreakdown.male.percentage) / 100);

      genderBreakdown.female.percentage = Number((genderTotals.female || 0).toFixed(2));
      genderBreakdown.female.count = Math.round((totalFollowers * genderBreakdown.female.percentage) / 100);

      genderBreakdown.others.percentage = Number((genderTotals.others || 0).toFixed(2));
      genderBreakdown.others.count = Math.round((totalFollowers * genderBreakdown.others.percentage) / 100);

      // Build age breakdown
      const ageOrder = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
      for (const ageRange of Object.keys(ageRangeTotals)) {
        const data = ageRangeTotals[ageRange];
        ageBreakdown.push({
          ageRange,
          percentage: Number(data.total.toFixed(2)),
          malePercentage: Number(data.male.toFixed(2)),
          femalePercentage: Number(data.female.toFixed(2)),
          othersPercentage: Number(data.others.toFixed(2)),
        });
      }

      // Sort by age order
      ageBreakdown.sort((a, b) => {
        const aIndex = ageOrder.findIndex(range => a.ageRange.includes(range.split('-')[0]));
        const bIndex = ageOrder.findIndex(range => b.ageRange.includes(range.split('-')[0]));
        return aIndex - bIndex;
      });
    }

    // Calculate variance/stability score
    let score = 10;
    let varianceIndex = 0;
    let change = 0;

    if (historicalSnapshots.length >= 2) {
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

      varianceIndex = varianceScores.length > 0
        ? varianceScores.reduce((sum, v) => sum + v, 0) / varianceScores.length
        : 0.25;

      // Convert to 0-10 scale (lower variance = higher score)
      score = (1 - varianceIndex) * 10;

      // Calculate change indicator (simple difference in largest segment)
      const previousSnapshot = historicalSnapshots[1];
      if (previousSnapshot) {
        const latestTotal = totalFollowers;
        const previousTotal = previousSnapshot.totalFollowers || latestTotal;
        change = latestTotal - previousTotal;
      }
    }

    // Identify core audience (highest percentage segment)
    let coreAudience = 'Unknown';
    let coreFeedback = 'Analyzing audience demographics...';

    if (ageBreakdown.length > 0) {
      const topSegment = ageBreakdown.reduce((max, curr) => curr.percentage > max.percentage ? curr : max);
      const topGender = topSegment.malePercentage > topSegment.femalePercentage ? 'Male' :
                        topSegment.femalePercentage > topSegment.othersPercentage ? 'Female' : 'Others';

      coreAudience = `${topGender} ${topSegment.ageRange}`;

      if (score >= 8) {
        coreFeedback = `Core audience (${coreAudience}) has remained stable for 90 days.`;
      } else if (score >= 6) {
        coreFeedback = `Core audience (${coreAudience}) shows moderate stability.`;
      } else {
        coreFeedback = `Significant demographic shifts detected in ${coreAudience} segment.`;
      }
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        totalFollowers,
        genderBreakdown,
        ageBreakdown,
        coreAudience,
        feedback: coreFeedback,
        change,
        snapshotsAnalyzed: historicalSnapshots.length,
        varianceIndex: Number(varianceIndex.toFixed(4)),
        stability: score >= 8 ? 'High' : score >= 6 ? 'Medium' : 'Low',
      },
    };
  }

  /**
   * 1.3 Geo Relevance (15%)
   * Target geography: India with city-level insights
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

    // Format top countries with proper names
    const countryNames: { [key: string]: string } = {
      'IN': 'India',
      'NP': 'Nepal',
      'BT': 'Bhutan',
      'BD': 'Bangladesh',
      'PK': 'Pakistan',
      'US': 'United States',
      'GB': 'United Kingdom',
      'CA': 'Canada',
      'AU': 'Australia',
      'AE': 'UAE',
    };

    const topCountries = latestSnapshot.audienceCountries
      .slice(0, 5)
      .map((country: any) => ({
        code: country.location,
        name: countryNames[country.location] || country.location,
        percentage: Number(country.percentage.toFixed(2)),
      }));

    // Get top cities from snapshot
    const topCities = latestSnapshot.audienceCities
      ? latestSnapshot.audienceCities
          .slice(0, 4)
          .map((city: any) => ({
            name: city.location,
            percentage: Number(city.percentage.toFixed(2)),
          }))
      : [];

    // Generate AI feedback based on India percentage
    let feedback = '';
    if (indiaPercentage >= 75) {
      feedback = 'Audience geography strongly aligns with Indian consumer brands.';
    } else if (indiaPercentage >= 50) {
      feedback = 'Good Indian market presence with some international reach.';
    } else if (indiaPercentage >= 25) {
      feedback = 'Moderate Indian audience - consider geo-targeted content for better brand alignment.';
    } else {
      feedback = 'Low Indian audience percentage may limit collaboration with India-focused brands.';
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        targetCountry: 'India',
        targetAudiencePercentage: Number(indiaPercentage.toFixed(2)),
        topCountries,
        topCities,
        feedback,
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

    // Convert to 0-100 scale for UI
    const scoreOut100 = score * 10;

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      breakdown: {
        platformRelevance: { score: platformRelevance.score * 10, weight: 35, details: platformRelevance.details },
        contentMix: { score: contentMix.score * 10, weight: 5, details: contentMix.details },
        contentStyle: { score: contentStyle.score * 10, weight: 10, details: contentStyle.details },
        topPerformingPosts: { score: topPerformingPosts.score * 10, weight: 10, details: topPerformingPosts.details },
        worstPerformingPosts: { score: worstPerformingPosts.score * 10, weight: 10, details: worstPerformingPosts.details },
        topNicheBreakdown: { score: topNicheBreakdown.score * 10, weight: 10, details: topNicheBreakdown.details },
        hashtagEffectiveness: { score: hashtagEffectiveness.score * 10, weight: 10, details: hashtagEffectiveness.details },
        languageMarketFit: { score: languageMarketFit.score * 10, weight: 10, details: languageMarketFit.details },
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
        details: {
          message: 'AI not available - using default score',
          percentage: 70,
          rating: 'Good',
          description: 'Content is Well Allignes',
        },
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

      const aiScore = trendAnalysis.score || 7; // AI returns 1-10
      const percentage = (aiScore / 10) * 100; // Convert to percentage

      // Determine rating based on score
      let rating = '';
      if (percentage >= 85) rating = 'Exceptional';
      else if (percentage >= 70) rating = 'Excellent';
      else if (percentage >= 50) rating = 'Good';
      else if (percentage >= 30) rating = 'Fair';
      else rating = 'Needs Improvement';

      // Generate feedback based on analysis
      const feedback = trendAnalysis.relevanceReason || 'Content follows current Instagram very well to stay relevant';

      // Calculate change (placeholder)
      const change = 200; // Would need to track from previous analysis

      return {
        score: Number(aiScore.toFixed(2)), // AI returns 1-10
        details: {
          percentage: Number(percentage.toFixed(2)),
          rating,
          description: 'Content is Well Allignes',
          trends: trendAnalysis.trends || [],
          relevanceReason: trendAnalysis.relevanceReason || '',
          feedback,
          change,
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          percentage: 70,
          rating: 'Good',
          description: 'Content is Well Allignes',
        },
      };
    }
  }

  /**
   * 2.2 Content Mix (5%)
   * Reel percentage scoring: 90%+ = 2, 60-90% = 5, <60% = 3
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

    const imagePosts = await this.instagramMediaModel.count({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
        mediaType: 'IMAGE',
      },
    });

    const carouselPosts = await this.instagramMediaModel.count({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
        mediaType: 'CAROUSEL_ALBUM',
      },
    });

    if (allPosts === 0) {
      return {
        score: 0,
        details: {
          message: 'No posts in last 30 days',
          totalPosts: 0,
          breakdown: [],
          aiFeedback: 'No content available for analysis',
        }
      };
    }

    const reelPercentage = (reelPosts / allPosts) * 100;
    const imagePercentage = (imagePosts / allPosts) * 100;
    const carouselPercentage = (carouselPosts / allPosts) * 100;

    let score = 0;
    let aiFeedback = '';
    if (reelPercentage >= 90) {
      score = 2;
      aiFeedback = 'High reel dominance detected. Consider diversifying content mix for better engagement variety.';
    } else if (reelPercentage >= 60) {
      score = 5;
      aiFeedback = 'Excellent content mix! Strong reel presence balanced with other formats for optimal reach.';
    } else {
      score = 3;
      aiFeedback = 'Low reel percentage. Instagram prioritizes reels - increase video content for better reach.';
    }

    // Convert to 0-10 scale
    const normalizedScore = (score / 5) * 10;

    return {
      score: Number(normalizedScore.toFixed(2)),
      details: {
        totalPosts: allPosts,
        breakdown: [
          {
            type: 'Reel',
            count: reelPosts,
            percentage: Number(reelPercentage.toFixed(1)),
          },
          {
            type: 'Image',
            count: imagePosts,
            percentage: Number(imagePercentage.toFixed(1)),
          },
          {
            type: 'Carousel',
            count: carouselPosts,
            percentage: Number(carouselPercentage.toFixed(1)),
          },
        ],
        aiFeedback,
      },
    };
  }

  /**
   * 2.3 Content Style (10%)
   * 1-100% face content scoring
   */
  private async calculateContentStyle(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: {
          message: 'AI not available - using default score',
          totalPosts: 0,
          facelessPercentage: 30,
          detectedStyles: ['Aesthetic'],
          aiFeedback: 'Default style analysis - AI service unavailable',
        },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return {
          score: 0,
          details: {
            message: 'No media available',
            totalPosts: 0,
            facelessPercentage: 0,
            detectedStyles: [],
            aiFeedback: 'No content available for style analysis',
          }
        };
      }

      let faceContentCount = 0;
      const styleCounts = {
        bold: 0,
        aesthetic: 0,
        storytelling: 0,
      };

      for (const media of recentMedia.slice(0, 10)) {
        try {
          const hasFace = await this.geminiAIService.detectFaceInContent(media.mediaUrl);
          if (hasFace) faceContentCount++;

          // Analyze content style based on caption and engagement patterns
          if (media.caption) {
            const caption = media.caption.toLowerCase();
            // Bold: Strong statements, exclamation marks, caps
            if (caption.includes('!') || caption.match(/[A-Z]{3,}/)) {
              styleCounts.bold++;
            }
            // Aesthetic: Emojis, minimal text, visual focus
            if ((caption.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length > 3) {
              styleCounts.aesthetic++;
            }
            // Storytelling: Longer captions, narrative elements
            if (caption.length > 200 || caption.includes('story') || caption.includes('journey')) {
              styleCounts.storytelling++;
            }
          }
        } catch (error) {
          // Continue on error
        }
      }

      const analyzedCount = Math.min(recentMedia.length, 10);
      const facePercentage = (faceContentCount / analyzedCount) * 100;
      const facelessPercentage = 100 - facePercentage;
      const score = (facePercentage / 100) * 10; // 100% face = 10/10

      // Determine dominant styles
      const detectedStyles: string[] = [];
      if (styleCounts.bold > analyzedCount * 0.3) detectedStyles.push('Bold');
      if (styleCounts.aesthetic > analyzedCount * 0.3) detectedStyles.push('Aesthetic');
      if (styleCounts.storytelling > analyzedCount * 0.3) detectedStyles.push('Storytelling');

      // Generate AI feedback
      let aiFeedback = '';
      if (facePercentage > 70) {
        aiFeedback = 'Strong personal brand presence with high face visibility. Great for building authentic connections with audience.';
      } else if (facePercentage > 40) {
        aiFeedback = 'Balanced content style mixing personal and product-focused content. Good for diverse brand collaborations.';
      } else {
        aiFeedback = 'Faceless content strategy detected. Works well for product-focused or lifestyle brand partnerships.';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          totalPosts: analyzedCount,
          faceContentPercentage: Number(facePercentage.toFixed(1)),
          facelessPercentage: Number(facelessPercentage.toFixed(1)),
          detectedStyles: detectedStyles.length > 0 ? detectedStyles : ['Minimalist'],
          aiFeedback,
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          totalPosts: 0,
          facelessPercentage: 30,
          detectedStyles: ['Aesthetic'],
          aiFeedback: 'Style analysis encountered an error - using default metrics',
        },
      };
    }
  }

  /**
   * 2.4 Top Performing Posts (10%)
   * % of posts where reach > avg reach
   * Scoring: 0=3, 1-30%=6, 31-44%=8, 45%+=10
   */
  private async calculateTopPerformingPosts(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        as: 'instagramMedia',
        required: true,
        where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
      }],
      order: [['reach', 'DESC']],
    });

    if (recentInsights.length === 0) {
      return {
        score: 0,
        details: {
          message: 'No insights available',
          postCount: 0,
          percentage: 0,
          avgReach: 0,
          avgEngagement: 0,
          topPosts: [],
          aiFeedback: 'No performance data available for analysis',
        }
      };
    }

    const avgReach = recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length;
    const avgEngagement = recentInsights.reduce((sum, i) => sum + (i.totalInteractions || 0), 0) / recentInsights.length;

    const topPostsInsights = recentInsights.filter(i => (i.reach || 0) > avgReach);
    const topPostsCount = topPostsInsights.length;
    const topPostsPercentage = (topPostsCount / recentInsights.length) * 100;

    let rawScore = 0;
    let aiFeedback = '';
    if (topPostsPercentage === 0) {
      rawScore = 3;
      aiFeedback = 'No posts exceeding average reach. Focus on content quality and posting consistency.';
    } else if (topPostsPercentage <= 30) {
      rawScore = 6;
      aiFeedback = 'Moderate high-performing content. Analyze top posts to identify winning patterns.';
    } else if (topPostsPercentage <= 44) {
      rawScore = 8;
      aiFeedback = 'Good content performance! Strong consistency in creating engaging posts.';
    } else {
      rawScore = 10;
      aiFeedback = 'Excellent performance! Majority of content exceeds average reach - keep up the great work!';
    }

    // Get top 3 posts with thumbnails
    const topPosts = topPostsInsights.slice(0, 3).map(insight => ({
      thumbnail: insight.instagramMedia?.mediaUrl || insight.instagramMedia?.thumbnailUrl || null,
      permalink: insight.instagramMedia?.permalink || null,
      timestamp: insight.instagramMedia?.timestamp || null,
      reach: insight.reach || 0,
      engagement: insight.totalInteractions || 0,
      likes: insight.likes || 0,
      comments: insight.comments || 0,
      saves: insight.saved || 0,
      shares: insight.shares || 0,
    }));

    return {
      score: Number(rawScore.toFixed(2)),
      details: {
        postCount: topPostsCount,
        percentage: Number(topPostsPercentage.toFixed(1)),
        avgReach: Math.round(avgReach),
        avgEngagement: Math.round(avgEngagement),
        topPosts,
        aiFeedback,
      },
    };
  }

  /**
   * 2.5 Worst Performing Posts (10%)
   * % of posts where reach < avg reach
   * Scoring: 0-15%=10, 16-30%=8, 31-45%=6, 46%+=3
   */
  private async calculateWorstPerformingPosts(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        as: 'instagramMedia',
        required: true,
        where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
      }],
      order: [['reach', 'ASC']],
    });

    if (recentInsights.length === 0) {
      return {
        score: 0,
        details: {
          message: 'No insights available',
          postCount: 0,
          percentage: 0,
          avgReach: 0,
          avgEngagement: 0,
          worstPosts: [],
          aiFeedback: 'No performance data available for analysis',
        }
      };
    }

    const avgReach = recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length;
    const avgEngagement = recentInsights.reduce((sum, i) => sum + (i.totalInteractions || 0), 0) / recentInsights.length;

    const worstPostsInsights = recentInsights.filter(i => (i.reach || 0) < avgReach);
    const worstPostsCount = worstPostsInsights.length;
    const worstPostsPercentage = (worstPostsCount / recentInsights.length) * 100;

    let rawScore = 0;
    let aiFeedback = '';
    if (worstPostsPercentage <= 15) {
      rawScore = 10;
      aiFeedback = 'Excellent consistency! Very few underperforming posts. Your content strategy is highly effective.';
    } else if (worstPostsPercentage <= 30) {
      rawScore = 8;
      aiFeedback = 'Good performance consistency. Minor fluctuations are normal - keep optimizing your best-performing content types.';
    } else if (worstPostsPercentage <= 45) {
      rawScore = 6;
      aiFeedback = 'Moderate consistency. Review underperforming posts to identify patterns and avoid similar content.';
    } else {
      rawScore = 3;
      aiFeedback = 'High number of underperforming posts. Analyze your top posts and replicate their successful elements.';
    }

    // Get worst 3 posts with thumbnails
    const worstPosts = worstPostsInsights.slice(0, 3).map(insight => ({
      thumbnail: insight.instagramMedia?.mediaUrl || insight.instagramMedia?.thumbnailUrl || null,
      permalink: insight.instagramMedia?.permalink || null,
      timestamp: insight.instagramMedia?.timestamp || null,
      reach: insight.reach || 0,
      engagement: insight.totalInteractions || 0,
      likes: insight.likes || 0,
      comments: insight.comments || 0,
      saves: insight.saved || 0,
      shares: insight.shares || 0,
    }));

    return {
      score: Number(rawScore.toFixed(2)),
      details: {
        postCount: worstPostsCount,
        percentage: Number(worstPostsPercentage.toFixed(1)),
        avgReach: Math.round(avgReach),
        avgEngagement: Math.round(avgEngagement),
        worstPosts,
        aiFeedback,
      },
    };
  }

  /**
   * 2.6 Top Niche Breakdown (10%)
   * Count of matching niches
   * Scoring: 0=3, 1=6, 2-4=8, 4+=10
   */
  private async calculateTopNicheBreakdown(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: {
          message: 'AI not available - using default score',
          primaryNiche: 'Lifestyle',
          nicheBreakdown: [],
          aiFeedback: 'Niche analysis unavailable - AI service not accessible',
        },
      };
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentMedia = await this.instagramMediaModel.findAll({
        where: {
          influencerId: influencer.id,
          timestamp: { [Op.gte]: thirtyDaysAgo },
        },
        include: [{
          model: this.instagramMediaInsightModel,
          as: 'insights',
          required: false,
        }],
        limit: 20,
        order: [['timestamp', 'DESC']],
      });

      if (recentMedia.length === 0) {
        return {
          score: 0,
          details: {
            message: 'No media available',
            primaryNiche: 'Unknown',
            nicheBreakdown: [],
            aiFeedback: 'No content available for niche analysis',
          }
        };
      }

      const captions = recentMedia.map(m => m.caption);
      const nicheResult = await this.geminiAIService.detectNiche(captions, []);

      const topNiches = ['fashion', 'beauty', 'lifestyle', 'food', 'electronics', 'travel', 'business', 'finance', 'education', 'fitness', 'sports', 'spiritual', 'motivator'];

      const allNiches = [nicheResult.primaryNiche, ...nicheResult.secondaryNiches];
      const matchedNiches = allNiches.filter(niche => topNiches.includes(niche.toLowerCase()));
      const matchCount = matchedNiches.length;

      let rawScore = 0;
      let aiFeedback = '';
      if (matchCount === 0) {
        rawScore = 3;
        aiFeedback = 'Content niche not clearly defined. Focus on specific categories for better brand targeting.';
      } else if (matchCount === 1) {
        rawScore = 6;
        aiFeedback = 'Single niche focus identified. Good for specialized brand partnerships in this category.';
      } else if (matchCount <= 4) {
        rawScore = 8;
        aiFeedback = 'Well-defined multi-niche presence. Excellent for diverse brand collaboration opportunities.';
      } else {
        rawScore = 10;
        aiFeedback = 'Strong presence across multiple niches. Highly versatile profile for various brand partnerships.';
      }

      // Calculate niche breakdown with reach and engagement data
      const nicheBreakdown: Array<{ niche: string; reach: number; engagement: number; postCount: number }> = [];
      const nicheMetrics = new Map<string, { reach: number; engagement: number; postCount: number }>();

      // Initialize metrics for detected niches
      for (const niche of allNiches) {
        if (!nicheMetrics.has(niche)) {
          nicheMetrics.set(niche, { reach: 0, engagement: 0, postCount: 0 });
        }
      }

      // Aggregate metrics (simplified - in production, would need content-to-niche mapping)
      let totalReach = 0;
      let totalEngagement = 0;

      for (const media of recentMedia) {
        const insight = media.insights?.[0];
        if (insight) {
          totalReach += insight.reach || 0;
          totalEngagement += insight.totalInteractions || 0;
        }
      }

      // Distribute metrics proportionally (primary gets more weight)
      const primaryWeight = 0.5;
      const secondaryWeight = nicheResult.secondaryNiches.length > 0 ?
        (0.5 / nicheResult.secondaryNiches.length) : 0;

      if (nicheMetrics.has(nicheResult.primaryNiche)) {
        const metrics = nicheMetrics.get(nicheResult.primaryNiche)!;
        metrics.reach = Math.round(totalReach * primaryWeight);
        metrics.engagement = Math.round(totalEngagement * primaryWeight);
        metrics.postCount = Math.round(recentMedia.length * primaryWeight);
      }

      for (const niche of nicheResult.secondaryNiches) {
        if (nicheMetrics.has(niche)) {
          const metrics = nicheMetrics.get(niche)!;
          metrics.reach = Math.round(totalReach * secondaryWeight);
          metrics.engagement = Math.round(totalEngagement * secondaryWeight);
          metrics.postCount = Math.round(recentMedia.length * secondaryWeight);
        }
      }

      // Convert to array for response
      for (const [niche, metrics] of nicheMetrics.entries()) {
        nicheBreakdown.push({
          niche: niche.charAt(0).toUpperCase() + niche.slice(1),
          reach: metrics.reach,
          engagement: metrics.engagement,
          postCount: metrics.postCount,
        });
      }

      // Sort by reach (descending)
      nicheBreakdown.sort((a, b) => b.reach - a.reach);

      return {
        score: Number(rawScore.toFixed(2)),
        details: {
          primaryNiche: nicheResult.primaryNiche,
          matchCount,
          nicheBreakdown,
          aiFeedback,
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          primaryNiche: 'Lifestyle',
          nicheBreakdown: [],
          aiFeedback: 'Niche analysis encountered an error - using default metrics',
        },
      };
    }
  }

  /**
   * 2.7 Hashtag Effectiveness (10%)
   * AI rates hashtag strategy
   * Scoring: outperforming=10, effective=8, medium=5, need_improvement=2
   */
  private async calculateHashtagEffectiveness(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: {
          message: 'AI not available - using default score',
          rating: 'effective',
          detectedHashtags: [],
          avgHashtagsUsed: 0,
          effectiveness: 'Moderate',
          aiFeedback: 'Hashtag analysis unavailable - AI service not accessible',
        },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return {
          score: 0,
          details: {
            message: 'No media available',
            rating: 'medium',
            detectedHashtags: [],
            avgHashtagsUsed: 0,
            effectiveness: 'Unknown',
            aiFeedback: 'No content available for hashtag analysis',
          }
        };
      }

      const captions = recentMedia.map(m => m.caption);
      const hashtagAnalysis = await this.geminiAIService.analyzeHashtagEffectiveness(captions);

      // Extract hashtags from captions
      const hashtagRegex = /#[\w]+/g;
      const allHashtags: string[] = [];
      let totalHashtagCount = 0;

      for (const caption of captions) {
        if (caption) {
          const matches = caption.match(hashtagRegex) || [];
          allHashtags.push(...matches);
          totalHashtagCount += matches.length;
        }
      }

      // Count hashtag frequency
      const hashtagFrequency = new Map<string, number>();
      for (const tag of allHashtags) {
        hashtagFrequency.set(tag, (hashtagFrequency.get(tag) || 0) + 1);
      }

      // Get top 10 most used hashtags
      const detectedHashtags = Array.from(hashtagFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({
          hashtag: tag,
          usageCount: count,
        }));

      const avgHashtagsUsed = captions.length > 0 ?
        Number((totalHashtagCount / captions.length).toFixed(1)) : 0;

      // Map AI rating to score
      const scoreMap = {
        'outperforming': 10,
        'effective': 8,
        'medium': 5,
        'need_improvement': 2,
      };

      const score = scoreMap[hashtagAnalysis.rating] || 5;

      // Map rating to effectiveness label
      const effectivenessMap = {
        'outperforming': 'Excellent',
        'effective': 'Good',
        'medium': 'Moderate',
        'need_improvement': 'Needs Work',
      };

      const effectiveness = effectivenessMap[hashtagAnalysis.rating] || 'Moderate';

      // Generate AI feedback based on rating
      let aiFeedback = '';
      if (hashtagAnalysis.rating === 'outperforming') {
        aiFeedback = 'Outstanding hashtag strategy! Your tags are driving excellent discoverability and engagement.';
      } else if (hashtagAnalysis.rating === 'effective') {
        aiFeedback = 'Solid hashtag usage. Your tags are helping content reach the right audience effectively.';
      } else if (hashtagAnalysis.rating === 'medium') {
        aiFeedback = 'Moderate hashtag effectiveness. Consider using more specific, niche-relevant tags for better reach.';
      } else {
        aiFeedback = 'Hashtag strategy needs improvement. Research trending and niche-specific tags to boost discoverability.';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: hashtagAnalysis.rating,
          effectiveness,
          detectedHashtags,
          avgHashtagsUsed,
          totalUniqueHashtags: hashtagFrequency.size,
          aiFeedback: hashtagAnalysis.feedback || aiFeedback,
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          rating: 'effective',
          effectiveness: 'Moderate',
          detectedHashtags: [],
          avgHashtagsUsed: 0,
          aiFeedback: 'Hashtag analysis encountered an error - using default metrics',
        },
      };
    }
  }

  /**
   * 2.8 Language & Market Fit (10%)
   * Target languages: Hindi + English
   * Score based on % of content in target languages
   */
  private async calculateLanguageMarketFit(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 8.0,
        details: {
          message: 'AI not available - using default score',
          primaryLanguage: 'English',
          languageBreakdown: [],
          targetMarketFit: 80,
          aiFeedback: 'Language analysis unavailable - AI service not accessible',
        },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return {
          score: 0,
          details: {
            message: 'No media available',
            primaryLanguage: 'Unknown',
            languageBreakdown: [],
            targetMarketFit: 0,
            aiFeedback: 'No content available for language analysis',
          }
        };
      }

      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);
      if (captions.length === 0) {
        return {
          score: 0,
          details: {
            message: 'No captions available',
            primaryLanguage: 'Unknown',
            languageBreakdown: [],
            targetMarketFit: 0,
            aiFeedback: 'No captions available for language analysis',
          }
        };
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

      // Convert language percentages to breakdown array
      const languageBreakdown = Object.entries(languageResult.languagePercentages)
        .map(([language, percentage]) => ({
          language,
          percentage: Number(percentage.toFixed(1)),
          isTarget: targetLanguages.includes(language),
        }))
        .sort((a, b) => b.percentage - a.percentage);

      // Generate market fit feedback
      let aiFeedback = '';
      if (targetLanguagePercentage >= 90) {
        aiFeedback = 'Excellent market alignment! Content is perfectly positioned for Hindi/English speaking audiences.';
      } else if (targetLanguagePercentage >= 70) {
        aiFeedback = 'Strong market fit with good Hindi/English content mix. Well-suited for Indian brand collaborations.';
      } else if (targetLanguagePercentage >= 50) {
        aiFeedback = 'Moderate market alignment. Consider increasing Hindi/English content for better brand partnership opportunities.';
      } else {
        aiFeedback = 'Limited market fit with target languages. Focus on Hindi/English content to attract local brand partnerships.';
      }

      // Add market insights
      const marketInsights: string[] = [];
      if (languageResult.languagePercentages['Hindi']) {
        marketInsights.push('Hindi content appeals to Tier 2/3 city audiences');
      }
      if (languageResult.languagePercentages['English']) {
        marketInsights.push('English content targets urban and global audiences');
      }
      if (languageResult.languagePercentages['Hindi'] && languageResult.languagePercentages['English']) {
        marketInsights.push('Bilingual content maximizes reach across demographics');
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          primaryLanguage: languageResult.primaryLanguage,
          languageBreakdown,
          targetMarketFit: Number(targetLanguagePercentage.toFixed(1)),
          marketInsights,
          aiFeedback,
        },
      };
    } catch (error) {
      return {
        score: 8.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          primaryLanguage: 'English',
          languageBreakdown: [],
          targetMarketFit: 80,
          aiFeedback: 'Language analysis encountered an error - using default metrics',
        },
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
      topKeywords,
    ] = await Promise.all([
      this.calculateVisualQuality(influencer),
      this.calculateColorPaletteMood(influencer),
      this.calculateCaptionSentiment(influencer),
      this.calculateCTAUsage(influencer),
      this.extractTopKeywords(influencer),
    ]);

    // Convert scores from 0-10 to 0-100 scale
    const score =
      (visualQuality.score * 0.60) +
      (colorPaletteMood.score * 0.20) +
      (captionSentiment.score * 0.10) +
      (ctaUsage.score * 0.10);

    const scoreOut100 = score * 10; // Convert to 0-100 scale

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100
      breakdown: {
        visualQuality: { score: visualQuality.score * 10, weight: 60, details: visualQuality.details },
        colorPaletteMood: { score: colorPaletteMood.score * 10, weight: 20, details: colorPaletteMood.details },
        captionSentiment: { score: captionSentiment.score * 10, weight: 10, details: captionSentiment.details },
        ctaUsage: { score: ctaUsage.score * 10, weight: 10, details: ctaUsage.details },
        topKeywords: { score: 0, weight: 0, details: topKeywords.details }, // Not included in score
      },
    };
  }

  /**
   * 3.1 Visual Quality (60%)
   * AI-based production quality analysis with sub-scores
   */
  private async calculateVisualQuality(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.5,
        details: {
          message: 'AI not available - using default score',
          lighting: 75,
          editing: 75,
          aesthetics: 75,
        },
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

      // Calculate sub-scores (0-100 scale for UI)
      const avgLighting = visualAnalyses.reduce((sum, v) => sum + (v.aesthetics?.lighting || 0), 0) / visualAnalyses.length;
      const avgEditing = visualAnalyses.reduce((sum, v) => sum + (v.professionalScore || 0), 0) / visualAnalyses.length;
      const avgComposition = visualAnalyses.reduce((sum, v) => sum + (v.aesthetics?.composition || 0), 0) / visualAnalyses.length;
      const avgColorHarmony = visualAnalyses.reduce((sum, v) => sum + (v.aesthetics?.colorHarmony || 0), 0) / visualAnalyses.length;
      const avgClarity = visualAnalyses.reduce((sum, v) => sum + (v.aesthetics?.clarity || 0), 0) / visualAnalyses.length;

      // Convert to 0-100 scale
      const lightingScore = avgLighting * 10; // 0-10 → 0-100
      const editingScore = avgEditing; // Already 0-100
      const aestheticsScore = ((avgComposition + avgColorHarmony + avgClarity) / 3) * 10; // Average and convert to 0-100

      // Overall score on 0-10 scale (4.2 combined rating as per spec)
      const score = ((lightingScore + editingScore + aestheticsScore) / 300) * 10;

      // Generate AI feedback
      let feedback = '';
      if (editingScore >= 80 && aestheticsScore < 40) {
        feedback = 'Your editing is strong, but weaker aesthetic reduce Reel retention';
      } else if (lightingScore < 40) {
        feedback = 'Improve lighting quality for better visual appeal';
      } else if (aestheticsScore >= 80) {
        feedback = 'Excellent visual consistency and aesthetic quality';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          imagesAnalyzed: visualAnalyses.length,
          lighting: Number(lightingScore.toFixed(2)),
          editing: Number(editingScore.toFixed(2)),
          aesthetics: Number(aestheticsScore.toFixed(2)),
          feedback,
          change: 0, // Could track change from previous sync
        },
      };
    } catch (error) {
      return {
        score: 7.5,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          lighting: 75,
          editing: 75,
          aesthetics: 75,
        },
      };
    }
  }

  /**
   * 3.2 Color Palette & Mood (20%)
   * AI rates aesthetic consistency with mood and color analysis
   */
  private async calculateColorPaletteMood(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: {
          message: 'AI not available - using default score',
          mood: 'Neutral',
          dominantColors: ['Blue', 'Grey'],
          rating: 70,
        },
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

      // Generate AI feedback based on mood and rating
      let feedback = '';
      const mood = aestheticAnalysis.mood || 'Neutral';
      const rating = aestheticAnalysis.rating || 14;

      if (mood.toLowerCase().includes('cool') && mood.toLowerCase().includes('muted')) {
        feedback = 'Consistent cool tones help brand recall, but muted accents reduce scroll-stopping impact.';
      } else if (rating >= 18) {
        feedback = 'Excellent color consistency creating strong brand recognition';
      } else if (rating < 10) {
        feedback = 'Improve color palette consistency for better aesthetic appeal';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: aestheticAnalysis.rating,
          mood: aestheticAnalysis.mood || 'Neutral',
          dominantColors: aestheticAnalysis.dominantColors || ['Blue', 'Grey', 'Yellow'],
          consistency: aestheticAnalysis.consistency || 'Medium',
          feedback,
          change: 0, // Could track change from previous analysis
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          mood: 'Neutral',
          dominantColors: ['Blue', 'Grey'],
          rating: 14,
        },
      };
    }
  }

  /**
   * 3.3 Caption Sentiment (10%)
   * Detailed sentiment breakdown with counts and percentages
   */
  private async calculateCaptionSentiment(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 8.0,
        details: {
          message: 'AI not available - using default score',
          positive: { count: 0, percentage: 70 },
          negative: { count: 0, percentage: 20 },
          neutral: { count: 0, percentage: 10 },
        },
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

      // Convert overall sentiment to distribution
      // sentimentScore ranges from -100 to +100
      // For simplicity, map to rough distribution
      let positivePercentage: number;
      let negativePercentage: number;
      let neutralPercentage: number;

      if (sentimentScore >= 50) {
        positivePercentage = 70 + (sentimentScore - 50) / 2; // 70-95%
        negativePercentage = 5;
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else if (sentimentScore >= 0) {
        positivePercentage = 50 + sentimentScore / 2; // 50-70%
        negativePercentage = 10 + (50 - sentimentScore) / 5; // 10-20%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else if (sentimentScore >= -50) {
        positivePercentage = 30 + (sentimentScore + 50) / 2.5; // 10-30%
        negativePercentage = 30 + Math.abs(sentimentScore) / 2; // 30-55%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else {
        positivePercentage = 5;
        negativePercentage = 70 + Math.abs(sentimentScore + 50) / 2; // 70-95%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      }

      const positiveCount = Math.round((positivePercentage / 100) * captions.length);
      const negativeCount = Math.round((negativePercentage / 100) * captions.length);
      const neutralCount = captions.length - positiveCount - negativeCount;

      // Scoring based on positive percentage
      let rawScore = 0;
      if (positivePercentage <= 30) rawScore = 4;
      else if (positivePercentage <= 50) rawScore = 6;
      else if (positivePercentage <= 75) rawScore = 8;
      else rawScore = 10;

      // Generate AI feedback
      let feedback = '';
      if (positivePercentage >= 70 && negativePercentage > 20) {
        feedback = 'Your captions are positive but seen and increase in negatives which hamper the growth';
      } else if (positivePercentage >= 80) {
        feedback = 'Excellent positive sentiment driving strong audience engagement';
      } else if (positivePercentage < 40) {
        feedback = 'Consider using more positive and uplifting language in captions';
      }

      return {
        score: Number(rawScore.toFixed(2)),
        details: {
          positive: {
            count: positiveCount,
            percentage: Number(positivePercentage.toFixed(2)),
          },
          negative: {
            count: negativeCount,
            percentage: Number(negativePercentage.toFixed(2)),
          },
          neutral: {
            count: neutralCount,
            percentage: Number(neutralPercentage.toFixed(2)),
          },
          captionsAnalyzed: captions.length,
          feedback,
        },
      };
    } catch (error) {
      return {
        score: 8.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          positive: { count: 0, percentage: 70 },
          negative: { count: 0, percentage: 20 },
          neutral: { count: 0, percentage: 10 },
        },
      };
    }
  }

  /**
   * 3.4 CTA Usage (10%)
   * AI rates call-to-action effectiveness with detailed metrics
   */
  private async calculateCTAUsage(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: {
          message: 'AI not available - using default score',
          rating: 'medium',
          usagePercentage: 70,
          totalPosts: 0,
        },
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

      // Calculate usage percentage
      const ctaCount = ctaAnalysis.ctaCount || 0;
      const usagePercentage = captions.length > 0 ? (ctaCount / captions.length) * 100 : 0;

      // Common CTAs detected (examples from design)
      const commonCTAs = ctaAnalysis.examples || [
        'Save For Later',
        'Comment Bellow',
        'Share With your Friend',
        'Follow For More',
      ];

      // Generate AI feedback
      let feedback = '';
      const faceContentPercentage = 30; // Could be calculated from content style analysis
      if (faceContentPercentage < 40) {
        feedback = 'High faceless content reduces trust signals. Adding 1-2 face-led reels weekly can improve reach.';
      } else if (usagePercentage >= 70) {
        feedback = `Good CTA usage! You effectively use CTAs in ${ctaCount} Reel and Post`;
      } else if (usagePercentage < 40) {
        feedback = 'Add more clear calls-to-action to boost engagement';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: ctaAnalysis.rating,
          usagePercentage: Number(usagePercentage.toFixed(2)),
          totalPosts: captions.length,
          ctaCount,
          detectedCTAs: commonCTAs,
          recommendations: ctaAnalysis.recommendations || '',
          feedback,
          change: 0, // Could track change from previous analysis
        },
      };
    } catch (error) {
      return {
        score: 7.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          rating: 'medium',
          usagePercentage: 70,
          totalPosts: 0,
        },
      };
    }
  }

  // ==================== CATEGORY 4: ENGAGEMENT STRENGTH (10 pts) ====================

  async calculateEngagementStrength(influencer: Influencer): Promise<EngagementStrengthScore> {
    const [
      engagementOverview,
      performanceConsistency,
    ] = await Promise.all([
      this.calculateEngagementOverview(influencer),
      this.calculatePerformanceConsistency(influencer),
    ]);

    // Calculate score on 0-10 scale
    const score =
      (engagementOverview.score * 0.70) +
      (performanceConsistency.score * 0.30);

    // Convert to 0-100 scale for UI
    const scoreOut100 = score * 10;

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      breakdown: {
        engagementOverview: { score: engagementOverview.score * 10, weight: 70, details: engagementOverview.details },
        performanceConsistency: { score: performanceConsistency.score * 10, weight: 30, details: performanceConsistency.details },
      },
    };
  }

  /**
   * 4.1 Engagement Overview (70%)
   * Overall engagement rate (likes + comments + saves + shares / reach)
   * Enhanced with detailed metrics for UI display
   */
  private async calculateEngagementOverview(influencer: Influencer): Promise<{ score: number; details: any }> {
    const latestSync = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
    });

    if (!latestSync || !latestSync.avgEngagementRate) {
      return {
        score: 0,
        details: {
          message: 'No engagement data available',
          engagementRate: 0,
          rating: 'Unknown',
          industryAvg: 3.0,
          avgReach: 0,
          avgRepost: 0,
          avgLike: 0,
          avgComments: 0,
          avgShare: 0,
          avgSaves: 0,
          reachToFollowerRatio: 0,
          aiFeedback: 'No engagement data available to analyze',
        },
      };
    }

    const engagementRate = Number(latestSync.avgEngagementRate) || 0;
    const benchmark = 3; // 3% is good engagement (industry avg for micro-influencers)

    // Convert to 0-10 scale (3% or higher = 10/10)
    const score = Math.min((engagementRate / benchmark) * 10, 10);

    // Determine rating based on engagement rate
    let rating = '';
    if (engagementRate >= 5) rating = 'Exceptional';
    else if (engagementRate >= 3) rating = 'Excellent';
    else if (engagementRate >= 2) rating = 'Good';
    else if (engagementRate >= 1) rating = 'Fair';
    else rating = 'Needs Improvement';

    // Calculate detailed metrics
    const avgReach = latestSync.avgReach || 0;
    const avgLike = Math.round((latestSync.totalLikes || 0) / (latestSync.postsAnalyzed || 1));
    const avgComments = Math.round((latestSync.totalComments || 0) / (latestSync.postsAnalyzed || 1));
    const avgShare = Math.round((latestSync.totalShares || 0) / (latestSync.postsAnalyzed || 1));
    const avgSaves = Math.round((latestSync.totalSaves || 0) / (latestSync.postsAnalyzed || 1));

    // Calculate reach to follower ratio
    const totalFollowers = latestSync.totalFollowers || 1;
    const reachToFollowerRatio = avgReach > 0 ? Number((avgReach / totalFollowers).toFixed(2)) : 0;

    // Generate AI feedback based on engagement patterns
    let aiFeedback = '';
    if (engagementRate >= 5) {
      aiFeedback = 'Outstanding engagement! Your audience is highly active and responsive to your content.';
    } else if (engagementRate >= 3) {
      aiFeedback = 'Your follower base shows healthy activity with no abnormal spikes.';
    } else if (engagementRate >= 1.5) {
      aiFeedback = 'Moderate engagement levels. Consider experimenting with content formats to boost interaction.';
    } else {
      aiFeedback = 'Engagement needs improvement. Focus on creating more compelling CTAs and interactive content.';
    }

    // Add specific insights based on reach ratio
    if (reachToFollowerRatio >= 2) {
      aiFeedback += ' Excellent reach extending beyond your follower base.';
    } else if (reachToFollowerRatio < 0.5) {
      aiFeedback += ' Low reach-to-follower ratio suggests content may need optimization for discovery.';
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        engagementRate: Number(engagementRate.toFixed(2)),
        rating,
        industryAvg: benchmark,
        avgReach: Math.round(avgReach),
        avgRepost: Math.round(avgShare), // Repost = Share for Instagram
        avgLike,
        avgComments,
        avgShare,
        avgSaves,
        reachToFollowerRatio,
        postsAnalyzed: latestSync.postsAnalyzed || 0,
        aiFeedback,
      },
    };
  }

  /**
   * 4.2 Performance Consistency (30%)
   * Coefficient of variation in reach
   * Enhanced with rating, benchmarks, and AI feedback
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

    if (recentInsights.length < 2) {
      return {
        score: 0,
        details: {
          message: 'Insufficient posts for consistency calculation',
          performance: 0,
          rating: 'Unknown',
          industryAvg: 60,
          consistentPostsCount: 0,
          totalPostsAnalyzed: recentInsights.length,
          aiFeedback: 'Need at least 2 posts in the last 30 days to calculate performance consistency',
        },
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

    // Convert consistency score to percentage (0-100)
    const performancePercentage = consistencyScore * 100;

    // Determine rating based on consistency
    let rating = '';
    if (performancePercentage >= 80) rating = 'Exceptional';
    else if (performancePercentage >= 60) rating = 'Excellent';
    else if (performancePercentage >= 40) rating = 'Good';
    else if (performancePercentage >= 20) rating = 'Fair';
    else rating = 'Needs Improvement';

    // Count posts with consistent performance (within 80% of avg reach)
    const consistencyThreshold = avgReach * 0.8;
    const consistentPostsCount = reaches.filter(r => r >= consistencyThreshold).length;

    // Calculate percentage change indicator
    const firstHalfAvg = reaches.slice(0, Math.floor(reaches.length / 2))
      .reduce((sum, r) => sum + r, 0) / Math.floor(reaches.length / 2);
    const secondHalfAvg = reaches.slice(Math.floor(reaches.length / 2))
      .reduce((sum, r) => sum + r, 0) / (reaches.length - Math.floor(reaches.length / 2));
    const trendPercentage = firstHalfAvg > 0 ?
      Number((((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100).toFixed(1)) : 0;

    // Generate AI feedback
    let aiFeedback = '';
    if (performancePercentage >= 70) {
      aiFeedback = 'Your follower base shows healthy activity with no abnormal spikes.';
    } else if (performancePercentage >= 50) {
      aiFeedback = 'Moderate consistency. Some posts underperform - analyze top performers for insights.';
    } else if (performancePercentage >= 30) {
      aiFeedback = 'High variability in post performance. Review content strategy for more consistent results.';
    } else {
      aiFeedback = 'Inconsistent performance detected. Focus on understanding what content resonates with your audience.';
    }

    // Add trend insight
    if (trendPercentage > 10) {
      aiFeedback += ' Positive trend: recent posts showing improved performance.';
    } else if (trendPercentage < -10) {
      aiFeedback += ' Declining trend: recent posts underperforming compared to earlier ones.';
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        performance: Number(performancePercentage.toFixed(1)),
        rating,
        industryAvg: 60, // Industry average consistency benchmark
        coefficientOfVariation: Number(cv.toFixed(3)),
        consistentPostsCount,
        totalPostsAnalyzed: reaches.length,
        avgReach: Math.round(avgReach),
        stdDev: Math.round(stdDev),
        trendPercentage,
        aiFeedback,
      },
    };
  }

  /**
   * 4.3 Retention Overview - REMOVED
   * This metric has been removed from Engagement Strength calculation as per UI design requirements.
   * Retention metrics are no longer included in the engagement strength score.
   *
   * Previous implementation awarded full points as a placeholder until Instagram video insights became available.
   * If retention metrics are needed in the future, they should be implemented as a separate category.
   */

  // ==================== CATEGORY 5: GROWTH MOMENTUM (10 pts) ====================

  async calculateGrowthMomentum(influencer: Influencer): Promise<GrowthMomentumScore> {
    const [
      growthTrend,
      postingBehaviour,
    ] = await Promise.all([
      this.calculateGrowthTrend(influencer),
      this.calculatePostingBehaviour(influencer),
    ]);

    const score =
      (growthTrend.score * 0.60) +
      (postingBehaviour.score * 0.40);

    return {
      score: Number(score.toFixed(2)),
      maxScore: 10,
      breakdown: {
        growthTrend: { score: growthTrend.score, weight: 60, details: growthTrend.details },
        postingBehaviour: { score: postingBehaviour.score, weight: 40, details: postingBehaviour.details },
      },
    };
  }

  /**
   * 5.1 Growth Trend (60%)
   * 30-day follower growth rate with tiered scoring
   * >30%: 10/10 | 25-30%: 8.33/10 | 20-25%: 6.67/10 | 15-20%: 5.83/10
   * 10-15%: 5/10 | 5-10%: 4.17/10 | 0-5%: 3.33/10 | negative: 0/10
   */
  private async calculateGrowthTrend(influencer: Influencer): Promise<{ score: number; details: any }> {
    const snapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 2,
    });

    if (snapshots.length < 2) {
      return {
        score: 5.0, // Mid-range for new accounts (cannot determine growth yet)
        details: { message: 'First sync. Growth will be calculated after next sync.' },
      };
    }

    const latestFollowers = snapshots[0].totalFollowers || 0;
    const previousFollowers = snapshots[1].totalFollowers || 0;

    if (previousFollowers === 0) {
      return { score: 5.0, details: { message: 'No baseline data' } };
    }

    const growthRate = ((latestFollowers - previousFollowers) / previousFollowers) * 100;

    // Tiered scoring based on growth rate
    let score = 0;
    if (growthRate > 30) {
      score = 10.0; // 60 points out of 60
    } else if (growthRate >= 25) {
      score = 8.33; // 50 points out of 60
    } else if (growthRate >= 20) {
      score = 6.67; // 40 points out of 60
    } else if (growthRate >= 15) {
      score = 5.83; // 35 points out of 60
    } else if (growthRate >= 10) {
      score = 5.0; // 30 points out of 60
    } else if (growthRate >= 5) {
      score = 4.17; // 25 points out of 60
    } else if (growthRate >= 0) {
      score = 3.33; // 20 points out of 60
    } else {
      score = 0; // Negative growth = 0 points
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        growthRate: Number(growthRate.toFixed(2)),
        followersStart: previousFollowers,
        followersEnd: latestFollowers,
        growth: latestFollowers - previousFollowers,
        tier: growthRate > 30 ? '>30%' :
              growthRate >= 25 ? '25-30%' :
              growthRate >= 20 ? '20-25%' :
              growthRate >= 15 ? '15-20%' :
              growthRate >= 10 ? '10-15%' :
              growthRate >= 5 ? '5-10%' :
              growthRate >= 0 ? '0-5%' : 'negative',
      },
    };
  }

  /**
   * 5.2 Posting Behaviour (40%)
   * Posting frequency consistency based on weekly posts
   * 6-7 posts/week: 10/10 | 4-5: 7.86/10 | 2-3: 5.71/10 | 0-1: 2.86/10
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

    // Calculate average posts per week (30 days ≈ 4.3 weeks)
    const postsPerWeek = (recentPosts / 30) * 7;

    // Tiered scoring based on weekly posting frequency
    let score = 0;
    if (postsPerWeek >= 6) {
      score = 10.0; // 70 points out of 70 = 10/10
    } else if (postsPerWeek >= 4) {
      score = 7.86; // 55 points out of 70 = 7.86/10
    } else if (postsPerWeek >= 2) {
      score = 5.71; // 40 points out of 70 = 5.71/10
    } else {
      score = 2.86; // 20 points out of 70 = 2.86/10
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        totalPosts30Days: recentPosts,
        postsPerWeek: Number(postsPerWeek.toFixed(2)),
        tier: postsPerWeek >= 6 ? '6-7 posts/week' :
              postsPerWeek >= 4 ? '4-5 posts/week' :
              postsPerWeek >= 2 ? '2-3 posts/week' : '0-1 posts/week',
      },
    };
  }

  // ==================== CATEGORY 6: MONETISATION (10 pts) ====================

  async calculateMonetisation(influencer: Influencer): Promise<MonetisationScore> {
    const [
      monetisationSignals,
      brandTrustSignal,
      audienceSentiment,
    ] = await Promise.all([
      this.calculateMonetisationSignals(influencer),
      this.calculateBrandTrustSignal(influencer),
      this.calculateAudienceSentiment(influencer),
    ]);

    const score =
      (monetisationSignals.score * 0.50) +
      (brandTrustSignal.score * 0.30) +
      (audienceSentiment.score * 0.20);

    // Convert to 0-100 scale for UI
    const scoreOut100 = score * 10;

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      breakdown: {
        monetisationSignals: { score: monetisationSignals.score * 10, weight: 50, details: monetisationSignals.details },
        brandTrustSignal: { score: brandTrustSignal.score * 10, weight: 30, details: brandTrustSignal.details },
        audienceSentiment: { score: audienceSentiment.score * 10, weight: 20, details: audienceSentiment.details },
      },
    };
  }

  /**
   * 6.1 Monetisation Signals (50%)
   * AI predicts monetisation scale on 1-50 rating with campaign recommendations
   */
  private async calculateMonetisationSignals(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 5.0,
        details: {
          message: 'AI not available - using default score',
          percentage: 50,
          rating: 'Medium',
          campaignTypes: ['Barter', 'Paid'],
        },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available for analysis' } };
      }

      // Get profile data for context
      const latestSync = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: influencer.id },
        order: [['syncDate', 'DESC']],
      });

      const activeFollowers = latestSync?.activeFollowers || 0;
      const avgEngagementRate = latestSync?.avgEngagementRate || 0;

      // Get average views from recent posts
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentInsights = await this.instagramMediaInsightModel.findAll({
        where: { influencerId: influencer.id },
        include: [{
          model: this.instagramMediaModel,
          required: true,
          where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
        }],
        limit: 20,
      });

      const avgViews = recentInsights.length > 0
        ? recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length
        : 0;

      const profileContext = {
        followerCount: influencer.instagramFollowersCount || 0,
        engagementRate: avgEngagementRate,
        accountType: influencer.instagramAccountType,
        captions: recentMedia.map(m => m.caption),
      };

      // Ask AI to predict monetisation potential on 1-50 scale
      const monetisationRating = await this.geminiAIService.predictMonetisationPotential(profileContext);

      // Convert 1-50 scale to 0-10 scale
      const score = (monetisationRating / 50) * 10;

      // Calculate percentage (0-100%)
      const percentage = (monetisationRating / 50) * 100;

      // Determine rating
      let rating = '';
      if (percentage >= 80) rating = 'Exceptional';
      else if (percentage >= 60) rating = 'Excellent';
      else if (percentage >= 40) rating = 'Good';
      else if (percentage >= 20) rating = 'Fair';
      else rating = 'Limited';

      // Determine best campaign types
      const campaignTypes: string[] = [];
      if (percentage >= 50) {
        campaignTypes.push('Paid');
      }
      campaignTypes.push('Barter');
      if (percentage >= 70) {
        campaignTypes.push('Performance');
      }

      // Calculate payout range (₹0.2-0.5 per view)
      const minPayout = Math.round(avgViews * 0.2);
      const maxPayout = Math.round(avgViews * 0.5);

      // Generate AI feedback
      let feedback = '';
      if (percentage < 40) {
        feedback = 'Your hooks lack movement or curiosity in the first 3 seconds. Faster cuts improve retention.';
      } else if (percentage >= 70) {
        feedback = 'Strong monetisation signals with high engagement and reach potential.';
      } else {
        feedback = 'Good monetisation potential. Focus on improving first 3 seconds of content for better retention.';
      }

      // Calculate change from previous analysis (placeholder)
      const change = 2; // Would need to store previous ratings

      return {
        score: Number(score.toFixed(2)),
        details: {
          percentage: Number(percentage.toFixed(2)),
          rating,
          campaignTypes,
          payoutRange: {
            min: minPayout,
            max: maxPayout,
            currency: '₹',
            basis: 'per campaign',
            description: 'Based On your Active Engagement and Followers',
          },
          monetisationRating, // 1-50 scale
          activeFollowers,
          avgViews: Math.round(avgViews),
          engagementRate: Number(avgEngagementRate.toFixed(2)),
          feedback,
          change,
        },
      };
    } catch (error) {
      return {
        score: 5.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          percentage: 50,
          rating: 'Medium',
          campaignTypes: ['Barter', 'Paid'],
        },
      };
    }
  }

  /**
   * 6.2 Brand Trust Signal Score (30%)
   * AI predicts payout based on 0.2-0.5 rupees per view and active followers
   * Tiers: 100-500: 10, 500-1500: 20, 1500-3000: 25, 3000+: 30
   */
  private async calculateBrandTrustSignal(influencer: Influencer): Promise<{ score: number; details: any }> {
    try {
      // Get active followers and average reach data
      const latestSync = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: influencer.id },
        order: [['syncDate', 'DESC']],
      });

      if (!latestSync) {
        return { score: 0, details: { message: 'No profile sync data available' } };
      }

      const activeFollowers = latestSync.activeFollowers || 0;

      // Get average views from recent posts
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentInsights = await this.instagramMediaInsightModel.findAll({
        where: { influencerId: influencer.id },
        include: [{
          model: this.instagramMediaModel,
          required: true,
          where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
        }],
        limit: 20,
      });

      const avgViews = recentInsights.length > 0
        ? recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length
        : 0;

      const profileData = {
        activeFollowers,
        avgViews,
        engagementRate: latestSync.avgEngagementRate || 0,
      };

      // Ask AI to predict payout considering 0.2-0.5 rupees per view (if available)
      let predictedPayout = 0;
      if (this.geminiAIService.isAvailable()) {
        try {
          predictedPayout = await this.geminiAIService.predictInfluencerPayout(profileData);
        } catch (error) {
          // Fallback calculation
          predictedPayout = avgViews * 0.35; // Average of 0.2-0.5
        }
      } else {
        predictedPayout = avgViews * 0.35;
      }

      // Tiered scoring based on predicted payout
      let tierScore = 0;
      let tier = '';
      if (predictedPayout >= 3000) {
        tierScore = 30;
        tier = '3000+';
      } else if (predictedPayout >= 1500) {
        tierScore = 25;
        tier = '1500-3000';
      } else if (predictedPayout >= 500) {
        tierScore = 20;
        tier = '500-1500';
      } else if (predictedPayout >= 100) {
        tierScore = 10;
        tier = '100-500';
      } else {
        tierScore = 5;
        tier = '<100';
      }

      // Convert to 0-10 scale (max 30 points)
      const score = (tierScore / 30) * 10;

      // Calculate percentage out of 100
      const percentage = (tierScore / 30) * 100;

      // Determine rating
      let rating = '';
      if (percentage >= 85) rating = 'Exceptional';
      else if (percentage >= 65) rating = 'Excellent';
      else if (percentage >= 40) rating = 'Good';
      else if (percentage >= 20) rating = 'Fair';
      else rating = 'Limited';

      // Determine brand categories
      const brandCategories: string[] = [];
      if (percentage >= 70) {
        brandCategories.push('FMCG', 'beauty', 'lifestyle', 'D2C brands');
      } else if (percentage >= 50) {
        brandCategories.push('lifestyle', 'D2C brands');
      } else {
        brandCategories.push('local brands', 'startups');
      }

      // Calculate account age
      const createdAt = influencer.createdAt || new Date();
      const accountAgeYears = ((Date.now() - createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // Analyze posting history
      const totalPosts = recentInsights.length;
      let postingHistory = 'Inconsistent';
      if (totalPosts >= 20) postingHistory = 'Consistent';
      else if (totalPosts >= 10) postingHistory = 'Moderate';

      // Check content format (Reels usage)
      const reelCount = await this.instagramMediaModel.count({
        where: {
          influencerId: influencer.id,
          timestamp: { [Op.gte]: thirtyDaysAgo },
          mediaType: 'VIDEO',
        },
      });
      const totalMediaCount = await this.instagramMediaModel.count({
        where: {
          influencerId: influencer.id,
          timestamp: { [Op.gte]: thirtyDaysAgo },
        },
      });
      const reelPercentage = totalMediaCount > 0 ? (reelCount / totalMediaCount) * 100 : 0;

      // Trust signals list
      const trustSignals: string[] = [
        `Account age: ${accountAgeYears.toFixed(1)} years`,
        `Posting history: ${postingHistory}`,
        'No shadow-ban or reach suppression signals',
      ];

      if (reelPercentage >= 60) {
        trustSignals.push('Regular use of platform-preferred formats (Reels)');
      } else if (reelPercentage >= 30) {
        trustSignals.push('Moderate use of Reels format');
      }

      // Generate AI feedback
      let feedback = '';
      if (percentage < 40) {
        feedback = 'Build trust through consistent posting and platform-preferred formats.';
      } else if (reelPercentage < 50) {
        feedback = 'Your hooks lack movement or curiosity in the first 3 seconds. Faster cuts improve retention.';
      } else {
        feedback = 'Strong brand trust signals with consistent content delivery.';
      }

      // Calculate change (placeholder)
      const change = 2;

      return {
        score: Number(score.toFixed(2)),
        details: {
          percentage: Number(percentage.toFixed(2)),
          rating,
          description: `Safe for ${brandCategories.join(', ')}`,
          brandCategories,
          trustSignals,
          predictedPayout: Math.round(predictedPayout),
          tier,
          tierScore,
          activeFollowers,
          avgViews: Math.round(avgViews),
          rateRange: '₹0.2-0.5 per view',
          accountAgeYears: Number(accountAgeYears.toFixed(1)),
          postingHistory,
          reelPercentage: Number(reelPercentage.toFixed(2)),
          feedback,
          change,
        },
      };
    } catch (error) {
      return {
        score: 5.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          percentage: 50,
          rating: 'Fair',
        },
      };
    }
  }

  /**
   * 6.3 Audience Sentiment Score (20%)
   * AI analyzes audience sentiment on 1-20 scale with detailed breakdown
   */
  private async calculateAudienceSentiment(influencer: Influencer): Promise<{ score: number; details: any }> {
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 5.0,
        details: {
          message: 'AI not available - using default score',
          positive: { percentage: 70 },
          negative: { percentage: 20 },
          neutral: { percentage: 10 },
        },
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

      // Ask AI to analyze audience sentiment on 1-20 scale
      const sentimentRating = await this.geminiAIService.analyzeAudienceSentiment(captions);

      // Convert 1-20 scale to 0-10 scale
      const score = (sentimentRating / 20) * 10;

      // Convert to percentage distribution
      let positivePercentage: number;
      let negativePercentage: number;
      let neutralPercentage: number;

      // Map 1-20 scale to percentage distribution
      if (sentimentRating >= 15) {
        // Very Positive
        positivePercentage = 70 + (sentimentRating - 15) * 6; // 70-100%
        negativePercentage = 5 + (20 - sentimentRating) * 2; // 5-15%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else if (sentimentRating >= 10) {
        // Positive
        positivePercentage = 50 + (sentimentRating - 10) * 4; // 50-70%
        negativePercentage = 15 + (15 - sentimentRating) * 3; // 15-30%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else if (sentimentRating >= 5) {
        // Neutral
        positivePercentage = 30 + (sentimentRating - 5) * 4; // 30-50%
        negativePercentage = 30 + (10 - sentimentRating) * 4; // 30-50%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else {
        // Negative
        positivePercentage = 10 + sentimentRating * 4; // 10-30%
        negativePercentage = 50 + (5 - sentimentRating) * 10; // 50-100%
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      }

      // Generate AI feedback
      let feedback = '';
      if (positivePercentage >= 70) {
        feedback = 'Strong positive audience sentiment drives engagement and trust.';
      } else if (positivePercentage < 40 || negativePercentage > 40) {
        feedback = 'Your hooks lack movement or curiosity in the first 3 seconds. Faster cuts improve retention.';
      } else {
        feedback = 'Balanced audience sentiment. Focus on positive engagement strategies.';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          sentimentRating, // 1-20 scale
          positive: {
            percentage: Number(positivePercentage.toFixed(2)),
          },
          negative: {
            percentage: Number(negativePercentage.toFixed(2)),
          },
          neutral: {
            percentage: Number(neutralPercentage.toFixed(2)),
          },
          sentiment: sentimentRating >= 15 ? 'Very Positive' :
                     sentimentRating >= 10 ? 'Positive' :
                     sentimentRating >= 5 ? 'Neutral' : 'Negative',
          captionsAnalyzed: captions.length,
          feedback,
        },
      };
    } catch (error) {
      return {
        score: 5.0,
        details: {
          message: 'AI analysis failed - using default',
          error: error.message,
          positive: { percentage: 70 },
          negative: { percentage: 20 },
          neutral: { percentage: 10 },
        },
      };
    }
  }

  /**
   * Extract top keywords from captions
   */
  private async extractTopKeywords(influencer: Influencer): Promise<{ score: number; details: any }> {
    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 30);
      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);

      if (captions.length === 0) {
        return { score: 0, details: { keywords: [], message: 'No captions available' } };
      }

      // Combine all captions
      const allText = captions.join(' ').toLowerCase();

      // Common stop words to exclude
      const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were',
        'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may',
        'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my',
        'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'us', 'them', 'what', 'which', 'who', 'when',
        'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'such', 'no', 'nor',
        'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now', 'get', 'got', 'like', 'new',
      ]);

      // Extract words (alphanumeric only, 3+ characters)
      const words = allText.match(/\b[a-z]{3,}\b/g) || [];

      // Count word frequency
      const wordFreq: { [key: string]: number } = {};
      words.forEach(word => {
        if (!stopWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });

      // Sort by frequency and get top keywords
      const sortedWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const totalWords = sortedWords.reduce((sum, [, count]) => sum + count, 0);

      const keywords = sortedWords.map(([keyword, count]) => ({
        keyword: keyword.charAt(0).toUpperCase() + keyword.slice(1), // Capitalize first letter
        count,
        percentage: totalWords > 0 ? Number(((count / totalWords) * 100).toFixed(2)) : 0,
      }));

      return {
        score: 0, // Not included in scoring
        details: {
          keywords,
          totalCaptions: captions.length,
          totalWords: words.length,
        },
      };
    } catch (error) {
      return {
        score: 0,
        details: {
          keywords: [],
          message: 'Keyword extraction failed',
          error: error.message,
        },
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
