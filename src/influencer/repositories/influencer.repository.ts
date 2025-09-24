import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Niche } from '../../auth/model/niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';

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
          attributes: ['id', 'name', 'description', 'icon'],
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
}
