import { ApiProperty } from '@nestjs/swagger';

export class NichePerformanceDto {
  @ApiProperty({ description: 'Niche name' })
  niche: string;

  @ApiProperty({ description: 'Number of posts in this niche' })
  count: number;

  @ApiProperty({ description: 'Average reach for this niche' })
  avgReach: number;

  @ApiProperty({ description: 'Average engagement for this niche' })
  avgEngagement: number;

  @ApiProperty({ description: 'Average impressions for this niche' })
  avgImpressions: number;
}

export class LanguageDistributionDto {
  @ApiProperty({ description: 'Language code (ISO 639-1)' })
  lang: string;

  @ApiProperty({ description: 'Number of posts in this language' })
  count: number;

  @ApiProperty({ description: 'Percentage of total posts' })
  percentage: number;
}

export class KeywordDto {
  @ApiProperty({ description: 'Keyword text' })
  keyword: string;

  @ApiProperty({ description: 'Number of times used' })
  count: number;
}

export class ContentStylesDto {
  @ApiProperty({ description: 'Content style percentages' })
  styles: {
    storytelling: number;
    simple: number;
    bold: number;
    medium: number;
  };

  @ApiProperty({ description: 'Dominant content style' })
  dominantStyle: string;
}

export class PaidCampaignByNicheDto {
  @ApiProperty({ description: 'Niche name' })
  niche: string;

  @ApiProperty({ description: 'Number of paid campaigns' })
  count: number;
}

export class TrendingTopicDto {
  @ApiProperty({ description: 'Hashtag' })
  tag: string;

  @ApiProperty({ description: 'Number of times used' })
  count: number;
}

export class InstagramProfileAnalysisResponseDto {
  @ApiProperty({ description: 'Number of posts analyzed' })
  postsAnalyzed: number;

  @ApiProperty({ description: 'Start date of analysis period' })
  analysisPeriodStart: Date;

  @ApiProperty({ description: 'End date of analysis period' })
  analysisPeriodEnd: Date;

  @ApiProperty({ description: 'Top 5 niches by count', type: [NichePerformanceDto] })
  topNiches: NichePerformanceDto[];

  @ApiProperty({ description: 'Niches ranked by performance', type: [NichePerformanceDto] })
  nichePerformance: NichePerformanceDto[];

  @ApiProperty({ description: 'Content style analysis', type: ContentStylesDto })
  contentStyles: ContentStylesDto;

  @ApiProperty({ description: 'Dominant content style' })
  dominantStyle: string;

  @ApiProperty({ description: 'Number of paid campaigns detected' })
  paidCampaignsCount: number;

  @ApiProperty({ description: 'Paid campaigns by niche', type: [PaidCampaignByNicheDto] })
  paidCampaignsByNiche: PaidCampaignByNicheDto[];

  @ApiProperty({ description: 'Languages used', type: [LanguageDistributionDto] })
  languagesUsed: LanguageDistributionDto[];

  @ApiProperty({ description: 'Primary language' })
  primaryLanguage: string;

  @ApiProperty({ description: 'Top 10 keywords', type: [KeywordDto] })
  topKeywords: KeywordDto[];

  @ApiProperty({ description: 'Suggested keywords', type: [KeywordDto] })
  suggestedKeywords: KeywordDto[];

  @ApiProperty({ description: 'Average engagement rate (percentage)' })
  avgEngagementRate: number;

  @ApiProperty({ description: 'Average reach per post' })
  avgReach: number;

  @ApiProperty({ description: 'Average impressions per post' })
  avgImpressions: number;

  @ApiProperty({ description: 'Total likes across all analyzed posts' })
  totalLikes: number;

  @ApiProperty({ description: 'Total comments across all analyzed posts' })
  totalComments: number;

  @ApiProperty({ description: 'Total shares across all analyzed posts' })
  totalShares: number;

  @ApiProperty({ description: 'Total saves across all analyzed posts' })
  totalSaves: number;

  @ApiProperty({ description: 'Content relevance score (0-100)' })
  relevanceScore: number;

  @ApiProperty({ description: 'Trending hashtags', type: [TrendingTopicDto] })
  trendingTopics: TrendingTopicDto[];
}

export class GrowthMetricsDto {
  @ApiProperty({ description: 'Follower growth data' })
  followers: {
    start: number;
    end: number;
    growthCount: number;
    growthPercentage: number;
  };

  @ApiProperty({ description: 'Engagement rate change' })
  engagement: {
    start: number;
    end: number;
    changePercentage: number;
  };

  @ApiProperty({ description: 'Media count change' })
  mediaCount: {
    start: number;
    end: number;
    postsAdded: number;
  };
}

export class GetProfileAnalysisDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  user_id: number;

  @ApiProperty({ description: 'User type', enum: ['influencer', 'brand'], example: 'influencer' })
  user_type: 'influencer' | 'brand';
}
