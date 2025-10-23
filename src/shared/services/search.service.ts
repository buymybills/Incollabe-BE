import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Brand } from '../../brand/model/brand.model';
import { Influencer } from '../../auth/model/influencer.model';
import { SearchUsersDto, UserType } from '../dto/search-users.dto';

export interface InfluencerSearchResult {
  id: number;
  name: string;
  username: string;
  profileImage: string | null;
  cityId: number | null;
  gender: string | null;
  bio: string | null;
  isVerified: boolean;
  userType: 'influencer';
}

export interface BrandSearchResult {
  id: number;
  brandName: string;
  username: string;
  profileImage: string | null;
  headquarterCityId: number | null;
  brandBio: string | null;
  isVerified: boolean;
  userType: 'brand';
}

export interface SearchUsersResult {
  influencers: InfluencerSearchResult[];
  brands: BrandSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
  ) {}

  async searchUsers(dto: SearchUsersDto) {
    const { search, type = UserType.ALL, page = 1, limit = 20 } = dto;
    const offset = (page - 1) * limit;
    const influencerSearchCondition = search
      ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { username: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    const brandSearchCondition = search
      ? {
          [Op.or]: [
            { brandName: { [Op.iLike]: `%${search}%` } },
            { username: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {};

    const results: SearchUsersResult = {
      influencers: [],
      brands: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };

    if (type === UserType.ALL || type === UserType.INFLUENCER) {
      const influencers = await this.influencerModel.findAndCountAll({
        where: {
          ...influencerSearchCondition,
          isProfileCompleted: true,
          isWhatsappVerified: true,
        },
        attributes: [
          'id',
          'name',
          'username',
          'profileImage',
          'cityId',
          'gender',
          'bio',
          'isVerified',
        ],
        limit,
        offset,
        distinct: true,
      });
      results.influencers = influencers.rows.map((influencer) => ({
        ...influencer.toJSON(),
        userType: 'influencer' as const,
      }));
      results.total += influencers.count;
    }

    if (type === UserType.ALL || type === UserType.BRAND) {
      const brands = await this.brandModel.findAndCountAll({
        where: {
          ...brandSearchCondition,
          isProfileCompleted: true,
        },
        attributes: [
          'id',
          'brandName',
          'username',
          'profileImage',
          'headquarterCityId',
          'brandBio',
          'isVerified',
        ],
        limit,
        offset,
        distinct: true,
      });
      results.brands = brands.rows.map((brand) => ({
        ...brand.toJSON(),
        userType: 'brand' as const,
      }));
      results.total += brands.count;
    }

    results.totalPages = Math.ceil(results.total / limit);
    return results;
  }
}
