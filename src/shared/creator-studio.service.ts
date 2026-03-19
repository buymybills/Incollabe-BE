import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, literal } from 'sequelize';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Post, UserType } from '../post/models/post.model';
import { Follow, FollowingType, FollowerType } from '../post/models/follow.model';
import { Campaign, CampaignStatus } from '../campaign/models/campaign.model';
import {
  CreatorStudioStatsResponseDto,
  ProfileInsightDto,
  EngagementInsightDto,
  StatsTimeFrame,
} from '../influencer/dto/creator-studio-stats.dto';

export enum CreatorType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Injectable()
export class CreatorStudioService {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
  ) {}

  /**
   * Get creator studio stats for both influencers and brands
   * Unified method that handles both user types
   */
  async getCreatorStudioStats(
    userId: number,
    userType: CreatorType,
    timeFrame: StatsTimeFrame = StatsTimeFrame.LAST_30_DAYS,
  ): Promise<CreatorStudioStatsResponseDto> {
    // Validate user exists
    if (userType === CreatorType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(userId);
      if (!influencer) {
        throw new NotFoundException('Influencer not found');
      }
    } else {
      const brand = await this.brandModel.findByPk(userId);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    // Calculate date range based on timeFrame
    const now = new Date();
    const daysMap = {
      [StatsTimeFrame.LAST_7_DAYS]: 7,
      [StatsTimeFrame.LAST_15_DAYS]: 15,
      [StatsTimeFrame.LAST_30_DAYS]: 30,
    };
    const days = daysMap[timeFrame];
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Format date range
    const dateRange = `${this.formatDateRange(startDate, now)}`;

    // Profile Insight
    const profileInsight: ProfileInsightDto = {
      profileViews: await this.calculateProfileViews(userId, userType, startDate, now),
      posts: await this.getPostsCount(userId, userType),
      followers: await this.getFollowersCount(userId, userType),
      following: await this.getFollowingCount(userId, userType),
      rating: await this.calculateRating(userId, userType),
    };

    // Engagement Insight
    const engagementInsight: EngagementInsightDto = {
      postView: await this.calculatePostViews(userId, userType, startDate, now),
      interactions: await this.calculateInteractions(userId, userType, startDate, now),
    };

    return {
      profileInsight,
      engagementInsight,
      timeFrame,
      dateRange,
    };
  }

  /**
   * Calculate profile views for the given time period
   */
  private async calculateProfileViews(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      const whereClause: any = {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      };

      if (userType === CreatorType.INFLUENCER) {
        whereClause.influencerId = userId;
        whereClause.userType = UserType.INFLUENCER;
      } else {
        whereClause.brandId = userId;
        whereClause.userType = UserType.BRAND;
      }

      const viewCount = await Post.count({ where: whereClause });

      // Multiply by average views per post (estimated metric)
      return viewCount * 100;
    } catch (error) {
      console.error('Error calculating profile views:', error);
      return 0;
    }
  }

  /**
   * Get total posts count
   */
  private async getPostsCount(userId: number, userType: CreatorType): Promise<number> {
    try {
      const whereClause: any = {};

      if (userType === CreatorType.INFLUENCER) {
        whereClause.influencerId = userId;
        whereClause.userType = UserType.INFLUENCER;
      } else {
        whereClause.brandId = userId;
        whereClause.userType = UserType.BRAND;
      }

      // Count actual posts from the database
      const dbPostCount = await Post.count({ where: whereClause });

      // For influencers, also check Instagram media count and return the higher value
      if (userType === CreatorType.INFLUENCER) {
        const influencer = await this.influencerModel.findByPk(userId);
        const instagramCount = influencer?.instagramMediaCount || 0;
        return Math.max(dbPostCount, instagramCount);
      }

      return dbPostCount;
    } catch (error) {
      console.error('Error getting posts count:', error);
      return 0;
    }
  }

  /**
   * Get followers count
   */
  private async getFollowersCount(userId: number, userType: CreatorType): Promise<number> {
    try {
      if (userType === CreatorType.INFLUENCER) {
        // For influencers, use Instagram data
        const influencer = await this.influencerModel.findByPk(userId);
        return influencer?.instagramFollowersCount || 0;
      } else {
        // For brands, count how many users are following them on the platform
        return await Follow.count({
          where: {
            followingBrandId: userId,
            followingType: FollowingType.BRAND,
          },
        });
      }
    } catch (error) {
      console.error('Error getting followers count:', error);
      return 0;
    }
  }

  /**
   * Get following count
   */
  private async getFollowingCount(userId: number, userType: CreatorType): Promise<number> {
    try {
      if (userType === CreatorType.INFLUENCER) {
        // For influencers, use Instagram data
        const influencer = await this.influencerModel.findByPk(userId);
        return influencer?.instagramFollowsCount || 0;
      } else {
        // For brands, count how many users they follow on the platform
        return await Follow.count({
          where: {
            followerBrandId: userId,
            followerType: FollowerType.BRAND,
          },
        });
      }
    } catch (error) {
      console.error('Error getting following count:', error);
      return 0;
    }
  }

  /**
   * Calculate post views for the given time period
   * Uses actual viewsCount from database (auto-incremented by trigger)
   */
  private async calculatePostViews(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      const whereClause: any = {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      };

      if (userType === CreatorType.INFLUENCER) {
        whereClause.influencerId = userId;
        whereClause.userType = UserType.INFLUENCER;
      } else {
        whereClause.brandId = userId;
        whereClause.userType = UserType.BRAND;
      }

      // Sum up actual view counts from posts in the time period
      const result = await Post.findAll({
        attributes: [[literal('COALESCE(SUM("viewsCount"), 0)'), 'totalViews']],
        where: whereClause,
        raw: true,
      });

      const data = result[0] as any;
      return parseInt(data.totalViews) || 0;
    } catch (error) {
      console.error('Error calculating post views:', error);
      return 0;
    }
  }

  /**
   * Calculate interactions (likes + shares) for the given time period
   * Interactions = Total Likes + Total Shares from actual database counts
   */
  private async calculateInteractions(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      const whereClause: any = {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      };

      if (userType === CreatorType.INFLUENCER) {
        whereClause.influencerId = userId;
        whereClause.userType = UserType.INFLUENCER;
      } else {
        whereClause.brandId = userId;
        whereClause.userType = UserType.BRAND;
      }

      const result = await Post.findAll({
        attributes: [
          [literal('COALESCE(SUM(likes_count), 0)'), 'totalLikes'],
          [literal('COALESCE(SUM(shares_count), 0)'), 'totalShares'],
        ],
        where: whereClause,
        raw: true,
      });

      const data = result[0] as any;
      const totalLikes = parseInt(data.totalLikes) || 0;
      const totalShares = parseInt(data.totalShares) || 0;

      // Total interactions = likes + shares
      return totalLikes + totalShares;
    } catch (error) {
      console.error('Error calculating interactions:', error);
      return 0;
    }
  }

  /**
   * Calculate user rating based on profile completeness and verification
   */
  private async calculateRating(userId: number, userType: CreatorType): Promise<number> {
    try {
      if (userType === CreatorType.INFLUENCER) {
        const influencer = await this.influencerModel.findByPk(userId);
        if (!influencer) return 0;

        let rating = 0;

        // Base rating from profile completeness
        if (influencer.isProfileCompleted) rating += 2;

        // Verification bonus
        if (influencer.isVerified) rating += 1;
        if (influencer.isWhatsappVerified) rating += 0.5;

        // Social media presence
        if (influencer.instagramFollowersCount > 1000) rating += 0.5;
        if (influencer.instagramFollowersCount > 10000) rating += 0.5;

        // Pro account bonus
        if (influencer.isPro) rating += 0.5;

        return Math.min(rating, 5.0);
      } else {
        const brand = await this.brandModel.findByPk(userId);
        if (!brand) return 0;

        let rating = 0;

        if (brand.isProfileCompleted) rating += 2;
        if (brand.isVerified) rating += 1.5;

        const followersCount = await this.getFollowersCount(userId, userType);
        if (followersCount > 100) rating += 0.5;
        if (followersCount > 1000) rating += 0.5;

        const campaignsCount = await Campaign.count({
          where: { brandId: userId, status: CampaignStatus.COMPLETED },
        });
        if (campaignsCount > 5) rating += 0.5;

        return Math.min(rating, 5.0);
      }
    } catch (error) {
      console.error('Error calculating rating:', error);
      return 0;
    }
  }

  /**
   * Format date range for display
   */
  private formatDateRange(startDate: Date, endDate: Date): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const startMonth = monthNames[startDate.getMonth()];
    const startDay = startDate.getDate();

    const endMonth = monthNames[endDate.getMonth()];
    const endDay = endDate.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}`;
    }

    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }
}
