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
    // Use instance method to trigger @BeforeUpdate hook which sets whatsappHash
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new Error('Influencer not found');
    }

    influencer.whatsappNumber = whatsappNumber;
    influencer.isWhatsappVerified = true;
    await influencer.save();
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
    formattedNumber?: string,
  ): Promise<Influencer | null> {
    const where: any = {
      isWhatsappVerified: true,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    // First try to find by hash (for new records where hash is set)
    const byHash = await this.influencerModel.findOne({
      where: { ...where, whatsappHash },
    });

    if (byHash) {
      return byHash;
    }

    // Fallback: Find all verified influencers and check after decryption
    // This handles old records where whatsappHash might be null
    if (formattedNumber) {
      const allVerified = await this.influencerModel.findAll({ where });

      // The @AfterFind hook will decrypt the whatsappNumber for us
      for (const influencer of allVerified) {
        if (influencer.whatsappNumber === formattedNumber) {
          return influencer;
        }
      }
    }

    return null;
  }
}
