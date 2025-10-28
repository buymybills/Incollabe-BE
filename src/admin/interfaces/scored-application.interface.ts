import { ApplicationStatus } from '../../campaign/models/campaign-application.model';

export interface AIScore {
  overall: number;
  nicheMatch: number;
  audienceRelevance: number;
  engagementRate: number;
  locationMatch: number;
  pastPerformance: number;
  contentQuality: number;
}

export interface ScoredApplication {
  applicationId: number;
  influencer: {
    id: number;
    name: string;
    username: string;
    profileImage?: string;
    followers: number;
    engagementRate: number;
    niches: string[];
    location: string;
  };
  aiScore: number;
  recommendation: 'Highly Recommended' | 'Recommended' | 'Consider';
  strengths: string[];
  concerns: string[];
  appliedAt: Date;
  status: ApplicationStatus;
  scoreBreakdown: AIScore;
}
