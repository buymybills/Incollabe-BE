import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post } from '../models/post.model';
import { HypeReelProduct } from '../models/hype-reel-product.model';
import { Influencer } from '../../auth/model/influencer.model';
import { HypeStoreOrder } from '../../wallet/models/hype-store-order.model';
import { CreateHypeReelDto } from '../dto/create-hype-reel.dto';

@Injectable()
export class HypeReelService {
  constructor(
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(HypeReelProduct)
    private readonly hypeReelProductModel: typeof HypeReelProduct,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(HypeStoreOrder)
    private readonly hypeStoreOrderModel: typeof HypeStoreOrder,
  ) {}

  async createHypeReel(influencerId: number, dto: CreateHypeReelDto) {
    const post = await this.postModel.create({
      content: dto.content,
      mediaUrls: dto.mediaUrls,
      userType: 'influencer',
      influencerId,
      isActive: true,
      postType: 'hype_reel',
      isHypeReel: true,
      postCategoryId: dto.postCategoryId ?? null,
      postSubcategoryId: dto.postSubcategoryId ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      videoDurationSeconds: dto.videoDurationSeconds ?? null,
      collaboratorId: dto.collaboratorId ?? null,
      collaboratorStatus: dto.collaboratorId ? 'pending' : null,
    } as any);

    if (dto.products && dto.products.length > 0) {
      for (const productDto of dto.products) {
        const order = await this.hypeStoreOrderModel.findOne({
          where: { id: productDto.hypeStoreOrderId } as any,
        });
        if (!order) continue;

        const baseUrl = process.env.BASE_URL ?? '';
        const referralCode = (order as any).referralCode ?? '';
        const affiliateLink = referralCode
          ? `${baseUrl}/affiliate/r/${referralCode}`
          : '';

        await this.hypeReelProductModel.create({
          postId: post.id,
          hypeStoreOrderId: order.id,
          hypeStoreId: (order as any).hypeStoreId,
          productName: (order as any).productName ?? null,
          productBrand: (order as any).brandName ?? null,
          productSize: (order as any).productSize ?? null,
          productThumbnailUrl: (order as any).productImageUrl ?? null,
          affiliateLink,
          productRating: productDto.productRating ?? null,
          sortOrder: productDto.sortOrder ?? 0,
        } as any);
      }
    }

    // Update influencer level
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (influencer) {
      const newCount = ((influencer as any).hypeReelsCount ?? 0) + 1;
      let newLevel = 1;
      if (newCount >= 20) newLevel = 3;
      else if (newCount >= 5) newLevel = 2;

      await influencer.update({
        hypeReelsCount: newCount,
        hypeInfluencerLevel: newLevel,
        hypeLevelUpdatedAt: new Date(),
      } as any);
    }

    return { message: 'HYPE reel created successfully', postId: post.id };
  }

  async getHypeReelProducts(postId: number) {
    return this.hypeReelProductModel.findAll({
      where: { postId },
      order: [['sortOrder', 'ASC']],
    });
  }

  async respondToCollaboratorInvite(
    postId: number,
    influencerId: number,
    status: 'accepted' | 'declined',
  ) {
    const post = await this.postModel.findOne({
      where: { id: postId, collaboratorId: influencerId } as any,
    });
    if (!post) throw new NotFoundException('Collaboration invite not found');
    if ((post as any).collaboratorStatus !== 'pending') {
      throw new BadRequestException('Invite already responded to');
    }
    await post.update({ collaboratorStatus: status } as any);
    return { message: `Collaboration ${status}` };
  }

  async getInfluencerHypeReels(influencerId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where: any = { isHypeReel: true, isActive: true };
    if (influencerId > 0) where.influencerId = influencerId;

    const { rows, count } = await this.postModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return { data: rows, meta: { total: count, page, limit } };
  }

  async getPurchasableProducts(influencerId: number) {
    const orders = await this.hypeStoreOrderModel.findAll({
      where: { influencerId } as any,
      order: [['createdAt', 'DESC']],
    });
    return orders;
  }

  async getAffiliateLinks(postId: number) {
    return this.hypeReelProductModel.findAll({
      where: { postId },
      attributes: ['id', 'productName', 'productBrand', 'affiliateLink'],
    });
  }
}
