import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  InfluencerData,
  CampaignData,
  AIScoreResult,
} from '../interfaces/ai-scoring.interface';

@Injectable()
export class AIScoringService {
  private openai: OpenAI | null;

  constructor(private configService: ConfigService) {
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
    if (!this.openai) {
      // Fallback to basic scoring if OpenAI not configured
      return this.fallbackScoring(influencer, campaign);
    }

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
      if (!content) {
        throw new Error('OpenAI returned empty response');
      }
      const result = JSON.parse(content);
      return this.normalizeAIResponse(result);
    } catch (error) {
      console.error('AI scoring error:', error);
      // Fallback to basic scoring on error
      return this.fallbackScoring(influencer, campaign);
    }
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
2. **audienceRelevance** (0-100): How relevant is the influencer's audience size and demographics?
3. **engagementRate** (0-100): How good is the influencer's engagement with their audience?
4. **locationMatch** (0-100): Does the influencer's location match campaign targeting?
5. **pastPerformance** (0-100): How reliable is the influencer based on past campaigns?
6. **contentQuality** (0-100): How good is the influencer's profile and content quality?

**Calculate overall score** as weighted average:
- nicheMatch × 30%
- audienceRelevance × 15%
- engagementRate × 25%
- locationMatch × 15%
- pastPerformance × 10%
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
  "engagementRate": <number>,
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

  private normalizeAIResponse(response: any): AIScoreResult {
    return {
      overall: Math.round(response.overall || 0),
      nicheMatch: Math.round(response.nicheMatch || 0),
      audienceRelevance: Math.round(response.audienceRelevance || 0),
      engagementRate: Math.round(response.engagementRate || 0),
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
    // Simple fallback logic when AI is not available
    const nicheMatch = this.calculateNicheMatch(
      influencer.niches,
      campaign.niches,
    );
    const audienceRelevance = this.calculateAudienceRelevance(
      influencer.followers,
    );
    const engagementRate = influencer.postPerformance?.engagementRate
      ? Math.min(influencer.postPerformance.engagementRate * 10, 100)
      : 50;
    const locationMatch = this.calculateLocationMatch(
      influencer.location,
      campaign.targetCities,
      campaign.isPanIndia,
    );
    const pastPerformance = influencer.pastCampaigns.successRate || 50;
    const contentQuality = influencer.isVerified ? 80 : 60;

    const overall = Math.round(
      nicheMatch * 0.3 +
        audienceRelevance * 0.15 +
        engagementRate * 0.25 +
        locationMatch * 0.15 +
        pastPerformance * 0.1 +
        contentQuality * 0.05,
    );

    let recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
    if (overall >= 80) recommendation = 'Highly Recommended';
    else if (overall >= 60) recommendation = 'Recommended';
    else recommendation = 'Consider';

    return {
      overall,
      nicheMatch,
      audienceRelevance,
      engagementRate,
      locationMatch,
      pastPerformance,
      contentQuality,
      recommendation,
      strengths: ['Fallback scoring - AI not configured'],
      concerns: [],
      reasoning: 'Using basic algorithmic scoring as AI is not configured.',
    };
  }

  private calculateNicheMatch(
    influencerNiches: string[],
    campaignNiches: string[],
  ): number {
    if (!campaignNiches || campaignNiches.length === 0) return 70;
    if (!influencerNiches || influencerNiches.length === 0) return 30;

    const matches = influencerNiches.filter((n) =>
      campaignNiches.some((cn) => cn.toLowerCase().includes(n.toLowerCase())),
    );

    if (matches.length === 0) return 30;
    if (matches.length >= campaignNiches.length) return 100;

    return 50 + (matches.length / campaignNiches.length) * 50;
  }

  private calculateAudienceRelevance(followers: number): number {
    if (followers >= 100000) return 90;
    if (followers >= 50000) return 80;
    if (followers >= 10000) return 70;
    if (followers >= 5000) return 60;
    return 50;
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
