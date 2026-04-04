import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CashbackTier, ContentType } from '../models/cashback-tier.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Op } from 'sequelize';

export interface CashbackCalculationResult {
  tierFound: boolean;
  followerCount: number;
  contentType: ContentType;
  cashbackPercentage: number;
  orderAmount: number;
  cashbackAmount: number;
  tierRange: string;
  tierId?: number;
}

@Injectable()
export class CashbackTierService {
  private readonly logger = new Logger(CashbackTierService.name);

  constructor(
    @InjectModel(CashbackTier)
    private cashbackTierModel: typeof CashbackTier,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
  ) {}

  /**
   * Calculate cashback for an influencer based on their follower count and content type
   */
  async calculateCashback(
    influencerId: number,
    orderAmount: number,
    contentType: ContentType,
  ): Promise<CashbackCalculationResult> {
    // Get influencer's follower count
    const influencer = await this.influencerModel.findByPk(influencerId, {
      attributes: ['id', 'instagramFollowersCount'],
    });

    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }

    const followerCount = influencer.instagramFollowersCount || 0;

    // Find matching tier
    const tier = await this.findTierForInfluencer(followerCount, contentType);

    if (!tier) {
      this.logger.warn(
        `No cashback tier found for influencer ${influencerId} with ${followerCount} followers and content type ${contentType}`,
      );

      return {
        tierFound: false,
        followerCount,
        contentType,
        cashbackPercentage: 0,
        orderAmount,
        cashbackAmount: 0,
        tierRange: 'No tier found',
      };
    }

    // Calculate cashback amount
    const cashbackAmount = tier.calculateCashback(orderAmount);

    this.logger.log(
      `Cashback calculated for influencer ${influencerId}: ${followerCount} followers, ${contentType}, ${tier.cashbackPercentage}% = ₹${cashbackAmount.toFixed(2)}`,
    );

    return {
      tierFound: true,
      followerCount,
      contentType,
      cashbackPercentage: tier.cashbackPercentage,
      orderAmount,
      cashbackAmount,
      tierRange: tier.getRangeDescription(),
      tierId: tier.id,
    };
  }

  /**
   * Find the appropriate cashback tier for an influencer
   */
  async findTierForInfluencer(
    followerCount: number,
    contentType: ContentType,
  ): Promise<CashbackTier | null> {
    // Find tier where follower count falls within range
    const tier = await this.cashbackTierModel.findOne({
      where: {
        contentType,
        isActive: true,
        minFollowers: { [Op.lte]: followerCount },
        [Op.or]: [
          { maxFollowers: { [Op.gte]: followerCount } },
          { maxFollowers: { [Op.is]: null } }, // Unlimited upper range
        ],
      },
      order: [['minFollowers', 'DESC']], // Get the most specific tier
    });

    return tier;
  }

  /**
   * Get all active cashback tiers
   */
  async getAllTiers(): Promise<CashbackTier[]> {
    return this.cashbackTierModel.findAll({
      where: { isActive: true },
      order: [
        ['minFollowers', 'ASC'],
        ['contentType', 'ASC'],
      ],
    });
  }

  /**
   * Get cashback tier breakdown for a specific influencer
   */
  async getInfluencerTierInfo(influencerId: number): Promise<{
    influencerId: number;
    followerCount: number;
    storyTier: CashbackTier | null;
    postReelTier: CashbackTier | null;
  }> {
    const influencer = await this.influencerModel.findByPk(influencerId, {
      attributes: ['id', 'instagramFollowersCount'],
    });

    if (!influencer) {
      throw new NotFoundException(`Influencer with ID ${influencerId} not found`);
    }

    const followerCount = influencer.instagramFollowersCount || 0;

    const [storyTier, postReelTier] = await Promise.all([
      this.findTierForInfluencer(followerCount, ContentType.STORY),
      this.findTierForInfluencer(followerCount, ContentType.POST_REEL),
    ]);

    return {
      influencerId,
      followerCount,
      storyTier,
      postReelTier,
    };
  }

  /**
   * Preview cashback for an influencer without creating an order
   */
  async previewCashback(
    influencerId: number,
    orderAmount: number,
  ): Promise<{
    followerCount: number;
    story: CashbackCalculationResult;
    postReel: CashbackCalculationResult;
  }> {
    const [story, postReel] = await Promise.all([
      this.calculateCashback(influencerId, orderAmount, ContentType.STORY),
      this.calculateCashback(influencerId, orderAmount, ContentType.POST_REEL),
    ]);

    return {
      followerCount: story.followerCount,
      story,
      postReel,
    };
  }

  /**
   * Get tier statistics (for admin dashboard)
   */
  async getTierStatistics(): Promise<{
    totalTiers: number;
    activeTiers: number;
    tiersByContentType: {
      story: number;
      postReel: number;
    };
    followerRanges: {
      min: number;
      max: number | null;
      story: number;
      postReel: number;
    }[];
  }> {
    const allTiers = await this.cashbackTierModel.findAll({
      order: [['minFollowers', 'ASC']],
    });

    const activeTiers = allTiers.filter((t) => t.isActive);

    const storyTiers = activeTiers.filter((t) => t.contentType === ContentType.STORY);
    const postReelTiers = activeTiers.filter(
      (t) => t.contentType === ContentType.POST_REEL,
    );

    // Group by follower ranges
    const rangeMap = new Map<
      string,
      { min: number; max: number | null; story: number; postReel: number }
    >();

    for (const tier of activeTiers) {
      const key = `${tier.minFollowers}-${tier.maxFollowers}`;
      if (!rangeMap.has(key)) {
        rangeMap.set(key, {
          min: tier.minFollowers,
          max: tier.maxFollowers,
          story: 0,
          postReel: 0,
        });
      }

      const range = rangeMap.get(key)!;
      if (tier.contentType === ContentType.STORY) {
        range.story = tier.cashbackPercentage;
      } else {
        range.postReel = tier.cashbackPercentage;
      }
    }

    return {
      totalTiers: allTiers.length,
      activeTiers: activeTiers.length,
      tiersByContentType: {
        story: storyTiers.length,
        postReel: postReelTiers.length,
      },
      followerRanges: Array.from(rangeMap.values()),
    };
  }
}
