// import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
// import { InjectModel } from '@nestjs/sequelize';
// import { Op } from 'sequelize';
// import axios from 'axios';
// import { Influencer } from '../../auth/model/influencer.model';
// import { Brand } from '../../brand/model/brand.model';
// import { InstagramMedia } from '../models/instagram-media.model';
// import { InstagramMediaInsight } from '../models/instagram-media-insight.model';
// import { InstagramMediaAnalysis } from '../models/instagram-media-analysis.model';
// import { InstagramProfileGrowth } from '../models/instagram-profile-growth.model';
// import { InstagramProfileAnalysis } from '../models/instagram-profile-analysis.model';
// import { TextAnalysisUtil } from '../utils/text-analysis.util';
// import { NicheDetectionUtil } from '../utils/niche-detection.util';
// import { VisualAnalysisUtil } from '../utils/visual-analysis.util';
// import { InstagramService } from './instagram.service';

// export type UserType = 'influencer' | 'brand';

// interface MediaWithInsights {
//   mediaId: string;
//   caption: string;
//   mediaType: string;
//   mediaProductType: string;
//   timestamp: Date;
//   permalink: string;
//   insights?: {
//     reach: number;
//     impressions: number;
//     likes: number;
//     comments: number;
//     shares: number;
//     saved: number;
//     plays: number;
//   };
// }

// @Injectable()
// export class InstagramProfileAnalysisService {
//   constructor(
//     @InjectModel(Influencer)
//     private influencerModel: typeof Influencer,
//     @InjectModel(Brand)
//     private brandModel: typeof Brand,
//     @InjectModel(InstagramMedia)
//     private instagramMediaModel: typeof InstagramMedia,
//     @InjectModel(InstagramMediaInsight)
//     private instagramMediaInsightModel: typeof InstagramMediaInsight,
//     @InjectModel(InstagramMediaAnalysis)
//     private instagramMediaAnalysisModel: typeof InstagramMediaAnalysis,
//     @InjectModel(InstagramProfileGrowth)
//     private instagramProfileGrowthModel: typeof InstagramProfileGrowth,
//     @InjectModel(InstagramProfileAnalysis)
//     private instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
//     @Inject(forwardRef(() => InstagramService))
//     private instagramService: InstagramService,
//   ) {}

//   /**
//    * Fetch and store Instagram media with full details
//    * @param userId - User ID
//    * @param userType - User type
//    * @param limit - Number of media to fetch (default: 50)
//    */
//   async fetchAndStoreMedia(
//     userId: number,
//     userType: UserType,
//     limit: number = 50,
//   ): Promise<MediaWithInsights[]> {
//     // Get user
//     const user = await this.getUser(userId, userType);

//     if (!user.instagramAccessToken || !user.instagramUserId) {
//       throw new BadRequestException('No Instagram account connected');
//     }

//     try {
//       // Fetch media from Instagram using Facebook Graph API
//       const fields = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
//       const response = await axios.get(
//         `https://graph.facebook.com/v24.0/${user.instagramUserId}/media`,
//         {
//           params: {
//             fields,
//             limit,
//             access_token: user.instagramAccessToken,
//           },
//         }
//       );

//       const mediaList: MediaWithInsights[] = [];

//       // Store each media item
//       for (const item of response.data.data) {
//         // Store in instagram_media table
//         const [mediaRecord] = await this.instagramMediaModel.findOrCreate({
//           where: { mediaId: item.id },
//           defaults: {
//             influencerId: userType === 'influencer' ? userId : undefined,
//             brandId: userType === 'brand' ? userId : undefined,
//             mediaId: item.id,
//             caption: item.caption || '',
//             mediaType: item.media_type,
//             mediaProductType: item.media_product_type,
//             mediaUrl: item.media_url,
//             thumbnailUrl: item.thumbnail_url,
//             permalink: item.permalink,
//             timestamp: new Date(item.timestamp),
//             firstFetchedAt: new Date(),
//             lastSyncedAt: new Date(),
//           },
//         });

//         // Update if exists
//         if (mediaRecord) {
//           await mediaRecord.update({
//             caption: item.caption || '',
//             mediaType: item.media_type,
//             mediaProductType: item.media_product_type,
//             mediaUrl: item.media_url,
//             thumbnailUrl: item.thumbnail_url,
//             permalink: item.permalink,
//             lastSyncedAt: new Date(),
//           });
//         }

//         // Try to fetch insights for this media
//         let insights: any = {};
//         try {
//           const insightsResponse = await this.fetchMediaInsights(
//             user.instagramAccessToken,
//             item.id,
//             item.media_type,
//             item.media_product_type
//           );
//           insights = insightsResponse;
//         } catch (error) {
//           console.log(`Could not fetch insights for media ${item.id}:`, error.message);
//         }

//         mediaList.push({
//           mediaId: item.id,
//           caption: item.caption || '',
//           mediaType: item.media_type,
//           mediaProductType: item.media_product_type,
//           timestamp: new Date(item.timestamp),
//           permalink: item.permalink,
//           insights,
//         });
//       }

//       return mediaList;
//     } catch (error) {
//       if (axios.isAxiosError(error)) {
//         throw new BadRequestException(
//           `Failed to fetch Instagram media: ${error.response?.data?.error?.message || error.message}`
//         );
//       }
//       throw error;
//     }
//   }

//   /**
//    * Fetch insights for a specific media
//    */
//   private async fetchMediaInsights(
//     accessToken: string,
//     mediaId: string,
//     mediaType: string,
//     mediaProductType: string
//   ): Promise<any> {
//     let metrics: string;

//     if (mediaProductType === 'REELS' || mediaType === 'REELS') {
//       metrics = 'plays,reach,total_interactions,saved,shares,comments,likes';
//     } else if (mediaType === 'VIDEO') {
//       metrics = 'reach,saved,plays,likes,comments,shares';
//     } else if (mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM') {
//       metrics = 'reach,saved,likes,comments,shares';
//     } else {
//       metrics = 'reach,saved,shares';
//     }

//     const response = await axios.get(
//       `https://graph.facebook.com/v24.0/${mediaId}/insights`,
//       {
//         params: {
//           metric: metrics,
//           access_token: accessToken,
//         },
//       }
//     );

//     const insightsData: any = {};
//     response.data.data.forEach((metric: any) => {
//       const value = metric.values[0]?.value;
//       if (value !== undefined) {
//         if (metric.name === 'reach') insightsData.reach = value;
//         if (metric.name === 'impressions') insightsData.impressions = value;
//         if (metric.name === 'saved') insightsData.saved = value;
//         if (metric.name === 'likes') insightsData.likes = value;
//         if (metric.name === 'comments') insightsData.comments = value;
//         if (metric.name === 'plays') insightsData.plays = value;
//         if (metric.name === 'shares') insightsData.shares = value;
//         if (metric.name === 'total_interactions') insightsData.totalInteractions = value;
//       }
//     });

//     return insightsData;
//   }

//   /**
//    * Analyze a single media item
//    */
//   async analyzeMedia(mediaId: string, userId: number, userType: UserType): Promise<void> {
//     // Get media record
//     const media = await this.instagramMediaModel.findOne({
//       where: { mediaId },
//     });

//     if (!media) {
//       throw new NotFoundException(`Media ${mediaId} not found`);
//     }

//     const caption = media.caption || '';

//     // Extract hashtags and mentions
//     const hashtags = TextAnalysisUtil.extractHashtags(caption);
//     const mentions = TextAnalysisUtil.extractMentions(caption);

//     // Detect language
//     const detectedLanguage = TextAnalysisUtil.detectLanguage(caption);

//     // Extract keywords
//     const keywords = TextAnalysisUtil.extractKeywords(caption);

//     // Detect niches
//     const detectedNiches = NicheDetectionUtil.detectNiches(caption, hashtags, 5);
//     const primaryNiche = NicheDetectionUtil.getPrimaryNiche(caption, hashtags);

//     // Check if paid campaign
//     const isPaidCampaign = TextAnalysisUtil.isPaidCampaign(caption);

//     // Count words
//     const captionWordCount = TextAnalysisUtil.countWords(caption);

//     // Visual analysis
//     let visualAnalysis = {
//       isFaceless: false,
//       lightingScore: undefined as number | undefined,
//       aestheticsScore: undefined as number | undefined,
//       editingScore: undefined as number | undefined,
//       visualFeatures: undefined as any,
//     };

//     try {
//       if (media.mediaUrl) {
//         visualAnalysis = await VisualAnalysisUtil.analyzeMedia(media.mediaUrl, media.mediaType);
//       }
//     } catch (error) {
//       console.warn(`Visual analysis failed for media ${mediaId}:`, error.message);
//     }

//     // Store analysis - using findOrCreate + update pattern due to Sequelize upsert issues with underscored fields
//     const [analysis, created] = await this.instagramMediaAnalysisModel.findOrCreate({
//       where: { mediaId },
//       defaults: {
//         influencerId: userType === 'influencer' ? userId : null,
//         brandId: userType === 'brand' ? userId : null,
//         instagramMediaId: media.id,
//         mediaId,
//         detectedNiches,
//         primaryNiche,
//         detectedLanguage,
//         extractedKeywords: keywords,
//         hashtags,
//         isPaidCampaign,
//         captionWordCount,
//         hasLocation: false, // Can be enhanced with location data from Graph API
//         mentionCount: mentions.length,
//         isFacelessContent: visualAnalysis.isFaceless,
//         lightingScore: visualAnalysis.lightingScore,
//         aestheticsScore: visualAnalysis.aestheticsScore,
//         editingQualityScore: visualAnalysis.editingScore,
//         visualFeatures: visualAnalysis.visualFeatures,
//         analyzedAt: new Date(),
//       },
//     });

//     // Update if already exists
//     if (!created) {
//       await analysis.update({
//         influencerId: userType === 'influencer' ? userId : undefined,
//         brandId: userType === 'brand' ? userId : undefined,
//         instagramMediaId: media.id,
//         detectedNiches,
//         primaryNiche,
//         detectedLanguage,
//         extractedKeywords: keywords,
//         hashtags,
//         isPaidCampaign,
//         captionWordCount,
//         hasLocation: false,
//         mentionCount: mentions.length,
//         isFacelessContent: visualAnalysis.isFaceless,
//         lightingScore: visualAnalysis.lightingScore,
//         aestheticsScore: visualAnalysis.aestheticsScore,
//         editingQualityScore: visualAnalysis.editingScore,
//         visualFeatures: visualAnalysis.visualFeatures,
//         analyzedAt: new Date(),
//       });
//     }
//   }

//   /**
//    * Perform comprehensive profile analysis
//    */
//   async analyzeProfile(userId: number, userType: UserType): Promise<any> {
//     const user = await this.getUser(userId, userType);

//     if (!user.instagramUserId) {
//       throw new BadRequestException('No Instagram account connected');
//     }

//     // Step 1: Fetch and store 50 media items
//     console.log('Fetching media...');
//     const mediaList = await this.fetchAndStoreMedia(userId, userType, 50);

//     // Step 2: Analyze each media item
//     console.log('Analyzing media...');
//     for (const media of mediaList) {
//       await this.analyzeMedia(media.mediaId, userId, userType);
//     }

//     // Step 2.5: Fetch insights from Instagram for each media item
//     console.log('Fetching insights from Instagram...');
//     for (const media of mediaList) {
//       try {
//         await this.instagramService.getMediaInsights(userId, userType, media.mediaId);
//       } catch (error) {
//         // Continue even if some insights fail (e.g., permissions, old posts)
//         console.warn(`Failed to fetch insights for media ${media.mediaId}:`, error.message);
//       }
//     }

//     // Step 3: Get all analyzed media with insights
//     const analyzedMedia = await this.instagramMediaAnalysisModel.findAll({
//       where: userType === 'influencer' ? { influencerId: userId } : { brandId: userId },
//       include: [
//         {
//           model: this.instagramMediaModel,
//           as: 'instagramMedia',
//           required: true,
//         },
//       ],
//       limit: 50,
//       order: [['analyzedAt', 'DESC']],
//     });

//     // Step 4: Get insights for analyzed media
//     const mediaInsights = await this.instagramMediaInsightModel.findAll({
//       where: {
//         mediaId: { [Op.in]: analyzedMedia.map(m => m.mediaId) },
//       },
//       order: [['fetchedAt', 'DESC']],
//     });

//     // Create a map of media insights
//     const insightsMap = new Map();
//     mediaInsights.forEach(insight => {
//       if (!insightsMap.has(insight.mediaId)) {
//         insightsMap.set(insight.mediaId, insight);
//       }
//     });

//     // Step 4.5: Fetch audience demographics
//     console.log('Fetching audience demographics...');
//     let demographics: {
//       ageGender: Record<string, number>;
//       cities: Array<{ name: string; count: number; percentage: number }>;
//       countries: Array<{ code: string; count: number; percentage: number }>;
//       locales: Array<{ locale: string; count: number; percentage: number }>;
//     } = {
//       ageGender: {},
//       cities: [],
//       countries: [],
//       locales: [],
//     };
//     try {
//       demographics = await this.instagramService.getAudienceDemographics(userId, userType);
//     } catch (error) {
//       console.warn('Failed to fetch demographics:', error.message);
//     }

//     // Step 5: Aggregate analysis data
//     const analysis = this.aggregateAnalysis(analyzedMedia, insightsMap, user);

//     // Add demographics to analysis
//     analysis.audienceAgeGender = demographics.ageGender;
//     analysis.audienceCities = demographics.cities;
//     analysis.audienceCountries = demographics.countries;
//     analysis.targetAudienceSummary = this.generateAudienceSummary(demographics);

//     // Step 6: Store profile analysis
//     await this.instagramProfileAnalysisModel.upsert({
//       influencerId: userType === 'influencer' ? userId : undefined,
//       brandId: userType === 'brand' ? userId : undefined,
//       instagramUserId: user.instagramUserId,
//       instagramUsername: user.instagramUsername,
//       ...analysis,
//       analyzedAt: new Date(),
//     });

//     return analysis;
//   }

//   /**
//    * Get stored profile analysis from database
//    */
//   async getStoredProfileAnalysis(userId: number, userType: UserType): Promise<any> {
//     const user = await this.getUser(userId, userType);

//     if (!user.instagramUserId) {
//       throw new BadRequestException('No Instagram account connected');
//     }

//     // Get the most recent profile analysis
//     const profileAnalysis = await this.instagramProfileAnalysisModel.findOne({
//       where: userType === 'influencer' ? { influencerId: userId } : { brandId: userId },
//       order: [['analyzedAt', 'DESC']],
//     });

//     if (!profileAnalysis) {
//       throw new NotFoundException('No analysis found for this user. Please run /instagram/analyze-profile first.');
//     }

//     // Return the stored analysis data
//     return {
//       postsAnalyzed: profileAnalysis.postsAnalyzed,
//       analysisPeriodStart: profileAnalysis.analysisPeriodStart,
//       analysisPeriodEnd: profileAnalysis.analysisPeriodEnd,
//       topNiches: profileAnalysis.topNiches,
//       nichePerformance: profileAnalysis.nichePerformance,
//       contentStyles: profileAnalysis.contentStyles,
//       dominantStyle: profileAnalysis.dominantStyle,
//       paidCampaignsCount: profileAnalysis.paidCampaignsCount,
//       paidCampaignsByNiche: profileAnalysis.paidCampaignsByNiche,
//       languagesUsed: profileAnalysis.languagesUsed,
//       primaryLanguage: profileAnalysis.primaryLanguage,
//       topKeywords: profileAnalysis.topKeywords,
//       suggestedKeywords: profileAnalysis.suggestedKeywords,
//       avgEngagementRate: profileAnalysis.avgEngagementRate,
//       avgReach: profileAnalysis.avgReach,
//       avgImpressions: profileAnalysis.avgImpressions,
//       totalLikes: profileAnalysis.totalLikes,
//       totalComments: profileAnalysis.totalComments,
//       totalShares: profileAnalysis.totalShares,
//       totalSaves: profileAnalysis.totalSaves,
//       relevanceScore: profileAnalysis.relevanceScore,
//       trendingTopics: profileAnalysis.trendingTopics,
//       // Audience demographics
//       audienceAgeGender: profileAnalysis.audienceAgeGender,
//       audienceCities: profileAnalysis.audienceCities,
//       audienceCountries: profileAnalysis.audienceCountries,
//       targetAudienceSummary: profileAnalysis.targetAudienceSummary,
//       // Visual analysis
//       facelessContentPercentage: profileAnalysis.facelessContentPercentage,
//       avgLightingScore: profileAnalysis.avgLightingScore,
//       avgAestheticsScore: profileAnalysis.avgAestheticsScore,
//       avgEditingQualityScore: profileAnalysis.avgEditingQualityScore,
//       analyzedAt: profileAnalysis.analyzedAt,
//     };
//   }

//   /**
//    * Aggregate analysis data from media items
//    */
//   private aggregateAnalysis(analyzedMedia: any[], insightsMap: Map<string, any>, user: any): any {
//     const postsAnalyzed = analyzedMedia.length;

//     // Calculate date range
//     const timestamps = analyzedMedia
//       .map(m => m.instagramMedia?.timestamp)
//       .filter(t => t)
//       .sort((a, b) => a - b);

//     const analysisPeriodStart = timestamps[0];
//     const analysisPeriodEnd = timestamps[timestamps.length - 1];

//     // 1. Niche analysis
//     const nicheStats = new Map<string, { count: number; totalReach: number; totalEngagement: number; totalImpressions: number }>();

//     analyzedMedia.forEach(media => {
//       const niche = media.primaryNiche || 'General';
//       const insights = insightsMap.get(media.mediaId);

//       if (!nicheStats.has(niche)) {
//         nicheStats.set(niche, { count: 0, totalReach: 0, totalEngagement: 0, totalImpressions: 0 });
//       }

//       const stats = nicheStats.get(niche)!;
//       stats.count += 1;

//       if (insights) {
//         stats.totalReach += insights.reach || 0;
//         stats.totalEngagement += (insights.likes || 0) + (insights.comments || 0);
//         stats.totalImpressions += insights.impressions || 0;
//       }
//     });

//     const topNiches = Array.from(nicheStats.entries())
//       .map(([niche, stats]) => ({
//         niche,
//         count: stats.count,
//         avgReach: Math.round(stats.totalReach / stats.count),
//         avgEngagement: Math.round(stats.totalEngagement / stats.count),
//         avgImpressions: Math.round(stats.totalImpressions / stats.count),
//       }))
//       .sort((a, b) => b.count - a.count)
//       .slice(0, 5);

//     const nichePerformance = [...topNiches].sort((a, b) => b.avgEngagement - a.avgEngagement);

//     // 2. Language analysis
//     const languageCounts = new Map<string, number>();
//     analyzedMedia.forEach(media => {
//       const lang = media.detectedLanguage || 'und';
//       languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
//     });

//     const languagesUsed = Array.from(languageCounts.entries())
//       .map(([lang, count]) => ({
//         lang,
//         count,
//         percentage: Math.round((count / postsAnalyzed) * 100 * 100) / 100,
//       }))
//       .sort((a, b) => b.count - a.count);

//     const primaryLanguage = languagesUsed[0]?.lang || 'und';

//     // 3. Paid campaigns
//     const paidPosts = analyzedMedia.filter(m => m.isPaidCampaign);
//     const paidCampaignsCount = paidPosts.length;

//     const paidByNiche = new Map<string, number>();
//     paidPosts.forEach(media => {
//       const niche = media.primaryNiche || 'General';
//       paidByNiche.set(niche, (paidByNiche.get(niche) || 0) + 1);
//     });

//     const paidCampaignsByNiche = Array.from(paidByNiche.entries())
//       .map(([niche, count]) => ({ niche, count }))
//       .sort((a, b) => b.count - a.count);

//     // 4. Keywords analysis
//     const allCaptions = analyzedMedia.map(m => m.instagramMedia?.caption || '');
//     const topKeywords = TextAnalysisUtil.getTopKeywords(allCaptions, 10).map(k => ({
//       keyword: k.keyword,
//       count: k.count,
//     }));

//     // 5. Suggested keywords (based on top performers)
//     const suggestedKeywords = topKeywords.slice(0, 10).map(k => ({
//       keyword: k.keyword,
//       count: k.count,
//     }));

//     // 6. Performance metrics
//     let totalLikes = 0;
//     let totalComments = 0;
//     let totalShares = 0;
//     let totalSaves = 0;
//     let totalReach = 0;
//     let totalImpressions = 0;
//     let metricsCount = 0;

//     analyzedMedia.forEach(media => {
//       const insights = insightsMap.get(media.mediaId);
//       if (insights) {
//         totalLikes += insights.likes || 0;
//         totalComments += insights.comments || 0;
//         totalShares += insights.shares || 0;
//         totalSaves += insights.saved || 0;
//         totalReach += insights.reach || 0;
//         totalImpressions += insights.impressions || 0;
//         metricsCount += 1;
//       }
//     });

//     const avgReach = metricsCount > 0 ? Math.round(totalReach / metricsCount) : 0;
//     const avgImpressions = metricsCount > 0 ? Math.round(totalImpressions / metricsCount) : 0;

//     const avgEngagementRate = user.instagramFollowersCount
//       ? TextAnalysisUtil.calculateEngagementRate(
//           Math.round(totalLikes / metricsCount),
//           Math.round(totalComments / metricsCount),
//           user.instagramFollowersCount
//         )
//       : 0;

//     // 7. Content styles (simple categorization based on caption length and emoji usage)
//     const contentStyles = this.analyzeContentStyles(analyzedMedia);

//     // 8. Relevance score (based on engagement rate and posting frequency)
//     const relevanceScore = this.calculateRelevanceScore(avgEngagementRate, postsAnalyzed);

//     // 9. Trending topics (top hashtags)
//     const allHashtags = analyzedMedia.flatMap(m => m.hashtags || []);
//     const hashtagCounts = new Map<string, number>();
//     allHashtags.forEach(tag => {
//       hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
//     });

//     const trendingTopics = Array.from(hashtagCounts.entries())
//       .map(([tag, count]) => ({ tag, count }))
//       .sort((a, b) => b.count - a.count)
//       .slice(0, 10);

//     // 10. Visual analysis aggregation
//     let facelessCount = 0;
//     let totalLighting = 0;
//     let totalAesthetics = 0;
//     let totalEditing = 0;
//     let visualCount = 0;

//     analyzedMedia.forEach(media => {
//       if (media.isFacelessContent) facelessCount++;
//       if (media.lightingScore) {
//         totalLighting += media.lightingScore;
//         visualCount++;
//       }
//       if (media.aestheticsScore) totalAesthetics += media.aestheticsScore;
//       if (media.editingQualityScore) totalEditing += media.editingQualityScore;
//     });

//     const facelessContentPercentage = postsAnalyzed > 0
//       ? Number(((facelessCount / postsAnalyzed) * 100).toFixed(2))
//       : 0;
//     const avgLightingScore = visualCount > 0 ? Number((totalLighting / visualCount).toFixed(2)) : undefined;
//     const avgAestheticsScore = visualCount > 0 ? Number((totalAesthetics / visualCount).toFixed(2)) : undefined;
//     const avgEditingQualityScore = visualCount > 0 ? Number((totalEditing / visualCount).toFixed(2)) : undefined;

//     return {
//       postsAnalyzed,
//       analysisPeriodStart,
//       analysisPeriodEnd,
//       topNiches,
//       nichePerformance,
//       contentStyles,
//       dominantStyle: contentStyles.dominantStyle,
//       paidCampaignsCount,
//       paidCampaignsByNiche,
//       languagesUsed,
//       primaryLanguage,
//       topKeywords,
//       suggestedKeywords,
//       avgEngagementRate,
//       avgReach,
//       avgImpressions,
//       totalLikes,
//       totalComments,
//       totalShares,
//       totalSaves,
//       relevanceScore,
//       trendingTopics,
//       facelessContentPercentage,
//       avgLightingScore,
//       avgAestheticsScore,
//       avgEditingQualityScore,
//     };
//   }

//   /**
//    * Analyze content styles based on caption characteristics
//    */
//   private analyzeContentStyles(analyzedMedia: any[]): any {
//     const styles = {
//       storytelling: 0,
//       simple: 0,
//       bold: 0,
//       medium: 0,
//     };

//     analyzedMedia.forEach(media => {
//       const wordCount = media.captionWordCount || 0;

//       if (wordCount > 50) {
//         styles.storytelling += 1;
//       } else if (wordCount < 10) {
//         styles.simple += 1;
//       } else if (wordCount >= 10 && wordCount <= 30) {
//         styles.medium += 1;
//       } else {
//         styles.bold += 1;
//       }
//     });

//     const total = analyzedMedia.length;
//     const stylePercentages = {
//       storytelling: Math.round((styles.storytelling / total) * 100),
//       simple: Math.round((styles.simple / total) * 100),
//       bold: Math.round((styles.bold / total) * 100),
//       medium: Math.round((styles.medium / total) * 100),
//     };

//     const dominantStyle = Object.entries(styles).sort((a, b) => b[1] - a[1])[0][0];

//     return { styles: stylePercentages, dominantStyle };
//   }

//   /**
//    * Calculate relevance score
//    */
//   private calculateRelevanceScore(engagementRate: number, postsCount: number): number {
//     // Simple scoring: engagement rate (0-5%) * 20 + posting activity (0-50 posts) * 0.4
//     const engagementScore = Math.min(engagementRate * 20, 100);
//     const activityScore = Math.min(postsCount * 2, 100);

//     return Math.round((engagementScore * 0.7 + activityScore * 0.3) * 100) / 100;
//   }

//   /**
//    * Get user (influencer or brand)
//    */
//   private async getUser(userId: number, userType: UserType): Promise<Influencer | Brand> {
//     if (userType === 'influencer') {
//       const user = await this.influencerModel.findByPk(userId);
//       if (!user) {
//         throw new NotFoundException(`Influencer with ID ${userId} not found`);
//       }
//       return user;
//     } else {
//       const user = await this.brandModel.findByPk(userId);
//       if (!user) {
//         throw new NotFoundException(`Brand with ID ${userId} not found`);
//       }
//       return user;
//     }
//   }

//   /**
//    * Generate audience summary from demographics data
//    */
//   private generateAudienceSummary(demographics: any): string {
//     const { ageGender, cities, countries } = demographics;

//     let summary = '';

//     // Top demographics
//     if (ageGender && ageGender.length > 0) {
//       const topDemo = ageGender.sort((a, b) => b.percentage - a.percentage)[0];
//       summary += `Primary demographic: ${topDemo.gender} ${topDemo.ageRange} (${topDemo.percentage}%). `;
//     }

//     // Top location
//     if (cities && cities.length > 0) {
//       const topCity = cities[0];
//       summary += `Top city: ${topCity.location} (${topCity.percentage}%). `;
//     }

//     if (countries && countries.length > 0) {
//       const topCountry = countries[0];
//       summary += `Top country: ${topCountry.location} (${topCountry.percentage}%). `;
//     }

//     return summary || 'Audience demographics not available';
//   }

//   /**
//    * Store daily growth snapshot
//    */
//   async storeGrowthSnapshot(userId: number, userType: UserType): Promise<void> {
//     const user = await this.getUser(userId, userType);

//     if (!user.instagramUserId) {
//       return; // Skip if no Instagram connected
//     }

//     // Get recent insights for engagement calculations
//     const recentInsights = await this.instagramMediaInsightModel.findAll({
//       where: userType === 'influencer' ? { influencerId: userId } : { brandId: userId },
//       order: [['fetchedAt', 'DESC']],
//       limit: 10,
//     });

//     const avgLikes = recentInsights.length > 0
//       ? recentInsights.reduce((sum, i) => sum + (i.likes || 0), 0) / recentInsights.length
//       : 0;

//     const avgComments = recentInsights.length > 0
//       ? recentInsights.reduce((sum, i) => sum + (i.comments || 0), 0) / recentInsights.length
//       : 0;

//     const avgReach = recentInsights.length > 0
//       ? recentInsights.reduce((sum, i) => sum + (i.reach || 0), 0) / recentInsights.length
//       : 0;

//     const avgImpressions = recentInsights.length > 0
//       ? recentInsights.reduce((sum, i) => sum + (i.impressions || 0), 0) / recentInsights.length
//       : 0;

//     const avgSaves = recentInsights.length > 0
//       ? recentInsights.reduce((sum, i) => sum + (i.saved || 0), 0) / recentInsights.length
//       : 0;

//     const engagementRate = user.instagramFollowersCount
//       ? TextAnalysisUtil.calculateEngagementRate(avgLikes, avgComments, user.instagramFollowersCount)
//       : 0;

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     await this.instagramProfileGrowthModel.upsert({
//       influencerId: userType === 'influencer' ? userId : undefined,
//       brandId: userType === 'brand' ? userId : undefined,
//       instagramUserId: user.instagramUserId,
//       instagramUsername: user.instagramUsername,
//       followersCount: user.instagramFollowersCount,
//       followsCount: user.instagramFollowsCount,
//       mediaCount: user.instagramMediaCount,
//       avgLikes,
//       avgComments,
//       avgReach,
//       avgImpressions,
//       avgSaves,
//       engagementRate,
//       snapshotDate: today,
//     });
//   }
// }
