import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BlockedUser, BlockUserType } from '../models/blocked-user.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

@Injectable()
export class BlockService {
  constructor(
    @InjectModel(BlockedUser)
    private blockedUserModel: typeof BlockedUser,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
  ) {}

  async blockUser(
    blockerId: number,
    blockerType: 'influencer' | 'brand',
    blockedId: number,
    blockedType: 'influencer' | 'brand',
  ) {
    if (blockerId === blockedId && blockerType === blockedType) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Verify blocked user exists
    if (blockedType === 'influencer') {
      const user = await this.influencerModel.findByPk(blockedId);
      if (!user) throw new NotFoundException('User not found');
    } else {
      const user = await this.brandModel.findByPk(blockedId);
      if (!user) throw new NotFoundException('User not found');
    }

    const existing = await this.findBlock(blockerId, blockerType, blockedId, blockedType);
    if (existing) {
      return { message: 'User is already blocked' };
    }

    await this.blockedUserModel.create({
      blockerType,
      blockerInfluencerId: blockerType === 'influencer' ? blockerId : null,
      blockerBrandId: blockerType === 'brand' ? blockerId : null,
      blockedType,
      blockedInfluencerId: blockedType === 'influencer' ? blockedId : null,
      blockedBrandId: blockedType === 'brand' ? blockedId : null,
    } as any);

    return { message: 'User blocked successfully' };
  }

  async unblockUser(
    blockerId: number,
    blockerType: 'influencer' | 'brand',
    blockedId: number,
    blockedType: 'influencer' | 'brand',
  ) {
    const block = await this.findBlock(blockerId, blockerType, blockedId, blockedType);
    if (!block) {
      throw new NotFoundException('Block relationship not found');
    }

    await block.destroy();
    return { message: 'User unblocked successfully' };
  }

  async getBlockedUsers(
    blockerId: number,
    blockerType: 'influencer' | 'brand',
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;
    const blockerIdField =
      blockerType === 'influencer' ? 'blockerInfluencerId' : 'blockerBrandId';

    const { count, rows } = await this.blockedUserModel.findAndCountAll({
      where: {
        blockerType,
        [blockerIdField]: blockerId,
      } as any,
      include: [
        {
          model: Influencer,
          as: 'blockedInfluencer',
          attributes: ['id', 'name', 'username', 'profileImage'],
          required: false,
        },
        {
          model: Brand,
          as: 'blockedBrand',
          attributes: ['id', 'brandName', 'username', 'profileImage'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const blockedUsers = rows.map((row) => {
      const data = row.toJSON() as any;
      const user =
        data.blockedType === 'influencer'
          ? { ...data.blockedInfluencer, userType: 'influencer' }
          : { ...data.blockedBrand, userType: 'brand' };
      return {
        blockId: data.id,
        blockedAt: data.createdAt,
        user,
      };
    });

    return {
      blockedUsers,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Check if potentialBlocker has blocked userId.
   * Used to determine if the current viewer is blocked by someone.
   */
  async isBlockedBy(
    userId: number,
    userType: 'influencer' | 'brand',
    potentialBlockerId: number,
    potentialBlockerType: 'influencer' | 'brand',
  ): Promise<boolean> {
    const block = await this.findBlock(
      potentialBlockerId,
      potentialBlockerType,
      userId,
      userType,
    );
    return !!block;
  }

  /**
   * Check if blockerId has blocked blockedId.
   */
  async hasBlocked(
    blockerId: number,
    blockerType: 'influencer' | 'brand',
    blockedId: number,
    blockedType: 'influencer' | 'brand',
  ): Promise<boolean> {
    const block = await this.findBlock(blockerId, blockerType, blockedId, blockedType);
    return !!block;
  }

  private async findBlock(
    blockerId: number,
    blockerType: 'influencer' | 'brand',
    blockedId: number,
    blockedType: 'influencer' | 'brand',
  ): Promise<BlockedUser | null> {
    const blockerIdField =
      blockerType === 'influencer' ? 'blockerInfluencerId' : 'blockerBrandId';
    const blockedIdField =
      blockedType === 'influencer' ? 'blockedInfluencerId' : 'blockedBrandId';

    return this.blockedUserModel.findOne({
      where: {
        blockerType,
        [blockerIdField]: blockerId,
        blockedType,
        [blockedIdField]: blockedId,
      } as any,
    });
  }
}
