import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Post, UserType } from '../post/models/post.model';
import { PostView, ViewerType } from '../post/models/post-view.model';
import { Like, LikerType } from '../post/models/like.model';
import { Share, SharerType } from '../post/models/share.model';
import { Follow, FollowingType, FollowerType } from '../post/models/follow.model';
import { Campaign, CampaignStatus } from '../campaign/models/campaign.model';
import { CampaignReview, ReviewerType } from './models/campaign-review.model';
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
    @InjectModel(PostView)
    private readonly postViewModel: typeof PostView,
    @InjectModel(Like)
    private readonly likeModel: typeof Like,
    @InjectModel(Share)
    private readonly shareModel: typeof Share,
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
      posts: await this.getPostsCount(userId, userType, startDate, now),
      followers: await this.getFollowersCount(userId, userType, startDate, now),
      following: await this.getFollowingCount(userId, userType, startDate, now),
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
   * NOTE: This is an approximation using post views as a proxy
   * TODO: Implement actual profile view tracking in the future
   */
  private async calculateProfileViews(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      // Build where clause for user's posts
      const postWhereClause: any = {};
      if (userType === CreatorType.INFLUENCER) {
        postWhereClause.influencerId = userId;
        postWhereClause.userType = UserType.INFLUENCER;
      } else {
        postWhereClause.brandId = userId;
        postWhereClause.userType = UserType.BRAND;
      }

      // Get all post IDs for this user
      const userPosts = await Post.findAll({
        where: postWhereClause,
        attributes: ['id'],
        raw: true,
      });

      if (userPosts.length === 0) {
        return 0;
      }

      const postIds = userPosts.map((p: any) => p.id);

      // Count views on these posts that occurred in the timeframe
      const viewCount = await this.postViewModel.count({
        where: {
          postId: { [Op.in]: postIds },
          viewedAt: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      // Multiply by 10 as approximation (people who view posts likely viewed profile)
      return viewCount * 10;
    } catch (error) {
      console.error('Error calculating profile views:', error);
      return 0;
    }
  }

  /**
   * Get posts count created within the specified time period
   * Counts actual posts created in the timeframe (not total portfolio)
   */
  private async getPostsCount(
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

      // Count posts created in the timeframe
      const postsCount = await Post.count({ where: whereClause });

      return postsCount;
    } catch (error) {
      console.error('Error getting posts count:', error);
      return 0;
    }
  }

  /**
   * Get followers count gained within the specified time period
   * Counts new followers from the application, not Instagram
   */
  private async getFollowersCount(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      if (userType === CreatorType.INFLUENCER) {
        // Count how many users started following this influencer in the timeframe
        return await Follow.count({
          where: {
            followingInfluencerId: userId,
            followingType: FollowingType.INFLUENCER,
            createdAt: {
              [Op.between]: [startDate, endDate],
            },
          },
        });
      } else {
        // Count how many users started following this brand in the timeframe
        return await Follow.count({
          where: {
            followingBrandId: userId,
            followingType: FollowingType.BRAND,
            createdAt: {
              [Op.between]: [startDate, endDate],
            },
          },
        });
      }
    } catch (error) {
      console.error('Error getting followers count:', error);
      return 0;
    }
  }

  /**
   * Get following count gained within the specified time period
   * Counts new follows from the application, not Instagram
   */
  private async getFollowingCount(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      if (userType === CreatorType.INFLUENCER) {
        // Count how many users this influencer started following in the timeframe
        return await Follow.count({
          where: {
            followerInfluencerId: userId,
            followerType: FollowerType.INFLUENCER,
            createdAt: {
              [Op.between]: [startDate, endDate],
            },
          },
        });
      } else {
        // Count how many users this brand started following in the timeframe
        return await Follow.count({
          where: {
            followerBrandId: userId,
            followerType: FollowerType.BRAND,
            createdAt: {
              [Op.between]: [startDate, endDate],
            },
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
   * Counts actual views from post_views table that occurred in the timeframe
   */
  private async calculatePostViews(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      // Build where clause for user's posts
      const postWhereClause: any = {};
      if (userType === CreatorType.INFLUENCER) {
        postWhereClause.influencerId = userId;
        postWhereClause.userType = UserType.INFLUENCER;
      } else {
        postWhereClause.brandId = userId;
        postWhereClause.userType = UserType.BRAND;
      }

      // Get all post IDs for this user
      const userPosts = await Post.findAll({
        where: postWhereClause,
        attributes: ['id'],
        raw: true,
      });

      if (userPosts.length === 0) {
        return 0;
      }

      const postIds = userPosts.map((p: any) => p.id);

      // Count views on these posts that occurred in the timeframe
      const viewCount = await this.postViewModel.count({
        where: {
          postId: { [Op.in]: postIds },
          viewedAt: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      return viewCount;
    } catch (error) {
      console.error('Error calculating post views:', error);
      return 0;
    }
  }

  /**
   * Calculate interactions (likes + shares) for the given time period
   * Counts actual likes and shares that occurred in the timeframe
   */
  private async calculateInteractions(
    userId: number,
    userType: CreatorType,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      // Build where clause for user's posts
      const postWhereClause: any = {};
      if (userType === CreatorType.INFLUENCER) {
        postWhereClause.influencerId = userId;
        postWhereClause.userType = UserType.INFLUENCER;
      } else {
        postWhereClause.brandId = userId;
        postWhereClause.userType = UserType.BRAND;
      }

      // Get all post IDs for this user
      const userPosts = await Post.findAll({
        where: postWhereClause,
        attributes: ['id'],
        raw: true,
      });

      if (userPosts.length === 0) {
        return 0;
      }

      const postIds = userPosts.map((p: any) => p.id);

      // Count likes that occurred in the timeframe
      const likesCount = await this.likeModel.count({
        where: {
          postId: { [Op.in]: postIds },
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      // Count shares that occurred in the timeframe
      const sharesCount = await this.shareModel.count({
        where: {
          postId: { [Op.in]: postIds },
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      // Total interactions = likes + shares
      return likesCount + sharesCount;
    } catch (error) {
      console.error('Error calculating interactions:', error);
      return 0;
    }
  }

  /**
   * Calculate user rating based on campaign reviews received
   * Returns average rating from all campaign reviews where user was reviewed
   */
  private async calculateRating(userId: number, userType: CreatorType): Promise<number> {
    try {
      // Determine reviewee type based on user type
      const revieweeType = userType === CreatorType.INFLUENCER
        ? ReviewerType.INFLUENCER
        : ReviewerType.BRAND;

      // Get all reviews where this user was the reviewee
      const reviews = await CampaignReview.findAll({
        where: {
          revieweeType: revieweeType,
          revieweeId: userId,
        },
        attributes: ['rating'],
        raw: true,
      });

      // If no reviews, return 0
      if (reviews.length === 0) {
        return 0;
      }

      // Calculate average rating
      const totalRating = reviews.reduce((sum, review: any) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;

      // Round to 1 decimal place
      return Math.round(averageRating * 10) / 10;
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
