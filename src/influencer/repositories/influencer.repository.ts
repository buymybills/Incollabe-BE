import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Niche } from '../../auth/model/niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { CustomNiche } from '../../auth/model/custom-niche.model';

@Injectable()
export class InfluencerRepository {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
  ) {}

  async findById(influencerId: number): Promise<Influencer | null> {
    return this.influencerModel.findByPk(influencerId, {
      include: [
        {
          model: Niche,
          attributes: ['id', 'name', 'description', 'logoNormal', 'logoDark'],
          through: { attributes: [] },
        },
        {
          model: Country,
          attributes: ['id', 'name', 'code'],
        },
        {
          model: City,
          attributes: ['id', 'name', 'state'],
        },
        {
          model: CustomNiche,
          attributes: ['id', 'name', 'description', 'isActive'],
          where: { isActive: true },
          required: false,
        },
      ],
    });
  }

  async findByPhone(phone: string): Promise<Influencer | null> {
    return this.influencerModel.findOne({ where: { phone } });
  }

  async findByUsername(username: string): Promise<Influencer | null> {
    return this.influencerModel.findOne({ where: { username } });
  }

  async updateInfluencer(
    influencerId: number,
    data: Partial<Influencer>,
  ): Promise<[number]> {
    return this.influencerModel.update(data, {
      where: { id: influencerId },
    });
  }

  async updateWhatsAppVerification(
    influencerId: number,
    whatsappNumber: string,
  ): Promise<void> {
    await this.influencerModel.update(
      {
        whatsappNumber,
        isWhatsappVerified: true,
      },
      { where: { id: influencerId } },
    );
  }

  async findAll(options: any): Promise<Influencer[]> {
    return this.influencerModel.findAll({
      ...options,
      include: [
        {
          model: Niche,
          attributes: ['id', 'name', 'description', 'logoNormal', 'logoDark'],
          through: { attributes: [] },
        },
        {
          model: Country,
          attributes: ['id', 'name', 'code'],
        },
        {
          model: City,
          attributes: ['id', 'name', 'state'],
        },
        {
          model: CustomNiche,
          attributes: ['id', 'name', 'description', 'isActive'],
          where: { isActive: true },
          required: false,
        },
      ],
    });
  }

  async findByWhatsappHash(
    whatsappHash: string,
    excludeId?: number,
  ): Promise<Influencer | null> {
    const where: any = {
      whatsappHash,
      isWhatsappVerified: true,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return this.influencerModel.findOne({ where });
  }
}
