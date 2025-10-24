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
import { Campaign, CampaignStatus } from '../campaign/models/campaign.model';
import {
  CampaignApplication,
  ApplicationStatus,
} from '../campaign/models/campaign-application.model';
import { CampaignDeliverable } from '../campaign/models/campaign-deliverable.model';
import { CampaignCity } from '../campaign/models/campaign-city.model';
import {
  AdminSearchDto,
  UserType,
  VerificationStatus,
  SortField,
  SortOrder,
} from './dto/admin-search.dto';
import {
  TopBrandsRequestDto,
  TopBrandsResponseDto,
  TopBrandDto,
  TopBrandsSortBy,
  TopBrandsTimeframe,
} from './dto/top-brands.dto';
import {
  TopCampaignsRequestDto,
  TopCampaignsResponseDto,
  TopCampaignsSortBy,
  TopCampaignsTimeframe,
  TopCampaignsStatus,
} from './dto/top-campaigns.dto';
import { Op, Order, Sequelize, literal } from 'sequelize';

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
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignApplication)
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(CampaignDeliverable)
    private readonly campaignDeliverableModel: typeof CampaignDeliverable,
    @InjectModel(CampaignCity)
    private readonly campaignCityModel: typeof CampaignCity,
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

    return {
      ...admin.toJSON(),
      userType: 'admin' as const,
    };
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

  async updateTopBrandStatus(
    brandId: number,
    isTopBrand: boolean,
    adminId: number,
  ) {
    // First check if brand exists
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Update the top brand status
    await brand.update({ isTopBrand });

    return {
      message: `Brand ${isTopBrand ? 'marked as' : 'removed from'} top brand`,
      brandId,
      isTopBrand,
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
      userType: 'brand' as const,
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

  async getTopBrands(
    requestDto: TopBrandsRequestDto,
  ): Promise<TopBrandsResponseDto> {
    const { sortBy, timeframe, limit } = requestDto;

    // Calculate date filter based on timeframe
    let dateFilter: any = {};
    if (timeframe === TopBrandsTimeframe.THIRTY_DAYS) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { createdAt: { [Op.gte]: thirtyDaysAgo } };
    } else if (timeframe === TopBrandsTimeframe.NINETY_DAYS) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      dateFilter = { createdAt: { [Op.gte]: ninetyDaysAgo } };
    }

    // Get all qualified brands with their metrics
    const brandsWithMetrics = await this.brandModel.findAll({
      where: {
        isVerified: true,
        isActive: true,
        isProfileCompleted: true,
      },
      attributes: [
        'id',
        'brandName',
        'username',
        'email',
        'profileImage',
        'brandBio',
        'websiteUrl',
        'isVerified',
        'createdAt',
      ],
      include: [
        {
          model: this.campaignModel,
          as: 'campaigns',
          attributes: ['id', 'nicheIds', 'createdAt', 'status'],
          where: {
            ...dateFilter,
            status: { [Op.ne]: CampaignStatus.CANCELLED },
          },
          required: false,
          include: [
            {
              model: this.campaignDeliverableModel,
              as: 'deliverables',
              attributes: ['budget'],
              required: false,
            },
            {
              model: this.campaignApplicationModel,
              as: 'applications',
              attributes: ['status'],
              where: {
                status: ApplicationStatus.SELECTED,
              },
              required: false,
            },
          ],
        },
      ],
    });

    // Calculate metrics for each brand
    const brandsWithCalculatedMetrics = brandsWithMetrics
      .map((brand) => {
        const campaigns = brand.get('campaigns') as any[] || [];

        // Metric 1: Total campaigns
        const totalCampaigns = campaigns.length;

        // Metric 2: Unique niches count
        const allNicheIds = campaigns
          .flatMap((c) => c.nicheIds || [])
          .filter((id) => id !== null && id !== undefined);
        const uniqueNichesCount = new Set(allNicheIds).size;

        // Metric 3: Selected influencers count
        const selectedInfluencersCount = campaigns.reduce((sum, campaign) => {
          const applications = campaign.applications || [];
          return sum + applications.length;
        }, 0);

        // Metric 4: Average payout
        let totalBudget = 0;
        let campaignsWithBudget = 0;
        campaigns.forEach((campaign) => {
          const deliverables = campaign.deliverables || [];
          if (deliverables.length > 0) {
            const campaignBudget = deliverables.reduce(
              (sum, d) => sum + (parseFloat(d.budget as any) || 0),
              0,
            );
            if (campaignBudget > 0) {
              totalBudget += campaignBudget;
              campaignsWithBudget++;
            }
          }
        });
        const averagePayout =
          campaignsWithBudget > 0 ? totalBudget / campaignsWithBudget : 0;

        return {
          brand,
          metrics: {
            totalCampaigns,
            uniqueNichesCount,
            selectedInfluencersCount,
            averagePayout,
          },
        };
      })
      .filter((item) => {
        // Apply minimum qualification filters
        return (
          item.metrics.totalCampaigns >= 2 &&
          item.metrics.uniqueNichesCount >= 2 &&
          item.metrics.selectedInfluencersCount >= 1
        );
      });

    // Find max values for normalization
    const maxCampaigns = Math.max(
      ...brandsWithCalculatedMetrics.map((b) => b.metrics.totalCampaigns),
      1,
    );
    const maxNiches = Math.max(
      ...brandsWithCalculatedMetrics.map((b) => b.metrics.uniqueNichesCount),
      1,
    );
    const maxInfluencers = Math.max(
      ...brandsWithCalculatedMetrics.map(
        (b) => b.metrics.selectedInfluencersCount,
      ),
      1,
    );
    const maxPayout = Math.max(
      ...brandsWithCalculatedMetrics.map((b) => b.metrics.averagePayout),
      1,
    );

    // Calculate composite score and prepare final data
    const brandsWithScores = brandsWithCalculatedMetrics.map((item) => {
      const { brand, metrics } = item;

      // Normalize metrics (0-100 scale)
      const normalizedCampaigns = (metrics.totalCampaigns / maxCampaigns) * 100;
      const normalizedNiches = (metrics.uniqueNichesCount / maxNiches) * 100;
      const normalizedInfluencers =
        (metrics.selectedInfluencersCount / maxInfluencers) * 100;
      const normalizedPayout = (metrics.averagePayout / maxPayout) * 100;

      // Calculate composite score (equal weights: 25% each)
      const compositeScore =
        normalizedCampaigns * 0.25 +
        normalizedNiches * 0.25 +
        normalizedInfluencers * 0.25 +
        normalizedPayout * 0.25;

      return {
        id: brand.id,
        brandName: brand.brandName,
        username: brand.username,
        email: brand.email,
        profileImage: brand.profileImage,
        brandBio: brand.brandBio,
        websiteUrl: brand.websiteUrl,
        isVerified: brand.isVerified,
        createdAt: brand.createdAt,
        metrics: {
          totalCampaigns: metrics.totalCampaigns,
          uniqueNichesCount: metrics.uniqueNichesCount,
          selectedInfluencersCount: metrics.selectedInfluencersCount,
          averagePayout: Math.round(metrics.averagePayout * 100) / 100,
          compositeScore: Math.round(compositeScore * 100) / 100,
        },
        sortValues: {
          campaigns: normalizedCampaigns,
          niches: normalizedNiches,
          influencers: normalizedInfluencers,
          payout: normalizedPayout,
          composite: compositeScore,
        },
      };
    });

    // Sort based on sortBy parameter
    const sortField =
      sortBy === TopBrandsSortBy.CAMPAIGNS
        ? 'campaigns'
        : sortBy === TopBrandsSortBy.NICHES
          ? 'niches'
          : sortBy === TopBrandsSortBy.INFLUENCERS
            ? 'influencers'
            : sortBy === TopBrandsSortBy.PAYOUT
              ? 'payout'
              : 'composite';

    brandsWithScores.sort(
      (a, b) => b.sortValues[sortField] - a.sortValues[sortField],
    );

    // Get top N brands
    const topBrands = brandsWithScores.slice(0, limit).map((item) => ({
      id: item.id,
      brandName: item.brandName,
      username: item.username,
      email: item.email,
      profileImage: item.profileImage,
      brandBio: item.brandBio,
      websiteUrl: item.websiteUrl,
      isVerified: item.isVerified,
      metrics: item.metrics,
      createdAt: item.createdAt,
    }));

    return {
      brands: topBrands,
      total: brandsWithScores.length,
      sortBy: sortBy || TopBrandsSortBy.COMPOSITE,
      timeframe: timeframe || TopBrandsTimeframe.ALL_TIME,
      limit: limit || 10,
    };
  }

  async getTopCampaigns(
    requestDto: TopCampaignsRequestDto,
  ): Promise<TopCampaignsResponseDto> {
    const { sortBy, timeframe, status, verifiedBrandsOnly, limit } = requestDto;

    // Calculate date filter based on timeframe
    let dateFilter: any = {};
    if (timeframe === TopCampaignsTimeframe.SEVEN_DAYS) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = { createdAt: { [Op.gte]: sevenDaysAgo } };
    } else if (timeframe === TopCampaignsTimeframe.THIRTY_DAYS) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { createdAt: { [Op.gte]: thirtyDaysAgo } };
    } else if (timeframe === TopCampaignsTimeframe.NINETY_DAYS) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      dateFilter = { createdAt: { [Op.gte]: ninetyDaysAgo } };
    }

    // Status filter
    let statusFilter: any = { [Op.ne]: CampaignStatus.CANCELLED };
    if (status === TopCampaignsStatus.ACTIVE) {
      statusFilter = CampaignStatus.ACTIVE;
    } else if (status === TopCampaignsStatus.COMPLETED) {
      statusFilter = CampaignStatus.COMPLETED;
    }

    // Brand filter
    const brandWhere: any = {};
    if (verifiedBrandsOnly) {
      brandWhere.isVerified = true;
    }

    // Fetch campaigns with all related data
    const campaigns = await this.campaignModel.findAll({
      where: {
        ...dateFilter,
        status: statusFilter,
      },
      include: [
        {
          model: this.brandModel,
          as: 'brand',
          attributes: ['id', 'brandName', 'username', 'profileImage', 'isVerified'],
          where: brandWhere,
          required: true,
        },
        {
          model: this.campaignApplicationModel,
          as: 'applications',
          attributes: ['id', 'status', 'createdAt'],
          required: false,
        },
        {
          model: this.campaignDeliverableModel,
          as: 'deliverables',
          attributes: ['id', 'budget'],
          required: false,
        },
        {
          model: this.campaignCityModel,
          as: 'cities',
          attributes: ['id', 'cityId'],
          required: false,
        },
      ],
    });

    // Calculate metrics for each campaign
    const campaignsWithMetrics = campaigns
      .map((campaign) => {
        const applications = campaign.get('applications') as any[] || [];
        const deliverables = campaign.get('deliverables') as any[] || [];
        const cities = campaign.get('cities') as any[] || [];
        const brand = campaign.get('brand') as any;

        // Application Metrics
        const applicationsCount = applications.length;
        const selectedApplications = applications.filter(
          (app) => app.status === ApplicationStatus.SELECTED,
        );
        const selectedInfluencers = selectedApplications.length;
        const conversionRate =
          applicationsCount > 0 ? (selectedInfluencers / applicationsCount) * 100 : 0;

        // Simple applicant quality score (can be enhanced with actual follower/engagement data)
        const applicantQuality = applicationsCount > 0 ? 50 : 0; // Placeholder

        // Budget Metrics
        const totalBudget = deliverables.reduce(
          (sum, d) => sum + (parseFloat(d.budget as any) || 0),
          0,
        );
        const deliverablesCount = deliverables.length;
        const budgetPerDeliverable =
          deliverablesCount > 0 ? totalBudget / deliverablesCount : 0;

        // Scope Metrics
        const isPanIndia = campaign.isPanIndia;
        const citiesCount = cities.length;
        const nichesCount = campaign.nicheIds ? campaign.nicheIds.length : 0;
        const geographicReach = isPanIndia
          ? 100
          : Math.min((citiesCount / 10) * 100, 100);

        // Engagement Metrics
        const completionRate =
          campaign.status === CampaignStatus.COMPLETED
            ? 100
            : campaign.status === CampaignStatus.ACTIVE
              ? 50
              : 0;

        // Recency Metrics
        const now = new Date();
        const createdAt = new Date(campaign.createdAt);
        const daysSinceLaunch = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        const lastApplication = applications.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];
        const daysSinceLastApplication = lastApplication
          ? Math.floor(
              (now.getTime() - new Date(lastApplication.createdAt).getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

        return {
          campaign,
          brand,
          metrics: {
            application: {
              applicationsCount,
              conversionRate,
              applicantQuality,
            },
            budget: {
              totalBudget,
              budgetPerDeliverable,
              deliverablesCount,
            },
            scope: {
              isPanIndia,
              citiesCount,
              nichesCount,
              geographicReach,
            },
            engagement: {
              selectedInfluencers,
              completionRate,
              status: campaign.status,
            },
            recency: {
              daysSinceLaunch,
              daysSinceLastApplication,
              createdAt: campaign.createdAt,
            },
          },
        };
      })
      .filter((item) => {
        // Apply minimum qualification filters
        return (
          item.metrics.application.applicationsCount >= 3 &&
          item.metrics.budget.deliverablesCount >= 1
        );
      });

    // Find max values for normalization
    const maxApplications = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.application.applicationsCount),
      1,
    );
    const maxBudget = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.budget.totalBudget),
      1,
    );
    const maxBudgetPerDel = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.budget.budgetPerDeliverable),
      1,
    );
    const maxNiches = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.scope.nichesCount),
      1,
    );
    const maxSelected = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.engagement.selectedInfluencers),
      1,
    );
    const maxDaysSinceLaunch = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.recency.daysSinceLaunch),
      1,
    );

    // Calculate composite scores
    const campaignsWithScores = campaignsWithMetrics.map((item) => {
      const { campaign, brand, metrics } = item;

      // Normalize metrics (0-100 scale)
      const normalizedApplications =
        (metrics.application.applicationsCount / maxApplications) * 100;
      const normalizedConversionRate = metrics.application.conversionRate;
      const normalizedApplicantQuality = metrics.application.applicantQuality;
      const normalizedTotalBudget = (metrics.budget.totalBudget / maxBudget) * 100;
      const normalizedBudgetPerDel =
        (metrics.budget.budgetPerDeliverable / maxBudgetPerDel) * 100;
      const normalizedGeographicReach = metrics.scope.geographicReach;
      const normalizedNiches = (metrics.scope.nichesCount / maxNiches) * 100;
      const normalizedSelectedInfluencers =
        (metrics.engagement.selectedInfluencers / maxSelected) * 100;
      const normalizedCompletionRate = metrics.engagement.completionRate;

      // Recency scoring: newer = higher score (inverse)
      const normalizedRecencyLaunch =
        100 - (metrics.recency.daysSinceLaunch / maxDaysSinceLaunch) * 100;
      const normalizedRecencyActivity = metrics.recency.daysSinceLastApplication !== null
        ? 100 - Math.min((metrics.recency.daysSinceLastApplication / 30) * 100, 100)
        : 0;

      // Calculate composite score with weights
      const compositeScore =
        normalizedApplications * 0.1 + // 10%
        normalizedConversionRate * 0.15 + // 15%
        normalizedApplicantQuality * 0.05 + // 5%
        normalizedTotalBudget * 0.1 + // 10%
        normalizedBudgetPerDel * 0.1 + // 10%
        normalizedGeographicReach * 0.08 + // 8%
        normalizedNiches * 0.07 + // 7%
        normalizedSelectedInfluencers * 0.15 + // 15%
        normalizedCompletionRate * 0.1 + // 10%
        normalizedRecencyLaunch * 0.05 + // 5%
        normalizedRecencyActivity * 0.05; // 5%

      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        category: campaign.category,
        type: campaign.type,
        status: campaign.status,
        brand: {
          id: brand.id,
          brandName: brand.brandName,
          username: brand.username,
          profileImage: brand.profileImage,
          isVerified: brand.isVerified,
        },
        metrics: {
          application: {
            applicationsCount: metrics.application.applicationsCount,
            conversionRate: Math.round(metrics.application.conversionRate * 100) / 100,
            applicantQuality: metrics.application.applicantQuality,
          },
          budget: {
            totalBudget: Math.round(metrics.budget.totalBudget * 100) / 100,
            budgetPerDeliverable:
              Math.round(metrics.budget.budgetPerDeliverable * 100) / 100,
            deliverablesCount: metrics.budget.deliverablesCount,
          },
          scope: {
            isPanIndia: metrics.scope.isPanIndia,
            citiesCount: metrics.scope.citiesCount,
            nichesCount: metrics.scope.nichesCount,
            geographicReach: Math.round(metrics.scope.geographicReach * 100) / 100,
          },
          engagement: {
            selectedInfluencers: metrics.engagement.selectedInfluencers,
            completionRate: Math.round(metrics.engagement.completionRate * 100) / 100,
            status: metrics.engagement.status,
          },
          recency: {
            daysSinceLaunch: metrics.recency.daysSinceLaunch,
            daysSinceLastApplication: metrics.recency.daysSinceLastApplication,
            createdAt: metrics.recency.createdAt,
          },
          compositeScore: Math.round(compositeScore * 100) / 100,
        },
        createdAt: campaign.createdAt,
        sortValues: {
          applications_count: normalizedApplications,
          conversion_rate: normalizedConversionRate,
          applicant_quality: normalizedApplicantQuality,
          total_budget: normalizedTotalBudget,
          budget_per_deliverable: normalizedBudgetPerDel,
          geographic_reach: normalizedGeographicReach,
          cities_count: metrics.scope.citiesCount,
          niches_count: normalizedNiches,
          selected_influencers: normalizedSelectedInfluencers,
          completion_rate: normalizedCompletionRate,
          recently_launched: normalizedRecencyLaunch,
          recently_active: normalizedRecencyActivity,
          composite: compositeScore,
        },
      };
    });

    // Sort based on sortBy parameter
    const sortField = sortBy || TopCampaignsSortBy.COMPOSITE;
    campaignsWithScores.sort(
      (a, b) => b.sortValues[sortField] - a.sortValues[sortField],
    );

    // Get top N campaigns
    const topCampaigns = campaignsWithScores.slice(0, limit).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      type: item.type,
      status: item.status,
      brand: item.brand,
      metrics: item.metrics,
      createdAt: item.createdAt,
    }));

    return {
      campaigns: topCampaigns,
      total: campaignsWithScores.length,
      sortBy: sortBy || TopCampaignsSortBy.COMPOSITE,
      timeframe: timeframe || TopCampaignsTimeframe.ALL_TIME,
      statusFilter: status || TopCampaignsStatus.ALL,
      limit: limit || 10,
    };
  }
}
