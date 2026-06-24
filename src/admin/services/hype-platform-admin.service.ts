import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Post } from '../../post/models/post.model';
import { AffiliateEarning, AffiliateEarningStatus } from '../../influencer/models/affiliate-earning.model';

@Injectable()
export class HypePlatformAdminService {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(AffiliateEarning)
    private readonly affiliateEarningModel: typeof AffiliateEarning,
  ) {}

  async listHypeInfluencers(page = 1, limit = 20, search?: string) {
    const offset = (page - 1) * limit;
    const where: any = { isHypeInfluencer: true };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await this.influencerModel.findAndCountAll({
      where,
      attributes: [
        'id', 'name', 'username', 'profileImage',
        'hypeInfluencerLevel', 'hypeReelsCount', 'inviteCode',
        'isHypeInfluencer', 'createdAt',
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async updateHypeInfluencerLevel(id: number, level: number) {
    if (![1, 2, 3].includes(level)) {
      throw new NotFoundException('Level must be 1, 2, or 3');
    }

    const influencer = await this.influencerModel.findOne({
      where: { id, isHypeInfluencer: true },
    });
    if (!influencer) throw new NotFoundException('HYPE influencer not found');

    await influencer.update({
      hypeInfluencerLevel: level,
      hypeLevelUpdatedAt: new Date(),
    });

    return { message: 'Level updated successfully', hypeInfluencerLevel: level };
  }

  async listHypeReels(page = 1, limit = 20, status?: string) {
    const offset = (page - 1) * limit;
    const where: any = { isHypeReel: true };

    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const { count, rows } = await this.postModel.findAndCountAll({
      where,
      include: [
        {
          model: Influencer,
          attributes: ['id', 'name', 'username', 'profileImage'],
        },
      ],
      attributes: [
        'id', 'content', 'mediaUrls', 'thumbnailUrl', 'isActive',
        'postType', 'viewsCount', 'likesCount', 'createdAt',
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async updateHypeReelStatus(id: number, action: 'approve' | 'reject' | 'flag') {
    const post = await this.postModel.findOne({ where: { id, isHypeReel: true } });
    if (!post) throw new NotFoundException('HYPE reel not found');

    const isActive = action === 'approve';
    await post.update({ isActive });

    return {
      message: `Reel ${action}d successfully`,
      id,
      isActive,
      action,
    };
  }

  async listAffiliatePendingPayouts(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { count, rows } = await this.affiliateEarningModel.findAndCountAll({
      where: { status: AffiliateEarningStatus.CONFIRMED },
      include: [
        {
          model: Influencer,
          attributes: ['id', 'name', 'username'],
        },
      ],
      attributes: [
        'id', 'influencerId', 'brandName', 'productName',
        'productThumbnailUrl', 'affiliateId', 'amount',
        'status', 'earnedAt', 'confirmedAt',
      ],
      limit,
      offset,
      order: [['confirmedAt', 'ASC']],
    });

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async processAffiliatePayout(id: number, action: 'processed' | 'failed') {
    const earning = await this.affiliateEarningModel.findByPk(id);
    if (!earning) throw new NotFoundException('Affiliate earning not found');

    const newStatus =
      action === 'processed' ? AffiliateEarningStatus.PAID : AffiliateEarningStatus.REVERSED;

    await earning.update({
      status: newStatus,
      ...(action === 'processed' && { paidAt: new Date() }),
    });

    return {
      message: `Payout marked as ${action}`,
      id,
      status: newStatus,
    };
  }
}
