import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Admin, AdminStatus } from './models/admin.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';
import {
  AdminSearchDto,
  UserType,
  VerificationStatus,
  SortField,
  SortOrder,
} from './dto/admin-search.dto';
import { Op, Order } from 'sequelize';

export interface CombinedUserResult {
  id: number;
  name: string;
  username: string;
  profileImage: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  userType: 'influencer' | 'brand';
  phone?: string;
  isTopInfluencer?: boolean;
  isWhatsappVerified?: boolean;
  email?: string;
  legalEntityName?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  country?: any;
  city?: any;
  headquarterCountry?: any;
  headquarterCity?: any;
  niches?: any[];
}

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(CompanyType)
    private readonly companyTypeModel: typeof CompanyType,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const admin = await this.adminModel.findOne({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await admin.update({ lastLoginAt: new Date() });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        profileImage: admin.profileImage,
      },
    };
  }

  async createAdmin(createAdminData: any) {
    const existingAdmin = await this.adminModel.findOne({
      where: { email: createAdminData.email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createAdminData.password, 12);

    const admin = await this.adminModel.create({
      ...createAdminData,
      password: hashedPassword,
      status: AdminStatus.ACTIVE, // Set status as ACTIVE by default
    });

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      createdAt: admin.createdAt,
    };
  }

  async getAdminProfile(adminId: number) {
    const admin = await this.adminModel.findByPk(adminId, {
      attributes: [
        'id',
        'name',
        'email',
        'role',
        'status',
        'profileImage',
        'lastLoginAt',
        'createdAt',
      ],
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return admin;
  }

  async updateTopInfluencerStatus(
    influencerId: number,
    isTopInfluencer: boolean,
    adminId: number,
  ) {
    // First check if influencer exists
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Update the top influencer status
    await influencer.update({ isTopInfluencer });

    return {
      message: `Influencer ${isTopInfluencer ? 'marked as' : 'removed from'} top influencer`,
      influencerId,
      isTopInfluencer,
      updatedBy: adminId,
      updatedAt: new Date(),
    };
  }

  async searchUsers(searchDto: AdminSearchDto) {
    const {
      search,
      userType,
      verificationStatus,
      isActive,
      isTopInfluencer,
      nicheIds,
      countryId,
      cityId,
      sortBy,
      sortOrder,
      page,
      limit,
    } = searchDto;

    const offset = ((page ?? 1) - 1) * (limit ?? 10);
    let results: CombinedUserResult[] = [];
    let total = 0;

    if (!userType || userType === UserType.INFLUENCER) {
      const influencerResults = await this.searchInfluencers({
        search,
        verificationStatus,
        isActive,
        isTopInfluencer,
        nicheIds,
        countryId,
        cityId,
        sortBy,
        sortOrder,
        limit: limit ?? 10,
        offset: userType === UserType.INFLUENCER ? offset : 0,
      });

      if (userType === UserType.INFLUENCER) {
        return influencerResults;
      }

      results.push(
        ...influencerResults.data.map((user) => ({
          ...user,
          userType: 'influencer' as const,
        })),
      );
      total += influencerResults.total;
    }

    if (!userType || userType === UserType.BRAND) {
      const brandResults = await this.searchBrands({
        search,
        verificationStatus,
        isActive,
        nicheIds,
        countryId,
        cityId,
        sortBy,
        sortOrder,
        limit: limit ?? 10,
        offset: userType === UserType.BRAND ? offset : 0,
      });

      if (userType === UserType.BRAND) {
        return brandResults;
      }

      results.push(
        ...brandResults.data.map((user) => ({
          ...user,
          userType: 'brand' as const,
        })),
      );
      total += brandResults.total;
    }

    // If searching both, sort combined results
    if (!userType) {
      results = results
        .sort((a, b) => {
          const field = sortBy === SortField.NAME ? 'name' : 'createdAt';
          const aVal = a[field];
          const bVal = b[field];

          if (sortOrder === SortOrder.ASC) {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        })
        .slice(offset, offset + (limit ?? 10));
    }

    const totalPages = Math.ceil(total / (limit ?? 10));

    return {
      data: results,
      total,
      page,
      limit,
      totalPages,
      hasNext: (page ?? 1) < totalPages,
      hasPrevious: (page ?? 1) > 1,
    };
  }

  private async searchInfluencers(params: any) {
    const {
      search,
      verificationStatus,
      isActive,
      isTopInfluencer,
      nicheIds,
      countryId,
      cityId,
      sortBy,
      sortOrder,
      limit,
      offset,
    } = params;

    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (verificationStatus === VerificationStatus.VERIFIED) {
      whereClause.isVerified = true;
    } else if (verificationStatus === VerificationStatus.REJECTED) {
      whereClause.isVerified = false;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (isTopInfluencer !== undefined) {
      whereClause.isTopInfluencer = isTopInfluencer;
    }

    if (countryId) {
      whereClause.countryId = countryId;
    }

    if (cityId) {
      whereClause.cityId = cityId;
    }

    const include = [
      {
        model: this.nicheModel,
        attributes: ['id', 'name'],
        through: { attributes: [] },
        ...(nicheIds && { where: { id: { [Op.in]: nicheIds } } }),
      },
      {
        model: this.countryModel,
        attributes: ['id', 'name', 'code'],
      },
      {
        model: this.cityModel,
        attributes: ['id', 'name', 'state'],
      },
    ];

    const orderField = sortBy === 'name' ? 'name' : 'createdAt';
    const order: Order = [[orderField, sortOrder || 'DESC']];

    const { count, rows } = await this.influencerModel.findAndCountAll({
      where: whereClause,
      include,
      limit,
      offset,
      order,
      distinct: true,
    });

    const data = rows.map((influencer) => ({
      id: influencer.id,
      name: influencer.name,
      username: influencer.username,
      phone: influencer.phone,
      profileImage: influencer.profileImage,
      isActive: influencer.isActive,
      isVerified: influencer.isVerified,
      isTopInfluencer: influencer.isTopInfluencer,
      isWhatsappVerified: influencer.isWhatsappVerified,
      country: influencer.country,
      city: influencer.city,
      niches: influencer.niches,
      createdAt: influencer.createdAt,
      updatedAt: influencer.updatedAt,
    }));

    const totalPages = Math.ceil(count / limit);

    return {
      data,
      total: count,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages,
      hasNext: offset + limit < count,
      hasPrevious: offset > 0,
    };
  }

  private async searchBrands(params: any) {
    const {
      search,
      verificationStatus,
      isActive,
      nicheIds,
      countryId,
      cityId,
      sortBy,
      sortOrder,
      limit,
      offset,
    } = params;

    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { brandName: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { legalEntityName: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (verificationStatus === VerificationStatus.VERIFIED) {
      whereClause.isVerified = true;
    } else if (verificationStatus === VerificationStatus.REJECTED) {
      whereClause.isVerified = false;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (countryId) {
      whereClause.headquarterCountryId = countryId;
    }

    if (cityId) {
      whereClause.headquarterCityId = cityId;
    }

    const include = [
      {
        model: this.nicheModel,
        attributes: ['id', 'name'],
        through: { attributes: [] },
        ...(nicheIds && { where: { id: { [Op.in]: nicheIds } } }),
      },
      {
        model: this.countryModel,
        as: 'headquarterCountry',
        attributes: ['id', 'name', 'code'],
      },
      {
        model: this.cityModel,
        as: 'headquarterCity',
        attributes: ['id', 'name', 'state'],
      },
    ];

    const orderField = sortBy === 'name' ? 'brandName' : 'createdAt';
    const order: Order = [[orderField, sortOrder || 'DESC']];

    const { count, rows } = await this.brandModel.findAndCountAll({
      where: whereClause,
      include,
      limit,
      offset,
      order,
      distinct: true,
    });

    const data = rows.map((brand) => ({
      id: brand.id,
      name: brand.brandName,
      username: brand.username,
      email: brand.email,
      legalEntityName: brand.legalEntityName,
      profileImage: brand.profileImage,
      isActive: brand.isActive,
      isVerified: brand.isVerified,
      isEmailVerified: brand.isEmailVerified,
      headquarterCountry: brand.headquarterCountry,
      headquarterCity: brand.headquarterCity,
      niches: brand.niches,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    }));

    const totalPages = Math.ceil(count / limit);

    return {
      data,
      total: count,
      page: Math.floor(offset / limit) + 1,
      limit,
      totalPages,
      hasNext: offset + limit < count,
      hasPrevious: offset > 0,
    };
  }

  // Brand Management Methods
  async getBrandDetails(brandId: number) {
    const brand = await this.brandModel.findByPk(brandId, {
      include: [
        {
          model: this.nicheModel,
          attributes: ['id', 'name', 'description'],
          through: { attributes: [] },
        },
        {
          model: this.countryModel,
          as: 'headquarterCountry',
          attributes: ['id', 'name', 'code'],
        },
        {
          model: this.cityModel,
          as: 'headquarterCity',
          attributes: ['id', 'name', 'state'],
        },
        {
          model: this.companyTypeModel,
          as: 'companyType',
          attributes: ['id', 'name', 'description'],
        },
      ],
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return {
      id: brand.id,
      brandName: brand.brandName,
      username: brand.username,
      email: brand.email,
      legalEntityName: brand.legalEntityName,
      brandEmailId: brand.brandEmailId,
      pocName: brand.pocName,
      pocDesignation: brand.pocDesignation,
      pocEmailId: brand.pocEmailId,
      pocContactNumber: brand.pocContactNumber,
      brandBio: brand.brandBio,
      profileHeadline: brand.profileHeadline,
      websiteUrl: brand.websiteUrl,
      foundedYear: brand.foundedYear,
      profileImage: brand.profileImage,
      profileBanner: brand.profileBanner,
      incorporationDocument: brand.incorporationDocument,
      gstDocument: brand.gstDocument,
      panDocument: brand.panDocument,
      facebookUrl: brand.facebookUrl,
      instagramUrl: brand.instagramUrl,
      youtubeUrl: brand.youtubeUrl,
      linkedinUrl: brand.linkedinUrl,
      twitterUrl: brand.twitterUrl,
      isActive: brand.isActive,
      isVerified: brand.isVerified,
      isEmailVerified: brand.isEmailVerified,
      isProfileCompleted: brand.isProfileCompleted,
      headquarterCountry: brand.headquarterCountry,
      headquarterCity: brand.headquarterCity,
      companyType: brand.companyType,
      niches: brand.niches,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  async updateBrandStatus(brandId: number, isActive: boolean, adminId: number) {
    const brand = await this.brandModel.findByPk(brandId);

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    await brand.update({ isActive });

    // Log the action
    console.log(
      `Admin ${adminId} ${isActive ? 'activated' : 'deactivated'} brand ${brandId}`,
    );

    return {
      message: `Brand ${isActive ? 'activated' : 'deactivated'} successfully`,
      brandId,
      isActive,
      updatedAt: new Date(),
    };
  }

  async advancedBrandSearch(searchDto: AdminSearchDto) {
    // For now, use the same logic as general brand search
    // This can be extended with brand-specific filters later
    return this.searchBrands(searchDto);
  }
}
