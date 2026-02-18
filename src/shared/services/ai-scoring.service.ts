import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  InfluencerData,
  CampaignData,
  AIScoreResult,
} from './ai-scoring.interface';
import { GeminiAIService } from '../../shared/services/gemini-ai.service';

@Injectable()
export class AIScoringService {
  private openai: OpenAI | null;

  constructor(
    private configService: ConfigService,
    private geminiAIService: GeminiAIService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      console.warn(
        'OpenAI API key not configured. AI scoring will use fallback logic.',
      );
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async scoreInfluencerForCampaign(
    influencer: InfluencerData,
    campaign: CampaignData,
  ): Promise<AIScoreResult> {
    let result: AIScoreResult | null = null;

    // Gemini is the primary AI scorer
    if (this.geminiAIService.isAvailable()) {
      try {
        result = await this.geminiScoring(influencer, campaign);
      } catch (error) {
        console.error('Gemini scoring error, falling back to OpenAI:', error);
      }
    }

    // OpenAI as secondary
    if (!result && this.openai) {
      try {
        const prompt = this.buildScoringPrompt(influencer, campaign);
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert influencer marketing analyst. Analyze the match between an influencer and a campaign, providing detailed scores and insights. Always respond with valid JSON only.`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error('OpenAI returned empty response');
        const parsed = JSON.parse(content);
        result = this.normalizeAIResponse(parsed, influencer, campaign);
      } catch (error) {
        console.error('OpenAI scoring error, falling back to deterministic:', error);
      }
    }

    // Deterministic fallback
    if (!result) {
      result = this.fallbackScoring(influencer, campaign);
    }

    return this.applyScoringCaps(result, influencer);
  }

  /**
   * Apply hard caps on the overall score:
   * 1. Follower cap — tiny accounts cannot score high regardless of other signals
   * 2. Location cap — a hard city mismatch (locationMatch === 0) caps overall at 50
   */
  private applyScoringCaps(result: AIScoreResult, influencer: InfluencerData): AIScoreResult {
    let maxScore = 100;

    // Location cap (city-targeted campaign, influencer not in target city)
    if (result.locationMatch === 0) maxScore = Math.min(maxScore, 50);

    // Follower cap
    if (influencer.followers < 50)       maxScore = Math.min(maxScore, 15);
    else if (influencer.followers < 100)  maxScore = Math.min(maxScore, 25);
    else if (influencer.followers < 500)  maxScore = Math.min(maxScore, 40);

    if (result.overall <= maxScore) return result;

    const cappedOverall = maxScore;
    let recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
    if (cappedOverall >= 80) recommendation = 'Highly Recommended';
    else if (cappedOverall >= 60) recommendation = 'Recommended';
    else recommendation = 'Consider';

    return { ...result, overall: cappedOverall, recommendation };
  }

  /**
   * Gemini-powered scoring.
   * Pre-calculates all deterministic component scores, then sends the full
   * influencer + campaign context to Gemini to get an intelligent nicheMatch
   * evaluation plus qualitative strengths/concerns/reasoning.
   * The overall score is the raw weighted average — no niche multiplier —
   * so the AI's holistic judgement is reflected without artificial crushing.
   */
  private async geminiScoring(
    influencer: InfluencerData,
    campaign: CampaignData,
  ): Promise<AIScoreResult> {
    // ── Deterministic component scores ──────────────────────────────────────
    const demographicScore  = this.calculateDemographicMatch(influencer.audienceAgeGender, campaign);
    const audienceRelevance = this.calculateAudienceRelevance(influencer.followers, demographicScore);
    const audienceQuality   = this.calculateAudienceQualityScore(influencer);
    const engagementRate    = this.calculateEngagementScore(
      influencer.postPerformance?.engagementRate ?? 0,
      influencer.followers,
    );
    const growthConsistency = this.calculateGrowthConsistencyScore(influencer.profileSnapshots);
    const locationMatch     = this.calculateLocationMatch(
      influencer.location,
      campaign.targetCities,
      campaign.isPanIndia,
    );
    const contentQuality    = influencer.contentQualityScore;

    // ── Build compact Gemini prompt ─────────────────────────────────────────
    const audienceDemoSummary = influencer.audienceAgeGender && influencer.audienceAgeGender.length > 0
      ? influencer.audienceAgeGender.slice(0, 5).map(d => `${d.ageRange}${d.gender ? '/' + d.gender : ''}: ${d.percentage}%`).join(', ')
      : 'N/A';
    const prompt = `You are an influencer-campaign match analyst. Given the data below, return ONLY valid JSON.

Influencer: ${influencer.name} (@${influencer.username})
  Followers: ${influencer.followers} | Follows: ${influencer.instagramFollowsCount ?? 'N/A'} | Media: ${influencer.instagramMediaCount ?? 'N/A'}
  Verified: ${influencer.isVerified} | Location: ${influencer.location}
  Niches: ${influencer.niches.join(', ') || 'Not specified'}
  Bio: ${influencer.bio || 'N/A'}
  Engagement rate: ${influencer.postPerformance?.engagementRate?.toFixed(2) ?? 'N/A'}%
  Past campaigns: ${influencer.pastCampaigns.total} (success rate ${influencer.pastCampaigns.successRate}%)
  Audience demographics: ${audienceDemoSummary}

Campaign: "${campaign.name}"
  Description: ${campaign.description || 'N/A'}
  Required niches: ${campaign.niches.join(', ') || 'Any'}
  Targeting: ${campaign.isPanIndia ? 'Pan India' : campaign.targetCities.join(', ')}
  Target gender: ${campaign.isOpenToAllGenders ? 'All' : (campaign.genderPreferences?.join(', ') || 'Not specified')}
  Target age: ${campaign.isOpenToAllAges ? 'All ages' : `${campaign.minAge ?? 'any'}–${campaign.maxAge ?? 'any'}`}
  Type: ${campaign.campaignType}

Pre-calculated component scores (0-100):
  audienceRelevance: ${audienceRelevance}
  audienceQuality: ${audienceQuality}
  engagementRate: ${engagementRate}
  growthConsistency: ${growthConsistency}
  locationMatch: ${locationMatch}
  contentQuality: ${contentQuality}

Your task:
1. Evaluate nicheMatch (0-100) — how well do the influencer's niches align with the campaign's required niches?
   Be precise: exact match = 80-100, related = 40-70, unrelated = 0-30.
2. Calculate overall as the weighted average:
   nicheMatch×0.25 + audienceRelevance×0.10 + audienceQuality×0.10 + engagementRate×0.30
   + growthConsistency×0.10 + locationMatch×0.10 + contentQuality×0.05
   Round to nearest integer.
3. recommendation: "Highly Recommended" if overall≥80, "Recommended" if 60-79, else "Consider".
4. 2-4 strengths (specific positives).
5. 1-3 concerns (specific cautions, if any).
6. reasoning: 2-3 sentences explaining the recommendation.

Return JSON:
{
  "nicheMatch": <number>,
  "overall": <number>,
  "recommendation": "<string>",
  "strengths": ["<string>"],
  "concerns": ["<string>"],
  "reasoning": "<string>"
}`;

    const result = await this.geminiAIService.executeWithFallback(async (model) => {
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.3,
        },
      });
      return response.response;
    }, 'scoringInfluencerForCampaign');

    const parsed = JSON.parse(result.text());
    const nicheMatch = Math.min(100, Math.max(0, Math.round(parsed.nicheMatch ?? 0)));

    // Recalculate overall from components so it is always consistent
    const weightedScore = Math.round(
      nicheMatch        * 0.25 +
      audienceRelevance * 0.10 +
      audienceQuality   * 0.10 +
      engagementRate    * 0.30 +
      growthConsistency * 0.10 +
      locationMatch     * 0.10 +
      contentQuality    * 0.05,
    );

    // Apply same niche penalty as fallback — poor niche match must hurt overall
    // even when engagement/other signals are strong
    let nicheMultiplier = 1.0;
    if (nicheMatch < 80) nicheMultiplier = 0.9;
    if (nicheMatch < 60) nicheMultiplier = 0.7;
    if (nicheMatch < 40) nicheMultiplier = 0.5;
    if (nicheMatch < 20) nicheMultiplier = 0.3;
    const rawOverall = Math.round(weightedScore * nicheMultiplier);

    let recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
    if (rawOverall >= 80) recommendation = 'Highly Recommended';
    else if (rawOverall >= 60) recommendation = 'Recommended';
    else recommendation = 'Consider';

    return {
      overall: rawOverall,
      nicheMatch,
      audienceRelevance,
      audienceQuality,
      engagementRate,
      growthConsistency,
      locationMatch,
      contentQuality,
      recommendation,
      strengths: parsed.strengths || [],
      concerns:  parsed.concerns  || [],
      reasoning: parsed.reasoning || '',
    };
  }

  private buildScoringPrompt(
    influencer: InfluencerData,
    campaign: CampaignData,
  ): string {
    return `
Analyze this influencer-campaign match and provide scores from 0-100 for each criterion:

**Influencer Profile:**
- Name: ${influencer.name} (@${influencer.username})
- Followers: ${influencer.followers.toLocaleString()}
- Niches: ${influencer.niches.join(', ') || 'Not specified'}
- Location: ${influencer.location}
- Verified: ${influencer.isVerified ? 'Yes' : 'No'}
- Bio: ${influencer.bio || 'Not provided'}
- Past Campaigns: ${influencer.pastCampaigns.total} total, ${influencer.pastCampaigns.successRate}% success rate
${
  influencer.postPerformance
    ? `- Post Performance: ${influencer.postPerformance.totalPosts} posts, ${influencer.postPerformance.averageLikes.toLocaleString()} avg likes, ${influencer.postPerformance.engagementRate.toFixed(2)}% engagement`
    : ''
}

**Campaign Requirements:**
- Campaign: ${campaign.name}
- Description: ${campaign.description || 'Not provided'}
- Target Niches: ${campaign.niches.join(', ') || 'Any'}
- Target Locations: ${campaign.isPanIndia ? 'Pan India' : campaign.targetCities.join(', ')}
- Campaign Type: ${campaign.campaignType}

**Scoring Criteria:**
1. **nicheMatch** (0-100): How well do the influencer's niches align with campaign requirements?
2. **audienceRelevance** (0-100): How relevant is the influencer's audience size for the campaign?
3. **audienceQuality** (0-100): How authentic and engaged is the influencer's audience (follower/following ratio, posting consistency)?
4. **engagementRate** (0-100): How good is the influencer's engagement relative to their follower tier?
5. **growthConsistency** (0-100): Is the influencer's growth healthy and consistent over time?
6. **locationMatch** (0-100): Does the influencer's location match campaign targeting?
7. **contentQuality** (0-100): How good is the influencer's profile and content quality?

**Calculate overall score** as weighted average:
- nicheMatch × 25%
- audienceRelevance × 10%
- audienceQuality × 10%
- engagementRate × 30%
- growthConsistency × 10%
- locationMatch × 10%
- contentQuality × 5%

**Provide:**
- Individual scores for each criterion
- Overall weighted score
- Recommendation: "Highly Recommended" (≥80), "Recommended" (60-79), or "Consider" (<60)
- 2-4 key strengths (specific positive points)
- 1-3 concerns (specific areas of caution, if any)
- Brief reasoning (2-3 sentences explaining the recommendation)

Return ONLY valid JSON in this exact format:
{
  "nicheMatch": <number>,
  "audienceRelevance": <number>,
  "audienceQuality": <number>,
  "engagementRate": <number>,
  "growthConsistency": <number>,
  "locationMatch": <number>,
  "contentQuality": <number>,
  "overall": <number>,
  "recommendation": "<string>",
  "strengths": ["<string>", ...],
  "concerns": ["<string>", ...],
  "reasoning": "<string>"
}
`;
  }

  private normalizeAIResponse(response: any, influencer: InfluencerData, _campaign: CampaignData): AIScoreResult {
    // If AI returned scores, validate and use them; re-calculate locals for fallback fields
    const audienceQuality = Math.round(response.audienceQuality ?? this.calculateAudienceQualityScore(influencer));
    const growthConsistency = Math.round(response.growthConsistency ?? this.calculateGrowthConsistencyScore(influencer.profileSnapshots));
    return {
      overall: Math.round(response.overall || 0),
      nicheMatch: Math.round(response.nicheMatch || 0),
      audienceRelevance: Math.round(response.audienceRelevance || 0),
      audienceQuality,
      engagementRate: Math.round(response.engagementRate || 0),
      growthConsistency,
      locationMatch: Math.round(response.locationMatch || 0),
      contentQuality: Math.round(response.contentQuality || 0),
      recommendation: response.recommendation || 'Consider',
      strengths: response.strengths || [],
      concerns: response.concerns || [],
      reasoning: response.reasoning || '',
    };
  }

  private fallbackScoring(
    influencer: InfluencerData,
    campaign: CampaignData,
  ): AIScoreResult {
    const nicheMatch = this.calculateNicheMatch(
      influencer.niches,
      campaign.niches,
    );
    const demographicScore = this.calculateDemographicMatch(influencer.audienceAgeGender, campaign);
    const audienceRelevance = this.calculateAudienceRelevance(influencer.followers, demographicScore);
    const audienceQuality = this.calculateAudienceQualityScore(influencer);
    const engagementRate = this.calculateEngagementScore(
      influencer.postPerformance?.engagementRate ?? 0,
      influencer.followers,
    );
    const growthConsistency = this.calculateGrowthConsistencyScore(influencer.profileSnapshots);
    const locationMatch = this.calculateLocationMatch(
      influencer.location,
      campaign.targetCities,
      campaign.isPanIndia,
    );
    const contentQuality = influencer.contentQualityScore;

    // Weights: nicheMatch × 0.25, audienceRelevance × 0.10, audienceQuality × 0.10,
    // engagementRate × 0.30, growthConsistency × 0.10,
    // locationMatch × 0.10, contentQuality × 0.05
    const rawScore = Math.round(
      nicheMatch * 0.25 +
        audienceRelevance * 0.10 +
        audienceQuality * 0.10 +
        engagementRate * 0.30 +
        growthConsistency * 0.10 +
        locationMatch * 0.10 +
        contentQuality * 0.05,
    );

    // Apply niche-based multiplier (PENALTY for poor niche match)
    let nicheMultiplier = 1.0;
    if (nicheMatch < 80) nicheMultiplier = 0.9;   // 10% penalty
    if (nicheMatch < 60) nicheMultiplier = 0.7;   // 30% penalty
    if (nicheMatch < 40) nicheMultiplier = 0.5;   // 50% penalty
    if (nicheMatch < 20) nicheMultiplier = 0.3;   // 70% penalty (SEVERE)

    const overall = Math.round(rawScore * nicheMultiplier);

    let recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
    if (overall >= 80) recommendation = 'Highly Recommended';
    else if (overall >= 60) recommendation = 'Recommended';
    else recommendation = 'Consider';

    const strengths: string[] = [];
    const concerns: string[] = [];

    // Niche Match analysis (CRITICAL for campaign success)
    if (nicheMatch >= 80) {
      strengths.push('Excellent niche alignment with campaign requirements');
    } else if (nicheMatch >= 60) {
      strengths.push('Good niche match for campaign');
    } else if (nicheMatch >= 40) {
      concerns.push('Partial niche alignment with campaign focus areas');
    } else if (nicheMatch >= 20) {
      concerns.push('Poor niche match - influencer content may not align with campaign goals');
    } else {
      concerns.push('⚠️ SEVERE NICHE MISMATCH - Influencer creates different content type than campaign requires');
    }

    // Audience Relevance analysis
    if (audienceRelevance >= 80) {
      strengths.push(`Strong audience size of ${influencer.followers.toLocaleString()} followers`);
    } else if (audienceRelevance >= 60) {
      strengths.push(`Good audience reach with ${influencer.followers.toLocaleString()} followers`);
    } else if (audienceRelevance < 60) {
      concerns.push('Smaller audience size may limit campaign reach');
    }

    // Audience Quality analysis
    if (audienceQuality >= 75) {
      strengths.push('High-quality, authentic audience with strong engagement signals');
    } else if (audienceQuality >= 55) {
      strengths.push('Decent audience quality with reasonable authenticity indicators');
    } else if (audienceQuality < 40) {
      concerns.push('Low audience quality score - possible follow-for-follow or inactive followers');
    }

    // Engagement Rate analysis (now tier-aware)
    if (engagementRate >= 80) {
      strengths.push('Exceptional engagement rate relative to follower tier');
    } else if (engagementRate >= 60) {
      strengths.push('Solid engagement rate for their follower tier');
    } else if (engagementRate < 40) {
      concerns.push('Engagement rate is below industry benchmark for this follower size');
    }

    // Growth & Consistency analysis
    if (growthConsistency >= 80) {
      strengths.push('Healthy and consistent account growth over time');
    } else if (growthConsistency < 40) {
      concerns.push('Inconsistent or stagnant growth pattern detected');
    }

    // Location Match analysis
    if (locationMatch >= 90) {
      strengths.push('Perfect location match for campaign targeting');
    } else if (locationMatch === 0) {
      concerns.push('Influencer location does not match any campaign target cities');
    } else if (locationMatch < 70) {
      concerns.push('Location may not align with primary campaign targets');
    }

    // Demographic match analysis
    if (!campaign.isOpenToAllGenders || !campaign.isOpenToAllAges) {
      if (demographicScore >= 75) {
        strengths.push('Audience demographics closely match campaign targeting');
      } else if (demographicScore < 40) {
        concerns.push('Audience demographics do not align well with campaign gender/age targets');
      }
    }

    // Content Quality analysis
    if (influencer.isVerified) {
      strengths.push('Verified account adds credibility');
    }

    // Ensure at least one strength
    if (strengths.length === 0) {
      strengths.push('Profile meets basic campaign requirements');
    }

    const reasoning = `Match score of ${overall}% based on niche alignment (${nicheMatch}%), audience quality (${audienceQuality}%), engagement tier score (${engagementRate}%), growth consistency (${growthConsistency}%), and location fit (${locationMatch}%).`;

    return {
      overall,
      nicheMatch,
      audienceRelevance,
      audienceQuality,
      engagementRate,
      growthConsistency,
      locationMatch,
      contentQuality,
      recommendation,
      strengths,
      concerns,
      reasoning,
    };
  }

  /**
   * Tiered engagement rate scoring based on industry benchmarks per follower tier.
   * Larger accounts have lower benchmark rates (they get more passive followers).
   */
  private calculateEngagementScore(engagementRate: number, followers: number): number {
    if (!engagementRate || engagementRate <= 0) return 20;

    let benchmark: number;

    if (followers >= 1_000_000) {
      benchmark = 1.0;
    } else if (followers >= 500_000) {
      benchmark = 1.5;
    } else if (followers >= 100_000) {
      benchmark = 2.0;
    } else if (followers >= 10_000) {
      benchmark = 3.5;
    } else if (followers >= 1_000) {
      benchmark = 5.0;
    } else {
      benchmark = 7.0; // Nano / micro: expected to have highest engagement
    }

    const ratio = engagementRate / benchmark;

    let score: number;
    if (ratio >= 2.0) score = 100;  // 2× benchmark = Elite
    else if (ratio >= 1.5) score = 90;   // 1.5× = Excellent
    else if (ratio >= 1.2) score = 80;   // 1.2× = Very Good
    else if (ratio >= 1.0) score = 70;   // At benchmark = Good
    else if (ratio >= 0.8) score = 60;   // 0.8× = Acceptable
    else if (ratio >= 0.6) score = 50;   // 0.6× = Below Average
    else if (ratio >= 0.4) score = 40;   // 0.4× = Poor
    else if (ratio >= 0.2) score = 30;   // 0.2× = Very Poor
    else score = 20;                     // <0.2× = Extremely Poor

    // Absolute follower floor: engagement rate is meaningless (and wildly
    // inflated) when a profile has almost no followers. Cap the score.
    if (followers < 50)  return Math.min(score, 25);
    if (followers < 200) return Math.min(score, 55);

    return score;
  }

  /**
   * Audience Quality Score based on:
   * - Follower / following ratio (authenticity indicator)
   * - Posts per follower (content consistency)
   * - Verified badge
   */
  private calculateAudienceQualityScore(influencer: InfluencerData): number {
    let score = 50; // Base score

    const followers = influencer.followers || 0;
    const following = influencer.instagramFollowsCount || 0;
    const mediaCount = influencer.instagramMediaCount || 0;

    // Follower-to-following ratio
    if (following > 0) {
      const ratio = followers / following;
      if (ratio >= 10) score += 20;      // Very organic growth
      else if (ratio >= 3) score += 15;  // Good ratio
      else if (ratio >= 1) score += 10;  // Decent ratio
      else if (ratio < 0.5) score -= 20; // Follow-for-follow behaviour
    }

    // Posts per follower (activity & content density)
    if (followers > 0 && mediaCount > 0) {
      const postsPerFollower = mediaCount / followers;
      if (postsPerFollower >= 0.05) score += 15;    // Very active
      else if (postsPerFollower >= 0.02) score += 10; // Active
      else if (postsPerFollower < 0.001) score -= 10; // Inactive / bought followers
    } else if (mediaCount === 0) {
      score -= 10; // No posts is a red flag
    }

    // Verified badge
    if (influencer.isVerified) score += 15;

    // Absolute follower floor: ratio & posts-per-follower metrics are
    // meaningless (and inflated) when a profile has almost no followers.
    if (followers < 50) score -= 30;
    else if (followers < 200) score -= 15;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Growth & Consistency Score based on profile analysis snapshots:
   * - Follower growth rate (healthy vs suspicious)
   * - Engagement rate consistency across snapshots
   */
  private calculateGrowthConsistencyScore(
    snapshots?: Array<{ syncNumber: number; totalFollowers: number; avgEngagementRate: number }>,
  ): number {
    if (!snapshots || snapshots.length < 2) return 30; // Insufficient data — slightly below neutral

    // Sort ascending by syncNumber to calculate growth over time
    const sorted = [...snapshots].sort((a, b) => a.syncNumber - b.syncNumber);

    const oldest = sorted[0];
    const latest = sorted[sorted.length - 1];

    // Guard against zero / null followers
    const oldestFollowers = oldest.totalFollowers || 1;
    const latestFollowers = latest.totalFollowers || oldestFollowers;

    const followerGrowth = ((latestFollowers - oldestFollowers) / oldestFollowers) * 100;

    let score = 50;
    if (followerGrowth >= 5 && followerGrowth <= 50) score = 90;       // Healthy growth
    else if (followerGrowth >= 2 && followerGrowth <= 100) score = 80; // Good growth
    else if (followerGrowth >= 0 && followerGrowth <= 200) score = 70; // Positive
    else if (followerGrowth > 200) score = 75;                          // Viral / rapid growth — rewarded, not penalised
    else if (followerGrowth >= -5) score = 40;                          // Slight drop (−5% to 0%) — mildly concerning
    else score = 30;                                                     // > −5% loss — losing followers

    // Check engagement consistency across snapshots
    const engagementRates = sorted
      .map(s => Number(s.avgEngagementRate) || 0)
      .filter(r => r > 0);

    if (engagementRates.length >= 2) {
      const avg = engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length;
      const variance = engagementRates.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / engagementRates.length;
      const stdDev = Math.sqrt(variance);

      // Low std deviation = consistent engagement (bonus)
      const consistencyBonus = stdDev < 1.0 ? 10 : (stdDev < 2.0 ? 5 : 0);
      score = Math.min(100, score + consistencyBonus);
    }

    return score;
  }

  private readonly NICHE_RELATIONSHIPS: { [key: string]: string[] } = {
    // Beauty cluster — tightly related to each other, NOT to generic lifestyle/travel
    'skincare': ['beauty', 'makeup', 'cosmetics', 'wellness', 'self-care'],
    'makeup': ['beauty', 'skincare', 'cosmetics', 'fashion'],
    'beauty': ['skincare', 'makeup', 'cosmetics', 'self-care', 'wellness'],
    'fashion': ['beauty', 'style', 'clothing', 'accessories', 'lifestyle'],
    // Travel cluster — lifestyle is OK for travel but NOT beauty
    'travel': ['adventure', 'photography', 'food', 'culture'],
    'lifestyle': ['fashion', 'food', 'fitness', 'travel', 'personal-growth'],
    // Fitness / wellness cluster
    'fitness': ['health', 'wellness', 'nutrition', 'sports', 'lifestyle'],
    'wellness': ['fitness', 'health', 'meditation', 'self-care', 'nutrition'],
    // Other clusters
    'food': ['cooking', 'restaurants', 'travel', 'lifestyle', 'wellness'],
    'technology': ['gadgets', 'gaming', 'reviews'],
    'spiritual': ['meditation', 'wellness', 'motivation', 'religion'],
    'spirituality': ['meditation', 'wellness', 'motivation', 'religion', 'culture'],
  };

  private areNichesRelated(niche1: string, niche2: string): boolean {
    const n1 = niche1.toLowerCase();
    const n2 = niche2.toLowerCase();

    const related1 = this.NICHE_RELATIONSHIPS[n1] || [];
    if (related1.some(r => n2.includes(r) || r.includes(n2))) return true;

    const related2 = this.NICHE_RELATIONSHIPS[n2] || [];
    if (related2.some(r => n1.includes(r) || r.includes(n1))) return true;

    return false;
  }

  private calculateNicheMatch(
    influencerNiches: string[],
    campaignNiches: string[],
  ): number {
    // No campaign niches = broad campaign, accept most influencers
    if (!campaignNiches || campaignNiches.length === 0) return 70;

    // No influencer niches detected = can't verify relevance (RISKY)
    if (!influencerNiches || influencerNiches.length === 0) return 20;

    // Find exact matches (case-insensitive)
    const exactMatches = influencerNiches.filter(iNiche =>
      campaignNiches.some(cNiche =>
        iNiche.toLowerCase() === cNiche.toLowerCase()
      )
    );

    // Find partial matches (one contains the other)
    const partialMatches = influencerNiches.filter(iNiche =>
      campaignNiches.some(cNiche =>
        iNiche.toLowerCase().includes(cNiche.toLowerCase()) ||
        cNiche.toLowerCase().includes(iNiche.toLowerCase())
      )
    );

    // Find related niches using predefined mapping
    const relatedMatches = influencerNiches.filter(iNiche =>
      campaignNiches.some(cNiche => this.areNichesRelated(iNiche, cNiche))
    );

    const totalMatches = new Set([...exactMatches, ...partialMatches, ...relatedMatches]).size;
    const requiredMatches = campaignNiches.length;

    // Strict scoring based on match quality
    if (exactMatches.length >= requiredMatches) return 100;           // Perfect match
    if (totalMatches >= requiredMatches) return 85;                   // Very good
    if (totalMatches >= requiredMatches * 0.7) return 70;            // Good
    if (totalMatches >= requiredMatches * 0.5) return 50;            // Partial
    if (partialMatches.length > 0 || relatedMatches.length > 0) return 30; // Weak
    return 10;  // NO MATCH = Very Poor
  }

  /**
   * Audience Relevance = reach score (40%) + demographic match (60%).
   * Falls back to reach-only when no demographic data is available.
   */
  private calculateAudienceRelevance(followers: number, demographicScore?: number): number {
    let reachScore: number;
    if (followers >= 100000) reachScore = 90;
    else if (followers >= 50000) reachScore = 80;
    else if (followers >= 10000) reachScore = 70;
    else if (followers >= 5000) reachScore = 60;
    else if (followers >= 1000) reachScore = 50;
    else if (followers >= 500) reachScore = 40;
    else if (followers >= 100) reachScore = 30;
    else if (followers >= 10) reachScore = 20;
    else reachScore = 10;

    if (demographicScore === undefined) return reachScore;

    // Combine: reach 40% + demographic relevance 60%
    return Math.round(reachScore * 0.4 + demographicScore * 0.6);
  }

  /**
   * Demographic match score (0-100) based on:
   * - Gender split of influencer's audience vs campaign's gender targeting (50%)
   * - Age distribution of influencer's audience vs campaign's age targeting (50%)
   * Returns 50 (neutral) when no demographic data is available.
   */
  private calculateDemographicMatch(
    audienceAgeGender: Array<{ ageRange: string; gender?: string; percentage: number }> | undefined,
    campaign: CampaignData,
  ): number {
    if (!audienceAgeGender || audienceAgeGender.length === 0) return 0; // No data — cannot verify demographic match

    // ── Gender match ─────────────────────────────────────────────────────────
    let genderScore = 100;
    if (!campaign.isOpenToAllGenders && campaign.genderPreferences && campaign.genderPreferences.length > 0) {
      const preferred = campaign.genderPreferences.map(g => g.toLowerCase());
      const matchingPct = audienceAgeGender
        .filter(d => {
          if (!d.gender) return false;
          const g = d.gender.toLowerCase();
          // Accept 'male'/'m', 'female'/'f' normalisation
          return preferred.some(p => g === p || g[0] === p[0]);
        })
        .reduce((sum, d) => sum + (d.percentage || 0), 0);
      genderScore = Math.min(100, Math.round(matchingPct));
    }

    // ── Age match ────────────────────────────────────────────────────────────
    // Aggregate by ageRange first to avoid double-counting when entries are
    // age+gender combined (e.g. 18-24/M: 20% + 18-24/F: 18% → 18-24: 38%)
    let ageScore = 100;
    if (!campaign.isOpenToAllAges && (campaign.minAge || campaign.maxAge)) {
      const minAge = campaign.minAge || 0;
      const maxAge = campaign.maxAge || 100;

      // Collapse all gender variants into a single percentage per age range
      const ageRangeTotals = new Map<string, number>();
      for (const d of audienceAgeGender) {
        ageRangeTotals.set(d.ageRange, (ageRangeTotals.get(d.ageRange) || 0) + (d.percentage || 0));
      }

      let matchingPct = 0;
      for (const [ageRange, pct] of ageRangeTotals) {
        const parts = ageRange.replace('+', '-100').split('-');
        const rangeMin = parseInt(parts[0]) || 0;
        const rangeMax = parseInt(parts[1]) || 100;
        if (rangeMin <= maxAge && rangeMax >= minAge) matchingPct += pct;
      }
      ageScore = Math.min(100, Math.round(matchingPct));
    }

    return Math.round(genderScore * 0.5 + ageScore * 0.5);
  }

  private calculateLocationMatch(
    influencerLocation: string,
    targetCities: string[],
    isPanIndia: boolean,
  ): number {
    if (isPanIndia) return 70; // Neutral — reaches all India but not specifically targeted
    if (!targetCities || targetCities.length === 0) return 70;

    const matches = targetCities.some((city) =>
      influencerLocation.toLowerCase().includes(city.toLowerCase()),
    );

    return matches ? 100 : 0; // Hard mismatch when city doesn't match
  }
}
