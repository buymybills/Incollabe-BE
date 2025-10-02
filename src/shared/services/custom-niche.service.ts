import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CustomNiche, UserType } from '../../auth/model/custom-niche.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Niche } from '../../auth/model/niche.model';

export interface CustomNicheData {
  name: string;
  description?: string;
}

export interface CustomNicheResponse {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CustomNicheService {
  private readonly MAX_TOTAL_NICHES = 5;

  constructor(
    @InjectModel(CustomNiche)
    private readonly customNicheModel: typeof CustomNiche,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
  ) {}

  async createCustomNiche(
    userId: number,
    userType: UserType,
    nicheData: CustomNicheData,
  ): Promise<CustomNicheResponse> {
    // Check total niche count (regular + custom) - must not exceed 5
    await this.validateNicheLimit(userId, userType);

    // Check if custom niche with same name already exists for this user
    const existingCustomNiche = await this.customNicheModel.findOne({
      where: {
        userType,
        userId,
        name: nicheData.name,
      },
    });

    if (existingCustomNiche) {
      throw new BadRequestException(
        'Custom niche with this name already exists',
      );
    }

    const customNiche = await this.customNicheModel.create({
      userType,
      userId,
      influencerId: userType === UserType.INFLUENCER ? userId : null,
      brandId: userType === UserType.BRAND ? userId : null,
      name: nicheData.name,
      description: nicheData.description || '',
    });

    return this.formatCustomNicheResponse(customNiche);
  }

  async getUserCustomNiches(userId: number, userType: UserType) {
    const customNiches = await this.customNicheModel.findAll({
      where: {
        userType,
        userId,
        isActive: true,
      },
      order: [['createdAt', 'DESC']],
    });

    return {
      customNiches: customNiches.map((niche) =>
        this.formatCustomNicheResponse(niche),
      ),
      total: customNiches.length,
    };
  }

  async updateCustomNiche(
    customNicheId: number,
    userId: number,
    userType: UserType,
    updateData: { name?: string; description?: string; isActive?: boolean },
  ): Promise<CustomNicheResponse> {
    const customNiche = await this.customNicheModel.findOne({
      where: {
        id: customNicheId,
        userType,
        userId,
      },
    });

    if (!customNiche) {
      throw new NotFoundException('Custom niche not found');
    }

    // If updating name, check for duplicates
    if (updateData.name && updateData.name !== customNiche.name) {
      const existingNiche = await this.customNicheModel.findOne({
        where: {
          userType,
          userId,
          name: updateData.name,
          id: { [Op.ne]: customNicheId },
        },
      });

      if (existingNiche) {
        throw new BadRequestException(
          'Custom niche with this name already exists',
        );
      }
    }

    await customNiche.update(updateData);
    return this.formatCustomNicheResponse(customNiche);
  }

  async deleteCustomNiche(
    customNicheId: number,
    userId: number,
    userType: UserType,
  ) {
    const customNiche = await this.customNicheModel.findOne({
      where: {
        id: customNicheId,
        userType,
        userId,
      },
    });

    if (!customNiche) {
      throw new NotFoundException('Custom niche not found');
    }

    await customNiche.destroy();

    return {
      message: 'Custom niche deleted successfully',
      deletedNiche: {
        id: customNiche.id,
        name: customNiche.name,
      },
    };
  }

  async getTotalNicheCount(
    userId: number,
    userType: UserType,
  ): Promise<number> {
    const customCount = await this.customNicheModel.count({
      where: {
        userType,
        userId,
        isActive: true,
      },
    });

    let regularCount = 0;
    if (userType === UserType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(userId, {
        include: [{ model: Niche, through: { attributes: [] } }],
      });
      regularCount = influencer?.niches?.length || 0;
    } else if (userType === UserType.BRAND) {
      const brand = await this.brandModel.findByPk(userId, {
        include: [{ model: Niche, through: { attributes: [] } }],
      });
      regularCount = brand?.niches?.length || 0;
    }

    return regularCount + customCount;
  }

  private async validateNicheLimit(userId: number, userType: UserType) {
    const totalCount = await this.getTotalNicheCount(userId, userType);

    if (totalCount >= this.MAX_TOTAL_NICHES) {
      throw new BadRequestException(
        `You can have maximum ${this.MAX_TOTAL_NICHES} niches (regular + custom combined). You currently have ${totalCount} niches.`,
      );
    }
  }

  private formatCustomNicheResponse(
    customNiche: CustomNiche,
  ): CustomNicheResponse {
    return {
      id: customNiche.id,
      name: customNiche.name,
      description: customNiche.description,
      isActive: customNiche.isActive,
      createdAt: customNiche.createdAt.toISOString(),
      updatedAt: customNiche.updatedAt.toISOString(),
    };
  }
}
