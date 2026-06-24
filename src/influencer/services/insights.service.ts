import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Post } from '../../post/models/post.model';
import { Follow } from '../../post/models/follow.model';
import { AffiliateEarning } from '../models/affiliate-earning.model';
import { HypeReelProduct } from '../../post/models/hype-reel-product.model';

@Injectable()
export class InsightsService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
    @InjectModel(AffiliateEarning)
    private readonly earningModel: typeof AffiliateEarning,
    @InjectModel(HypeReelProduct)
    private readonly hypeReelProductModel: typeof HypeReelProduct,
  ) {}

  private getPeriodRange(period?: string, dateFrom?: string, dateTo?: string) {
    if (dateFrom && dateTo) {
      return { start: new Date(dateFrom), end: new Date(dateTo) };
    }
    const end = new Date();
    const start = new Date();
    if (period === '90d') start.setDate(start.getDate() - 90);
    else if (period === '30d') start.setDate(start.getDate() - 30);
    else start.setDate(start.getDate() - 7);
    return { start, end };
  }

  async getSummary(
    influencerId: number,
    period?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const [totalFollowers, totalEarning, totalProductsListed, posts] =
      await Promise.all([
        this.followModel.count({ where: { followingId: influencerId } as any }),
        this.earningModel.sum('amount', { where: { influencerId } }),
        this.hypeReelProductModel.count({
          include: [
            {
              model: Post,
              where: { influencerId },
              required: true,
              attributes: [],
            },
          ],
        }),
        this.postModel.findAll({
          where: { influencerId, isHypeReel: true },
          attributes: ['viewsCount'],
        }),
      ]);

    const totalViews = posts.reduce(
      (sum, p) => sum + ((p as any).viewsCount ?? 0),
      0,
    );

    return {
      totalViews,
      viewsChange: '+0',
      totalFollowers: totalFollowers ?? 0,
      followersChange: '+0',
      totalEarning: totalEarning ?? 0,
      earningChange: '+0',
      totalProductsListed: totalProductsListed ?? 0,
      productsChange: '+0',
    };
  }

  async getViewsInsights(
    influencerId: number,
    period?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const { start, end } = this.getPeriodRange(period, dateFrom, dateTo);

    const posts = await this.postModel.findAll({
      where: {
        influencerId,
        isHypeReel: true,
        createdAt: { [Op.between]: [start, end] },
      },
      attributes: [
        'id',
        'viewsCount',
        'likesCount',
        'sharesCount',
        'thumbnailUrl',
        'createdAt',
      ] as any,
      order: [['viewsCount', 'DESC']],
    });

    const totalViews = posts.reduce(
      (sum, p) => sum + ((p as any).viewsCount ?? 0),
      0,
    );
    const likes = posts.reduce((sum, p) => sum + (p.likesCount ?? 0), 0);
    const shares = posts.reduce((sum, p) => sum + (p.sharesCount ?? 0), 0);

    const topPerformingPosts = posts.slice(0, 5).map((p) => ({
      postId: p.id,
      thumbnailUrl: (p as any).thumbnailUrl,
      views: (p as any).viewsCount ?? 0,
    }));

    return {
      totalViews,
      likes,
      shares,
      saves: 0,
      followersPercent: 0,
      nonFollowersPercent: 0,
      viewsTimeSeries: [],
      topPerformingPosts,
      topViewingCategories: [],
      viewerAudience: { countries: [], cities: [] },
    };
  }

  async getFollowersInsights(
    influencerId: number,
    period?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const total = await this.followModel.count({
      where: { followingId: influencerId } as any,
    });
    return {
      totalFollowers: total,
      followersChange: '+0',
      followersTimeSeries: [],
      topFollowerLocations: [],
    };
  }

  async getEarningsInsights(
    influencerId: number,
    period?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const { start, end } = this.getPeriodRange(period, dateFrom, dateTo);

    const earnings = await this.earningModel.findAll({
      where: {
        influencerId,
        earnedAt: { [Op.between]: [start, end] },
      },
    });

    const totalEarning = earnings.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      totalEarning,
      earningChange: '+0',
      totalListed: 0,
      salesQty: earnings.length,
      totalClicks: 0,
      ctr: 0,
      earningsTimeSeries: [],
      topProductByEarning: [],
      topBuyingCategories: [],
      buyerAudience: { countries: [], cities: [] },
    };
  }

  async getProductsInsights(influencerId: number) {
    return this.hypeReelProductModel.findAll({
      include: [
        {
          model: Post,
          where: { influencerId },
          required: true,
          attributes: ['id', 'viewsCount'],
        },
      ],
      attributes: [
        'id',
        'productName',
        'productBrand',
        'productThumbnailUrl',
        'affiliateLink',
      ],
    });
  }

  async getReelInsights(influencerId: number, postId: number) {
    const post = await this.postModel.findOne({
      where: { id: postId, influencerId, isHypeReel: true },
    });
    if (!post) return null;

    const products = await this.hypeReelProductModel.findAll({
      where: { postId },
    });

    return {
      postId: post.id,
      views: (post as any).viewsCount ?? 0,
      likes: post.likesCount ?? 0,
      shares: post.sharesCount ?? 0,
      products,
    };
  }
}
