import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { SearchUsersDto, UserType } from '../shared/dto/search-users.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
  ) {}

  async searchUsers(dto: SearchUsersDto) {
    const { search, type, page = 1, limit = 20 } = dto;
    const offset = (page - 1) * limit;
    const searchCondition = search
      ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { username: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    let results = {
      influencers: [] as Influencer[],
      brands: [] as Brand[],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };

    if (type === UserType.ALL || type === UserType.INFLUENCER) {
      const influencers = await this.influencerModel.findAndCountAll({
        where: {
          ...searchCondition,
          isProfileCompleted: true,
          isWhatsappVerified: true,
        },
        attributes: [
          'id',
          'name',
          'username',
          'profilePicture',
          'cityId',
          'gender',
          'bio',
        ],
        limit,
        offset,
        distinct: true,
      });
      results.influencers = influencers.rows;
      results.total += influencers.count;
    }

    if (type === UserType.ALL || type === UserType.BRAND) {
      const brands = await this.brandModel.findAndCountAll({
        where: {
          ...searchCondition,
          isProfileCompleted: true,
        },
        attributes: [
          'id',
          'brandName',
          'username',
          'logo',
          'cityId',
          'description',
        ],
        limit,
        offset,
        distinct: true,
      });
      results.brands = brands.rows;
      results.total += brands.count;
    }

    results.totalPages = Math.ceil(results.total / limit);
    return results;
  }
}