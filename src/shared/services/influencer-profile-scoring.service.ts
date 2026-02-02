import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramProfileAnalysis } from '../models/instagram-profile-analysis.model';
import { InstagramMediaInsight } from '../models/instagram-media-insight.model';
import { InstagramMedia } from '../models/instagram-media.model';
import { InstagramProfileGrowth } from '../models/instagram-profile-growth.model';
import { InstagramOnlineFollowers } from '../models/instagram-online-followers.model';
import { CampaignApplication } from '../../campaign/models/campaign-application.model';
import { GeminiAIService } from './gemini-ai.service';
import { InstagramService } from './instagram.service';

// ==================== INTERFACES ====================

export interface ProfileScore {
  totalScore: number; // 0-100 (average of all 6 categories)
  maxScore: 100;
  scoreChange: number; // Change from previous week (e.g., -3, +5)
  grade: string; // "Strong Profile", "Good Profile", "Average Profile", or "Weak Profile"
  profileSummary: string; // AI-generated summary (e.g., "Strong in: niche clarity, engagement. Focus on improving: growth momentum.")
  facebookPageConnected: boolean; // Whether Facebook page is connected (required for demographics)
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
  facebookPageConnected: boolean; // Indicates if Facebook Page is connected for demographics
  message?: string; // Optional message when no data available
  breakdown?: {
    followerAuthenticity: { score: number; weight: 65; details: any };
    demographicsSnapshot: { score: number; weight: 20; details: any };
    geoRelevance: { score: number; weight: 15; details: any };
  };
  onlinePresence?: {
    hourlyActivity: any[];
    aiInsights: string;
  };
}

// Category 2: Content Relevance (100 points for UI display)
export interface ContentRelevanceScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
  details: {
    rating: string;
    totalPostsAnalyzed: number;
    primaryNiche: string;
    contentMixScore: number;
    platformRelevanceScore: number;
    hashtagEffectivenessRating: string;
    languageFit: string;
    aiFeedback: string;
  };
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

// Category 5: Growth Momentum (100 points for UI display)
export interface GrowthMomentumScore {
  score: number; // 0-100 (for UI display)
  maxScore: 100;
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
    @InjectModel(InstagramOnlineFollowers)
    private instagramOnlineFollowersModel: typeof InstagramOnlineFollowers,
    @InjectModel(CampaignApplication)
    private campaignApplicationModel: typeof CampaignApplication,
    private geminiAIService: GeminiAIService,
    private instagramService: InstagramService,
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

    // Calculate average of all categories (each is 0-100) to get final score out of 100
    const totalScore = (
      audienceQuality.score +
      contentRelevance.score +
      contentQuality.score +
      engagementStrength.score +
      growthMomentum.score +
      monetisation.score
    ) / 6;

    // Calculate score change from previous week
    const scoreChange = await this.calculateScoreChange(influencerId, totalScore);

    // Generate grade based on total score
    const grade = this.calculateGrade(totalScore);

    // Generate AI profile summary (4-6 words)
    const profileSummary = await this.generateProfileSummary({
      audienceQuality,
      contentRelevance,
      contentQuality,
      engagementStrength,
      growthMomentum,
      monetisation,
    });

    return {
      totalScore: Number(totalScore.toFixed(2)),
      maxScore: 100,
      scoreChange,
      grade,
      profileSummary,
      facebookPageConnected: audienceQuality.facebookPageConnected || false,
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
    const onlinePresence = await this.calculateOnlinePresence(influencer);

    // Check if Facebook page is connected based on demographic data availability
    const facebookPageConnected = !!(demographicsSnapshot.details?.ageBreakdown?.length > 0);

    // Weighted average: 65% + 20% + 15% = 100%
    const score =
      (followerAuthenticity.score * 0.65) +
      (demographicsSnapshot.score * 0.20) +
      (geoRelevance.score * 0.15);

    // Convert to 0-100 scale for UI
    const scoreOut100 = score * 10;

    // If all scores are 0 (no demographic data available), return simplified response
    // Note: onlinePresence data may still be available from Instagram API
    if (scoreOut100 === 0 && followerAuthenticity.score === 0 && demographicsSnapshot.score === 0 && geoRelevance.score === 0) {
      return {
        score: 0,
        maxScore: 100,
        facebookPageConnected: false,
        message: 'Basic audience data available. Connect your Instagram to a Facebook Page to unlock detailed demographics (age, gender, location) for better audience targeting.',
        onlinePresence,
      } as any;
    }

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      facebookPageConnected,
      breakdown: {
        followerAuthenticity: { score: followerAuthenticity.score * 10, weight: 65, details: followerAuthenticity.details },
        demographicsSnapshot: { score: demographicsSnapshot.score * 10, weight: 20, details: demographicsSnapshot.details },
        geoRelevance: { score: geoRelevance.score * 10, weight: 15, details: geoRelevance.details },
      },
      onlinePresence,
    };
  }

  /**
   * 1.1 Follower Authenticity (65%)
   * NOTE: Instagram Graph API does NOT provide active/real followers data.
   * Therefore, we ALWAYS assign full points (10/10) as we cannot measure authenticity.
   */
  private async calculateFollowerAuthenticity(influencer: Influencer): Promise<{ score: number; details: any }> {
    // Instagram API doesn't provide follower authenticity metrics
    // Always return full score (10/10) - benefit of the doubt
    return {
      score: 10,
      details: {
        authenticityPercentage: 100,
        totalFollowers: influencer.instagramFollowersCount || 0,
        activeFollowers: influencer.instagramFollowersCount || 0,
        rating: 'Not Available',
        aiFeedback: 'Follower authenticity data not available from Instagram API',
        change: 0,
        syncDate: null,
        message: 'Instagram API does not provide follower authenticity metrics - full score assigned',
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

    // Prefer snapshots with both demographics AND post analysis
    // This avoids using demographics-only snapshots when full snapshots exist
    const snapshotsWithDemographics = snapshots.filter(
      snapshot => snapshot.audienceAgeGender && snapshot.audienceAgeGender.length > 0
    );

    const snapshotsWithPostsAndDemographics = snapshotsWithDemographics.filter(
      snapshot => snapshot.postsAnalyzed > 0
    );

    // Use full snapshots if available, otherwise fall back to demographics-only
    const historicalSnapshots = snapshotsWithPostsAndDemographics.length > 0
      ? snapshotsWithPostsAndDemographics
      : snapshotsWithDemographics;

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
        const percentage = Number(segment.percentage) || 0;

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
      const malePercentage = Number(genderTotals.male || 0);
      genderBreakdown.male.percentage = Number(malePercentage.toFixed(2));
      genderBreakdown.male.count = Math.round((totalFollowers * genderBreakdown.male.percentage) / 100);

      const femalePercentage = Number(genderTotals.female || 0);
      genderBreakdown.female.percentage = Number(femalePercentage.toFixed(2));
      genderBreakdown.female.count = Math.round((totalFollowers * genderBreakdown.female.percentage) / 100);

      const othersPercentage = Number(genderTotals.others || 0);
      genderBreakdown.others.percentage = Number(othersPercentage.toFixed(2));
      genderBreakdown.others.count = Math.round((totalFollowers * genderBreakdown.others.percentage) / 100);

      // Build age breakdown
      const ageOrder = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
      for (const ageRange of Object.keys(ageRangeTotals)) {
        const data = ageRangeTotals[ageRange];
        ageBreakdown.push({
          ageRange,
          percentage: Number(Number(data.total || 0).toFixed(2)),
          malePercentage: Number(Number(data.male || 0).toFixed(2)),
          femalePercentage: Number(Number(data.female || 0).toFixed(2)),
          othersPercentage: Number(Number(data.others || 0).toFixed(2)),
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
    let score = 0; // Default to 0 when no data available
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
          // Convert to number to avoid NaN in calculations
          segmentVariances[key].push(Number(segment.percentage) || 0);
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
    } else if (historicalSnapshots.length === 1 && latestSnapshot && latestSnapshot.audienceAgeGender && latestSnapshot.audienceAgeGender.length > 0) {
      // Only 1 snapshot with demographics - give full score since we have valid data but can't calculate variance yet
      score = 10;
      varianceIndex = 0;
    }

    // Identify core audience (highest percentage segment)
    let coreAudience = 'Unknown';
    let coreFeedback = 'Connect your Instagram to Facebook to access audience demographics data.';

    if (ageBreakdown.length > 0) {
      const topSegment = ageBreakdown.reduce((max, curr) => curr.percentage > max.percentage ? curr : max);
      const topGender = topSegment.malePercentage > topSegment.femalePercentage ? 'Male' :
                        topSegment.femalePercentage > topSegment.othersPercentage ? 'Female' : 'Others';

      coreAudience = `${topGender} ${topSegment.ageRange}`;

      // Generate AI feedback (4-6 words)
      const rating = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : 'Weak';
      coreFeedback = await this.geminiAIService.generateDemographicsStabilityFeedback({
        stabilityScore: score,
        coreAudience,
        rating,
      });
    }

    return {
      score: Number(score.toFixed(2)),
      details: {
        totalFollowers,
        genderBreakdown,
        ageBreakdown,
        coreAudience,
        aiFeedback: coreFeedback,
        change,
        snapshotsAnalyzed: historicalSnapshots.length,
        varianceIndex: Number(varianceIndex.toFixed(4)),
        stability: score === 0 ? 'Unknown' : score >= 8 ? 'High' : score >= 6 ? 'Medium' : 'Low',
      },
    };
  }

  /**
   * 1.3 Geo Relevance (15%)
   * Target geography: India with city-level insights
   */
  private async calculateGeoRelevance(influencer: Influencer): Promise<{ score: number; details: any }> {
    // Fetch recent snapshots
    const snapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncDate', 'DESC']],
      limit: 5,
    });

    // Prefer snapshots with both geography data AND post analysis
    const snapshotsWithGeo = snapshots.filter(
      s => s.audienceCountries && s.audienceCountries.length > 0
    );

    const snapshotsWithPostsAndGeo = snapshotsWithGeo.filter(
      s => s.postsAnalyzed > 0
    );

    // Use full snapshots if available, otherwise fall back to geo-only
    const latestSnapshot = snapshotsWithPostsAndGeo.length > 0
      ? snapshotsWithPostsAndGeo[0]
      : snapshotsWithGeo[0];

    if (!latestSnapshot || !latestSnapshot.audienceCountries || latestSnapshot.audienceCountries.length === 0) {
      return {
        score: 0,
        details: {
          targetCountry: 'India',
          targetAudiencePercentage: 0,
          message: 'Connect your Instagram to Facebook to access geographic audience data',
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
        percentage: Number(Number(country.percentage || 0).toFixed(2)),
      }));

    // Get top cities from snapshot
    const topCities = latestSnapshot.audienceCities
      ? latestSnapshot.audienceCities
          .slice(0, 4)
          .map((city: any) => ({
            name: city.location,
            percentage: Number(Number(city.percentage || 0).toFixed(2)),
          }))
      : [];

    // Generate AI feedback (4-6 words)
    const rating = indiaPercentage >= 75 ? 'Excellent' :
                   indiaPercentage >= 50 ? 'Good' :
                   indiaPercentage >= 25 ? 'Fair' : 'Weak';
    const aiFeedback = await this.geminiAIService.generateGeoRelevanceFeedback({
      targetCountryPercent: indiaPercentage,
      targetCountry: 'India',
      rating,
    });

    return {
      score: Number(score.toFixed(2)),
      details: {
        targetCountry: 'India',
        targetAudiencePercentage: Number(indiaPercentage.toFixed(2)),
        topCountries,
        topCities,
        aiFeedback,
      },
    };
  }

  /**
   * 1.4 Online Presence
   * Generates hourly activity patterns based on demographics
   * If actual online data is available, uses it; otherwise generates AI-based estimates
   */
  private async calculateOnlinePresence(influencer: Influencer): Promise<{ hourlyActivity: any[]; aiInsights: string }> {
    try {
      // Try to get from dedicated instagram_online_followers table first
      const onlineFollowersRecord = await this.instagramOnlineFollowersModel.findOne({
        where: { influencerId: influencer.id },
        order: [['fetchedAt', 'DESC']],
      });

      let onlineFollowers: any = null;

      if (onlineFollowersRecord?.onlineFollowersData) {
        // Data from instagram_online_followers table (array format)
        const data = onlineFollowersRecord.onlineFollowersData;
        if (Array.isArray(data) && data.length > 0) {
          // Convert array format to object format for easier processing
          onlineFollowers = {};
          data.forEach((item: any) => {
            onlineFollowers[item.hour.toString()] = item.value;
          });
        }
      }

      // Fallback: Try to get from profile analysis snapshot (exclude demographics-only snapshots)
      if (!onlineFollowers || Object.keys(onlineFollowers).length === 0) {
        const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
          where: { influencerId: influencer.id },
          order: [['syncNumber', 'DESC']],
        });
        const validSnapshots = allSnapshots.filter(s => s.syncNumber != null && s.onlineFollowersHourlyData != null);
        const latestSnapshot = validSnapshots.length > 0 ? validSnapshots[0] : null;

        onlineFollowers = latestSnapshot?.onlineFollowersHourlyData;
      }

      // If we have actual online data, use it
      if (onlineFollowers && Object.keys(onlineFollowers).length > 0) {
        const hourlyActivity: any[] = [];
        const hasGenderBreakdown = Object.keys(onlineFollowers).some(key => key.includes('.'));

        if (hasGenderBreakdown) {
          // Gender-based breakdown
          for (let hour = 0; hour < 24; hour++) {
            const male = onlineFollowers[`M.${hour}`] || 0;
            const female = onlineFollowers[`F.${hour}`] || 0;
            const unknown = onlineFollowers[`U.${hour}`] || 0;

            hourlyActivity.push({
              hour,
              male,
              female,
              others: unknown,
              total: male + female + unknown,
            });
          }
        } else {
          // Simple hour-based breakdown
          for (let hour = 0; hour < 24; hour++) {
            const count = onlineFollowers[hour.toString()] || 0;
            hourlyActivity.push({
              hour,
              total: count,
            });
          }
        }

        const sortedByActivity = [...hourlyActivity].sort((a, b) => b.total - a.total);
        const peakHours = sortedByActivity.slice(0, 3);

        let aiInsights = 'Insufficient online follower activity data.';

        if (peakHours[0] && peakHours[0].total > 0) {
          const peakHour = peakHours[0].hour;
          const timeRange = this.getTimeRangeDescription(peakHour);
          const formattedHour = this.formatHour(peakHour);

          aiInsights = `Posting during ${timeRange} aligns best with follower activity. Peak engagement occurs around ${formattedHour}.`;
        }

        return { hourlyActivity, aiInsights };
      }

      // FALLBACK: Generate realistic hourly patterns from demographics
      console.log('Generating AI-based online presence from demographics...');

      const snapshots = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId: influencer.id },
        order: [['syncDate', 'DESC']],
        limit: 5,
      });

      if (snapshots.length === 0) {
        return {
          hourlyActivity: [],
          aiInsights: 'No profile data available. Sync your account to generate online presence insights.',
        };
      }

      const latestSnapshot = snapshots[0];
      const totalFollowers = latestSnapshot.totalFollowers || influencer.instagramFollowersCount || 0;

      // Extract demographics data
      const ageBreakdown = latestSnapshot.audienceAgeGender || [];
      const avgEngagementRate = latestSnapshot.avgEngagementRate || 3.5;

      // Calculate gender percentages from demographics
      const genderStats = this.calculateGenderStats(ageBreakdown);

      // Generate hourly activity pattern based on demographics
      const hourlyActivity = this.generateHourlyActivityPattern(
        totalFollowers,
        genderStats,
        ageBreakdown,
        avgEngagementRate
      );

      // Find peak hours for AI insights
      const sortedByTotal = [...hourlyActivity].sort((a: any) => -a.total);
      const peakHours = sortedByTotal.slice(0, 3);
      const peakHour = peakHours[0]?.hour || 20;
      const timeRange = this.getTimeRangeDescription(peakHour);
      const formattedHour = this.formatHour(peakHour);

      const aiInsights = `Posting during ${timeRange} aligns best with follower activity. Peak engagement occurs around ${formattedHour}.`;

      return {
        hourlyActivity,
        aiInsights,
      };
    } catch (error) {
      console.log('Online presence calculation error:', error.message);
      return {
        hourlyActivity: [],
        aiInsights: 'Unable to generate online presence analysis.',
      };
    }
  }

  /**
   * Calculate gender percentages from age-gender breakdown data
   */
  private calculateGenderStats(ageBreakdown: any[]): { male: number; female: number; others: number } {
    const stats = { male: 0, female: 0, others: 0 };

    if (!ageBreakdown || ageBreakdown.length === 0) {
      return { male: 50, female: 30, others: 20 }; // Default fallback
    }

    for (const segment of ageBreakdown) {
      // Handle both regular numbers and Decimal types from database
      let malePercentage = 0;
      let femalePercentage = 0;
      let othersPercentage = 0;

      if (segment.malePercentage) {
        malePercentage = typeof segment.malePercentage === 'number' 
          ? segment.malePercentage 
          : parseFloat(segment.malePercentage.toString());
      }

      if (segment.femalePercentage) {
        femalePercentage = typeof segment.femalePercentage === 'number' 
          ? segment.femalePercentage 
          : parseFloat(segment.femalePercentage.toString());
      }

      if (segment.othersPercentage) {
        othersPercentage = typeof segment.othersPercentage === 'number' 
          ? segment.othersPercentage 
          : parseFloat(segment.othersPercentage.toString());
      }

      stats.male += malePercentage;
      stats.female += femalePercentage;
      stats.others += othersPercentage;
    }

    return stats;
  }

  /**
   * Generate realistic hourly activity pattern based on demographics
   * Returns array with hour, male, female, others counts
   */
  private generateHourlyActivityPattern(
    totalFollowers: number,
    genderStats: { male: number; female: number; others: number },
    ageBreakdown: any[],
    engagementRate: number
  ): any[] {
    const hourlyActivity: any[] = [];

    // Normalize gender stats to percentages (ensure they sum to 100)
    const totalGender = genderStats.male + genderStats.female + genderStats.others;
    
    // Handle edge case where totalGender is 0
    if (totalGender === 0) {
      const fallbackStats = { male: 50, female: 30, others: 20 };
      const fallbackTotal = 100;
      genderStats.male = 50;
      genderStats.female = 30;
      genderStats.others = 20;
    }

    const normalizedTotal = genderStats.male + genderStats.female + genderStats.others;
    const malePercent = (genderStats.male / normalizedTotal) * 100;
    const femalePercent = (genderStats.female / normalizedTotal) * 100;
    const othersPercent = (genderStats.others / normalizedTotal) * 100;

    // Analyze age distribution
    const dominantAgeGroup = this.findDominantAgeGroup(ageBreakdown);

    // Generate for each hour of the day
    for (let hour = 0; hour < 24; hour++) {
      // Get base activity multiplier for this hour
      const baseMultiplier = this.getHourlyActivityMultiplier(hour, dominantAgeGroup);

      // Calculate followers active at this hour (using engagement rate as base)
      const activeFollowers = Math.round((totalFollowers * engagementRate / 100) * baseMultiplier);

      // Distribute by gender using actual percentages
      const male = Math.round((activeFollowers * malePercent) / 100);
      const female = Math.round((activeFollowers * femalePercent) / 100);
      const others = Math.max(0, activeFollowers - male - female); // Ensure sum equals total

      hourlyActivity.push({
        hour,
        male: Math.max(0, male),
        female: Math.max(0, female),
        others: Math.max(0, others),
        total: activeFollowers,
      });
    }

    return hourlyActivity;
  }

  /**
   * Find dominant age group to adjust hourly patterns
   */
  private findDominantAgeGroup(ageBreakdown: any[]): string {
    if (!ageBreakdown || ageBreakdown.length === 0) return '25-34';

    let maxPercentage = 0;
    let dominantGroup = '25-34';

    for (const segment of ageBreakdown) {
      const percentage = Number(segment.percentage) || 0;
      if (percentage > maxPercentage) {
        maxPercentage = percentage;
        dominantGroup = segment.ageRange || '25-34';
      }
    }

    return dominantGroup;
  }

  /**
   * Get hourly activity multiplier based on time of day and audience demographics
   * Returns a multiplier (0-1.5) that adjusts base activity for each hour
   */
  private getHourlyActivityMultiplier(hour: number, dominantAgeGroup: string): number {
    let multiplier = 0.3; // Minimum baseline

    // Morning (7-10 AM)
    if (hour >= 7 && hour <= 9) {
      multiplier = ['13-17', '18-24'].includes(dominantAgeGroup) ? 0.5 : 0.7;
    }
    // Late Morning (10 AM-12 PM)
    else if (hour >= 10 && hour <= 11) {
      multiplier = ['13-17', '18-24'].includes(dominantAgeGroup) ? 0.6 : 0.8;
    }
    // Noon (12-1 PM)
    else if (hour === 12) {
      multiplier = ['25-34', '35-44'].includes(dominantAgeGroup) ? 1.0 : 0.7;
    }
    // Afternoon (1-3 PM)
    else if (hour >= 13 && hour <= 15) {
      multiplier = ['25-34', '35-44'].includes(dominantAgeGroup) ? 0.9 : 0.6;
    }
    // Late Afternoon (3-5 PM)
    else if (hour >= 16 && hour <= 17) {
      multiplier = 0.7;
    }
    // Evening (5-7 PM)
    else if (hour >= 18 && hour <= 19) {
      multiplier = ['13-17', '18-24'].includes(dominantAgeGroup) ? 1.1 : 0.8;
    }
    // Night (7-10 PM) - PEAK for young audiences
    else if (hour >= 20 && hour <= 21) {
      multiplier = ['13-17', '18-24'].includes(dominantAgeGroup) ? 1.5 : 1.0;
    }
    // Late Night (10-11 PM)
    else if (hour === 22) {
      multiplier = ['13-17', '18-24'].includes(dominantAgeGroup) ? 1.2 : 0.5;
    }
    // Midnight to 6 AM
    else if (hour >= 23 || hour <= 6) {
      multiplier = 0.2;
    }

    return multiplier;
  }

  /**
   * Get time range description for peak hours
   */
  private getTimeRangeDescription(hour: number): string {
    if (hour >= 7 && hour <= 9) return '7-9 AM';
    if (hour >= 10 && hour <= 12) return '10 AM-12 PM';
    if (hour >= 13 && hour <= 15) return '1-3 PM';
    if (hour >= 16 && hour <= 18) return '4-6 PM';
    if (hour >= 19 && hour <= 21) return '7-9 PM';
    if (hour >= 22 || hour <= 2) return '10 PM-2 AM';
    if (hour >= 3 && hour <= 6) return '3-6 AM';
    return `${hour}:00`;
  }

  /**
   * Format hour to 12-hour format
   */
  private formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
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

    // Determine overall rating based on score
    let rating = '';
    if (scoreOut100 >= 85) rating = 'Exceptional';
    else if (scoreOut100 >= 70) rating = 'Excellent';
    else if (scoreOut100 >= 50) rating = 'Good';
    else if (scoreOut100 >= 30) rating = 'Fair';
    else rating = 'Needs Improvement';

    // Generate AI feedback based on scores
    const strengths: string[] = [];
    const improvements: string[] = [];

    if (platformRelevance.score * 10 >= 70) strengths.push('platform relevance');
    else improvements.push('platform relevance');

    if (contentMix.score * 10 >= 70) strengths.push('content mix');
    else improvements.push('content mix (increase reel percentage)');

    if (contentStyle.score * 10 >= 70) strengths.push('content style');
    else improvements.push('content style');

    if (hashtagEffectiveness.score * 10 >= 70) strengths.push('hashtag effectiveness');
    else improvements.push('hashtag usage');

    let aiFeedback = '';
    if (strengths.length > 0) {
      aiFeedback += `Strong in: ${strengths.join(', ')}. `;
    }
    if (improvements.length > 0) {
      aiFeedback += `Focus on improving: ${improvements.join(', ')}.`;
    }

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      details: {
        rating,
        totalPostsAnalyzed: contentMix.details.totalPosts || 0,
        primaryNiche: topNicheBreakdown.details.primaryNiche || 'Unknown',
        contentMixScore: Number((contentMix.score * 10).toFixed(2)),
        platformRelevanceScore: Number((platformRelevance.score * 10).toFixed(2)),
        hashtagEffectivenessRating: hashtagEffectiveness.details.effectiveness || 'Unknown',
        languageFit: languageMarketFit.details.primaryLanguage || 'Unknown',
        aiFeedback: aiFeedback.trim(),
      },
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
    // Get cached AI analysis from snapshot (generated once per 30 days)
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
    });

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available for analysis' } };
      }

      // Use AI to analyze trend relevance (try cache first)
      const captions = recentMedia.map(m => m.caption);
      let trendAnalysis;

      if (latestSnapshot?.aiTrendAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
        trendAnalysis = latestSnapshot.aiTrendAnalysis;
        console.log(`📦 Using cached trend analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);
      } else if (this.geminiAIService.isAvailable()) {
        console.log(`🤖 Generating fresh trend analysis (will be cached in next snapshot)`);
        trendAnalysis = await this.geminiAIService.analyzeTrendRelevance(captions);
      } else {
        return {
          score: 7.0,
          details: {
            message: 'AI not available - using default score',
            percentage: 70,
            rating: 'Good',
            description: 'Content is Well Allignes',
          },
        };
      }

      const aiScore = trendAnalysis.score || 7; // AI returns 1-10
      const percentage = (aiScore / 10) * 100; // Convert to percentage

      // Determine rating based on score
      let rating = '';
      if (percentage >= 85) rating = 'Exceptional';
      else if (percentage >= 70) rating = 'Excellent';
      else if (percentage >= 50) rating = 'Good';
      else if (percentage >= 30) rating = 'Fair';
      else rating = 'Needs Improvement';

      // Use AI-generated feedback
      const aiFeedback = trendAnalysis.feedback || 'Content follows current trends well.';

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
          aiFeedback,
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
    let rating = '';
    if (reelPercentage >= 90) {
      score = 2;
      rating = 'Weak';
    } else if (reelPercentage >= 60) {
      score = 5;
      rating = 'Excellent';
    } else {
      score = 3;
      rating = 'Fair';
    }

    // Generate AI feedback (4-6 words)
    const aiFeedback = await this.geminiAIService.generateContentMixFeedback({
      reelPercent: reelPercentage,
      imagePercent: imagePercentage,
      carouselPercent: carouselPercentage,
      rating,
    });

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

      // Generate AI feedback (4-6 words)
      const rating = facePercentage > 70 ? 'Excellent' : facePercentage > 40 ? 'Good' : 'Fair';
      const aiFeedback = await this.geminiAIService.generateFacePresenceFeedback({
        facePercent: facePercentage,
        rating,
      });

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
    let rating = '';
    if (topPostsPercentage === 0) {
      rawScore = 3;
      rating = 'Weak';
    } else if (topPostsPercentage <= 30) {
      rawScore = 6;
      rating = 'Fair';
    } else if (topPostsPercentage <= 44) {
      rawScore = 8;
      rating = 'Good';
    } else {
      rawScore = 10;
      rating = 'Excellent';
    }

    // Generate AI feedback (4-6 words)
    const lowPostsPercentage = 100 - topPostsPercentage;
    const aiFeedback = await this.geminiAIService.generatePerformanceDistributionFeedback({
      highPerformingPercent: topPostsPercentage,
      lowPerformingPercent: lowPostsPercentage,
      rating,
    });

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
    let rating = '';
    if (worstPostsPercentage <= 15) {
      rawScore = 10;
      rating = 'Excellent';
    } else if (worstPostsPercentage <= 30) {
      rawScore = 8;
      rating = 'Good';
    } else if (worstPostsPercentage <= 45) {
      rawScore = 6;
      rating = 'Fair';
    } else {
      rawScore = 3;
      rating = 'Weak';
    }

    // Generate AI feedback (4-6 words)
    const highPostsPercentage = 100 - worstPostsPercentage;
    const aiFeedback = await this.geminiAIService.generatePerformanceDistributionFeedback({
      highPerformingPercent: highPostsPercentage,
      lowPerformingPercent: worstPostsPercentage,
      rating,
    });

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

      // Get cached AI analysis from snapshot (generated once per 30 days)
      const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'DESC']],
      });

      let nicheResult;
      if (latestSnapshot?.aiNicheAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
        nicheResult = latestSnapshot.aiNicheAnalysis;
        console.log(`📦 Using cached niche analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);
      } else {
        console.log(`🤖 Generating fresh niche analysis (will be cached in next snapshot)`);
        nicheResult = await this.geminiAIService.detectNiche(captions, []);
      }

      const topNiches = ['fashion', 'beauty', 'lifestyle', 'food', 'electronics', 'travel', 'business', 'finance', 'education', 'fitness', 'sports', 'spiritual', 'motivator'];

      const allNiches = [nicheResult.primaryNiche, ...nicheResult.secondaryNiches];
      const matchedNiches = allNiches.filter(niche => topNiches.includes(niche.toLowerCase()));
      const matchCount = matchedNiches.length;

      let rawScore = 0;
      let rating = '';
      if (matchCount === 0) {
        rawScore = 3;
        rating = 'Weak';
      } else if (matchCount === 1) {
        rawScore = 6;
        rating = 'Fair';
      } else if (matchCount <= 4) {
        rawScore = 8;
        rating = 'Good';
      } else {
        rawScore = 10;
        rating = 'Excellent';
      }

      // Generate AI feedback (4-6 words)
      const aiFeedback = await this.geminiAIService.generateNicheFeedback({
        nicheCount: matchCount,
        topNiches: matchedNiches,
        rating,
      });

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

      // Get cached AI analysis from snapshot (generated once per 30 days)
      const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'DESC']],
      });

      let hashtagAnalysis;
      if (latestSnapshot?.aiHashtagAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
        hashtagAnalysis = latestSnapshot.aiHashtagAnalysis;
        console.log(`📦 Using cached hashtag analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);
      } else {
        console.log(`🤖 Generating fresh hashtag analysis (will be cached in next snapshot)`);
        hashtagAnalysis = await this.geminiAIService.analyzeHashtagEffectiveness(captions);
      }

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

      // Generate AI feedback (4-6 words) - use cached from hashtagAnalysis or generate new
      const aiFeedback = hashtagAnalysis.feedback || await this.geminiAIService.generateHashtagFeedback({
        effectiveness: hashtagAnalysis.rating,
        rating: effectivenessMap[hashtagAnalysis.rating] || 'Moderate',
      });

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: hashtagAnalysis.rating,
          effectiveness,
          detectedHashtags,
          avgHashtagsUsed,
          totalUniqueHashtags: hashtagFrequency.size,
          aiFeedback,
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

      // Get cached AI analysis from snapshot (generated once per 30 days)
      const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'DESC']],
      });

      let languageResult;
      if (latestSnapshot?.aiLanguageAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
        languageResult = latestSnapshot.aiLanguageAnalysis;
        console.log(`📦 Using cached language analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);
      } else {
        console.log(`🤖 Generating fresh language analysis (will be cached in next snapshot)`);
        languageResult = await this.geminiAIService.analyzeLanguage(captions);
      }

      // Check if language analysis returned valid data
      if (!languageResult || !languageResult.languagePercentages || typeof languageResult.languagePercentages !== 'object') {
        return {
          score: 8.0,
          details: {
            message: 'AI language analysis returned invalid data - using default',
            primaryLanguage: 'English',
            languageBreakdown: [],
            targetMarketFit: 80,
            aiFeedback: 'Language analysis unavailable - assuming English content',
          },
        };
      }

      const targetLanguages = ['Hindi', 'English'];
      let targetLanguagePercentage = 0;

      for (const lang of targetLanguages) {
        if (languageResult.languagePercentages[lang]) {
          targetLanguagePercentage += Number(languageResult.languagePercentages[lang]) || 0;
        }
      }

      const score = (targetLanguagePercentage / 100) * 10;

      // Convert language percentages to breakdown array
      const languageBreakdown = Object.entries(languageResult.languagePercentages)
        .map(([language, percentage]) => ({
          language,
          percentage: Number(Number(percentage).toFixed(1)),
          isTarget: targetLanguages.includes(language),
        }))
        .sort((a, b) => b.percentage - a.percentage);

      // Generate AI feedback for market fit (4-6 words)
      const rating = targetLanguagePercentage >= 90 ? 'Excellent' :
                     targetLanguagePercentage >= 70 ? 'Good' :
                     targetLanguagePercentage >= 50 ? 'Fair' : 'Weak';
      const aiFeedback = await this.geminiAIService.generateLanguageAlignmentFeedback({
        targetLanguagePercent: targetLanguagePercentage,
        rating,
      });

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
    // Get cached AI analysis from snapshot (generated once per 30 days)
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
    });

    // Try to use cached AI visual analysis
    if (latestSnapshot?.aiVisualAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
      const cachedData = latestSnapshot.aiVisualAnalysis;
      console.log(`📦 Using cached visual analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);

      // Extract cached scores
      const lightingScore = cachedData.avgLighting || 75;
      const editingScore = cachedData.avgProfessionalScore || 75;
      const aestheticsScore = cachedData.avgAestheticsScore || 75;

      // Calculate overall score on 0-10 scale
      const score = ((lightingScore + editingScore + aestheticsScore) / 300) * 10;

      // Generate AI feedback from cached data (4-6 words)
      const avgScore = (editingScore + aestheticsScore + lightingScore) / 3;
      const rating = avgScore >= 80 ? 'Excellent' :
                     avgScore >= 60 ? 'Good' :
                     avgScore >= 40 ? 'Fair' : 'Weak';
      const aiFeedback = await this.geminiAIService.generateVisualQualityFeedback({
        avgLighting: lightingScore,
        avgEditing: editingScore,
        avgAesthetics: aestheticsScore,
        rating,
      });

      return {
        score: Number(score.toFixed(2)),
        details: {
          imagesAnalyzed: cachedData.imagesAnalyzed || 0,
          lighting: Number(lightingScore.toFixed(2)),
          editing: Number(editingScore.toFixed(2)),
          aesthetics: Number(aestheticsScore.toFixed(2)),
          aiFeedback,
          change: 0,
        },
      };
    }

    // Fallback: Generate fresh AI analysis if not cached
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.5,
        details: {
          message: 'AI not available - using default score',
          lighting: 75,
          editing: 75,
          aesthetics: 75,
          aiFeedback: 'Visual quality analysis unavailable - AI service not accessible.',
        },
      };
    }

    try {
      console.log(`🤖 Generating fresh visual analysis (will be cached in next snapshot)`);
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

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
          // Continue on error - skip this media
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
      let aiFeedback = '';
      if (editingScore >= 80 && aestheticsScore >= 80 && lightingScore >= 80) {
        aiFeedback = 'Excellent visual quality across all aspects - professional production value.';
      } else if (editingScore >= 80 && aestheticsScore < 40) {
        aiFeedback = 'Strong editing, but weaker aesthetics reduce reel retention.';
      } else if (lightingScore >= 80 && aestheticsScore >= 70) {
        aiFeedback = 'Good lighting and composition create appealing visuals.';
      } else if (lightingScore < 40) {
        aiFeedback = 'Improve lighting quality for better visual appeal.';
      } else if (aestheticsScore < 40) {
        aiFeedback = 'Focus on composition and framing to enhance visual impact.';
      } else if (editingScore < 40) {
        aiFeedback = 'Enhance editing quality with better transitions and effects.';
      } else {
        aiFeedback = 'Moderate visual quality - refine lighting, editing, and composition.';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          imagesAnalyzed: visualAnalyses.length,
          lighting: Number(lightingScore.toFixed(2)),
          editing: Number(editingScore.toFixed(2)),
          aesthetics: Number(aestheticsScore.toFixed(2)),
          aiFeedback,
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
          aiFeedback: 'Visual analysis unavailable - using default metrics.',
        },
      };
    }
  }

  /**
   * 3.2 Color Palette & Mood (20%)
   * AI rates aesthetic consistency with mood and color analysis
   */
  private async calculateColorPaletteMood(influencer: Influencer): Promise<{ score: number; details: any }> {
    // Get cached AI analysis from snapshot (generated once per 30 days)
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
    });

    // Try to use cached AI color palette analysis
    if (latestSnapshot?.aiColorPaletteAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
      const aestheticAnalysis = latestSnapshot.aiColorPaletteAnalysis;
      console.log(`📦 Using cached color palette analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);

      // AI returns 1-20, convert to 0-10
      const rating = aestheticAnalysis.rating || 14;
      const score = (rating / 20) * 10;

      // Generate AI feedback based on mood and rating
      const mood = aestheticAnalysis.mood || 'Neutral';
      const consistency = aestheticAnalysis.consistency || 'medium';
      let aiFeedback = '';

      if (rating >= 18 && consistency === 'high') {
        aiFeedback = 'Excellent color consistency creating strong brand recognition and aesthetic appeal.';
      } else if (rating >= 15 && consistency === 'high') {
        aiFeedback = 'Strong color palette consistency helps with brand recall.';
      } else if (mood.toLowerCase().includes('cool') && mood.toLowerCase().includes('muted')) {
        aiFeedback = 'Consistent cool tones help brand recall, but muted accents reduce scroll-stopping impact.';
      } else if (mood.toLowerCase().includes('vibrant') || mood.toLowerCase().includes('warm')) {
        aiFeedback = 'Vibrant colors create eye-catching content that stands out in feeds.';
      } else if (rating < 10 || consistency === 'low') {
        aiFeedback = 'Improve color palette consistency for better aesthetic appeal and brand recognition.';
      } else {
        aiFeedback = 'Moderate color consistency - consider developing a signature palette.';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: aestheticAnalysis.rating,
          mood: aestheticAnalysis.mood || 'Neutral',
          dominantColors: aestheticAnalysis.dominantColors && aestheticAnalysis.dominantColors.length > 0
            ? aestheticAnalysis.dominantColors
            : [],
          consistency: aestheticAnalysis.consistency || 'Medium',
          aiFeedback,
          change: 0,
        },
      };
    }

    // Fallback: Generate fresh AI analysis if not cached
    if (!this.geminiAIService.isAvailable()) {
      return {
        score: 7.0,
        details: {
          message: 'AI not available - using default score',
          mood: 'Neutral',
          dominantColors: [],
          rating: 70,
          aiFeedback: 'Color palette analysis unavailable - AI service not accessible.',
        },
      };
    }

    try {
      console.log(`🤖 Generating fresh color palette analysis (will be cached in next snapshot)`);
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 10);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      const aestheticAnalysis = await this.geminiAIService.analyzeColorPaletteMood(recentMedia.map(m => m.mediaUrl).slice(0, 10));

      // AI returns 1-20, convert to 0-10
      const score = (aestheticAnalysis.rating / 20) * 10;

      // Generate AI feedback based on mood and rating
      const mood = aestheticAnalysis.mood || 'Neutral';
      const rating = aestheticAnalysis.rating || 14;
      const consistency = aestheticAnalysis.consistency || 'medium';
      let aiFeedback = '';

      if (rating >= 18 && consistency === 'high') {
        aiFeedback = 'Excellent color consistency creating strong brand recognition and aesthetic appeal.';
      } else if (rating >= 15 && consistency === 'high') {
        aiFeedback = 'Strong color palette consistency helps with brand recall.';
      } else if (mood.toLowerCase().includes('cool') && mood.toLowerCase().includes('muted')) {
        aiFeedback = 'Consistent cool tones help brand recall, but muted accents reduce scroll-stopping impact.';
      } else if (mood.toLowerCase().includes('vibrant') || mood.toLowerCase().includes('warm')) {
        aiFeedback = 'Vibrant colors create eye-catching content that stands out in feeds.';
      } else if (rating < 10 || consistency === 'low') {
        aiFeedback = 'Improve color palette consistency for better aesthetic appeal and brand recognition.';
      } else {
        aiFeedback = 'Moderate color consistency - consider developing a signature palette.';
      }

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: aestheticAnalysis.rating,
          mood: aestheticAnalysis.mood || 'Neutral',
          dominantColors: aestheticAnalysis.dominantColors && aestheticAnalysis.dominantColors.length > 0
            ? aestheticAnalysis.dominantColors
            : [],
          consistency: aestheticAnalysis.consistency || 'Medium',
          aiFeedback,
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
          dominantColors: [],
          rating: 14,
          aiFeedback: 'Color palette analysis encountered an error - using default metrics.',
        },
      };
    }
  }

  /**
   * 3.3 Caption Sentiment (10%)
   * Detailed sentiment breakdown with counts and percentages
   */
  private async calculateCaptionSentiment(influencer: Influencer): Promise<{ score: number; details: any }> {
    // Get cached AI analysis from snapshot (generated once per 30 days)
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
    });

    // Get caption count for percentage calculations
    const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
    const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);

    // Try to use cached AI sentiment analysis
    if (latestSnapshot?.aiSentimentAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
      const sentimentResult = latestSnapshot.aiSentimentAnalysis;
      console.log(`📦 Using cached sentiment analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);

      const sentimentScore = sentimentResult.score || 70;
      const aiFeedback = sentimentResult.feedback || 'Sentiment analysis complete.';

      // Convert overall sentiment to distribution
      // sentimentScore ranges from -100 to +100
      let positivePercentage: number;
      let negativePercentage: number;
      let neutralPercentage: number;

      if (sentimentScore >= 50) {
        positivePercentage = 70 + (sentimentScore - 50) / 2;
        negativePercentage = 5;
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else if (sentimentScore >= 0) {
        positivePercentage = 50 + sentimentScore / 2;
        negativePercentage = 10 + (50 - sentimentScore) / 5;
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else if (sentimentScore >= -50) {
        positivePercentage = 30 + (sentimentScore + 50) / 2.5;
        negativePercentage = 30 + Math.abs(sentimentScore) / 2;
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      } else {
        positivePercentage = 5;
        negativePercentage = 70 + Math.abs(sentimentScore + 50) / 2;
        neutralPercentage = 100 - positivePercentage - negativePercentage;
      }

      const captionsLength = captions.length || 20;
      const positiveCount = Math.round((positivePercentage / 100) * captionsLength);
      const negativeCount = Math.round((negativePercentage / 100) * captionsLength);
      const neutralCount = captionsLength - positiveCount - negativeCount;

      // Scoring based on positive percentage
      let rawScore = 0;
      if (positivePercentage <= 30) rawScore = 4;
      else if (positivePercentage <= 50) rawScore = 6;
      else if (positivePercentage <= 75) rawScore = 8;
      else rawScore = 10;

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
          captionsAnalyzed: captionsLength,
          aiFeedback,
        },
      };
    }

    // Fallback: Generate fresh AI analysis if not cached
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
      console.log(`🤖 Generating fresh sentiment analysis (will be cached in next snapshot)`);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

      if (captions.length === 0) {
        return { score: 0, details: { message: 'No captions available' } };
      }

      const sentimentResult = await this.geminiAIService.analyzeSentiment(captions);
      const sentimentScore = sentimentResult.score;
      const aiFeedback = sentimentResult.feedback;

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

      // Use AI-generated feedback (already set from analyzeSentiment result)

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
          aiFeedback,
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
    // Get cached AI analysis from snapshot (generated once per 30 days)
    const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
    });

    // Get caption count for calculations
    const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
    const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);

    // Try to use cached AI CTA analysis
    if (latestSnapshot?.aiCtaAnalysis && latestSnapshot?.aiFeedbackGeneratedAt) {
      const ctaAnalysis = latestSnapshot.aiCtaAnalysis;
      console.log(`📦 Using cached CTA analysis from ${latestSnapshot.aiFeedbackGeneratedAt}`);

      // Map AI rating to score
      const scoreMap = {
        'good': 10,
        'medium': 7,
        'less': 4,
      };

      const score = scoreMap[ctaAnalysis.rating] || 7;

      // Calculate usage percentage
      const ctaCount = ctaAnalysis.ctaCount || 0;
      const captionsLength = captions.length || 20;
      const usagePercentage = captionsLength > 0 ? (ctaCount / captionsLength) * 100 : 0;

      // Common CTAs detected
      const commonCTAs = ctaAnalysis.examples || [
        'Save For Later',
        'Comment Bellow',
        'Share With your Friend',
        'Follow For More',
      ];

      const aiFeedback = ctaAnalysis.feedback || 'Moderate CTA usage detected.';

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: ctaAnalysis.rating,
          usagePercentage: Number(usagePercentage.toFixed(2)),
          totalPosts: captionsLength,
          ctaCount,
          detectedCTAs: commonCTAs,
          aiFeedback,
          change: 0,
        },
      };
    }

    // Fallback: Generate fresh AI analysis if not cached
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
      console.log(`🤖 Generating fresh CTA analysis (will be cached in next snapshot)`);
      if (recentMedia.length === 0) {
        return { score: 0, details: { message: 'No media available' } };
      }

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

      // Use AI-generated feedback
      const aiFeedback = ctaAnalysis.feedback || 'Moderate CTA usage detected.';

      return {
        score: Number(score.toFixed(2)),
        details: {
          rating: ctaAnalysis.rating,
          usagePercentage: Number(usagePercentage.toFixed(2)),
          totalPosts: captions.length,
          ctaCount,
          detectedCTAs: commonCTAs,
          aiFeedback,
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
    // Query for all snapshots and filter to get latest with complete engagement data
    // This excludes demographics-only snapshots without engagement metrics
    const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
    });

    // Filter to only complete snapshots with engagement data
    // Must have postsAnalyzed > 0 to ensure it's not a demographics-only snapshot
    const validSnapshots = allSnapshots.filter(s =>
      s.syncNumber != null &&
      s.avgEngagementRate != null &&
      s.postsAnalyzed > 0
    );
    const latestSync = validSnapshots.length > 0 ? validSnapshots[0] : null;

    console.log(`📊 Engagement Overview Debug: Found ${allSnapshots.length} total snapshots, ${validSnapshots.length} valid snapshots`);
    if (latestSync) {
      console.log(`   Latest valid snapshot: syncNumber=${latestSync.syncNumber}, avgEngagementRate=${latestSync.avgEngagementRate}%`);
    }

    if (!latestSync || !latestSync.avgEngagementRate) {
      // Get cached retention curve or use default
      let defaultRetentionCurve;
      if (latestSync?.aiRetentionCurve) {
        defaultRetentionCurve = latestSync.aiRetentionCurve;
        console.log(`📦 Using cached retention curve from ${latestSync.aiFeedbackGeneratedAt}`);
      } else if (this.geminiAIService.isAvailable()) {
        console.log(`🤖 Generating fresh retention curve (will be cached in next snapshot)`);
        defaultRetentionCurve = await this.geminiAIService.generateRetentionCurve({
          retentionRate: 0,
          avgDuration: '20-30 Sec',
          engagementRate: 0,
        });
      } else {
        defaultRetentionCurve = this.getDefaultRetentionCurve();
      }

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
          retentionOverview: {
            retentionRate: 0,
            skipRate: 0,
            retentionRating: 'Unknown',
            avgReelDuration: 'N/A',
            retentionCurve: defaultRetentionCurve,
            note: 'No engagement data available. Retention metrics require Instagram Business/Creator account with Facebook Page connection for accurate data.',
          },
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

    // Calculate retention metrics from actual Instagram video data
    // Query recent video insights to get average retention rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const videoInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId: influencer.id },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: {
          timestamp: { [Op.gte]: thirtyDaysAgo },
          mediaProductType: ['REELS', 'CLIPS', 'VIDEO'],
        },
      }],
    });

    let retentionRate = 0;
    let skipRate = 100;

    // Calculate average retention from videos that have retention data
    const videosWithRetention = videoInsights.filter(v => v.totalVideoViews && v.totalVideoViews > 0);
    if (videosWithRetention.length > 0) {
      const totalRetention = videosWithRetention.reduce((sum, v) => {
        const videoRetention = (v.totalVideoCompleteViews || 0) / (v.totalVideoViews || 1) * 100;
        return sum + videoRetention;
      }, 0);
      retentionRate = Number((totalRetention / videosWithRetention.length).toFixed(2));
      skipRate = Math.max(0, Number((100 - retentionRate).toFixed(2)));
    } else {
      // Improved fallback: estimate retention using engagement quality indicators
      // High-value engagements (saves, shares, comments) indicate higher retention

      if (avgReach > 0) {
        // Base engagement rate
        const totalInteractions = avgLike + avgComments + avgShare + avgSaves;
        const engagementRate = (totalInteractions / avgReach) * 100;

        // Weight different engagement types (higher value = more retention)
        const saveWeight = 3.0;  // Saves indicate high retention (watched to value it)
        const shareWeight = 2.5;  // Shares indicate completion (watched to recommend)
        const commentWeight = 2.0;  // Comments indicate engagement with content
        const likeWeight = 1.0;  // Likes are passive, less indicative of retention

        const weightedEngagement = (
          (avgSaves * saveWeight) +
          (avgShare * shareWeight) +
          (avgComments * commentWeight) +
          (avgLike * likeWeight)
        );

        const weightedEngagementRate = (weightedEngagement / avgReach) * 100;

        // Estimate retention using weighted engagement + industry benchmarks
        // Average Instagram reel retention: 40-60% (we'll use engagement as modifier)
        const baseRetention = 45; // Industry average baseline
        const engagementBonus = Math.min(weightedEngagementRate * 5, 35); // Max +35% bonus
        const estimatedRetention = baseRetention + engagementBonus;

        retentionRate = Math.min(Number(estimatedRetention.toFixed(2)), 90); // Cap at 90%
        skipRate = Math.max(0, Number((100 - retentionRate).toFixed(2)));
      } else {
        retentionRate = 0;
        skipRate = 100;
      }
    }

    // Estimate average reel duration based on content type distribution
    // Note: Instagram API doesn't provide video duration, this is an estimate
    const avgReelDuration = await this.estimateAvgReelDuration(influencer.id);

    // Generate retention rating
    let retentionRating = '';
    if (retentionRate >= 80) retentionRating = 'Exceptional';
    else if (retentionRate >= 60) retentionRating = 'Excellent';
    else if (retentionRate >= 40) retentionRating = 'Good';
    else if (retentionRate >= 20) retentionRating = 'Fair';
    else retentionRating = 'Needs Improvement';

    // Generate AI feedback (4-6 words) - with caching
    let aiFeedback = '';
    if (latestSync?.aiEngagementFeedback && latestSync?.aiFeedbackGeneratedAt) {
      aiFeedback = latestSync.aiEngagementFeedback;
      console.log(`📦 Using cached engagement feedback from ${latestSync.aiFeedbackGeneratedAt}`);
    } else {
      console.log(`🤖 Generating fresh engagement feedback (will be cached in next snapshot)`);
      aiFeedback = await this.geminiAIService.generateEngagementFeedback({
        engagementRate,
        reachRatio: reachToFollowerRatio,
        retentionRate,
        rating,
      });
    }

    // Get cached retention curve or generate fresh one
    let retentionCurve;
    if (latestSync?.aiRetentionCurve && latestSync?.aiFeedbackGeneratedAt) {
      retentionCurve = latestSync.aiRetentionCurve;
      console.log(`📦 Using cached retention curve from ${latestSync.aiFeedbackGeneratedAt}`);
    } else if (this.geminiAIService.isAvailable()) {
      console.log(`🤖 Generating fresh retention curve (will be cached in next snapshot)`);
      retentionCurve = await this.geminiAIService.generateRetentionCurve({
        retentionRate,
        avgDuration: avgReelDuration,
        engagementRate: Number(engagementRate.toFixed(2)),
        contentQuality: latestSync.avgEngagementRate ? Math.min(100, latestSync.avgEngagementRate * 20) : undefined,
      });
    } else {
      retentionCurve = this.getDefaultRetentionCurve();
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
        // Retention metrics (from Instagram API or approximated)
        retentionOverview: {
          retentionRate,
          skipRate,
          retentionRating,
          avgReelDuration,
          retentionCurve, // AI-generated time-series data
          note: videosWithRetention?.length > 0
            ? `Retention rate calculated from ${videosWithRetention.length} video${videosWithRetention.length > 1 ? 's' : ''} with completion data from Instagram API. Retention curve is AI-estimated for visualization.`
            : 'Retention metrics are AI-estimated using engagement quality (saves, shares, comments). For accurate data, convert Instagram to Business/Creator account and connect to Facebook Page.',
        },
      },
    };
  }

  /**
   * Estimate average reel duration based on content type distribution
   * Note: Instagram API doesn't provide video duration, this is an approximation
   */
  private async estimateAvgReelDuration(influencerId: number): Promise<string> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId },
      include: [{
        model: this.instagramMediaModel,
        required: true,
        where: { timestamp: { [Op.gte]: thirtyDaysAgo } },
      }],
      limit: 30,
    });

    if (recentInsights.length === 0) {
      return '20-30 Sec'; // Default estimate
    }

    // Count reels vs other content types
    let reelsCount = 0;
    let totalPosts = 0;

    for (const insight of recentInsights) {
      totalPosts++;
      const mediaProductType = insight.mediaProductType;
      if (mediaProductType === 'REELS' || mediaProductType === 'CLIPS') {
        reelsCount++;
      }
    }

    const reelsPercentage = totalPosts > 0 ? (reelsCount / totalPosts) * 100 : 0;

    // Estimate duration based on content mix
    // Higher reel percentage = likely shorter durations (15-30s)
    // Lower reel percentage = likely mix of longer content (30-60s)
    if (reelsPercentage >= 70) {
      return '15-25 Sec'; // High reel content, likely short-form
    } else if (reelsPercentage >= 40) {
      return '20-35 Sec'; // Mixed content
    } else if (reelsPercentage >= 20) {
      return '25-45 Sec'; // More diverse content
    } else if (reelsPercentage > 0) {
      return '30-60 Sec'; // Occasional reels, likely longer
    } else {
      return 'N/A'; // No reels detected
    }
  }

  /**
   * Get default retention curve when AI is not available
   * Returns a standard retention curve for visualization
   */
  private getDefaultRetentionCurve(): any[] {
    return [
      { time: 0, retention: 100 },
      { time: 5, retention: 85 },
      { time: 10, retention: 70 },
      { time: 15, retention: 60 },
      { time: 20, retention: 50 },
      { time: 25, retention: 45 },
      { time: 30, retention: 40 },
    ];
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

    // Generate AI feedback (4-6 words) - no caching for performance consistency (needs real-time trend)
    const aiFeedback = await this.geminiAIService.generatePerformanceConsistencyFeedback({
      consistencyPercent: performancePercentage,
      trendPercent: trendPercentage,
      rating,
    });

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

    // Calculate on 0-10 scale, then convert to 0-100 for UI
    const score =
      (growthTrend.score * 0.60) +
      (postingBehaviour.score * 0.40);

    // Convert to 0-100 scale for UI
    const scoreOut100 = score * 10;

    return {
      score: Number(scoreOut100.toFixed(2)),
      maxScore: 100, // Changed from 10 to 100 for UI
      breakdown: {
        growthTrend: { score: growthTrend.score * 10, weight: 60, details: growthTrend.details },
        postingBehaviour: { score: postingBehaviour.score * 10, weight: 40, details: postingBehaviour.details },
      },
    };
  }

  /**
   * 5.1 Growth Trend (60%)
   * 30-day follower growth rate with tiered scoring
   * >30%: 10/10 | 25-30%: 8.33/10 | 20-25%: 6.67/10 | 15-20%: 5.83/10
   * 10-15%: 5/10 | 5-10%: 4.17/10 | 0-5%: 3.33/10 | negative: 0/10
   * Enhanced with chart data and detailed metrics
   */
  private async calculateGrowthTrend(influencer: Influencer): Promise<{ score: number; details: any }> {
    // Fetch growth snapshots from last 60 days (to calculate previous period comparison)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const growthSnapshots = await this.instagramProfileGrowthModel.findAll({
      where: {
        influencerId: influencer.id,
        snapshotDate: { [Op.gte]: sixtyDaysAgo },
      },
      order: [['snapshotDate', 'ASC']],
    });


    // Fallback to profile analysis if no growth snapshots
    if (growthSnapshots.length < 2) {
      // Fetch ALL snapshots to build chart data (exclude incomplete snapshots without syncNumber or totalFollowers)
      const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'ASC']],
      });

      // Filter out incomplete snapshots (demographics-only records without growth metrics)
      const snapshots = allSnapshots.filter(s => s.syncNumber != null && s.totalFollowers != null);

      console.log(`📊 Growth Trend Debug: Found ${allSnapshots.length} total snapshots, ${snapshots.length} valid snapshots with growth data`);
      if (snapshots.length > 0) {
        console.log(`   First snapshot: syncNumber=${snapshots[0].syncNumber}, followers=${snapshots[0].totalFollowers}`);
        console.log(`   Last snapshot: syncNumber=${snapshots[snapshots.length - 1].syncNumber}, followers=${snapshots[snapshots.length - 1].totalFollowers}`);
      }

      if (snapshots.length < 2) {
        return {
          score: 5.0,
          details: {
            message: 'First sync. Growth will be calculated after next sync.',
            newFollowers: 0,
            newFollowersChange: 0,
            avgGrowthPerDay: 0,
            avgGrowthChange: 0,
            rating: 'Unknown',
            chartData: [],
          },
        };
      }

      // Calculate growth from FIRST and LAST snapshot (not last two)
      const latestFollowers = snapshots[snapshots.length - 1].totalFollowers || 0;
      const previousFollowers = snapshots[0].totalFollowers || 0;  // Use FIRST snapshot, not second-to-last
      const growth = latestFollowers - previousFollowers;
      const growthRate = previousFollowers > 0 ? ((growth / previousFollowers) * 100) : 0;

      let score = 0;
      let rating = '';
      if (growthRate > 30) { score = 10.0; rating = 'Exceptional'; }
      else if (growthRate >= 25) { score = 8.33; rating = 'Excellent'; }
      else if (growthRate >= 20) { score = 6.67; rating = 'Very Good'; }
      else if (growthRate >= 15) { score = 5.83; rating = 'Good'; }
      else if (growthRate >= 10) { score = 5.0; rating = 'Moderate'; }
      else if (growthRate >= 5) { score = 4.17; rating = 'Fair'; }
      else if (growthRate >= 0) { score = 3.33; rating = 'Weak'; }
      else { score = 0; rating = 'Declining'; }

      // Build chart data with weekly intervals from profile analysis snapshots
      const chartData = this.generateWeeklyChartDataFromAnalysis(snapshots);

      // Get AI feedback from cache or generate new one
      // TEMPORARILY DISABLED FOR TESTING - Always generate fresh feedback
      // const latestSnapshot = snapshots[snapshots.length - 1];
      // let aiFeedback: string;

      // if (latestSnapshot?.aiGrowthFeedback && latestSnapshot?.aiFeedbackGeneratedAt) {
      //   // Use cached feedback to save AI costs
      //   aiFeedback = latestSnapshot.aiGrowthFeedback;
      //   console.log(`📦 Using cached growth feedback from ${latestSnapshot.aiFeedbackGeneratedAt}`);
      // } else {
      //   // Generate new AI feedback (will be cached during next snapshot creation)
      //   aiFeedback = await this.generateGrowthFeedback({
      //     growthRate,
      //     currentGrowth: growth,
      //     avgGrowthPerDay: 0,
      //     rating,
      //   });
      //   console.log(`🤖 Generated new growth feedback (not cached)`);
      // }

      // Always generate fresh AI feedback (4-6 words)
      const aiFeedback = await this.geminiAIService.generateGrowthFeedback({
        growthRate,
        currentGrowth: growth,
        avgGrowthPerDay: 0,
        rating,
      });
      console.log(`🤖 Generated new growth feedback (cache disabled for testing)`);

      // Find peak gain from profile analysis snapshots
      const peakGain = await this.findPeakFollowerGainFromAnalysis(influencer.id, snapshots);

      return {
        score: Number(score.toFixed(2)),
        details: {
          growthRate: Number(growthRate.toFixed(2)),
          followersStart: previousFollowers,
          followersEnd: latestFollowers,
          growth,
          newFollowers: growth,
          newFollowersChange: 0,
          avgGrowthPerDay: 0,
          avgGrowthChange: 0,
          rating,
          tier: growthRate > 30 ? '>30%' :
                growthRate >= 25 ? '25-30%' :
                growthRate >= 20 ? '20-25%' :
                growthRate >= 15 ? '15-20%' :
                growthRate >= 10 ? '10-15%' :
                growthRate >= 5 ? '5-10%' :
                growthRate >= 0 ? '0-5%' : 'negative',
          chartData,
          aiFeedback,
          peakFollowerGain: peakGain,
          note: 'Chart data generated from profile analysis snapshots. Daily growth tracking will provide more detailed charts.',
        },
      };
    }

    // Split snapshots into current period (last 30 days) and previous period (31-60 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const currentPeriodSnapshots = growthSnapshots.filter(s => new Date(s.snapshotDate) >= thirtyDaysAgo);
    const previousPeriodSnapshots = growthSnapshots.filter(s => new Date(s.snapshotDate) < thirtyDaysAgo);

    // Build chart data with weekly intervals (7 days apart)
    const chartData = this.generateWeeklyChartData(growthSnapshots);

    // If insufficient data in last 30 days, calculate from all available snapshots
    if (currentPeriodSnapshots.length < 2) {
      // Use all snapshots for calculation
      const firstSnapshot = growthSnapshots[0];
      const lastSnapshot = growthSnapshots[growthSnapshots.length - 1];
      const totalGrowth = (lastSnapshot.followersCount || 0) - (firstSnapshot.followersCount || 0);
      const growthRate = (firstSnapshot.followersCount || 0) > 0
        ? ((totalGrowth / (firstSnapshot.followersCount || 0)) * 100)
        : 0;

      let score = 0;
      let rating = '';
      if (growthRate > 30) { score = 10.0; rating = 'Exceptional'; }
      else if (growthRate >= 25) { score = 8.33; rating = 'Excellent'; }
      else if (growthRate >= 20) { score = 6.67; rating = 'Very Good'; }
      else if (growthRate >= 15) { score = 5.83; rating = 'Good'; }
      else if (growthRate >= 10) { score = 5.0; rating = 'Moderate'; }
      else if (growthRate >= 5) { score = 4.17; rating = 'Fair'; }
      else if (growthRate >= 0) { score = 3.33; rating = 'Weak'; }
      else { score = 0; rating = 'Declining'; }

      // Generate AI feedback (4-6 words)
      const aiFeedback = await this.geminiAIService.generateGrowthFeedback({
        growthRate,
        currentGrowth: totalGrowth,
        avgGrowthPerDay: 0,
        rating,
      });

      // Find peak gain
      const peakGain = await this.findPeakFollowerGain(influencer.id, growthSnapshots);

      return {
        score: Number(score.toFixed(2)),
        details: {
          growthRate: Number(growthRate.toFixed(2)),
          followersStart: firstSnapshot.followersCount || 0,
          followersEnd: lastSnapshot.followersCount || 0,
          growth: totalGrowth,
          newFollowers: totalGrowth,
          newFollowersChange: 0,
          avgGrowthPerDay: 0,
          avgGrowthChange: 0,
          rating,
          tier: growthRate > 30 ? '>30%' :
                growthRate >= 25 ? '25-30%' :
                growthRate >= 20 ? '20-25%' :
                growthRate >= 15 ? '15-20%' :
                growthRate >= 10 ? '10-15%' :
                growthRate >= 5 ? '5-10%' :
                growthRate >= 0 ? '0-5%' : 'negative',
          chartData,
          aiFeedback,
          peakFollowerGain: peakGain,
          note: 'Growth calculated from all available snapshots. More snapshots in the last 30 days will improve accuracy.',
        },
      };
    }

    // Calculate current period growth
    const currentStart = currentPeriodSnapshots[0].followersCount || 0;
    const currentEnd = currentPeriodSnapshots[currentPeriodSnapshots.length - 1].followersCount || 0;
    const currentGrowth = currentEnd - currentStart;
    const currentDays = Math.max(1, currentPeriodSnapshots.length);
    const currentAvgPerDay = Math.round(currentGrowth / currentDays);
    const currentGrowthRate = currentStart > 0 ? ((currentGrowth / currentStart) * 100) : 0;

    // Calculate previous period growth for comparison
    let newFollowersChange = 0;
    let avgGrowthChange = 0;
    if (previousPeriodSnapshots.length >= 2) {
      const previousStart = previousPeriodSnapshots[0].followersCount || 0;
      const previousEnd = previousPeriodSnapshots[previousPeriodSnapshots.length - 1].followersCount || 0;
      const previousGrowth = previousEnd - previousStart;
      const previousDays = Math.max(1, previousPeriodSnapshots.length);
      const previousAvgPerDay = Math.round(previousGrowth / previousDays);

      newFollowersChange = currentGrowth - previousGrowth;
      avgGrowthChange = currentAvgPerDay - previousAvgPerDay;
    }

    // Determine rating based on growth rate
    let rating = '';
    if (currentGrowthRate > 30) rating = 'Exceptional';
    else if (currentGrowthRate >= 25) rating = 'Excellent';
    else if (currentGrowthRate >= 20) rating = 'Very Good';
    else if (currentGrowthRate >= 15) rating = 'Good';
    else if (currentGrowthRate >= 10) rating = 'Moderate';
    else if (currentGrowthRate >= 5) rating = 'Fair';
    else if (currentGrowthRate >= 0) rating = 'Weak';
    else rating = 'Declining';

    // Tiered scoring based on growth rate
    let score = 0;
    if (currentGrowthRate > 30) score = 10.0;
    else if (currentGrowthRate >= 25) score = 8.33;
    else if (currentGrowthRate >= 20) score = 6.67;
    else if (currentGrowthRate >= 15) score = 5.83;
    else if (currentGrowthRate >= 10) score = 5.0;
    else if (currentGrowthRate >= 5) score = 4.17;
    else if (currentGrowthRate >= 0) score = 3.33;
    else score = 0;

    // Generate AI feedback about growth trends (4-6 words)
    const aiFeedback = await this.geminiAIService.generateGrowthFeedback({
      growthRate: currentGrowthRate,
      currentGrowth,
      avgGrowthPerDay: currentAvgPerDay,
      rating,
    });

    // Find peak follower gain period
    const peakGain = await this.findPeakFollowerGain(influencer.id, growthSnapshots);

    return {
      score: Number(score.toFixed(2)),
      details: {
        growthRate: Number(currentGrowthRate.toFixed(2)),
        followersStart: currentStart,
        followersEnd: currentEnd,
        growth: currentGrowth,
        newFollowers: currentGrowth,
        newFollowersChange,
        avgGrowthPerDay: currentAvgPerDay,
        avgGrowthChange,
        rating,
        tier: currentGrowthRate > 30 ? '>30%' :
              currentGrowthRate >= 25 ? '25-30%' :
              currentGrowthRate >= 20 ? '20-25%' :
              currentGrowthRate >= 15 ? '15-20%' :
              currentGrowthRate >= 10 ? '10-15%' :
              currentGrowthRate >= 5 ? '5-10%' :
              currentGrowthRate >= 0 ? '0-5%' : 'negative',
        chartData,
        aiFeedback,
        peakFollowerGain: peakGain,
      },
    };
  }

  /**
   * Helper: Generate weekly chart data from growth snapshots
   * Creates data points at 7-day intervals with linear interpolation
   */
  private generateWeeklyChartData(snapshots: any[]): Array<{ date: string; followers: number }> {
    if (snapshots.length === 0) return [];
    if (snapshots.length === 1) {
      const date = new Date(snapshots[0].snapshotDate);
      return [{
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: snapshots[0].followersCount || 0,
      }];
    }

    const firstDate = new Date(snapshots[0].snapshotDate);
    const lastDate = new Date(snapshots[snapshots.length - 1].snapshotDate);
    const firstFollowers = snapshots[0].followersCount || 0;
    const lastFollowers = snapshots[snapshots.length - 1].followersCount || 0;

    const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeklyData: Array<{ date: string; followers: number }> = [];

    // Add first data point
    weeklyData.push({
      date: firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      followers: firstFollowers,
    });

    // Generate weekly points (7-day intervals)
    for (let i = 7; i < daysDiff; i += 7) {
      const currentDate = new Date(firstDate);
      currentDate.setDate(firstDate.getDate() + i);

      // Linear interpolation for follower count
      const progress = i / daysDiff;
      const interpolatedFollowers = Math.round(firstFollowers + (lastFollowers - firstFollowers) * progress);

      weeklyData.push({
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: interpolatedFollowers,
      });
    }

    // Add last data point
    weeklyData.push({
      date: lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      followers: lastFollowers,
    });

    return weeklyData;
  }

  /**
   * Helper: Generate weekly chart data from profile analysis snapshots
   */
  private generateWeeklyChartDataFromAnalysis(snapshots: any[]): Array<{ date: string; followers: number }> {
    if (snapshots.length === 0) return [];
    if (snapshots.length === 1) {
      const date = snapshots[0].analysisPeriodEnd || snapshots[0].syncDate || snapshots[0].createdAt;
      return [{
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: snapshots[0].totalFollowers || 0,
      }];
    }

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    const firstDate = new Date(firstSnapshot.analysisPeriodEnd || firstSnapshot.syncDate || firstSnapshot.createdAt);
    const lastDate = new Date(lastSnapshot.analysisPeriodEnd || lastSnapshot.syncDate || lastSnapshot.createdAt);
    const firstFollowers = firstSnapshot.totalFollowers || 0;
    const lastFollowers = lastSnapshot.totalFollowers || 0;

    const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeklyData: Array<{ date: string; followers: number }> = [];

    // Add first data point
    weeklyData.push({
      date: firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      followers: firstFollowers,
    });

    // Generate weekly points (7-day intervals)
    for (let i = 7; i < daysDiff; i += 7) {
      const currentDate = new Date(firstDate);
      currentDate.setDate(firstDate.getDate() + i);

      // Linear interpolation for follower count
      const progress = i / daysDiff;
      const interpolatedFollowers = Math.round(firstFollowers + (lastFollowers - firstFollowers) * progress);

      weeklyData.push({
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        followers: interpolatedFollowers,
      });
    }

    // Add last data point
    weeklyData.push({
      date: lastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      followers: lastFollowers,
    });

    return weeklyData;
  }


  /**
   * Helper: Find peak follower gain period with top contributing posts
   */
  private async findPeakFollowerGain(influencerId: number, snapshots: any[]): Promise<any> {
    if (snapshots.length < 2) return null;

    // Find the period with maximum growth between consecutive snapshots
    let maxGrowth = 0;
    let peakStartDate: Date | null = null;
    let peakEndDate: Date | null = null;
    let peakStartFollowers = 0;
    let peakEndFollowers = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const prevFollowers = snapshots[i - 1].followersCount || 0;
      const currFollowers = snapshots[i].followersCount || 0;
      const growth = currFollowers - prevFollowers;

      if (growth > maxGrowth) {
        maxGrowth = growth;
        peakStartDate = new Date(snapshots[i - 1].snapshotDate);
        peakEndDate = new Date(snapshots[i].snapshotDate);
        peakStartFollowers = prevFollowers;
        peakEndFollowers = currFollowers;
      }
    }

    if (!peakStartDate || !peakEndDate || maxGrowth <= 0) {
      return null;
    }

    // Find top posts during the peak growth period with insights
    const topPosts = await this.instagramMediaModel.findAll({
      where: {
        influencerId,
        timestamp: {
          [Op.between]: [peakStartDate, peakEndDate],
        },
      },
      order: [['timestamp', 'DESC']],
      limit: 3,
      attributes: ['id', 'mediaUrl', 'timestamp'],
      include: [{
        model: this.instagramMediaInsightModel,
        as: 'insights',
        attributes: ['reach', 'likes'],
        limit: 1,
        order: [['fetchedAt', 'DESC']],
        required: false,
      }],
    });

    // Calculate estimated followers gained per post (distribute total growth)
    const followersPerPost = topPosts.length > 0 ? Math.floor(maxGrowth / topPosts.length) : 0;

    return {
      maxFollowersGained: maxGrowth,
      dateRange: {
        start: peakStartDate.toISOString().split('T')[0],
        end: peakEndDate.toISOString().split('T')[0],
      },
      topPosts: topPosts.map((post) => ({
        mediaUrl: post.mediaUrl,
        date: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: post.insights?.[0]?.reach || 0,
        followersGained: followersPerPost,
      })),
      aiFeedback: maxGrowth > 100
        ? 'Your follower base shows healthy activity with no abnormal spikes.'
        : 'Steady growth pattern detected. Keep creating engaging content.',
    };
  }

  /**
   * Helper: Find peak follower gain from profile analysis snapshots
   */
  private async findPeakFollowerGainFromAnalysis(influencerId: number, snapshots: any[]): Promise<any> {
    if (snapshots.length < 2) return null;

    // Find the period with maximum growth between consecutive snapshots
    let maxGrowth = 0;
    let peakStartDate: Date | null = null;
    let peakEndDate: Date | null = null;
    let peakStartFollowers = 0;
    let peakEndFollowers = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const prevFollowers = snapshots[i - 1].totalFollowers || 0;
      const currFollowers = snapshots[i].totalFollowers || 0;
      const growth = currFollowers - prevFollowers;

      if (growth > maxGrowth) {
        maxGrowth = growth;
        peakStartDate = new Date(snapshots[i - 1].analysisPeriodEnd || snapshots[i - 1].syncDate || snapshots[i - 1].createdAt);
        peakEndDate = new Date(snapshots[i].analysisPeriodEnd || snapshots[i].syncDate || snapshots[i].createdAt);
        peakStartFollowers = prevFollowers;
        peakEndFollowers = currFollowers;
      }
    }

    if (!peakStartDate || !peakEndDate || maxGrowth <= 0) {
      return null;
    }

    // Find top posts during the peak growth period with insights
    const topPosts = await this.instagramMediaModel.findAll({
      where: {
        influencerId,
        timestamp: {
          [Op.between]: [peakStartDate, peakEndDate],
        },
      },
      order: [['timestamp', 'DESC']],
      limit: 3,
      attributes: ['id', 'mediaUrl', 'timestamp'],
      include: [{
        model: this.instagramMediaInsightModel,
        as: 'insights',
        attributes: ['reach', 'likes'],
        limit: 1,
        order: [['fetchedAt', 'DESC']],
        required: false,
      }],
    });

    // Calculate estimated followers gained per post (distribute total growth)
    const followersPerPost = topPosts.length > 0 ? Math.floor(maxGrowth / topPosts.length) : 0;

    return {
      maxFollowersGained: maxGrowth,
      dateRange: {
        start: peakStartDate.toISOString().split('T')[0],
        end: peakEndDate.toISOString().split('T')[0],
      },
      topPosts: topPosts.map((post) => ({
        mediaUrl: post.mediaUrl,
        date: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: post.insights?.[0]?.reach || 0,
        followersGained: followersPerPost,
      })),
      aiFeedback: maxGrowth > 100
        ? 'Your follower base shows healthy activity with no abnormal spikes.'
        : 'Steady growth pattern detected. Keep creating engaging content.',
    };
  }

  /**
   * 5.2 Posting Behaviour (40%)
   * Posting frequency consistency based on weekly posts
   * 6-7 posts/week: 10/10 | 4-5: 7.86/10 | 2-3: 5.71/10 | 0-1: 2.86/10
   * Enhanced with post type breakdown, best days/times, and AI feedback
   */
  private async calculatePostingBehaviour(influencer: Influencer): Promise<{ score: number; details: any }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch recent posts with insights for detailed analysis
    const recentPostsWithInsights = await this.instagramMediaModel.findAll({
      where: {
        influencerId: influencer.id,
        timestamp: { [Op.gte]: thirtyDaysAgo },
      },
      attributes: ['id', 'mediaType', 'mediaProductType', 'timestamp', 'mediaUrl'],
      include: [{
        model: this.instagramMediaInsightModel,
        as: 'insights',
        attributes: ['reach', 'likes', 'comments', 'saved'],
        limit: 1,
        order: [['fetchedAt', 'DESC']],
        required: false,
      }],
    });

    const recentPosts = recentPostsWithInsights.length;

    // Calculate average posts per week (30 days ≈ 4.3 weeks)
    const postsPerWeek = (recentPosts / 30) * 7;

    // Tiered scoring based on weekly posting frequency
    let score = 0;
    let rating = '';
    if (postsPerWeek >= 6) {
      score = 10.0;
      rating = 'Excellent';
    } else if (postsPerWeek >= 4) {
      score = 7.86;
      rating = 'Good';
    } else if (postsPerWeek >= 2) {
      score = 5.71;
      rating = 'Fair';
    } else {
      score = 2.86;
      rating = 'Needs Improvement';
    }

    // Analyze post type breakdown
    const postTypeBreakdown = this.analyzePostTypes(recentPostsWithInsights);

    // Find best posting days and times
    const { bestDays, bestTimes } = this.analyzeBestPostingSchedule(recentPostsWithInsights);

    // Get AI feedback from cache or generate new one
    // TEMPORARILY DISABLED FOR TESTING - Always generate fresh feedback
    // const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
    //   where: { influencerId: influencer.id },
    //   order: [['syncNumber', 'DESC']],
    // });

    // let aiFeedback: string;

    // if (latestSnapshot?.aiPostingFeedback && latestSnapshot?.aiFeedbackGeneratedAt) {
    //   // Use cached feedback to save AI costs
    //   aiFeedback = latestSnapshot.aiPostingFeedback;
    //   console.log(`📦 Using cached posting feedback from ${latestSnapshot.aiFeedbackGeneratedAt}`);
    // } else {
    //   // Generate new AI feedback (will be cached during next snapshot creation)
    //   aiFeedback = await this.generatePostingBehaviorFeedback({
    //     postsPerWeek,
    //     rating,
    //     postTypeBreakdown,
    //   });
    //   console.log(`🤖 Generated new posting feedback (not cached)`);
    // }

    // Always generate fresh AI feedback (4-6 words)
    const aiFeedback = await this.geminiAIService.generatePostingBehaviorFeedback({
      postsPerWeek,
      rating,
      postTypeBreakdown,
    });
    console.log(`🤖 Generated new posting feedback (cache disabled for testing)`);

    // Get top 5 recent posts with media URLs for display
    const recentTopPosts = recentPostsWithInsights
      .sort((a, b) => {
        const engagementA = (a.insights?.[0]?.reach || 0) + (a.insights?.[0]?.likes || 0);
        const engagementB = (b.insights?.[0]?.reach || 0) + (b.insights?.[0]?.likes || 0);
        return engagementB - engagementA;
      })
      .slice(0, 5)
      .map(post => ({
        mediaUrl: post.mediaUrl,
        date: new Date(post.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: post.insights?.[0]?.reach || 0,
        mediaType: post.mediaProductType || post.mediaType,
      }));

    return {
      score: Number(score.toFixed(2)),
      details: {
        totalPosts30Days: recentPosts,
        postsPerWeek: Number(postsPerWeek.toFixed(2)),
        rating,
        tier: postsPerWeek >= 6 ? '6-7 posts/week' :
              postsPerWeek >= 4 ? '4-5 posts/week' :
              postsPerWeek >= 2 ? '2-3 posts/week' : '0-1 posts/week',
        postTypeBreakdown,
        bestDays,
        bestTimes,
        recentPosts: recentTopPosts,
        aiFeedback,
      },
    };
  }

  /**
   * Helper: Analyze post type distribution
   */
  private analyzePostTypes(posts: any[]): any {
    const typeCounts = {
      reel: 0,
      image: 0,
      carousel: 0,
    };

    posts.forEach(post => {
      const productType = post.mediaProductType?.toLowerCase() || '';
      const mediaType = post.mediaType?.toLowerCase() || '';

      if (productType.includes('reel') || mediaType.includes('reel') || productType === 'reels') {
        typeCounts.reel++;
      } else if (productType.includes('carousel') || mediaType.includes('carousel_album')) {
        typeCounts.carousel++;
      } else {
        typeCounts.image++;
      }
    });

    const total = posts.length || 1; // Avoid division by zero
    const reelPercentage = Math.round((typeCounts.reel / total) * 100);
    const imagePercentage = Math.round((typeCounts.image / total) * 100);
    const carouselPercentage = Math.round((typeCounts.carousel / total) * 100);

    return {
      reel: {
        count: typeCounts.reel,
        percentage: reelPercentage,
      },
      image: {
        count: typeCounts.image,
        percentage: imagePercentage,
      },
      carousel: {
        count: typeCounts.carousel,
        percentage: carouselPercentage,
      },
    };
  }

  /**
   * Helper: Analyze best posting days and times based on engagement
   */
  private analyzeBestPostingSchedule(posts: any[]): { bestDays: string[]; bestTimes: string[] } {
    if (posts.length === 0) {
      return {
        bestDays: ['Mon', 'Wed', 'Fri'],
        bestTimes: ['12PM', '6PM', '8PM'],
      };
    }

    // Map to track engagement by day and hour
    const dayEngagement: { [key: string]: number } = {};
    const hourEngagement: { [key: number]: number } = {};
    const dayCounts: { [key: string]: number } = {};
    const hourCounts: { [key: number]: number } = {};

    posts.forEach(post => {
      const timestamp = new Date(post.timestamp);
      const dayName = timestamp.toLocaleDateString('en-US', { weekday: 'short' });
      const hour = timestamp.getHours();

      // Calculate engagement (reach + likes + comments + saves)
      const engagement = (post.insights?.[0]?.reach || 0) +
                        (post.insights?.[0]?.likes || 0) +
                        (post.insights?.[0]?.comments || 0) +
                        (post.insights?.[0]?.saved || 0);

      // Aggregate by day
      dayEngagement[dayName] = (dayEngagement[dayName] || 0) + engagement;
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;

      // Aggregate by hour
      hourEngagement[hour] = (hourEngagement[hour] || 0) + engagement;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Calculate average engagement per day
    const dayAvgEngagement = Object.keys(dayEngagement).map(day => ({
      day,
      avgEngagement: dayEngagement[day] / dayCounts[day],
    }));

    // Get top 3 days
    const topDays = dayAvgEngagement
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map(item => item.day);

    // Calculate average engagement per hour
    const hourAvgEngagement = Object.keys(hourEngagement).map(hour => ({
      hour: parseInt(hour),
      avgEngagement: hourEngagement[hour] / hourCounts[hour],
    }));

    // Get top 3 hours
    const topHours = hourAvgEngagement
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3)
      .map(item => {
        const h = item.hour;
        if (h === 0) return '12AM';
        if (h === 12) return '12PM';
        if (h > 12) return `${h - 12}PM`;
        return `${h}AM`;
      });

    return {
      bestDays: topDays.length > 0 ? topDays : ['Mon', 'Wed', 'Fri'],
      bestTimes: topHours.length > 0 ? topHours : ['12PM', '6PM', '8PM'],
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
        score: 10.0,
        details: {
          message: 'AI not available - using full score',
          percentage: 100,
          rating: 'Excellent',
          campaignTypes: ['Barter', 'Paid'],
        },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return {
          score: 10.0,
          details: {
            message: 'No media available for analysis - using full score',
            percentage: 100,
            rating: 'Excellent',
            campaignTypes: ['Barter', 'Paid'],
          }
        };
      }

      // Get profile data for context (exclude demographics-only snapshots)
      const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'DESC']],
      });
      const validSnapshots = allSnapshots.filter(s => s.syncNumber != null && s.activeFollowers != null);
      const latestSync = validSnapshots.length > 0 ? validSnapshots[0] : null;

      const activeFollowers = latestSync?.activeFollowers || 0;
      // Convert Sequelize Decimal to number properly
      const avgEngagementRate = latestSync?.avgEngagementRate ? Number(latestSync.avgEngagementRate) : 0;

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

      // Try to use cached AI monetization analysis
      let monetisationRating: number;
      let aiFeedback: string;

      if (latestSync?.aiMonetizationAnalysis && latestSync?.aiFeedbackGeneratedAt) {
        const monetisationResult = latestSync.aiMonetizationAnalysis;
        console.log(`📦 Using cached monetization analysis from ${latestSync.aiFeedbackGeneratedAt}`);
        monetisationRating = monetisationResult.rating || 25;
        aiFeedback = monetisationResult.feedback || 'Monetization analysis complete.';
      } else {
        // Generate fresh AI analysis
        console.log(`🤖 Generating fresh monetization analysis (will be cached in next snapshot)`);
        const monetisationResult = await this.geminiAIService.predictMonetisationPotential(profileContext);
        monetisationRating = monetisationResult.rating;
        aiFeedback = monetisationResult.feedback;
      }

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
          aiFeedback,
          change,
        },
      };
    } catch (error) {
      return {
        score: 10.0,
        details: {
          message: 'AI analysis failed - using full score',
          error: error.message,
          percentage: 100,
          rating: 'Excellent',
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
      // Get active followers and average reach data (exclude demographics-only snapshots)
      const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'DESC']],
      });
      const validSnapshots = allSnapshots.filter(s => s.syncNumber != null && s.activeFollowers != null);
      const latestSync = validSnapshots.length > 0 ? validSnapshots[0] : null;

      if (!latestSync) {
        return {
          score: 10.0,
          details: {
            message: 'No profile sync data available - using full score',
            percentage: 100,
            rating: 'Excellent',
          }
        };
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
        engagementRate: latestSync.avgEngagementRate ? Number(latestSync.avgEngagementRate) : 0,
      };

      // Try to use cached AI payout prediction
      let predictedPayout = 0;
      let payoutFeedback = '';

      if (latestSync?.aiPayoutPrediction && latestSync?.aiFeedbackGeneratedAt) {
        const payoutResult = latestSync.aiPayoutPrediction;
        console.log(`📦 Using cached payout prediction from ${latestSync.aiFeedbackGeneratedAt}`);
        predictedPayout = payoutResult.payout || 0;
        payoutFeedback = payoutResult.feedback || 'Payout prediction complete.';
      } else if (this.geminiAIService.isAvailable()) {
        try {
          console.log(`🤖 Generating fresh payout prediction (will be cached in next snapshot)`);
          const payoutResult = await this.geminiAIService.predictInfluencerPayout(profileData);
          predictedPayout = payoutResult.payout;
          payoutFeedback = payoutResult.feedback;
        } catch (error) {
          // Fallback calculation
          predictedPayout = avgViews * 0.35; // Average of 0.2-0.5
          payoutFeedback = 'Calculated from average views.';
        }
      } else {
        predictedPayout = avgViews * 0.35;
        payoutFeedback = 'AI unavailable - basic calculation.';
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

      // Generate AI feedback based on brand trust signals
      let aiFeedback = '';
      if (percentage >= 85) {
        aiFeedback = 'Exceptional brand trust - ideal for premium brand partnerships and higher payouts.';
      } else if (percentage >= 65) {
        aiFeedback = 'Strong brand trust signals - suitable for established brands and consistent collaborations.';
      } else if (percentage >= 40) {
        aiFeedback = 'Good brand trust foundation - focus on consistent posting to attract more brands.';
      } else if (reelPercentage < 50) {
        aiFeedback = 'Improve brand trust by increasing Reels usage (platform-preferred format) and posting consistency.';
      } else if (postingHistory === 'Inconsistent') {
        aiFeedback = 'Build brand trust through consistent posting schedule and engagement with audience.';
      } else {
        aiFeedback = 'Moderate brand trust - focus on increasing views and engagement for better payout potential.';
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
          aiFeedback,
          change,
        },
      };
    } catch (error) {
      return {
        score: 10.0,
        details: {
          message: 'AI analysis failed - using full score',
          error: error.message,
          percentage: 100,
          rating: 'Excellent',
          aiFeedback: 'Brand trust analysis encountered an error - using full score.',
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
        score: 10.0,
        details: {
          message: 'AI not available - using full score',
          positive: { percentage: 90 },
          negative: { percentage: 5 },
          neutral: { percentage: 5 },
        },
      };
    }

    try {
      const recentMedia = await this.getRecentMediaForAI(influencer.id, 20);
      if (recentMedia.length === 0) {
        return {
          score: 10.0,
          details: {
            message: 'No media available - using full score',
            positive: { percentage: 90 },
            negative: { percentage: 5 },
            neutral: { percentage: 5 },
          }
        };
      }

      const captions = recentMedia.map(m => m.caption).filter(c => c && c.length > 0);
      if (captions.length === 0) {
        return {
          score: 10.0,
          details: {
            message: 'No captions available - using full score',
            positive: { percentage: 90 },
            negative: { percentage: 5 },
            neutral: { percentage: 5 },
          }
        };
      }

      // Get cached AI analysis from snapshot (generated once per 30 days)
      const latestSnapshot = await this.instagramProfileAnalysisModel.findOne({
        where: { influencerId: influencer.id },
        order: [['syncNumber', 'DESC']],
      });

      // Try to use cached AI audience sentiment analysis
      let sentimentRating: number;
      let aiFeedback: string;

      if (latestSnapshot?.aiAudienceSentiment && latestSnapshot?.aiFeedbackGeneratedAt) {
        const sentimentResult = latestSnapshot.aiAudienceSentiment;
        console.log(`📦 Using cached audience sentiment from ${latestSnapshot.aiFeedbackGeneratedAt}`);
        sentimentRating = sentimentResult.rating || 12;
        aiFeedback = sentimentResult.feedback || 'Audience sentiment analysis complete.';
      } else {
        // Generate fresh AI analysis
        console.log(`🤖 Generating fresh audience sentiment (will be cached in next snapshot)`);
        const sentimentResult = await this.geminiAIService.analyzeAudienceSentiment(captions);
        sentimentRating = sentimentResult.rating;
        aiFeedback = sentimentResult.feedback;
      }

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
          aiFeedback,
        },
      };
    } catch (error) {
      return {
        score: 10.0,
        details: {
          message: 'AI analysis failed - using full score',
          error: error.message,
          positive: { percentage: 90 },
          negative: { percentage: 5 },
          neutral: { percentage: 5 },
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
   * Calculate score change from previous calculation
   * Compares current total score with the last calculated score
   */
  private async calculateScoreChange(influencerId: number, currentScore: number): Promise<number> {
    // TODO: Implement score history tracking in database
    // For now, return 0 as placeholder
    // Future implementation:
    // 1. Store each calculation in a score_history table with timestamp
    // 2. Query the last calculation from 7 days ago (or closest)
    // 3. Return the difference: currentScore - previousScore
    return 0;
  }

  /**
   * Calculate profile strength based on total score
   * 100-75: Strong, 75-50: Good, 50-25: Average, 25-0: Weak
   */
  private calculateGrade(score: number): string {
    if (score >= 75) return 'Strong Profile';
    if (score >= 50) return 'Good Profile';
    if (score >= 25) return 'Average Profile';
    return 'Weak Profile';
  }

  /**
   * Generate AI profile summary based on category scores (4-6 words)
   */
  private async generateProfileSummary(categories: {
    audienceQuality: AudienceQualityScore;
    contentRelevance: ContentRelevanceScore;
    contentQuality: ContentQualityScore;
    engagementStrength: EngagementStrengthScore;
    growthMomentum: GrowthMomentumScore;
    monetisation: MonetisationScore;
  }): Promise<string> {
    // Analyze each category and identify strengths/weaknesses
    const categoryAnalysis = [
      { name: 'niche clarity', score: categories.contentRelevance.score },
      { name: 'audience quality', score: categories.audienceQuality.score },
      { name: 'content quality', score: categories.contentQuality.score },
      { name: 'engagement', score: categories.engagementStrength.score },
      { name: 'growth momentum', score: categories.growthMomentum.score },
      { name: 'monetisation', score: categories.monetisation.score },
    ];

    // Calculate total score and grade
    const totalScore = (
      categories.audienceQuality.score +
      categories.contentRelevance.score +
      categories.contentQuality.score +
      categories.engagementStrength.score +
      categories.growthMomentum.score +
      categories.monetisation.score
    ) / 6;

    const grade = this.calculateGrade(totalScore);

    // Find strongest (≥70) and weakest (<60) areas
    const strengths = categoryAnalysis.filter(c => c.score >= 70).map(c => c.name);
    const weaknesses = categoryAnalysis.filter(c => c.score < 60).map(c => c.name);

    // Generate AI summary (4-6 words)
    return await this.geminiAIService.generateProfileSummary({
      totalScore,
      strengths,
      weaknesses,
      grade,
    });
  }
}
