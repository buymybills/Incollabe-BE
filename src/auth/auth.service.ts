import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Sequelize } from 'sequelize-typescript';
import { randomInt, randomUUID } from 'crypto';
import { Influencer } from './model/influencer.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { InfluencerNiche } from './model/influencer-niche.model';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandLoginDto } from './dto/brand-login.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import { SmsService } from '../shared/sms.service';
import { RedisService } from '../redis/redis.service';
import { Brand, BrandCreationAttributes } from './model/brand.model';
import { BrandNiche } from './model/brand-niche.model';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly ATTEMPT_TTL = 15 * 60; // 15 minutes
  private readonly OTP_VERIFIED_TTL = 15 * 60; // 15 minutes
  private readonly REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Niche)
    private readonly nicheModel: typeof Niche,
    @InjectModel(Otp)
    private readonly otpModel: typeof Otp,
    @InjectModel(InfluencerNiche)
    private readonly influencerNicheModel: typeof InfluencerNiche,
    @InjectModel(BrandNiche)
    private readonly brandNicheModel: typeof BrandNiche,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
    private readonly sequelize: Sequelize,
    private readonly redisService: RedisService,
  ) {}

  // Redis key helpers
  private cooldownKey(phone: string): string {
    return `otp:cooldown:${phone}`;
  }

  private attemptsKey(phone: string): string {
    return `otp:attempts:${phone}`;
  }

  private sessionKey(userId: number, jti: string): string {
    return `session:${userId}:${jti}`;
  }

  private sessionsSetKey(userId: number): string {
    return `sessions:${userId}`;
  }

  private verificationKey(phone: string): string {
    return `otp:verified:${phone}`;
  }

  async requestOtp(requestOtpDto: RequestOtpDto): Promise<string> {
    const { phone } = requestOtpDto;
    const formattedPhone = `+91${phone}`; // Add Indian country code

    // Redis key to track OTP request cooldown for this phone
    const cooldownKey = this.cooldownKey(phone);
    const requestAttemptsKey = `otp:requests:${phone}`;

    // If key exists in Redis → user requested OTP recently → enforce cooldown
    if (await this.redisService.get(cooldownKey)) {
      throw new ForbiddenException("Please wait before requesting another OTP");
    }

    // Check total attempts in window (5 requests / 15 mins)
    const attempts = parseInt((await this.redisService.get(requestAttemptsKey)) || "0");
    if (attempts >= 5) {
      throw new ForbiddenException("Too many OTP requests. Try again later.");
    }

    // Generate OTP based on environment
    const isStaging = this.configService.get<string>("NODE_ENV") === "staging";
    const code = isStaging ? "123456" : randomInt(100000, 999999).toString();

    // Set expiry timestamp for OTP (valid for 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Clear any previously issued OTP for this phone (avoid duplicates/conflicts)
    await this.otpModel.destroy({ where: { phone } });

    // Save the new OTP in the database
    await this.otpModel.create({ phone, otp: code, expiresAt });

    // Send OTP via SMS only in production environment
    if (!isStaging) {
      await this.smsService.sendOtp(formattedPhone, code);
    }

    console.log(`OTP for ${formattedPhone}: ${code}`);

    // Update rate limiting counters
    await this.redisService.getClient()
      .multi()
      .set(cooldownKey, "1", "EX", 60) // Write cooldown flag (60s)
      .incr(requestAttemptsKey) // Increment request counter
      .expire(requestAttemptsKey, 15 * 60) // 15 minutes window
      .exec();

    // Return confirmation message
    return `OTP sent to ${formattedPhone}`;
  }

  async verifyOtp(
    verifyOtpDto: VerifyOtpDto,
    deviceId?: string,
    userAgent?: string,
  ) {
    const { phone, otp } = verifyOtpDto;
    const formattedPhone = `+91${phone}`; // Add Indian country code
    const attemptsKey = this.attemptsKey(phone);

    // 🔹 Step 1: Check for brute-force lock
    const attempts = parseInt((await this.redisService.get(attemptsKey)) ?? '0', 10);
    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      throw new ForbiddenException('Too many failed attempts. Try again later.');
    }

    // 🔹 Step 2: Validate OTP against DB
    const otpRecord = await this.otpModel.findOne({
      where: {
        phone,
        otp,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!otpRecord) {
      // Track failed attempt
      await this.redisService.getClient()
        .multi()
        .incr(attemptsKey)
        .expire(attemptsKey, this.ATTEMPT_TTL)
        .exec();

      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // 🔹 Step 3: Mark OTP as verified (and clear attempts)
    const verificationKey = this.verificationKey(phone);
    await this.redisService.getClient()
      .multi()
      .del(attemptsKey)
      .set(verificationKey, '1', 'EX', this.OTP_VERIFIED_TTL)
      .exec();

    // 🔹 Step 4: Transaction → consume OTP + find user
    const user = await this.sequelize.transaction(async t => {
      await this.otpModel.destroy({ where: { id: otpRecord.id }, transaction: t });

      return await this.influencerModel.findOne({
        where: { phone: formattedPhone },
        transaction: t,
      });
    });

    // 🔹 Step 5: Handle new users (OTP verified but signup required)
    if (!user) {
      return {
        message: 'OTP verified successfully',
        phone: formattedPhone,
        verified: true,
        requiresSignup: true,
      };
    }

    // 🔹 Step 6: Handle returning users → issue tokens
    const profileCompleted = Boolean(user.name && user.username);

    if (profileCompleted) {
      const { accessToken, refreshToken, jti } = await this.generateTokens(
        user.id,
        profileCompleted,
      );

      const sessionKey = this.sessionKey(user.id, jti);
      const sessionsSetKey = this.sessionsSetKey(user.id);

      const sessionPayload = JSON.stringify({
        deviceId: deviceId ?? null,
        userAgent: userAgent ?? null,
        createdAt: new Date().toISOString(),
      });

      await this.redisService.getClient()
        .multi()
        .set(sessionKey, sessionPayload, 'EX', this.REFRESH_TTL)
        .sadd(sessionsSetKey, jti)
        .exec();

      return {
        message: 'OTP verified successfully',
        accessToken,
        refreshToken,
        phone: user.phone,
        profileCompleted,
        requiresProfileCompletion: !profileCompleted,
      };
    }

    // 🔹 Step 7: User exists but profile incomplete
    return {
      message: 'OTP verified successfully',
      phone: formattedPhone,
      verified: true,
      requiresProfileCompletion: true,
    };
  }

  async influencerSignup(signupDto: InfluencerSignupDto) {
    const { phone, username, nicheIds, ...influencerData } = signupDto;
    const formattedPhone = `+91${phone}`; // Add Indian country code

    // Check if phone was recently verified (within last 15 minutes)
    // We'll check Redis for recent OTP verification instead
    const verificationKey = `otp:verified:${phone}`;
    const isVerified = await this.redisService.get(verificationKey);

    if (!isVerified) {
      throw new UnauthorizedException('Phone number not verified or verification expired');
    }

    // Validate niche IDs
    const validNiches = await this.nicheModel.findAll({
      where: { id: nicheIds, isActive: true },
    });

    if (validNiches.length !== nicheIds.length) {
      throw new BadRequestException('One or more invalid niche IDs provided');
    }

    // Create influencer
    const influencer = await this.influencerModel.create({
      ...influencerData,
      phone: formattedPhone,
      username,
      isPhoneVerified: true,
    });

    // Associate niches
    const nicheAssociations = nicheIds.map(nicheId => ({
      influencerId: influencer.id,
      nicheId,
    }));

    await this.influencerNicheModel.bulkCreate(nicheAssociations);

    // Fetch complete influencer data with niches
    const completeInfluencer = await this.influencerModel.findByPk(
      influencer.id,
      {
        include: [
          {
            model: Niche,
            through: { attributes: [] },
          },
        ],
      },
    );

    return {
      message: 'Influencer registered successfully',
      influencer: completeInfluencer,
    };
  }

  async getNiches() {
    const niches = await this.nicheModel.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });

    return {
      message: 'Niches fetched successfully',
      niches,
    };
  }

  async checkUsernameAvailability(checkUsernameDto: CheckUsernameDto) {
    const { username } = checkUsernameDto;

    // Check if username exists in either influencer or brand tables
    const [influencerExists, brandExists] = await Promise.all([
      this.influencerModel.findOne({ where: { username } }),
      this.brandModel.findOne({ where: { username } })
    ]);

    const isAvailable = !influencerExists && !brandExists;

    if (isAvailable) {
      return {
        available: true,
        username,
        message: 'Username is unique and available to use',
      };
    }

    // Only generate suggestions when username is taken
    const suggestions = await this.generateUsernameSuggestions(username, isAvailable);

    return {
      available: false,
      username,
      message: 'Username is already taken',
      suggestions,
    };
  }

  private async generateUsernameSuggestions(baseUsername: string, originalAvailable: boolean = false): Promise<string[]> {
    const suggestions: string[] = [];
    const maxSuggestions = 5;

    // Strategy 1: Add random 2-4 digit numbers
    const randomSuggestions: string[] = [];
    for (let i = 0; i < 8; i++) {
      const randomNum = Math.floor(Math.random() * 9999) + 1;
      randomSuggestions.push(`${baseUsername}${randomNum}`);
    }
    suggestions.push(...randomSuggestions);

    // Strategy 2: Add common suffixes
    const suffixes = ['_official', '_real', '_original', '_pro', '_user', '_123', '_xyz', '_new'];
    for (const suffix of suffixes) {
      suggestions.push(`${baseUsername}${suffix}`);
    }

    // Strategy 3: Add year and other variations
    const year = new Date().getFullYear();
    const yearVariations = [
      `${baseUsername}_${year}`,
      `${baseUsername}${year}`,
      `${baseUsername}_${year.toString().slice(-2)}`, // last 2 digits of year
      `${baseUsername}${year.toString().slice(-2)}`,
    ];
    suggestions.push(...yearVariations);

    // Strategy 4: Add incremental numbers
    for (let i = 1; i <= 20; i++) {
      suggestions.push(`${baseUsername}_${i}`);
      suggestions.push(`${baseUsername}${i}`);
    }

    // Strategy 5: Add some creative variations
    const creativeVariations = [
      `${baseUsername}_the_real`,
      `${baseUsername}_official1`,
      `real_${baseUsername}`,
      `${baseUsername}_verified`,
      `${baseUsername}_authentic`,
    ];
    suggestions.push(...creativeVariations);

    // Filter out suggestions that are also taken
    const availableSuggestions: string[] = [];
    
    for (const suggestion of suggestions) {
      if (availableSuggestions.length >= maxSuggestions) break;
      
      const [influencerExists, brandExists] = await Promise.all([
        this.influencerModel.findOne({ where: { username: suggestion } }),
        this.brandModel.findOne({ where: { username: suggestion } })
      ]);

      if (!influencerExists && !brandExists) {
        availableSuggestions.push(suggestion);
      }
    }

    // If we still don't have enough suggestions, generate more with incremental numbers
    let counter = 1;
    while (availableSuggestions.length < maxSuggestions && counter <= 20) {
      const suggestion = `${baseUsername}_${counter}`;
      
      const [influencerExists, brandExists] = await Promise.all([
        this.influencerModel.findOne({ where: { username: suggestion } }),
        this.brandModel.findOne({ where: { username: suggestion } })
      ]);

      if (!influencerExists && !brandExists) {
        availableSuggestions.push(suggestion);
      }
      counter++;
    }

    return availableSuggestions.slice(0, maxSuggestions);
  }

  private async generateTokens(
    userId: number,
    profileCompleted: boolean = false,
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    // 1. Create short-lived access token
    // Payload contains user ID and profile completion status
    const accessToken = this.jwtService.sign(
      {
        id: userId,
        profileCompleted: profileCompleted,
      },
      { jwtid: randomUUID() },
    );

    // 2. Create long-lived refresh token
    // - Has its own unique JTI (this one is stored in Redis for session tracking)
    // - Signed with a separate secret
    // - Expiration defined by REFRESH_TTL (e.g., 7 days)
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { id: userId }, // keep payload minimal
      {
        jwtid: jti,
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.REFRESH_TTL,
      },
    );

    // 3. Return both tokens and the refresh JTI
    // The caller will use this JTI to manage session lifecycle in Redis
    return { accessToken, refreshToken, jti };
  }

  // Brand Authentication Methods
  async brandSignup(signupDto: BrandSignupDto) {
    const { phone, email, password, ...brandData } = signupDto;
    const formattedPhone = `+91${phone}`; // Add Indian country code

    // Check if phone was recently verified
    const verificationKey = `otp:verified:${phone}`;
    const isVerified = await this.redisService.get(verificationKey);

    if (!isVerified) {
      throw new UnauthorizedException('Phone number not verified or verification expired');
    }

    // Check if brand already exists with email or phone
    const existingBrand = await this.brandModel.findOne({
      where: {
        [Op.or]: [{ email }, { phone: formattedPhone }]
      }
    });

    if (existingBrand) {
      throw new ConflictException('Brand already exists with this email or phone number');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create brand
    const brandCreateData: BrandCreationAttributes = {
      email,
      phone: formattedPhone,
      password: hashedPassword,
      isPhoneVerified: true,
      brandName: brandData.brandName,
      username: brandData.username,
      legalEntityName: brandData.legalEntityName,
      companyType: brandData.companyType,
      brandEmailId: brandData.brandEmailId,
      pocName: brandData.pocName,
      pocDesignation: brandData.pocDesignation,
      pocEmailId: brandData.pocEmailId,
      pocContactNumber: brandData.pocContactNumber,
      brandBio: brandData.brandBio,
      profileImage: brandData.profileImage,
      incorporationDocument: brandData.incorporationDocument,
      gstDocument: brandData.gstDocument,
      panDocument: brandData.panDocument,
    };

    const brand = await this.brandModel.create(brandCreateData);

    // Associate niches if provided
    if (brandData.nicheIds && brandData.nicheIds.length > 0) {
      // Validate niche IDs
      const validNiches = await this.nicheModel.findAll({
        where: { id: brandData.nicheIds, isActive: true },
      });

      if (validNiches.length !== brandData.nicheIds.length) {
        throw new BadRequestException('One or more invalid niche IDs provided');
      }

      // Create brand-niche associations
      const brandNicheAssociations = brandData.nicheIds.map(nicheId => ({
        brandId: brand.id,
        nicheId,
      }));

      await this.brandNicheModel.bulkCreate(brandNicheAssociations);
    }

    // Fetch complete brand data with niches
    const completeBrand = await this.brandModel.findByPk(brand.id, {
      include: [
        {
          model: Niche,
          through: { attributes: [] },
        },
      ],
    });

    return {
      message: 'Brand registered successfully',
      brand: completeBrand,
    };
  }

  async brandLogin(loginDto: BrandLoginDto, deviceId?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Find brand by email
    const brand = await this.brandModel.findOne({
      where: { email }
    });

    if (!brand) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, brand.password);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken, jti } = await this.generateTokens(brand.id);

    // Store session in Redis for multi-device support
    const sessionKey = this.sessionKey(brand.id, jti);
    const sessionsSetKey = this.sessionsSetKey(brand.id);

    const sessionPayload = JSON.stringify({
      deviceId: deviceId ?? null,
      userAgent: userAgent ?? null,
      createdAt: new Date().toISOString(),
      userType: 'brand',
    });

    await this.redisService.getClient()
      .multi()
      .set(sessionKey, sessionPayload, 'EX', this.REFRESH_TTL)
      .sadd(sessionsSetKey, jti)
      .exec();

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      brand: {
        id: brand.id,
        email: brand.email,
        phone: brand.phone,
        brandName: brand.brandName,
        username: brand.username,
      },
    };
  }

}