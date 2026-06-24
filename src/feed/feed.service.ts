import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from '../post/models/post.model';
import { Influencer } from '../auth/model/influencer.model';
import { HypeReelProduct } from '../post/models/hype-reel-product.model';
import { PostCategory } from '../post/models/post-category.model';
import { PostSubcategory } from '../post/models/post-subcategory.model';

@Injectable()
export class FeedService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(HypeReelProduct)
    private readonly hypeReelProductModel: typeof HypeReelProduct,
  ) {}

  async getHypeFeed(query: {
    categoryId?: number;
    subcategoryId?: number;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: any = { isHypeReel: true, isActive: true };
    if (query.categoryId) where.postCategoryId = query.categoryId;
    if (query.subcategoryId) where.postSubcategoryId = query.subcategoryId;

    const { rows: posts, count } = await this.postModel.findAndCountAll({
      where,
      include: [
        {
          model: Influencer,
          attributes: ['id', 'name', 'profileImage'],
        },
        {
          model: PostCategory,
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: PostSubcategory,
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const reels = await Promise.all(
      posts.map(async (post) => {
        const productCount = await this.hypeReelProductModel.count({
          where: { postId: post.id },
        });
        const p = post as any;
        return {
          postId: post.id,
          videoUrl: post.mediaUrls?.[0] ?? null,
          thumbnailUrl: p.thumbnailUrl ?? null,
          likesCount: post.likesCount,
          sharesCount: post.sharesCount,
          savesCount: p.savesCount ?? 0,
          viewsCount: p.viewsCount ?? 0,
          influencer: post.influencer
            ? {
                id: (post.influencer as any).id,
                name: (post.influencer as any).name,
                profileImage: (post.influencer as any).profileImage,
              }
            : null,
          productCount,
          category: p.postCategory?.name ?? null,
          subcategory: p.postSubcategory?.name ?? null,
        };
      }),
    );

    return {
      data: reels,
      meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    };
  }

  async getHypeReelDetail(postId: number) {
    const post = await this.postModel.findOne({
      where: { id: postId, isHypeReel: true, isActive: true },
      include: [
        { model: Influencer, attributes: ['id', 'name', 'profileImage'] },
        { model: PostCategory, attributes: ['id', 'name'], required: false },
        { model: PostSubcategory, attributes: ['id', 'name'], required: false },
      ],
    });

    if (!post) return null;

    const products = await this.hypeReelProductModel.findAll({
      where: { postId: post.id },
      order: [['sortOrder', 'ASC']],
      attributes: [
        'id',
        'productName',
        'productBrand',
        'productSize',
        'productThumbnailUrl',
        'affiliateLink',
        'productRating',
        'sortOrder',
      ],
    });

    const p = post as any;
    return {
      postId: post.id,
      videoUrl: post.mediaUrls?.[0] ?? null,
      thumbnailUrl: p.thumbnailUrl ?? null,
      content: post.content,
      likesCount: post.likesCount,
      sharesCount: post.sharesCount,
      viewsCount: p.viewsCount ?? 0,
      influencer: post.influencer,
      category: p.postCategory?.name ?? null,
      subcategory: p.postSubcategory?.name ?? null,
      products,
    };
  }

  async getTopCreators(limit = 10) {
    return this.influencerModel.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'username', 'profileImage', 'hypeReelsCount'],
      order: [['hypeReelsCount', 'DESC']],
      limit,
    });
  }
}
