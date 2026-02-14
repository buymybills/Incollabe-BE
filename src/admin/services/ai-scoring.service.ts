import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  InfluencerData,
  CampaignData,
  AIScoreResult,
} from '../interfaces/ai-scoring.interface';
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
    // Gemini is the primary AI scorer
    if (this.geminiAIService.isAvailable()) {
      try {
        return await this.geminiScoring(influencer, campaign);
      } catch (error) {
        console.error('Gemini scoring error, falling back to OpenAI:', error);
      }
    }

    // OpenAI as secondary
    if (this.openai) {
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
        const result = JSON.parse(content);
        return this.normalizeAIResponse(result, influencer, campaign);
      } catch (error) {
        console.error('OpenAI scoring error, falling back to deterministic:', error);
      }
    }

    // Deterministic fallback
    return this.fallbackScoring(influencer, campaign);
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
    const audienceRelevance = this.calculateAudienceRelevance(influencer.followers);
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
    const pastPerformance   = influencer.pastCampaigns.successRate || 50;
    const contentQuality    = influencer.isVerified ? 80 : 60;

    // ── Build compact Gemini prompt ─────────────────────────────────────────
    const prompt = `You are an influencer-campaign match analyst. Given the data below, return ONLY valid JSON.

Influencer: ${influencer.name} (@${influencer.username})
  Followers: ${influencer.followers} | Follows: ${influencer.instagramFollowsCount ?? 'N/A'} | Media: ${influencer.instagramMediaCount ?? 'N/A'}
  Verified: ${influencer.isVerified} | Location: ${influencer.location}
  Niches: ${influencer.niches.join(', ') || 'Not specified'}
  Bio: ${influencer.bio || 'N/A'}
  Engagement rate: ${influencer.postPerformance?.engagementRate?.toFixed(2) ?? 'N/A'}%
  Past campaigns: ${influencer.pastCampaigns.total} (success rate ${influencer.pastCampaigns.successRate}%)

Campaign: "${campaign.name}"
  Description: ${campaign.description || 'N/A'}
  Required niches: ${campaign.niches.join(', ') || 'Any'}
  Targeting: ${campaign.isPanIndia ? 'Pan India' : campaign.targetCities.join(', ')}
  Type: ${campaign.campaignType}

Pre-calculated component scores (0-100):
  audienceRelevance: ${audienceRelevance}
  audienceQuality: ${audienceQuality}
  engagementRate: ${engagementRate}
  growthConsistency: ${growthConsistency}
  locationMatch: ${locationMatch}
  pastPerformance: ${pastPerformance}
  contentQuality: ${contentQuality}

Your task:
1. Evaluate nicheMatch (0-100) — how well do the influencer's niches align with the campaign's required niches?
   Be precise: exact match = 80-100, related = 40-70, unrelated = 0-30.
2. Calculate overall as the weighted average:
   nicheMatch×0.25 + audienceRelevance×0.10 + audienceQuality×0.10 + engagementRate×0.25
   + growthConsistency×0.10 + locationMatch×0.10 + pastPerformance×0.05 + contentQuality×0.05
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
    const rawOverall = Math.round(
      nicheMatch       * 0.25 +
      audienceRelevance * 0.10 +
      audienceQuality   * 0.10 +
      engagementRate    * 0.25 +
      growthConsistency * 0.10 +
      locationMatch     * 0.10 +
      pastPerformance   * 0.05 +
      contentQuality    * 0.05,
    );

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
      pastPerformance,
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
7. **pastPerformance** (0-100): How reliable is the influencer based on past campaigns?
8. **contentQuality** (0-100): How good is the influencer's profile and content quality?

**Calculate overall score** as weighted average:
- nicheMatch × 25%
- audienceRelevance × 10%
- audienceQuality × 10%
- engagementRate × 25%
- growthConsistency × 10%
- locationMatch × 10%
- pastPerformance × 5%
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
  "pastPerformance": <number>,
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
      pastPerformance: Math.round(response.pastPerformance || 0),
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
    const audienceRelevance = this.calculateAudienceRelevance(influencer.followers);
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
    const pastPerformance = influencer.pastCampaigns.successRate || 50;
    const contentQuality = influencer.isVerified ? 80 : 60;

    // Proposed weights:
    // nicheMatch × 0.25, audienceRelevance × 0.10, audienceQuality × 0.10,
    // engagementRate × 0.25, growthConsistency × 0.10,
    // locationMatch × 0.10, pastPerformance × 0.05, contentQuality × 0.05
    const rawScore = Math.round(
      nicheMatch * 0.25 +
        audienceRelevance * 0.10 +
        audienceQuality * 0.10 +
        engagementRate * 0.25 +
        growthConsistency * 0.10 +
        locationMatch * 0.10 +
        pastPerformance * 0.05 +
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
    } else if (locationMatch < 70) {
      concerns.push('Location may not align with primary campaign targets');
    }

    // Past Performance analysis
    if (influencer.pastCampaigns.total > 0) {
      if (pastPerformance >= 70) {
        strengths.push(`Proven track record with ${influencer.pastCampaigns.total} past campaigns`);
      } else if (pastPerformance < 50) {
        concerns.push('Past campaign performance shows room for improvement');
      }
    } else {
      concerns.push('No past campaign history to evaluate');
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
      pastPerformance,
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
    if (!snapshots || snapshots.length < 2) return 50; // Not enough data

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
    else if (followerGrowth > 200) score = 40;                          // Suspicious spike
    else if (followerGrowth < -5) score = 30;                           // Losing followers

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

  private calculateAudienceRelevance(followers: number): number {
    if (followers >= 100000) return 90;
    if (followers >= 50000) return 80;
    if (followers >= 10000) return 70;
    if (followers >= 5000) return 60;
    if (followers >= 1000) return 50;  // Micro-influencer
    if (followers >= 500) return 40;
    if (followers >= 100) return 30;
    if (followers >= 10) return 20;
    return 10; // < 10 followers — not a real influencer
  }

  private calculateLocationMatch(
    influencerLocation: string,
    targetCities: string[],
    isPanIndia: boolean,
  ): number {
    if (isPanIndia) return 100;
    if (!targetCities || targetCities.length === 0) return 100;

    const matches = targetCities.some((city) =>
      influencerLocation.toLowerCase().includes(city.toLowerCase()),
    );

    return matches ? 100 : 50;
  }
}
