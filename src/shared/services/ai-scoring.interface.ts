export interface InfluencerData {
  id: number;
  name: string;
  username: string;
  followers: number;
  niches: string[];
  location: string;
  isVerified: boolean;
  bio?: string;
  pastCampaigns: {
    total: number;
    successRate: number;
  };
  postPerformance?: {
    totalPosts: number;
    averageLikes: number;
    engagementRate: number;
  };
  // For audience quality scoring
  instagramFollowsCount?: number;
  instagramMediaCount?: number;
  // For growth & consistency scoring (sorted ASC by syncNumber)
  profileSnapshots?: Array<{
    syncNumber: number;
    totalFollowers: number;
    avgEngagementRate: number;
  }>;
  // Pre-calculated content quality score from influencer_profile_scores
  contentQualityScore: number;
  // Audience demographics from latest Instagram profile analysis
  audienceAgeGender?: Array<{ ageRange: string; gender?: string; percentage: number }>;
}

export interface CampaignData {
  id: number;
  name: string;
  description?: string;
  niches: string[];
  targetCities: string[];
  isPanIndia: boolean;
  campaignType: string;
  // Demographic targeting
  genderPreferences?: string[];
  isOpenToAllGenders?: boolean;
  minAge?: number;
  maxAge?: number;
  isOpenToAllAges?: boolean;
}

export interface AIScoreResult {
  overall: number;
  nicheMatch: number;
  audienceRelevance: number;
  audienceQuality: number;
  engagementRate: number;
  growthConsistency: number;
  locationMatch: number;
  contentQuality: number;
  recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
  strengths: string[];
  concerns: string[];
  reasoning: string;
}
