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
}

export interface CampaignData {
  id: number;
  name: string;
  description?: string;
  niches: string[];
  targetCities: string[];
  isPanIndia: boolean;
  campaignType: string;
}

export interface AIScoreResult {
  overall: number;
  nicheMatch: number;
  audienceRelevance: number;
  engagementRate: number;
  locationMatch: number;
  pastPerformance: number;
  contentQuality: number;
  recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
  strengths: string[];
  concerns: string[];
  reasoning: string;
}
