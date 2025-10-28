import { ApiProperty } from '@nestjs/swagger';

export class InfluencerScoreBreakdown {
  @ApiProperty({
    description: 'Niche match score (0-100)',
    example: 85.5,
  })
  nicheMatchScore: number;

  @ApiProperty({
    description: 'Engagement rate score (0-100)',
    example: 72.3,
  })
  engagementRateScore: number;

  @ApiProperty({
    description: 'Audience relevance score (0-100)',
    example: 90.0,
  })
  audienceRelevanceScore: number;

  @ApiProperty({
    description: 'Location match score (0-100)',
    example: 100.0,
  })
  locationMatchScore: number;

  @ApiProperty({
    description: 'Past performance score (0-100)',
    example: 65.0,
  })
  pastPerformanceScore: number;

  @ApiProperty({
    description: 'Collaboration charges match score (0-100)',
    example: 80.0,
  })
  collaborationChargesScore: number;

  @ApiProperty({
    description: 'Overall weighted score (0-100)',
    example: 81.2,
  })
  overallScore: number;

  @ApiProperty({
    description: 'Recommendation level based on overall score',
    example: 'highly_recommended',
    enum: ['highly_recommended', 'recommended', 'consider', 'not_recommended'],
  })
  recommendationLevel: string;
}

export class TopInfluencerDto {
  @ApiProperty({ description: 'Influencer ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Influencer name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Username', example: 'johndoe' })
  username: string;

  @ApiProperty({
    description: 'Profile image URL',
    example: 'https://s3.amazonaws.com/profile.jpg',
  })
  profileImage: string;

  @ApiProperty({
    description: 'Bio/description',
    example: 'Fashion and lifestyle influencer',
  })
  bio: string;

  @ApiProperty({
    description: 'Profile headline',
    example: 'Inspiring lives through fashion',
  })
  profileHeadline: string;

  @ApiProperty({
    description: 'City name',
    example: 'Mumbai',
  })
  city: string;

  @ApiProperty({
    description: 'Country name',
    example: 'India',
  })
  country: string;

  @ApiProperty({
    description: 'Total followers count',
    example: 150000,
  })
  followersCount: number;

  @ApiProperty({
    description: 'Average engagement rate percentage',
    example: 4.5,
  })
  engagementRate: number;

  @ApiProperty({
    description: 'Number of posts',
    example: 50,
  })
  postsCount: number;

  @ApiProperty({
    description: 'Number of completed campaigns',
    example: 12,
  })
  completedCampaigns: number;

  @ApiProperty({
    description: 'Niches',
    type: [String],
    example: ['Fashion', 'Lifestyle', 'Beauty'],
  })
  niches: string[];

  @ApiProperty({
    description: 'Collaboration costs for Instagram post',
    example: 25000,
  })
  instagramPostCost: number;

  @ApiProperty({
    description: 'Collaboration costs for Instagram reel',
    example: 35000,
  })
  instagramReelCost: number;

  @ApiProperty({
    description: 'Scoring breakdown for this influencer',
    type: InfluencerScoreBreakdown,
  })
  scoreBreakdown: InfluencerScoreBreakdown;
}

export class TopInfluencersResponseDto {
  @ApiProperty({
    description: 'List of top influencers with scores',
    type: [TopInfluencerDto],
  })
  influencers: TopInfluencerDto[];

  @ApiProperty({
    description: 'Total number of influencers found',
    example: 150,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Results per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;

  @ApiProperty({
    description: 'Weights used for scoring',
    example: {
      nicheMatchWeight: 30,
      engagementRateWeight: 25,
      audienceRelevanceWeight: 15,
      locationMatchWeight: 15,
      pastPerformanceWeight: 10,
      collaborationChargesWeight: 5,
    },
  })
  appliedWeights: {
    nicheMatchWeight: number;
    engagementRateWeight: number;
    audienceRelevanceWeight: number;
    locationMatchWeight: number;
    pastPerformanceWeight: number;
    collaborationChargesWeight: number;
  };
}
