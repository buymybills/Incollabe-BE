import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Admin, AdminStatus, AdminRole } from './models/admin.model';
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
import { Post } from '../post/models/post.model';
import { Follow } from '../post/models/follow.model';
import {
  ProfileReview,
  ReviewStatus,
  ProfileType,
} from './models/profile-review.model';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../shared/email.service';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
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
  GetBrandsDto,
  BrandProfileFilter,
  BrandSortBy,
} from './dto/get-brands.dto';
import {
  TopCampaignsRequestDto,
  TopCampaignsResponseDto,
  TopCampaignsSortBy,
  TopCampaignsTimeframe,
  TopCampaignsStatus,
} from './dto/top-campaigns.dto';
import { Op, Order, Sequelize, literal } from 'sequelize';

// Interfaces for Top Campaigns
interface CampaignDeliverableJson {
  id: number;
  platform: string;
  type: string;
  budget: number | string | null; // Can be string (DECIMAL from DB) or number
  quantity: number | string; // Can be string from DB
  specifications: string | null;
}

interface CampaignApplicationJson {
  id: number;
  status: string;
  createdAt: Date;
}

interface CampaignBrandJson {
  id: number;
  brandName: string;
  username: string;
  profileImage: string | null;
  isVerified: boolean;
}

interface CampaignJson {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  type: string;
  status: string;
  isPanIndia: boolean;
  nicheIds: number[] | null;
  createdAt: Date;
  updatedAt: Date;
  applications?: CampaignApplicationJson[];
  deliverables?: CampaignDeliverableJson[];
  cities?: any[];
  brand?: CampaignBrandJson;
}

interface CampaignMetrics {
  application: {
    applicationsCount: number;
    conversionRate: number;
    applicantQuality: number;
  };
  budget: {
    totalBudget: number;
    budgetPerDeliverable: number;
    deliverablesCount: number;
  };
  scope: {
    isPanIndia: boolean;
    citiesCount: number;
    nichesCount: number;
    geographicReach: number;
  };
  engagement: {
    selectedInfluencers: number;
    completionRate: number;
    status: string;
  };
  recency: {
    daysSinceLaunch: number;
    daysSinceLastApplication: number | null;
    createdAt: Date;
  };
}

interface CampaignWithMetrics {
  campaign: CampaignJson;
  brand: CampaignBrandJson;
  deliverables: CampaignDeliverableJson[];
  metrics: CampaignMetrics;
}

interface CampaignWithScores extends CampaignWithMetrics {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  type: string;
  status: string;
  deliverables: CampaignDeliverableJson[];
  brand: CampaignBrandJson;
  metrics: CampaignMetrics & { compositeScore: number };
  createdAt: Date;
  updatedAt: Date;
  sortValues: {
    applications_count: number;
    conversion_rate: number;
    applicant_quality: number;
    total_budget: number;
    budget_per_deliverable: number;
    geographic_reach: number;
    cities_count: number;
    niches_count: number;
    selected_influencers: number;
    completion_rate: number;
    recently_launched: number;
    recently_active: number;
    composite: number;
  };
}

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
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
    @InjectModel(ProfileReview)
    private readonly profileReviewModel: typeof ProfileReview,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  // Redis key helpers
  private adminOtpKey(email: string): string {
    return `admin:otp:${email}`;
  }

  private adminOtpAttemptsKey(email: string): string {
    return `admin:otp:attempts:${email}`;
  }

  // Redis key helper for password reset
  private passwordResetKey(token: string): string {
    return `admin:password-reset:${token}`;
  }

  // Redis key helper for refresh token sessions
  private refreshTokenKey(jti: string): string {
    return `admin:refresh:${jti}`;
  }

  // Redis key helper for blacklisted tokens
  private blacklistKey(jti: string): string {
    return `admin:blacklist:${jti}`;
  }

  // Redis key helper for admin's active sessions set
  private sessionsSetKey(adminId: number): string {
    return `admin:sessions:${adminId}`;
  }

  /**
   * Generate access and refresh tokens for admin
   */
  private async generateTokens(
    adminId: number,
    email: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    // Generate a single JTI for both access and refresh tokens to enable session tracking
    const jti = randomUUID();

    // Generate access token
    const accessToken = this.jwtService.sign(
      {
        sub: adminId,
        email,
        role,
        type: 'admin',
      },
      { jwtid: jti },
    );

    // Generate refresh token with separate secret and same JTI
    const refreshToken = this.jwtService.sign(
      { sub: adminId, type: 'admin' },
      {
        jwtid: jti,
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        // No expiresIn - token persists until explicitly revoked
      },
    );

    return { accessToken, refreshToken, jti };
  }

  /**
   * Step 1: Login with email and password - Send OTP (if 2FA enabled) or return tokens directly
   */
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

    // Check if 2FA is enabled for this admin
    if (!admin.twoFactorEnabled) {
      // 2FA disabled - login directly without OTP
      await admin.update({ lastLoginAt: new Date() });

      // Generate access and refresh tokens
      const { accessToken, refreshToken, jti } = await this.generateTokens(
        admin.id,
        admin.email,
        admin.role,
      );

      // Store refresh token JTI in Redis for session management
      await this.redisService.set(
        this.refreshTokenKey(jti),
        JSON.stringify({
          adminId: admin.id,
          email: admin.email,
          createdAt: new Date().toISOString(),
        }),
        // 30 days in seconds
        30 * 24 * 60 * 60,
      );

      // Add JTI to admin's active sessions set
      await this.redisService
        .getClient()
        .sadd(this.sessionsSetKey(admin.id), jti);

      return {
        accessToken,
        refreshToken,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
        },
        requiresOtp: false,
      };
    }

    // 2FA enabled - send OTP
    const isStaging = this.configService.get<string>('NODE_ENV') === 'staging';
    const otp = isStaging
      ? '123456'
      : Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5 minutes expiry
    const otpKey = this.adminOtpKey(email);
    await this.redisService.set(
      otpKey,
      JSON.stringify({
        otp,
        adminId: admin.id,
        email: admin.email,
        createdAt: new Date().toISOString(),
      }),
      300, // 5 minutes
    );

    // Send OTP via email
    await this.emailService.sendAdminLoginOtp(admin.email, admin.name, otp);

    return {
      message: 'OTP sent to your email. Please verify to complete login.',
      email: admin.email,
      requiresOtp: true,
    };
  }

  /**
   * Step 2: Verify OTP and return JWT token
   */
  async verifyLoginOtp(email: string, otp: string) {
    if (!email || !otp) {
      throw new BadRequestException('Email and OTP are required');
    }

    // Check failed attempts
    const attemptsKey = this.adminOtpAttemptsKey(email);
    const attempts = await this.redisService.get(attemptsKey);
    const attemptCount = attempts ? parseInt(attempts) : 0;

    if (attemptCount >= 5) {
      throw new UnauthorizedException(
        'Too many failed attempts. Please request a new OTP.',
      );
    }

    // Get OTP from Redis
    const otpKey = this.adminOtpKey(email);
    const otpData = await this.redisService.get(otpKey);

    if (!otpData) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    const { otp: storedOtp, adminId } = JSON.parse(otpData);

    // Verify OTP
    if (otp !== storedOtp) {
      // Increment failed attempts
      await this.redisService.set(
        attemptsKey,
        (attemptCount + 1).toString(),
        300,
      );
      throw new UnauthorizedException('Invalid OTP');
    }

    // OTP is valid - get admin details
    const admin = await this.adminModel.findByPk(adminId);

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    // Clear OTP and attempts from Redis
    await this.redisService.del(otpKey);
    await this.redisService.del(attemptsKey);

    // Update last login
    await admin.update({ lastLoginAt: new Date() });

    // Generate access and refresh tokens
    const { accessToken, refreshToken, jti } = await this.generateTokens(
      admin.id,
      admin.email,
      admin.role,
    );

    // Store refresh token JTI in Redis for session management
    await this.redisService.set(
      this.refreshTokenKey(jti),
      JSON.stringify({
        adminId: admin.id,
        email: admin.email,
        createdAt: new Date().toISOString(),
      }),
      // 30 days in seconds
      30 * 24 * 60 * 60,
    );

    // Add JTI to admin's active sessions set
    await this.redisService
      .getClient()
      .sadd(this.sessionsSetKey(admin.id), jti);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        profileImage: admin.profileImage,
      },
    };
  }

  /**
   * Resend OTP for admin login
   */
  async resendLoginOtp(email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const admin = await this.adminModel.findOne({
      where: { email },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.status !== AdminStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    // Generate new 6-digit OTP based on environment
    const isStaging = this.configService.get<string>('NODE_ENV') === 'staging';
    const otp = isStaging
      ? '123456'
      : Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 5 minutes expiry
    const otpKey = this.adminOtpKey(email);
    await this.redisService.set(
      otpKey,
      JSON.stringify({
        otp,
        adminId: admin.id,
        email: admin.email,
        createdAt: new Date().toISOString(),
      }),
      300, // 5 minutes
    );

    // Reset failed attempts
    const attemptsKey = this.adminOtpAttemptsKey(email);
    await this.redisService.del(attemptsKey);

    // Send OTP via email
    await this.emailService.sendAdminLoginOtp(admin.email, admin.name, otp);

    return {
      message: 'New OTP sent to your email',
      email: admin.email,
    };
  }

  /**
   * Logout from single device by revoking refresh token
   */
  async logout(refreshToken: string) {
    try {
      // Verify and decode the refresh token
      const decoded: any = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const adminId = decoded.sub;
      const jti = decoded.jti;

      if (!adminId || !jti) {
        return { message: 'Logged out' };
      }

      // Remove session from Redis and blacklist the token
      const sessionKey = this.refreshTokenKey(jti);
      const sessionsSetKey = this.sessionsSetKey(adminId);
      const blacklistKey = this.blacklistKey(jti);

      // Calculate TTL for blacklist (30 days)
      const ttl = 30 * 24 * 60 * 60;

      await this.redisService
        .getClient()
        .multi()
        .set(blacklistKey, '1', 'EX', ttl)
        .del(sessionKey)
        .srem(sessionsSetKey, jti)
        .exec();

      return { message: 'Logged out' };
    } catch (error) {
      // Invalid token - still return success for security
      return { message: 'Logged out' };
    }
  }

  /**
   * Logout from all devices by revoking all refresh tokens
   */
  async logoutAll(adminId: number) {
    const sessionsSetKey = this.sessionsSetKey(adminId);
    const jtis = await this.redisService.getClient().smembers(sessionsSetKey);

    if (jtis.length) {
      const multi = this.redisService.getClient().multi();

      for (const jti of jtis) {
        // Delete session key
        multi.del(this.refreshTokenKey(jti));

        // Blacklist token for 30 days
        multi.set(this.blacklistKey(jti), '1', 'EX', 30 * 24 * 60 * 60);
      }

      // Remove the sessions set
      multi.del(sessionsSetKey);

      await multi.exec();
    }

    return { message: 'Logged out from all devices' };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      // Verify and decode the refresh token
      const decoded: any = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const adminId = decoded.sub;
      const jti = decoded.jti;

      if (!adminId || !jti) {
        throw new UnauthorizedException('Malformed refresh token');
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.redisService
        .getClient()
        .get(this.blacklistKey(jti));
      if (isBlacklisted) {
        throw new ForbiddenException('Refresh token revoked');
      }

      // Check if session exists
      const sessionExists = await this.redisService
        .getClient()
        .get(this.refreshTokenKey(jti));
      if (!sessionExists) {
        throw new UnauthorizedException('Session expired or revoked');
      }

      // Get admin details
      const admin = await this.adminModel.findByPk(adminId);
      if (!admin || admin.status !== AdminStatus.ACTIVE) {
        throw new UnauthorizedException('Admin not found or inactive');
      }

      // Generate new tokens
      const {
        accessToken,
        refreshToken: newRefreshToken,
        jti: newJti,
      } = await this.generateTokens(adminId, admin.email, admin.role);

      // Rotate session in Redis
      await this.rotateSession(adminId, jti, newJti);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Helper: Rotate refresh token session
   */
  private async rotateSession(adminId: number, oldJti: string, newJti: string) {
    const oldKey = this.refreshTokenKey(oldJti);
    const newKey = this.refreshTokenKey(newJti);
    const sessionsSetKey = this.sessionsSetKey(adminId);

    // Get old session data
    const oldSession = await this.redisService.getClient().get(oldKey);
    const sessionData = oldSession
      ? JSON.parse(oldSession)
      : { adminId, createdAt: new Date().toISOString() };

    // Update rotation timestamp
    sessionData.rotatedAt = new Date().toISOString();

    // Atomic operations to rotate session
    await this.redisService
      .getClient()
      .multi()
      .del(oldKey)
      .srem(sessionsSetKey, oldJti)
      .set(newKey, JSON.stringify(sessionData), 'EX', 30 * 24 * 60 * 60)
      .sadd(sessionsSetKey, newJti)
      .exec();

    // Blacklist old token
    await this.redisService
      .getClient()
      .set(this.blacklistKey(oldJti), '1', 'EX', 30 * 24 * 60 * 60);
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
      limit: limit || 10,
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

    const totalPages = Math.ceil(count / (limit || 10));

    return {
      data,
      total: count,
      page: Math.floor(offset / (limit || 10)) + 1,
      limit: limit || 10,
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
      limit: limit || 10,
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
        isTopBrand: true,
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

    console.log(
      `Found ${brandsWithMetrics.length} verified brands with isVerified=true, isActive=true, isProfileCompleted=true`,
    );

    // Calculate metrics for each brand
    const brandsWithCalculatedMetrics = brandsWithMetrics
      .map((brand) => {
        const campaigns = (brand.get('campaigns') as any[]) || [];

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
              (sum, d) => sum + (parseFloat(d.budget) || 0),
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
        // Apply minimum qualification filters - relaxed for better results
        // At least 1 campaign to be considered
        return item.metrics.totalCampaigns >= 1;
      });

    console.log(
      `After filtering: ${brandsWithCalculatedMetrics.length} brands with at least 1 campaign`,
    );

    // If no brands meet criteria, return empty result
    if (brandsWithCalculatedMetrics.length === 0) {
      console.warn('No brands found matching the criteria');
      return {
        brands: [],
        total: 0,
        sortBy: sortBy || TopBrandsSortBy.COMPOSITE,
        timeframe: timeframe || TopBrandsTimeframe.ALL_TIME,
        limit: limit ?? 10,
      };
    }

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
        isTopBrand: brand.isTopBrand || false,
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
      isTopBrand: item.isTopBrand,
      metrics: item.metrics,
      createdAt: item.createdAt,
    }));

    return {
      brands: topBrands,
      total: brandsWithScores.length,
      sortBy: sortBy || TopBrandsSortBy.COMPOSITE,
      timeframe: timeframe || TopBrandsTimeframe.ALL_TIME,
      limit: limit ?? 10,
    };
  }

  /**
   * Get brands with different profile filters
   * - allProfile: All profiles ordered by createdAt asc
   * - topProfile: Top profiles using scoring metrics (same as getTopBrands)
   * - verifiedProfile: Verified profiles ordered by createdAt asc
   * - unverifiedProfile: Unverified profiles ordered by createdAt asc
   */
  async getBrands(filters: GetBrandsDto): Promise<TopBrandsResponseDto> {
    const {
      profileFilter,
      sortBy = BrandSortBy.CREATED_AT,
      searchQuery,
      locationSearch,
      nicheSearch,
      minCampaigns,
      minSelectedInfluencers,
      minCompositeScore,
      page = 1,
      limit = 20,
    } = filters;

    // For topProfile, use the existing scoring logic
    if (profileFilter === BrandProfileFilter.TOP_PROFILE) {
      const topBrandsRequest: TopBrandsRequestDto = {
        sortBy:
          sortBy === BrandSortBy.COMPOSITE
            ? TopBrandsSortBy.COMPOSITE
            : TopBrandsSortBy.CAMPAIGNS,
        timeframe: TopBrandsTimeframe.ALL_TIME,
        limit: limit || 20,
      };
      const result = await this.getTopBrands(topBrandsRequest);

      // Apply additional filters if provided
      let filteredBrands = result.brands;

      // Apply search filters
      if (searchQuery && searchQuery.trim()) {
        const search = searchQuery.trim().toLowerCase();
        filteredBrands = filteredBrands.filter(
          (b) =>
            b.brandName?.toLowerCase().includes(search) ||
            b.username?.toLowerCase().includes(search),
        );
      }

      if (minCampaigns !== undefined) {
        filteredBrands = filteredBrands.filter(
          (b) => b.metrics.totalCampaigns >= minCampaigns,
        );
      }

      if (minSelectedInfluencers !== undefined) {
        filteredBrands = filteredBrands.filter(
          (b) => b.metrics.selectedInfluencersCount >= minSelectedInfluencers,
        );
      }

      if (minCompositeScore !== undefined) {
        filteredBrands = filteredBrands.filter(
          (b) => b.metrics.compositeScore >= minCompositeScore,
        );
      }

      // Apply pagination
      const total = filteredBrands.length;
      const totalPages = Math.ceil(total / (limit ?? 20));
      const offset = (page - 1) * (limit ?? 20);
      const paginatedBrands = filteredBrands.slice(
        offset,
        offset + (limit ?? 20),
      );

      return {
        brands: paginatedBrands,
        total,
        sortBy:
          sortBy === BrandSortBy.COMPOSITE
            ? TopBrandsSortBy.COMPOSITE
            : TopBrandsSortBy.CAMPAIGNS,
        timeframe: TopBrandsTimeframe.ALL_TIME,
        limit: limit ?? 20,
      };
    }

    // For other filters, build appropriate where conditions
    const whereConditions: any = {
      isProfileCompleted: true,
      isActive: true,
    };

    // Apply search query for brand name or username
    if (searchQuery && searchQuery.trim()) {
      whereConditions[Op.or] = [
        { brandName: { [Op.iLike]: `%${searchQuery.trim()}%` } },
        { username: { [Op.iLike]: `%${searchQuery.trim()}%` } },
      ];
    }

    // Apply profile filter
    switch (profileFilter) {
      case BrandProfileFilter.VERIFIED_PROFILE:
        whereConditions.isVerified = true;
        break;
      case BrandProfileFilter.UNVERIFIED_PROFILE:
        whereConditions.isVerified = false;
        break;
      case BrandProfileFilter.ALL_PROFILE:
      default:
        // No additional filter for all profiles
        break;
    }

    // Build dynamic includes for city and niche search
    const cityInclude: any = {
      model: this.cityModel,
      as: 'headquarterCity',
    };
    if (locationSearch && locationSearch.trim()) {
      cityInclude.where = {
        name: { [Op.iLike]: `%${locationSearch.trim()}%` },
      };
      cityInclude.required = true; // Inner join to filter results
    }

    const nicheInclude: any = {
      model: this.nicheModel,
      as: 'niches',
      through: { attributes: [] },
    };
    if (nicheSearch && nicheSearch.trim()) {
      nicheInclude.where = {
        name: { [Op.iLike]: `%${nicheSearch.trim()}%` },
      };
      nicheInclude.required = true; // Inner join to filter results
    }

    // Fetch brands ordered by createdAt asc
    const allBrands = await this.brandModel.findAll({
      where: whereConditions,
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
        cityInclude,
        nicheInclude,
        {
          model: this.campaignModel,
          as: 'campaigns',
          attributes: ['id', 'nicheIds', 'status'],
          where: {
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
      order: [['createdAt', 'ASC']], // Default order, will be re-sorted based on sortBy
    });

    // Map brands and calculate metrics (including posts, followers, following)
    const mappedBrands = await Promise.all(
      allBrands.map(async (brand) => {
        const campaigns = (brand.get('campaigns') as any[]) || [];

        // Calculate metrics
        const totalCampaigns = campaigns.length;

        const allNicheIds = campaigns
          .flatMap((c) => c.nicheIds || [])
          .filter((id) => id !== null && id !== undefined);
        const uniqueNichesCount = new Set(allNicheIds).size;

        const selectedInfluencersCount = campaigns.reduce((sum, campaign) => {
          const applications = campaign.applications || [];
          return sum + applications.length;
        }, 0);

        let totalBudget = 0;
        let campaignsWithBudget = 0;
        campaigns.forEach((campaign) => {
          const deliverables = campaign.deliverables || [];
          if (deliverables.length > 0) {
            const campaignBudget = deliverables.reduce(
              (sum, d) => sum + (parseFloat(d.budget) || 0),
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

        // Get posts count
        const postsCount = await this.postModel.count({
          where: {
            userType: 'brand',
            userId: brand.id,
          },
        });

        // Get followers count (users following this brand)
        const followersCount = await this.followModel.count({
          where: {
            followingBrandId: brand.id,
          },
        });

        // Get following count (brands/influencers this brand follows)
        const followingCount = await this.followModel.count({
          where: {
            followerBrandId: brand.id,
            [Op.or]: [
              { followingInfluencerId: { [Op.not]: null } },
              { followingBrandId: { [Op.not]: null } },
            ],
          },
        });

        // Apply filters
        if (minCampaigns !== undefined && totalCampaigns < minCampaigns) {
          return null;
        }
        if (
          minSelectedInfluencers !== undefined &&
          selectedInfluencersCount < minSelectedInfluencers
        ) {
          return null;
        }

        // For non-top profiles, we don't calculate composite score
        // Set it to 0 for consistency
        const brandDto: TopBrandDto & {
          postsCount: number;
          followersCount: number;
          followingCount: number;
        } = {
          id: brand.id,
          brandName: brand.brandName,
          username: brand.username,
          email: brand.email,
          profileImage: brand.profileImage,
          brandBio: brand.brandBio,
          websiteUrl: brand.websiteUrl,
          isVerified: brand.isVerified,
          isTopBrand: brand.isTopBrand || false,
          createdAt: brand.createdAt,
          postsCount,
          followersCount,
          followingCount,
          metrics: {
            totalCampaigns,
            uniqueNichesCount,
            selectedInfluencersCount,
            averagePayout: Math.round(averagePayout * 100) / 100,
            compositeScore: 0, // Not calculated for non-top profiles
          },
        };

        return brandDto;
      }),
    );

    // Filter out null values
    const validBrands = mappedBrands.filter(
      (
        brand,
      ): brand is TopBrandDto & {
        postsCount: number;
        followersCount: number;
        followingCount: number;
      } => brand !== null,
    );

    // Apply sorting based on sortBy parameter
    switch (sortBy) {
      case BrandSortBy.POSTS:
        validBrands.sort((a, b) => b.postsCount - a.postsCount);
        break;
      case BrandSortBy.FOLLOWERS:
        validBrands.sort((a, b) => b.followersCount - a.followersCount);
        break;
      case BrandSortBy.FOLLOWING:
        validBrands.sort((a, b) => b.followingCount - a.followingCount);
        break;
      case BrandSortBy.CAMPAIGNS:
        validBrands.sort(
          (a, b) => b.metrics.totalCampaigns - a.metrics.totalCampaigns,
        );
        break;
      case BrandSortBy.CREATED_AT:
      default:
        // Already sorted by createdAt ASC from database query
        break;
    }

    // Pagination
    const total = validBrands.length;
    const totalPages = Math.ceil(total / (limit ?? 20));
    const offset = (page - 1) * (limit ?? 20);
    const paginatedBrands = validBrands.slice(offset, offset + (limit ?? 20));

    return {
      brands: paginatedBrands,
      total,
      sortBy: TopBrandsSortBy.COMPOSITE,
      timeframe: TopBrandsTimeframe.ALL_TIME,
      limit: limit ?? 20,
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
      attributes: [
        'id',
        'name',
        'description',
        'category',
        'type',
        'status',
        'isPanIndia',
        'nicheIds',
        'createdAt',
        'updatedAt', // Include updatedAt for completion date
      ],
      include: [
        {
          model: this.brandModel,
          as: 'brand',
          attributes: [
            'id',
            'brandName',
            'username',
            'profileImage',
            'isVerified',
          ],
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
          attributes: [
            'id',
            'platform',
            'type',
            'budget',
            'quantity',
            'specifications',
          ],
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
    const campaignsWithMetrics: CampaignWithMetrics[] = campaigns
      .map((campaign): CampaignWithMetrics | null => {
        const campaignJson = campaign.toJSON() as CampaignJson;
        const applications: CampaignApplicationJson[] = campaignJson.applications || [];
        const deliverables: CampaignDeliverableJson[] = campaignJson.deliverables || [];
        const cities = campaignJson.cities || [];
        const brand = campaignJson.brand!;

        // Application Metrics
        const applicationsCount = applications.length;
        const selectedApplications = applications.filter(
          (app) => app.status === ApplicationStatus.SELECTED,
        );
        const selectedInfluencers = selectedApplications.length;
        const conversionRate =
          applicationsCount > 0
            ? (selectedInfluencers / applicationsCount) * 100
            : 0;

        // Simple applicant quality score (can be enhanced with actual follower/engagement data)
        const applicantQuality = applicationsCount > 0 ? 50 : 0; // Placeholder

        // Budget Metrics - multiply budget by quantity for each deliverable
        const totalBudget = deliverables.reduce(
          (sum, d) =>
            sum + (parseFloat(String(d.budget || '0')) || 0) * (parseInt(String(d.quantity || '1')) || 1),
          0,
        );
        const deliverablesCount = deliverables.length;
        const budgetPerDeliverable =
          deliverablesCount > 0 ? totalBudget / deliverablesCount : 0;

        // Scope Metrics
        const isPanIndia = campaignJson.isPanIndia;
        const citiesCount = cities.length;
        const nichesCount = campaignJson.nicheIds ? campaignJson.nicheIds.length : 0;
        const geographicReach = isPanIndia
          ? 100
          : Math.min((citiesCount / 10) * 100, 100);

        // Engagement Metrics
        const completionRate =
          campaignJson.status === CampaignStatus.COMPLETED
            ? 100
            : campaignJson.status === CampaignStatus.ACTIVE
              ? 50
              : 0;

        // Recency Metrics
        const now = new Date();
        const createdAt = new Date(campaignJson.createdAt);
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
          campaign: campaignJson,
          brand,
          deliverables, // Include deliverables array for response mapping
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
              status: campaignJson.status,
            },
            recency: {
              daysSinceLaunch,
              daysSinceLastApplication,
              createdAt: campaignJson.createdAt,
            },
          },
        };
      })
      .filter((item): item is CampaignWithMetrics => {
        // Apply minimum qualification filters
        return (
          item !== null &&
          item.metrics.application.applicationsCount >= 3 &&
          item.metrics.budget.deliverablesCount >= 1
        );
      });

    // Find max values for normalization
    const maxApplications = Math.max(
      ...campaignsWithMetrics.map(
        (c) => c.metrics.application.applicationsCount,
      ),
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
      ...campaignsWithMetrics.map(
        (c) => c.metrics.engagement.selectedInfluencers,
      ),
      1,
    );
    const maxDaysSinceLaunch = Math.max(
      ...campaignsWithMetrics.map((c) => c.metrics.recency.daysSinceLaunch),
      1,
    );

    // Calculate composite scores
    const campaignsWithScores: CampaignWithScores[] = campaignsWithMetrics.map((item): CampaignWithScores => {
      const { campaign, brand, deliverables, metrics } = item;

      // Normalize metrics (0-100 scale)
      const normalizedApplications =
        (metrics.application.applicationsCount / maxApplications) * 100;
      const normalizedConversionRate = metrics.application.conversionRate;
      const normalizedApplicantQuality = metrics.application.applicantQuality;
      const normalizedTotalBudget =
        (metrics.budget.totalBudget / maxBudget) * 100;
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
      const normalizedRecencyActivity =
        metrics.recency.daysSinceLastApplication !== null
          ? 100 -
            Math.min((metrics.recency.daysSinceLastApplication / 30) * 100, 100)
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
        campaign,
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        category: campaign.category,
        type: campaign.type,
        status: campaign.status,
        deliverables: deliverables || [],
        brand,
        metrics: {
          application: {
            applicationsCount: metrics.application.applicationsCount,
            conversionRate:
              Math.round(metrics.application.conversionRate * 100) / 100,
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
            geographicReach:
              Math.round(metrics.scope.geographicReach * 100) / 100,
          },
          engagement: {
            selectedInfluencers: metrics.engagement.selectedInfluencers,
            completionRate:
              Math.round(metrics.engagement.completionRate * 100) / 100,
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
        updatedAt: campaign.updatedAt, // Add updatedAt from campaign
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
    const topCampaigns = campaignsWithScores.slice(0, limit).map((item) => {
      // Format status for UI display
      const statusLabel =
        item.status === CampaignStatus.ACTIVE
          ? 'Ongoing'
          : item.status === CampaignStatus.COMPLETED
            ? 'Completed'
            : item.status === CampaignStatus.DRAFT
              ? 'Draft'
              : item.status;

      // Get completion date if completed (use updatedAt as proxy)
      const completedAt =
        item.status === CampaignStatus.COMPLETED
          ? item.updatedAt || item.createdAt
          : null;

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        type: item.type,
        status: item.status,
        statusLabel, // Human-readable status: "Ongoing", "Completed", "Draft"
        applicationsCount: item.metrics.application.applicationsCount, // Top-level for easy UI access
        completedAt, // Date when completed (null if not completed)
        deliverables: item.deliverables.map(d => ({
          ...d,
          budget: d.budget ? parseFloat(String(d.budget)) : null,
          quantity: typeof d.quantity === 'string' ? parseInt(d.quantity) : d.quantity,
        })),
        brand: item.brand,
        metrics: item.metrics,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return {
      campaigns: topCampaigns,
      total: campaignsWithScores.length,
      sortBy: sortBy || TopCampaignsSortBy.COMPOSITE,
      timeframe: timeframe || TopCampaignsTimeframe.ALL_TIME,
      statusFilter: status || TopCampaignsStatus.ALL,
      limit: limit || 10,
    };
  }

  async getComprehensiveDashboardStats() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all counts in parallel
    const [
      // Current month counts
      totalInfluencers,
      totalBrands,
      totalCampaigns,
      verifiedInfluencers,
      verifiedBrands,
      unverifiedInfluencers,
      unverifiedBrands,
      campaignsLive,
      campaignsCompleted,
      influencersPendingVerification,
      brandsPendingVerification,
      totalCampaignApplications,

      // Last month counts for comparison
      lastMonthInfluencers,
      lastMonthBrands,
      lastMonthCampaigns,
      lastMonthVerifiedInfluencers,
      lastMonthVerifiedBrands,
      lastMonthCampaignsLive,
      lastMonthUnverifiedInfluencers,
      lastMonthUnverifiedBrands,
      lastMonthCampaignsCompleted,
    ] = await Promise.all([
      // Current month counts
      this.influencerModel.count(),
      this.brandModel.count(),
      this.campaignModel.count(),
      this.influencerModel.count({ where: { isVerified: true } }),
      this.brandModel.count({ where: { isVerified: true } }),
      this.influencerModel.count({ where: { isVerified: false } }),
      this.brandModel.count({ where: { isVerified: false } }),
      this.campaignModel.count({ where: { status: CampaignStatus.ACTIVE } }),
      this.campaignModel.count({ where: { status: CampaignStatus.COMPLETED } }),
      this.profileReviewModel.count({
        where: {
          profileType: ProfileType.INFLUENCER,
          status: {
            [Op.in]: [ReviewStatus.PENDING, ReviewStatus.UNDER_REVIEW],
          },
        },
      }),
      this.profileReviewModel.count({
        where: {
          profileType: ProfileType.BRAND,
          status: {
            [Op.in]: [ReviewStatus.PENDING, ReviewStatus.UNDER_REVIEW],
          },
        },
      }),
      this.campaignApplicationModel.count(),

      // Last month counts
      this.influencerModel.count({
        where: {
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.brandModel.count({
        where: {
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.campaignModel.count({
        where: {
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.influencerModel.count({
        where: {
          isVerified: true,
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.brandModel.count({
        where: {
          isVerified: true,
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.campaignModel.count({
        where: {
          status: CampaignStatus.ACTIVE,
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.influencerModel.count({
        where: {
          isVerified: false,
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.brandModel.count({
        where: {
          isVerified: false,
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
      this.campaignModel.count({
        where: {
          status: CampaignStatus.COMPLETED,
          createdAt: {
            [Op.lt]: currentMonthStart,
          },
        },
      }),
    ]);

    // Helper function to calculate percentage growth
    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    return {
      totalInfluencers: {
        count: totalInfluencers,
        growth: calculateGrowth(totalInfluencers, lastMonthInfluencers),
      },
      totalBrands: {
        count: totalBrands,
        growth: calculateGrowth(totalBrands, lastMonthBrands),
      },
      totalCampaigns: {
        count: totalCampaigns,
        growth: calculateGrowth(totalCampaigns, lastMonthCampaigns),
      },
      verifiedInfluencers: {
        count: verifiedInfluencers,
        growth: calculateGrowth(
          verifiedInfluencers,
          lastMonthVerifiedInfluencers,
        ),
      },
      verifiedBrands: {
        count: verifiedBrands,
        growth: calculateGrowth(verifiedBrands, lastMonthVerifiedBrands),
      },
      campaignsLive: {
        count: campaignsLive,
        growth: calculateGrowth(campaignsLive, lastMonthCampaignsLive),
      },
      unverifiedInfluencers: {
        count: unverifiedInfluencers,
        growth: calculateGrowth(
          unverifiedInfluencers,
          lastMonthUnverifiedInfluencers,
        ),
      },
      unverifiedBrands: {
        count: unverifiedBrands,
        growth: calculateGrowth(unverifiedBrands, lastMonthUnverifiedBrands),
      },
      campaignsCompleted: {
        count: campaignsCompleted,
        growth: calculateGrowth(
          campaignsCompleted,
          lastMonthCampaignsCompleted,
        ),
      },
      influencersPendingVerification: {
        count: influencersPendingVerification,
      },
      brandsPendingVerification: {
        count: brandsPendingVerification,
      },
      totalCampaignApplications: {
        count: totalCampaignApplications,
      },
    };
  }

  /**
   * Forgot password - Send password reset email with token for admin
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Step 1: Check if admin exists
    const admin = await this.adminModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: ['id', 'email', 'name'],
    });

    if (!admin) {
      // Don't reveal if email exists or not for security
      return {
        message: 'If the email exists, a password reset link has been sent',
        success: true,
      };
    }

    // Step 2: Generate password reset token (JWT with admin ID and expiration)
    const resetPayload = {
      adminId: admin.id,
      email: admin.email,
      type: 'admin-password-reset',
    };

    const resetToken = this.jwtService.sign(resetPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'), // Use refresh secret for reset tokens
      expiresIn: '1h', // 1 hour expiry
    });

    // Step 3: Store token in Redis with 1 hour TTL for additional validation
    const tokenKey = this.passwordResetKey(resetToken);
    await this.redisService.set(
      tokenKey,
      JSON.stringify({
        adminId: admin.id,
        email: admin.email,
        createdAt: new Date().toISOString(),
      }),
      3600,
    ); // 1 hour

    // Step 4: Generate password reset URL (admin reset page)
    const resetUrl = `${this.configService.get<string>('ADMIN_FRONTEND_URL') || this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/admin/reset-password?token=${resetToken}`;

    // Step 5: Send password reset email
    await this.emailService.sendPasswordResetEmail(
      admin.email,
      admin.name,
      resetUrl,
      resetToken,
    );

    return {
      message: 'If the email exists, a password reset link has been sent',
      success: true,
    };
  }

  /**
   * Reset password - Verify token and set new password for admin
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Step 1: Verify and decode the reset token
    const decoded = this.jwtService.verify<{
      adminId: number;
      email: string;
      type: string;
    }>(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });

    // Step 2: Validate token payload
    if (
      decoded.type !== 'admin-password-reset' ||
      !decoded.adminId ||
      !decoded.email
    ) {
      throw new UnauthorizedException('Invalid reset token format');
    }

    // Step 3: Check if token exists in Redis (additional security)
    const tokenKey = this.passwordResetKey(token);
    const tokenData = await this.redisService.get(tokenKey);

    if (!tokenData) {
      throw new UnauthorizedException(
        'Reset token has expired or already been used',
      );
    }

    // Step 4: Find the admin
    const admin = await this.adminModel.findOne({
      where: {
        id: decoded.adminId,
        email: decoded.email.toLowerCase(),
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    // Step 5: Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Step 6: Update admin password in database
    await admin.update({ password: hashedPassword });

    // Step 7: Invalidate the reset token (delete from Redis)
    await this.redisService.del(tokenKey);

    // Step 8: Clear any admin sessions (optional - invalidate all admin sessions for security)
    // Note: We could implement logout all functionality here if needed

    return {
      message:
        'Password has been reset successfully. Please log in with your new password.',
      success: true,
    };
  }

  /**
   * Change password for authenticated admin
   */
  async changePassword(
    adminId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    // Get admin
    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as current password',
      );
    }

    // Hash and update password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await admin.update({ password: hashedPassword });

    return {
      message: 'Password changed successfully',
      updatedAt: new Date(),
    };
  }

  /**
   * Get 2FA status for admin
   */
  async get2FAStatus(adminId: number) {
    const admin = await this.adminModel.findByPk(adminId, {
      attributes: ['id', 'email', 'twoFactorEnabled'],
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return {
      isEnabled: admin.twoFactorEnabled ?? true,
      email: admin.email,
    };
  }

  /**
   * Enable 2FA for admin
   */
  async enable2FA(adminId: number, password: string) {
    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    // Enable 2FA
    await admin.update({ twoFactorEnabled: true });

    return {
      message: 'Two-factor authentication enabled successfully',
      isEnabled: true,
      updatedAt: new Date(),
    };
  }

  /**
   * Disable 2FA for admin
   */
  async disable2FA(adminId: number, password: string) {
    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    // Disable 2FA
    await admin.update({ twoFactorEnabled: false });

    return {
      message: 'Two-factor authentication disabled successfully',
      isEnabled: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Get all active sessions for admin
   */
  async getActiveSessions(adminId: number, currentJti: string) {
    // Get all refresh token JTIs for this admin from Redis
    const pattern = `refresh_token:${adminId}:*`;
    const keys = await this.redisService.keys(pattern);

    const sessions = await Promise.all(
      keys.map(async (key) => {
        const sessionData = await this.redisService.get(key);
        if (!sessionData) return null;

        const jti = key.split(':')[2];
        const data = JSON.parse(sessionData);

        return {
          sessionId: jti,
          device: data.device || 'Unknown Device',
          ipAddress: data.ipAddress || 'Unknown IP',
          location: data.location || undefined,
          lastActivity: new Date(data.lastActivity || data.createdAt),
          isCurrent: jti === currentJti,
        };
      }),
    );

    const validSessions = sessions.filter((s) => s !== null);

    return {
      sessions: validSessions,
      totalSessions: validSessions.length,
    };
  }

  /**
   * Logout specific session
   */
  async logoutSession(adminId: number, sessionId: string, currentJti: string) {
    // Prevent logging out current session
    if (sessionId === currentJti) {
      throw new BadRequestException(
        'Cannot logout current session. Use regular logout instead.',
      );
    }

    // Delete the specific session from Redis
    const key = `refresh_token:${adminId}:${sessionId}`;
    const result = await this.redisService.del(key);

    if (result === 0) {
      throw new NotFoundException('Session not found or already logged out');
    }

    return {
      message: 'Session logged out successfully',
      sessionId,
    };
  }

  /**
   * Delete admin account (soft delete)
   */
  async deleteAccount(
    adminId: number,
    password: string,
    confirmationText: string,
    reason?: string,
  ) {
    // Validate confirmation text
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      throw new BadRequestException(
        'Confirmation text must be exactly "DELETE MY ACCOUNT"',
      );
    }

    // Get admin
    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Prevent super admin from deleting their own account if they're the only one
    if (admin.role === AdminRole.SUPER_ADMIN) {
      const superAdminCount = await this.adminModel.count({
        where: { role: AdminRole.SUPER_ADMIN, status: AdminStatus.ACTIVE },
      });

      if (superAdminCount <= 1) {
        throw new ForbiddenException(
          'Cannot delete the last super admin account',
        );
      }
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    // Soft delete: set status to inactive
    await admin.update({
      status: AdminStatus.INACTIVE,
      email: `deleted_${Date.now()}_${admin.email}`, // Prevent email conflicts
    });

    // Clear all sessions
    await this.logoutAll(adminId);

    // Log the deletion reason if provided
    if (reason) {
      console.log(
        `Admin ${adminId} (${admin.email}) deleted account. Reason: ${reason}`,
      );
    }

    return {
      message: 'Account deleted successfully',
      adminId,
      deletedAt: new Date(),
    };
  }
}
