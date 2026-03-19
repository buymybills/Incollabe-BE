import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PostView, ViewerType } from '../models/post-view.model';
import { Post } from '../models/post.model';
import { Op } from 'sequelize';

export interface TrackViewDto {
  postId: number;
  viewerId: number;
  viewerType: 'influencer' | 'brand';
}

export interface ViewAnalytics {
  totalViews: number;
  uniqueViewers: number;
  viewsByUserType: {
    influencers: number;
    brands: number;
  };
  topViewers: Array<{
    viewerId: number;
    viewerType: string;
    viewerName: string;
    viewCount: number;
    lastViewedAt: Date;
  }>;
}

@Injectable()
export class PostViewService {
  constructor(
    @InjectModel(PostView)
    private readonly postViewModel: typeof PostView,
    @InjectModel(Post)
    private readonly postModel: typeof Post,
  ) {}

  /**
   * Track a post view
   * Uses ON CONFLICT to prevent duplicate views from same user
   */
  async trackView(data: TrackViewDto): Promise<{ success: boolean; message: string; isNewView: boolean }> {
    try {
      // Verify post exists
      const post = await this.postModel.findByPk(data.postId);
      if (!post) {
        throw new NotFoundException('Post not found');
      }

      // Prepare view data
      const viewData: any = {
        postId: data.postId,
        viewerType: data.viewerType === 'influencer' ? ViewerType.INFLUENCER : ViewerType.BRAND,
        viewedAt: new Date(),
      };

      if (data.viewerType === 'influencer') {
        viewData.viewerInfluencerId = data.viewerId;
        viewData.viewerBrandId = null;
      } else {
        viewData.viewerBrandId = data.viewerId;
        viewData.viewerInfluencerId = null;
      }

      // Try to create view (will fail if already exists due to unique constraint)
      const [view, created] = await this.postViewModel.findOrCreate({
        where: {
          postId: data.postId,
          viewerType: viewData.viewerType,
          ...(data.viewerType === 'influencer'
            ? { viewerInfluencerId: data.viewerId }
            : { viewerBrandId: data.viewerId }),
        },
        defaults: viewData,
      });

      if (created) {
        // New view - viewsCount is auto-incremented by trigger
        return {
          success: true,
          message: 'View tracked successfully',
          isNewView: true,
        };
      } else {
        // Existing view - update viewedAt
        await view.update({
          viewedAt: new Date(),
        });

        return {
          success: true,
          message: 'View already exists, updated timestamp',
          isNewView: false,
        };
      }
    } catch (error) {
      console.error('Error tracking post view:', error);
      throw error;
    }
  }

  /**
   * Get detailed analytics for a post
   */
  async getPostViewAnalytics(postId: number): Promise<ViewAnalytics> {
    const post = await this.postModel.findByPk(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const views = await this.postViewModel.findAll({
      where: { postId },
      include: [
        {
          association: 'viewerInfluencer',
          attributes: ['id', 'name', 'username'],
        },
        {
          association: 'viewerBrand',
          attributes: ['id', 'brandName', 'username'],
        },
      ],
    });

    const totalViews = views.length;
    const uniqueViewers = totalViews; // Each view is unique per user

    const viewsByUserType = {
      influencers: views.filter((v) => v.viewerType === ViewerType.INFLUENCER).length,
      brands: views.filter((v) => v.viewerType === ViewerType.BRAND).length,
    };

    // Get top viewers (limit to 10)
    const topViewers = views
      .slice(0, 10)
      .map((view) => ({
        viewerId: view.viewerId,
        viewerType: view.viewerType,
        viewerName:
          view.viewerType === ViewerType.INFLUENCER
            ? view.viewerInfluencer?.name || 'Unknown'
            : view.viewerBrand?.brandName || 'Unknown',
        viewCount: 1, // Each user can only view once (unique constraint)
        lastViewedAt: view.viewedAt,
      }));

    return {
      totalViews,
      uniqueViewers,
      viewsByUserType,
      topViewers,
    };
  }

  /**
   * Get all viewers for a post
   */
  async getPostViewers(
    postId: number,
    options?: { limit?: number; offset?: number },
  ): Promise<PostView[]> {
    return await this.postViewModel.findAll({
      where: { postId },
      include: [
        {
          association: 'viewerInfluencer',
          attributes: ['id', 'name', 'username', 'profileImage'],
        },
        {
          association: 'viewerBrand',
          attributes: ['id', 'brandName', 'username', 'profileImage'],
        },
      ],
      order: [['viewedAt', 'DESC']],
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    });
  }

  /**
   * Check if a user has viewed a post
   */
  async hasUserViewedPost(postId: number, viewerId: number, viewerType: 'influencer' | 'brand'): Promise<boolean> {
    const whereClause: any = {
      postId,
      viewerType: viewerType === 'influencer' ? ViewerType.INFLUENCER : ViewerType.BRAND,
    };

    if (viewerType === 'influencer') {
      whereClause.viewerInfluencerId = viewerId;
    } else {
      whereClause.viewerBrandId = viewerId;
    }

    const view = await this.postViewModel.findOne({ where: whereClause });
    return !!view;
  }

  /**
   * Get view count for a post (from denormalized column for performance)
   */
  async getPostViewCount(postId: number): Promise<number> {
    const post = await this.postModel.findByPk(postId, { attributes: ['viewsCount'] });
    return post?.viewsCount || 0;
  }

  /**
   * Get posts viewed by a user
   */
  async getViewedPostsByUser(
    viewerId: number,
    viewerType: 'influencer' | 'brand',
    options?: { limit?: number; offset?: number },
  ): Promise<PostView[]> {
    const whereClause: any = {
      viewerType: viewerType === 'influencer' ? ViewerType.INFLUENCER : ViewerType.BRAND,
    };

    if (viewerType === 'influencer') {
      whereClause.viewerInfluencerId = viewerId;
    } else {
      whereClause.viewerBrandId = viewerId;
    }

    return await this.postViewModel.findAll({
      where: whereClause,
      include: [
        {
          association: 'post',
          attributes: ['id', 'content', 'mediaUrls', 'likesCount', 'sharesCount', 'viewsCount', 'createdAt'],
        },
      ],
      order: [['viewedAt', 'DESC']],
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });
  }
}
