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
import { BrandVerifyOtpDto } from './dto/brand-verify-otp.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import { LogoutDto } from './dto/logout.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token-response.dto';
import { SmsService } from '../shared/sms.service';
import { EmailService } from '../shared/email.service';
import { S3Service } from '../shared/s3.service';
import { RedisService } from '../redis/redis.service';
import { Brand, BrandCreationAttributes } from './model/brand.model';
import { BrandNiche } from './model/brand-niche.model';
import { Op } from 'sequelize';
import * as bcrypt from 'bcrypt';

// Interfaces for token payload
interface DecodedRefresh {
  id: number;
  jti: string;
  exp: number;
}

interface RequestWithUser {
  user: { id: number };
}

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
    private readonly emailService: EmailService,
    private readonly s3Service: S3Service,
    private readonly jwtService: JwtService,
    private readonly sequelize: Sequelize,
    private readonly redisService: RedisService,
  ) { }

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

  private blacklistKey(jti: string): string {
    return `blacklist:${jti}`;
  }

  private brandOtpKey(email: string): string {
    return `brand:otp:${email}`;
  }

  private brandOtpAttemptsKey(email: string): string {
    return `brand:otp:attempts:${email}`;
  }

  private async uploadFileToS3(file: Express.Multer.File, folder: string, prefix: string): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = file.originalname.split('.').pop();
    const s3Key = `${folder}/${prefix}-${uniqueSuffix}.${fileExtension}`;

    await this.s3Service.uploadFile(file, s3Key);
    return this.s3Service.getFileUrl(s3Key);
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
    const profileCompleted = Boolean(user.dataValues.name && user.dataValues.username);

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
        .set(sessionKey, sessionPayload) // No expiry - session persists until logout
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

  async influencerSignup(signupDto: InfluencerSignupDto, profileImage?: Express.Multer.File) {
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

    // Upload profile image to S3 if provided
    let profileImageUrl: string | undefined;
    if (profileImage) {
      profileImageUrl = await this.uploadFileToS3(profileImage, 'profiles/influencers', 'influencer');
    }

    // Create influencer and associate niches in a transaction
    const influencer = await this.sequelize.transaction(async (transaction) => {
      // Create influencer
      const createdInfluencer = await this.influencerModel.create({
        ...influencerData,
        phone: formattedPhone,
        username,
        profileImage: profileImageUrl,
        isPhoneVerified: true,
      }, { transaction });

      // Associate niches
      const nicheAssociations = nicheIds.map(nicheId => ({
        influencerId: createdInfluencer.id,
        nicheId,
      }));

      await this.influencerNicheModel.bulkCreate(nicheAssociations, { transaction });

      return createdInfluencer;
    });

    // Fetch complete influencer data with niches
    const completeInfluencer = await this.influencerModel.findByPk(
      influencer.id,
      {
        include: [
          {
            model: Niche,
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
    // - No expiration - persists until explicit logout
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { id: userId }, // keep payload minimal
      {
        jwtid: jti,
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        // No expiresIn - token never expires unless explicitly revoked
      },
    );

    // 3. Return both tokens and the refresh JTI
    // The caller will use this JTI to manage session lifecycle in Redis
    return { accessToken, refreshToken, jti };
  }

  // Brand Authentication Methods
  async brandSignup(
    signupDto: BrandSignupDto,
    files?: {
      profileImage?: Express.Multer.File[],
      incorporationDocument?: Express.Multer.File[],
      gstDocument?: Express.Multer.File[],
      panDocument?: Express.Multer.File[]
    },
    deviceId?: string,
    userAgent?: string
  ) {
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

    // Upload files to S3 if provided
    let profileImageUrl: string | undefined;
    let incorporationDocumentUrl: string | undefined;
    let gstDocumentUrl: string | undefined;
    let panDocumentUrl: string | undefined;

    if (files?.profileImage?.[0]) {
      profileImageUrl = await this.uploadFileToS3(files.profileImage[0], 'profiles/brands', 'brand');
    }

    if (files?.incorporationDocument?.[0]) {
      incorporationDocumentUrl = await this.uploadFileToS3(files.incorporationDocument[0], 'documents/brands', 'incorporation');
    }

    if (files?.gstDocument?.[0]) {
      gstDocumentUrl = await this.uploadFileToS3(files.gstDocument[0], 'documents/brands', 'gst');
    }

    if (files?.panDocument?.[0]) {
      panDocumentUrl = await this.uploadFileToS3(files.panDocument[0], 'documents/brands', 'pan');
    }

    // Validate niche IDs before transaction if provided
    if (brandData.nicheIds && brandData.nicheIds.length > 0) {
      const validNiches = await this.nicheModel.findAll({
        where: { id: brandData.nicheIds, isActive: true },
      });

      if (validNiches.length !== brandData.nicheIds.length) {
        throw new BadRequestException('One or more invalid niche IDs provided');
      }
    }

    // Use transaction for brand creation and niche associations
    const brand = await this.sequelize.transaction(async (transaction) => {
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
        profileImage: profileImageUrl || brandData.profileImage,
        incorporationDocument: incorporationDocumentUrl || brandData.incorporationDocument,
        gstDocument: gstDocumentUrl || brandData.gstDocument,
        panDocument: panDocumentUrl || brandData.panDocument,
      };

      const createdBrand = await this.brandModel.create(brandCreateData, { transaction });

      // Associate niches if provided
      if (brandData.nicheIds && brandData.nicheIds.length > 0) {
        const brandNicheAssociations = brandData.nicheIds.map(nicheId => ({
          brandId: createdBrand.id,
          nicheId,
        }));

        await this.brandNicheModel.bulkCreate(brandNicheAssociations, { transaction });
      }

      return createdBrand;
    });

    // Fetch complete brand data with niches
    const completeBrand = await this.brandModel.findByPk(brand.id, {
      include: [
        {
          model: Niche,
          through: { attributes: [] },
        },
      ],
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(email, brandData.brandName || 'Brand Partner');

    // Automatically initiate login flow after successful signup
    const loginResult = await this.brandLogin({ email, password }, deviceId, userAgent);

    return {
      message: 'Brand registered successfully. Please check your email for OTP to complete login.',
      signup: {
        brand: completeBrand,
      },
      login: loginResult,
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
    if (!password || !brand.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, brand.password);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate and send email OTP
    const otp = randomInt(100000, 999999).toString();
    const otpKey = this.brandOtpKey(email);

    // Store OTP in Redis with 10 minutes expiry
    await this.redisService.getClient().set(otpKey, otp, 'EX', 600);

    // Store temporary session data for after OTP verification
    const tempSessionKey = `temp:brand:${email}`;
    const tempSessionData = JSON.stringify({
      brandId: brand.id,
      deviceId: deviceId ?? null,
      userAgent: userAgent ?? null,
      createdAt: new Date().toISOString(),
    });
    await this.redisService.getClient().set(tempSessionKey, tempSessionData, 'EX', 600);

    // Send OTP email
    await this.emailService.sendBrandOtp(email, otp);

    return {
      message: 'OTP sent to your email address. Please verify to complete login.',
      requiresOtp: true,
      email: email,
    };
  }

  async verifyBrandOtp(verifyOtpDto: BrandVerifyOtpDto, deviceId?: string, userAgent?: string) {
    const { email, otp } = verifyOtpDto;

    // Get stored OTP from Redis
    const otpKey = this.brandOtpKey(email);
    const storedOtp = await this.redisService.getClient().get(otpKey);

    if (!storedOtp) {
      throw new UnauthorizedException('OTP has expired or is invalid');
    }

    if (storedOtp !== otp) {
      // Increment failed attempts
      const attemptsKey = this.brandOtpAttemptsKey(email);
      const attempts = await this.redisService.getClient().incr(attemptsKey);

      if (attempts === 1) {
        await this.redisService.getClient().expire(attemptsKey, 600); // 10 minutes
      }

      if (attempts >= 5) {
        // Too many failed attempts, invalidate OTP
        await this.redisService.getClient().del(otpKey);
        throw new UnauthorizedException('Too many failed attempts. Please request a new OTP.');
      }

      throw new UnauthorizedException('Invalid OTP');
    }

    // Get temporary session data
    const tempSessionKey = `temp:brand:${email}`;
    const tempSessionData = await this.redisService.getClient().get(tempSessionKey);

    if (!tempSessionData) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const sessionInfo = JSON.parse(tempSessionData);
    const brandId = sessionInfo.brandId;

    // Generate tokens
    const { accessToken, refreshToken, jti } = await this.generateTokens(brandId);

    // Store session in Redis for multi-device support
    const sessionKey = this.sessionKey(brandId, jti);
    const sessionsSetKey = this.sessionsSetKey(brandId);

    const sessionPayload = JSON.stringify({
      deviceId: deviceId ?? sessionInfo.deviceId,
      userAgent: userAgent ?? sessionInfo.userAgent,
      createdAt: new Date().toISOString(),
      userType: 'brand',
    });

    // Clean up temporary data and store final session
    await this.redisService.getClient()
      .multi()
      .del(otpKey) // Remove used OTP
      .del(tempSessionKey) // Remove temporary session
      .del(this.brandOtpAttemptsKey(email)) // Remove failed attempts
      .set(sessionKey, sessionPayload) // No expiry - session persists until logout
      .sadd(sessionsSetKey, jti)
      .exec();

    // Get brand details for response
    const brand = await this.brandModel.findByPk(brandId, {
      include: [
        {
          model: this.nicheModel,
          as: 'niches',
          through: { attributes: [] },
        },
      ],
    });

    if (!brand) {
      throw new UnauthorizedException('Brand not found');
    }

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
        legalEntityName: brand.legalEntityName,
        companyType: brand.companyType,
        brandEmailId: brand.brandEmailId,
        pocName: brand.pocName,
        pocDesignation: brand.pocDesignation,
        pocEmailId: brand.pocEmailId,
        pocContactNumber: brand.pocContactNumber,
        brandBio: brand.brandBio,
        profileImage: brand.profileImage,
        incorporationDocument: brand.incorporationDocument,
        gstDocument: brand.gstDocument,
        panDocument: brand.panDocument,
        isProfileCompleted: brand.isProfileCompleted,
        isActive: brand.isActive,
        niches: brand.niches || [],
      },
    };
  }

  async logout({ refreshToken }: LogoutDto): Promise<LogoutResponseDto> {
    let decoded: DecodedRefresh;


    // Step 1: Verify token signature & decode payload
    decoded = this.jwtService.verify<DecodedRefresh>(refreshToken, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
    });


    const userId = decoded.id;
    const jti = decoded.jti;

    // Safety check → if token doesn't contain expected fields, just return success
    if (!userId || !jti) return { message: "Logged out" };

    // Step 2: Prepare Redis keys for this session
    const key = this.sessionKey(userId, jti); // key for this session
    const setKey = this.sessionsSetKey(userId); // set of all active sessions

    // Step 3: Calculate TTL = seconds left until token expiry
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    const expTtl = ttl > 0 ? ttl : 60; // fallback: 1 min minimum

    // Step 4: Redis transaction to clean up session + blacklist token
    await this.redisService.getClient()
      .multi()
      .set(this.blacklistKey(jti), "1", "EX", expTtl) // mark JTI as blacklisted
      .del(key) // delete session for this device
      .srem(setKey, jti) // remove JTI from user's active set
      .exec();

    // Step 5: Return confirmation
    return { message: "Logged out" };
  }

  /**
   * Logs out a user from all devices by invalidating every active session.
   */
  async logoutAll(userId: number): Promise<LogoutResponseDto> {
    // Step 1: Find all session JTIs linked to this user
    const setKey = this.sessionsSetKey(userId);
    const jtis = await this.redisService.getClient().smembers(setKey);

    if (jtis.length) {
      const multi = this.redisService.getClient().multi();

      // Step 2: Iterate over all active JTIs and invalidate them
      for (const jti of jtis) {
        // Delete device-specific session key
        multi.del(this.sessionKey(userId, jti));

        // Blacklist token for a long period (1 year) since tokens don't naturally expire
        multi.set(this.blacklistKey(jti), "1", "EX", 365 * 24 * 60 * 60);
      }

      // Step 3: Remove the user's session set itself
      multi.del(setKey);

      // Execute all Redis operations atomically
      await multi.exec();
    }

    // Step 4: Return confirmation
    return { message: "Logged out from all devices" };
  }

  async refreshToken({ refreshToken }: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    let decoded: DecodedRefresh;

    try {
      // Step 1: Decode & validate the refresh token
      decoded = this.jwtService.verify<DecodedRefresh>(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const userId = decoded.id;
    const jti = decoded.jti;

    // Sanity check → must have userId and JTI
    if (!userId || !jti) throw new UnauthorizedException("Malformed refresh token");

    // Step 2: Check blacklist and active session in Redis
    const [isBlacklisted, exists] = await Promise.all([
      this.redisService.getClient().get(this.blacklistKey(jti)), // was revoked?
      this.redisService.getClient().get(this.sessionKey(userId, jti)), // still active?
    ]);

    if (isBlacklisted) throw new ForbiddenException("Refresh token revoked");
    if (!exists) throw new UnauthorizedException("Session expired or revoked");

    // Step 3: Rotate refresh token (security best practice)
    const {
      accessToken,
      refreshToken: newRefresh,
      jti: newJti,
    } = await this.generateTokens(userId);

    await this.rotateSession(userId, jti, newJti, {
      // carry forward device info, userAgent, etc. if needed
    });

    // Step 4: Return the new tokens
    return { accessToken, refreshToken: newRefresh };
  }

  /**
   * Rotates a user's refresh session in Redis.
   */
  private async rotateSession(
    userId: number,
    oldJti: string,
    newJti: string,
    extra?: Record<string, any>,
  ) {
    const oldKey = this.sessionKey(userId, oldJti);
    const newKey = this.sessionKey(userId, newJti);
    const setKey = this.sessionsSetKey(userId);

    // Get remaining TTL from old session to apply to new (prevents extending lifetime)
    const ttl = await this.redisService.getClient().ttl(oldKey);

    // Fetch old session payload (if missing, default to empty object)
    const oldPayload = (await this.redisService.getClient().get(oldKey)) || "{}";

    // Merge old payload with new data & add rotation timestamp
    const merged = JSON.stringify({
      ...JSON.parse(oldPayload),
      ...extra,
      rotatedAt: new Date().toISOString(),
    });

    // Atomic operations to rotate session in Redis
    const multi = this.redisService.getClient()
      .multi()
      .del(oldKey) // delete old session key
      .srem(setKey, oldJti) // remove old JTI from user's session set
      .set(newKey, merged); // store new session payload

    // No expiry - sessions persist until explicit logout

    // Add new JTI to user's session set
    multi.sadd(setKey, newJti);
    await multi.exec();

    // Blacklist the old JTI for a long period (1 year) since tokens don't naturally expire
    await this.redisService.getClient().set(this.blacklistKey(oldJti), "1", "EX", 365 * 24 * 60 * 60);
  }

}