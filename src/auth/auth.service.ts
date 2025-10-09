import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { CompanyType } from '../shared/models/company-type.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { Brand, BrandCreationAttributes } from '../brand/model/brand.model';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../shared/email.service';
import { S3Service } from '../shared/s3.service';
import { LoggerService } from '../shared/services/logger.service';
import { EncryptionService } from '../shared/services/encryption.service';
import { SmsService } from '../shared/sms.service';
import { SignupFiles } from '../types/file-upload.types';
import { BrandInitialSignupDto } from './dto/brand-initial-signup.dto';
import { BrandLoginDto } from './dto/brand-login.dto';
import { BrandProfileCompletionDto } from './dto/brand-profile-completion.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandVerifyOtpDto } from './dto/brand-verify-otp.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InfluencerNiche } from './model/influencer-niche.model';
import { Influencer } from './model/influencer.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { CustomNiche } from './model/custom-niche.model';
import { Gender } from './types/gender.enum';

// Interfaces for token payload
interface DecodedRefresh {
  id: number;
  jti: string;
  exp: number;
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
    @InjectModel(CustomNiche)
    private readonly customNicheModel: typeof CustomNiche,
    @InjectModel(CompanyType)
    private readonly companyTypeModel: typeof CompanyType,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly s3Service: S3Service,
    private readonly loggerService: LoggerService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
    private readonly sequelize: Sequelize,
    private readonly redisService: RedisService,
    private readonly uploadService: S3Service,
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

  private blacklistKey(jti: string): string {
    return `blacklist:${jti}`;
  }

  private brandOtpKey(email: string): string {
    return `brand:otp:${email}`;
  }

  private brandOtpAttemptsKey(email: string): string {
    return `brand:otp:attempts:${email}`;
  }

  private passwordResetKey(token: string): string {
    return `password-reset:${token}`;
  }

  private phoneVerificationKey(verificationId: string): string {
    return `phone_verification:${verificationId}`;
  }

  async getVerifiedPhoneNumber(
    verificationKey: string,
  ): Promise<string | null> {
    const phoneVerificationKey = this.phoneVerificationKey(verificationKey);
    return await this.redisService.get(phoneVerificationKey);
  }

  async requestOtp(requestOtpDto: RequestOtpDto): Promise<string> {
    const { phone } = requestOtpDto;
    const formattedPhone = `+91${phone}`; // Add Indian country code

    // Log OTP request start
    this.loggerService.logAuth('OTP_REQUEST_STARTED', {
      phone: formattedPhone,
      action: 'requestOtp',
    });

    // Redis key to track OTP request cooldown for this phone
    const cooldownKey = this.cooldownKey(phone);
    const requestAttemptsKey = `otp:requests:${phone}`;

    // If key exists in Redis → user requested OTP recently → enforce cooldown
    if (await this.redisService.get(cooldownKey)) {
      this.loggerService.logAuth('OTP_REQUEST_RATE_LIMITED', {
        phone: formattedPhone,
        reason: 'cooldown_active',
      });
      throw new ForbiddenException('Please wait before requesting another OTP');
    }

    // Check total attempts in window (5 requests / 15 mins)
    const attempts = parseInt(
      (await this.redisService.get(requestAttemptsKey)) || '0',
    );
    if (attempts >= 5) {
      this.loggerService.logAuth('OTP_REQUEST_RATE_LIMITED', {
        phone: formattedPhone,
        attempts,
        reason: 'max_attempts_exceeded',
      });
      throw new ForbiddenException('Too many OTP requests. Try again later.');
    }

    // Generate OTP based on environment
    const isStaging = this.configService.get<string>('NODE_ENV') === 'staging';
    const code = isStaging ? '123456' : randomInt(100000, 999999).toString();

    // Set expiry timestamp for OTP (valid for 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Log OTP generation
    this.loggerService.logAuth('OTP_GENERATED', {
      phone: formattedPhone,
      isStaging,
      expiresAt: expiresAt.toISOString(),
    });

    // Encrypt identifier before storing (use formattedPhone for consistency)
    const identifierHash = crypto
      .createHash('sha256')
      .update(formattedPhone)
      .digest('hex');
    const encryptedIdentifier = this.encryptionService.encrypt(formattedPhone);

    // Clear any previously issued OTP for this phone (avoid duplicates/conflicts)
    await this.otpModel.destroy({
      where: {
        identifierHash,
        type: 'phone',
      },
    });

    // Save the new OTP in the database
    await this.otpModel.create({
      identifier: encryptedIdentifier,
      identifierHash,
      type: 'phone',
      otp: code,
      expiresAt,
    });

    this.loggerService.logDatabase('OTP_STORED', {
      phone: formattedPhone,
      type: 'phone',
      expiresAt: expiresAt.toISOString(),
    });

    // Send OTP via SMS only in production environment
    if (!isStaging) {
      await this.smsService.sendOtp(formattedPhone, code);
      this.loggerService.info(`📱 OTP sent via SMS to ${formattedPhone}`);
    } else {
      this.loggerService.info(`🧪 Staging OTP for ${formattedPhone}: ${code}`);
    }

    // Update rate limiting counters
    await this.redisService
      .getClient()
      .multi()
      .set(cooldownKey, '1', 'EX', 60) // Write cooldown flag (60s)
      .incr(requestAttemptsKey) // Increment request counter
      .expire(requestAttemptsKey, 15 * 60) // 15 minutes window
      .exec();

    this.loggerService.logAuth('OTP_REQUEST_COMPLETED', {
      phone: formattedPhone,
      attempts: attempts + 1,
    });

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
    const attempts = parseInt(
      (await this.redisService.get(attemptsKey)) ?? '0',
      10,
    );
    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      throw new ForbiddenException(
        'Too many failed attempts. Try again later.',
      );
    }

    // 🔹 Step 2: Validate OTP against DB
    // Hash the phone number to search (since identifiers are encrypted in DB)
    const crypto = require('crypto');
    const identifierHash = crypto
      .createHash('sha256')
      .update(formattedPhone)
      .digest('hex');

    console.log('Verifying OTP:');
    console.log('Phone:', phone);
    console.log('Formatted Phone:', formattedPhone);
    console.log('OTP:', otp);
    console.log('Identifier Hash:', identifierHash);

    const otpRecord = await this.otpModel.findOne({
      where: {
        identifierHash,
        type: 'phone',
        otp,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    console.log('OTP Record found:', !!otpRecord);
    if (otpRecord) {
      console.log('OTP Record details:', {
        id: otpRecord.id,
        identifierHash: otpRecord.identifierHash,
        otp: otpRecord.otp,
        isUsed: otpRecord.isUsed,
        expiresAt: otpRecord.expiresAt,
      });
    }

    if (!otpRecord) {
      // Track failed attempt
      await this.redisService
        .getClient()
        .multi()
        .incr(attemptsKey)
        .expire(attemptsKey, this.ATTEMPT_TTL)
        .exec();

      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // 🔹 Step 3: Mark OTP as verified (and clear attempts)
    const verificationKey = this.verificationKey(phone);
    await this.redisService
      .getClient()
      .multi()
      .del(attemptsKey)
      .set(verificationKey, '1', 'EX', this.OTP_VERIFIED_TTL)
      .exec();

    // 🔹 Step 4: Transaction → consume OTP + find user
    // Create phone hash for lookup
    const phoneHash = crypto
      .createHash('sha256')
      .update(formattedPhone)
      .digest('hex');

    const user = await this.sequelize.transaction(async (t) => {
      await this.otpModel.destroy({
        where: { id: otpRecord.id },
        transaction: t,
      });

      // Check for deleted account within 30 days
      const deletedUser = await this.influencerModel.findOne({
        where: { phoneHash },
        paranoid: false,
        transaction: t,
      });

      // If account was deleted within 30 days, restore it
      if (deletedUser && deletedUser.deletedAt) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (deletedUser.deletedAt > thirtyDaysAgo) {
          await deletedUser.restore({ transaction: t });
          await deletedUser.update({ isActive: true }, { transaction: t });
          this.loggerService.info(
            `Restored deleted account for influencer: ${deletedUser.id}`,
          );
          return deletedUser;
        } else {
          // Account deleted more than 30 days ago, treat as new user
          return null;
        }
      }

      return await this.influencerModel.findOne({
        where: { phoneHash },
        transaction: t,
      });
    });

    // 🔹 Step 5: Handle new users (OTP verified but signup required)
    if (!user) {
      // Generate unique verification key for Redis
      const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const phoneVerificationKey = this.phoneVerificationKey(verificationId);

      // Store verified phone number in Redis with 15-minute expiry
      await this.redisService.set(
        phoneVerificationKey,
        formattedPhone,
        15 * 60,
      );

      return {
        message: 'OTP verified successfully',
        verificationKey: verificationId,
        verified: true,
        requiresSignup: true,
      };
    }

    // 🔹 Step 6: Handle returning users → issue tokens

    // Reactivate account if deactivated
    if (!user.isActive) {
      await user.update({ isActive: true });
      this.loggerService.info(`Account reactivated for influencer: ${user.id}`);
    }

    const profileCompleted = Boolean(
      user.dataValues.name && user.dataValues.username,
    );

    if (profileCompleted) {
      // Update last login timestamp
      await user.update({ lastLoginAt: new Date() });

      const { accessToken, refreshToken, jti } = await this.generateTokens(
        user.id,
        profileCompleted,
        'influencer',
      );

      const sessionKey = this.sessionKey(user.id, jti);
      const sessionsSetKey = this.sessionsSetKey(user.id);

      const sessionPayload = JSON.stringify({
        deviceId: deviceId ?? null,
        userAgent: userAgent ?? null,
        createdAt: new Date().toISOString(),
      });

      await this.redisService
        .getClient()
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

  async influencerSignup(
    signupDto: InfluencerSignupDto,
    verificationKey: string,
    profileImage?: Express.Multer.File,
  ) {
    // Retrieve verified phone number from Redis using verification key
    const formattedPhone = await this.getVerifiedPhoneNumber(verificationKey);
    if (!formattedPhone) {
      throw new UnauthorizedException('Invalid or expired verification key');
    }

    const { username, nicheIds, customNiches, ...influencerData } = signupDto;

    // Handle gender mapping logic
    let finalGender: string | undefined;
    let finalOthersGender: string | undefined;

    if (influencerData.gender) {
      const genderValue = influencerData.gender;
      const standardGenders = [Gender.MALE, Gender.FEMALE];
      if (standardGenders.includes(genderValue as Gender)) {
        // Standard gender options
        finalGender = genderValue;
        finalOthersGender = undefined;
      } else {
        // Custom gender option - map to Others
        finalGender = Gender.OTHERS;
        finalOthersGender = genderValue;
      }
    }

    // Update influencerData with mapped gender values
    if (finalGender) {
      influencerData.gender = finalGender as any;
      (influencerData as any).othersGender = finalOthersGender;
    }

    // Validate niche IDs
    const validNiches = await this.nicheModel.findAll({
      where: { id: nicheIds, isActive: true },
    });

    if (validNiches.length !== nicheIds.length) {
      throw new BadRequestException('One or more invalid niche IDs provided');
    }

    // Validate total niche count (regular + custom) doesn't exceed 5
    const totalNicheCount = nicheIds.length + (customNiches?.length || 0);
    if (totalNicheCount > 5) {
      throw new BadRequestException(
        `Maximum 5 niches allowed (regular + custom combined). You selected ${totalNicheCount} niches.`,
      );
    }

    // Validate custom niche names are unique
    if (customNiches && customNiches.length > 0) {
      const uniqueCustomNiches = [...new Set(customNiches)];
      if (uniqueCustomNiches.length !== customNiches.length) {
        throw new BadRequestException('Custom niche names must be unique');
      }
    }

    // Upload profile image to S3 if provided
    let profileImageUrl: string | undefined;
    if (profileImage) {
      profileImageUrl = await this.s3Service.uploadFileToS3(
        profileImage,
        'profiles/influencers',
        'influencer',
      );
    }

    // Create influencer and associate niches in a transaction
    const influencer = await this.sequelize.transaction(async (transaction) => {
      // Create influencer
      const createdInfluencer = await this.influencerModel.create(
        {
          ...influencerData,
          phone: formattedPhone,
          username,
          profileImage: profileImageUrl,
          isPhoneVerified: true,
        },
        { transaction },
      );

      // Associate niches
      const nicheAssociations = nicheIds.map((nicheId) => ({
        influencerId: createdInfluencer.id,
        nicheId,
      }));

      await this.influencerNicheModel.bulkCreate(nicheAssociations, {
        transaction,
      });

      // Create custom niches if provided
      if (customNiches && customNiches.length > 0) {
        const customNicheData = customNiches.map((nicheName) => ({
          userType: 'influencer' as const,
          userId: createdInfluencer.id,
          influencerId: createdInfluencer.id,
          brandId: null,
          name: nicheName,
          description: '',
          isActive: true,
        }));

        await this.customNicheModel.bulkCreate(customNicheData, {
          transaction,
        });
      }

      return createdInfluencer;
    });

    // Fetch complete influencer data with niches and custom niches
    const completeInfluencer = await this.influencerModel.findByPk(
      influencer.id,
      {
        include: [
          {
            model: Niche,
            attributes: [
              'id',
              'name',
              'description',
              'logoNormal',
              'logoDark',
              'isActive',
            ], // Exclude timestamps
            through: { attributes: [] }, // Exclude junction table data
          },
          {
            model: CustomNiche,
            attributes: ['id', 'name', 'description', 'isActive'],
            where: { isActive: true },
            required: false, // LEFT JOIN to include influencers without custom niches
          },
        ],
      },
    );

    if (!completeInfluencer) {
      throw new NotFoundException(
        'Influencer data not found after registration',
      );
    }

    // Create clean response without timestamps
    const completeData = completeInfluencer.toJSON();
    const { createdAt, updatedAt, ...cleanInfluencer } = completeData;

    // Update last login timestamp
    await completeInfluencer.update({ lastLoginAt: new Date() });

    // Generate JWT tokens for auto-login using the existing token generation method
    const { accessToken, refreshToken, jti } = await this.generateTokens(
      completeInfluencer.id,
      true, // profile is completed
      'influencer',
    );

    // Store session in Redis for multi-device support
    const sessionKey = this.sessionKey(completeInfluencer.id, jti);
    const sessionsSetKey = this.sessionsSetKey(completeInfluencer.id);

    const sessionPayload = JSON.stringify({
      deviceId: null, // No device info available during signup
      userAgent: null,
      createdAt: new Date().toISOString(),
      userType: 'influencer',
    });

    await this.redisService
      .getClient()
      .multi()
      .set(sessionKey, sessionPayload) // No expiry - session persists until logout
      .sadd(sessionsSetKey, jti)
      .exec();

    // Clear the phone verification key from Redis since it's no longer needed
    const phoneVerificationKey = this.phoneVerificationKey(verificationKey);
    await this.redisService.del(phoneVerificationKey);

    return {
      message: 'Influencer registered and logged in successfully',
      accessToken,
      refreshToken,
      influencer: cleanInfluencer,
      profileCompleted: true,
    };
  }

  async getNiches() {
    const niches = await this.nicheModel.findAll({
      where: { isActive: true },
      attributes: [
        'id',
        'name',
        'logoNormal',
        'logoDark',
        'description',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
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
      this.brandModel.findOne({ where: { username } }),
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
    const suggestions = await this.generateUsernameSuggestions(
      username,
      isAvailable,
    );

    return {
      available: false,
      username,
      message: 'Username is already taken',
      suggestions,
    };
  }

  private async generateUsernameSuggestions(
    baseUsername: string,
    originalAvailable: boolean = false,
  ): Promise<string[]> {
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
    const suffixes = [
      '_official',
      '_real',
      '_original',
      '_pro',
      '_user',
      '_123',
      '_xyz',
      '_new',
    ];
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
        this.brandModel.findOne({ where: { username: suggestion } }),
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
        this.brandModel.findOne({ where: { username: suggestion } }),
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
    userType: 'influencer' | 'brand' = 'influencer',
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    // 1. Create short-lived access token
    // Payload contains user ID, profile completion status, and user type
    const accessToken = this.jwtService.sign(
      {
        id: userId,
        profileCompleted: profileCompleted,
        userType: userType,
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
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        // No expiresIn property - token never expires unless explicitly revoked
      },
    );

    // 3. Return both tokens and the refresh JTI
    // The caller will use this JTI to manage session lifecycle in Redis
    return { accessToken, refreshToken, jti };
  }

  async brandSignup(
    signupDto: BrandSignupDto,
    files?: {
      profileImage?: Express.Multer.File[];
      incorporationDocument?: Express.Multer.File[];
      gstDocument?: Express.Multer.File[];
      panDocument?: Express.Multer.File[];
    },
    deviceId?: string,
    userAgent?: string,
  ) {
    const { email, password, ...brandData } = signupDto;

    // 1️⃣ Check if brand exists
    const existingBrand = await this.findExistingBrand(email);

    if (existingBrand) {
      return this.handleExistingBrand(
        existingBrand,
        email,
        deviceId,
        userAgent,
      );
    }

    // 2️⃣ Prepare brand creation data
    const hashedPassword = await bcrypt.hash(password, 10);
    const fileUrls = await this.uploadSignupFiles(files);

    await this.validateNicheIds(brandData.nicheIds);

    // 3️⃣ Transactional brand creation
    const brand = await this.createBrandWithNiches(
      { email, password: hashedPassword, ...brandData },
      fileUrls,
    );

    // 4️⃣ Handle verification
    await this.initiateEmailVerification(brand, email, deviceId, userAgent);

    return {
      message:
        'Brand registered successfully. Please check your email for OTP to complete verification.',
      requiresOtp: true,
      email: email,
      brand: { id: brand.id, brandName: brand.brandName, email: brand.email },
    };
  }

  private async findExistingBrand(email: string) {
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');

    return this.brandModel.findOne({
      where: { emailHash },
    });
  }

  private async handleExistingBrand(
    brand: Brand,
    email: string,
    deviceId?: string,
    userAgent?: string,
  ) {
    const otp = await this.generateAndStoreOtp(email, {
      brandId: brand.id,
      deviceId,
      userAgent,
      isExistingAccount: true,
    });

    await this.emailService.sendBrandOtp(email, otp);

    return {
      message:
        'An account with this email already exists. OTP sent to your email to verify ownership.',
      requiresOtp: true,
      accountExists: true,
      email,
      brand: { id: brand.id, brandName: brand.brandName, email: brand.email },
    };
  }

  private async uploadSignupFiles(files?: SignupFiles) {
    return {
      profileImage: files?.profileImage?.[0]
        ? await this.s3Service.uploadFileToS3(
            files.profileImage[0],
            'profiles/brands',
            'brand',
          )
        : undefined,
      profileBanner: files?.profileBanner?.[0]
        ? await this.s3Service.uploadFileToS3(
            files.profileBanner[0],
            'profiles/brands',
            'banner',
          )
        : undefined,
      incorporationDocument: files?.incorporationDocument?.[0]
        ? await this.s3Service.uploadFileToS3(
            files.incorporationDocument[0],
            'documents/brands',
            'incorporation',
          )
        : undefined,
      gstDocument: files?.gstDocument?.[0]
        ? await this.s3Service.uploadFileToS3(
            files.gstDocument[0],
            'documents/brands',
            'gst',
          )
        : undefined,
      panDocument: files?.panDocument?.[0]
        ? await this.s3Service.uploadFileToS3(
            files.panDocument[0],
            'documents/brands',
            'pan',
          )
        : undefined,
    };
  }

  private async validateNicheIds(nicheIds?: number[]) {
    if (!nicheIds?.length) return;
    const validNiches = await this.nicheModel.findAll({
      where: { id: nicheIds, isActive: true },
    });

    if (validNiches.length !== nicheIds.length) {
      throw new BadRequestException('One or more invalid niche IDs provided');
    }
  }

  private async createBrandWithNiches(
    brandData: BrandCreationAttributes & { nicheIds?: number[] },
    fileUrls: {
      profileImage?: string;
      incorporationDocument?: string;
      gstDocument?: string;
      panDocument?: string;
    },
  ) {
    return this.sequelize.transaction(async (transaction) => {
      const createdBrand = await this.brandModel.create(
        {
          ...brandData,
          profileImage: fileUrls.profileImage ?? brandData.profileImage,
          incorporationDocument:
            fileUrls.incorporationDocument ?? brandData.incorporationDocument,
          gstDocument: fileUrls.gstDocument ?? brandData.gstDocument,
          panDocument: fileUrls.panDocument ?? brandData.panDocument,
          isPhoneVerified: false,
          isEmailVerified: false,
        },
        { transaction },
      );

      if (brandData.nicheIds?.length) {
        await this.brandNicheModel.bulkCreate(
          brandData.nicheIds.map((nicheId) => ({
            brandId: createdBrand.id,
            nicheId,
          })),
          { transaction },
        );
      }

      return createdBrand;
    });
  }

  private async initiateEmailVerification(
    brand: Brand,
    email: string,
    deviceId?: string,
    userAgent?: string,
  ) {
    const otp = await this.generateAndStoreOtp(email, {
      brandId: brand.id,
      deviceId,
      userAgent,
    });

    // Send welcome + OTP
    await this.emailService.sendWelcomeEmail(email, brand.brandName);
    await this.emailService.sendBrandOtp(email, otp);
  }

  private async generateAndStoreOtp(
    email: string,
    sessionData: {
      brandId: number;
      deviceId?: string | null;
      userAgent?: string | null;
      isExistingAccount?: boolean;
    },
  ) {
    const isStaging = this.configService.get<string>('NODE_ENV') === 'staging';
    const otp = isStaging ? '123456' : randomInt(100000, 999999).toString();

    // Set expiry timestamp for OTP (valid for 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Encrypt identifier and create hash for searching
    const identifierHash = crypto
      .createHash('sha256')
      .update(email)
      .digest('hex');
    const encryptedIdentifier = this.encryptionService.encrypt(email);

    // Clear any previously issued OTP for this email (avoid duplicates/conflicts)
    await this.otpModel.destroy({
      where: {
        identifierHash,
        type: 'email',
      },
    });

    // Save the new OTP in the database with encrypted identifier
    await this.otpModel.create({
      identifier: encryptedIdentifier,
      identifierHash,
      type: 'email',
      otp: otp,
      expiresAt,
    });

    const tempSessionKey = `temp:brand:${email}`;
    await this.redisService
      .getClient()
      .set(
        tempSessionKey,
        JSON.stringify({ ...sessionData, createdAt: new Date().toISOString() }),
        'EX',
        600,
      );

    return otp;
  }

  async brandLogin(
    loginDto: BrandLoginDto,
    deviceId?: string,
    userAgent?: string,
  ) {
    const { email, password } = loginDto;

    // Create hash of email for searching
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');

    // Find brand by emailHash (including soft-deleted)
    let brand = await this.brandModel.findOne({
      where: { emailHash },
      paranoid: false,
    });

    // If account was deleted within 30 days, restore it
    if (brand && brand.deletedAt) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (brand.deletedAt > thirtyDaysAgo) {
        // Verify password before restoring
        if (!password || !brand.password) {
          throw new UnauthorizedException('Invalid email or password');
        }

        const isValidPassword = await bcrypt.compare(password, brand.password);
        if (!isValidPassword) {
          throw new UnauthorizedException('Invalid email or password');
        }

        await brand.restore();
        await brand.update({ isActive: true });
        this.loggerService.info(`Restored deleted account for brand: ${brand.id}`);
      } else {
        // Account deleted more than 30 days ago
        throw new UnauthorizedException('Invalid email or password');
      }
    }

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

    // Check if email is verified
    if (!brand.isEmailVerified) {
      // Use existing private method to generate and store OTP with session data
      const otp = await this.generateAndStoreOtp(email, {
        brandId: brand.id,
        deviceId,
        userAgent,
      });

      // Send OTP email
      await this.emailService.sendBrandOtp(email, otp);

      return {
        message:
          'Email not verified. OTP sent to your email address. Please verify to complete login.',
        requiresEmailVerification: true,
        requiresOtp: true,
        email: email,
      };
    }

    // Generate and send email OTP for verified users (normal login flow)
    const otp = await this.generateAndStoreOtp(email, {
      brandId: brand.id,
      deviceId,
      userAgent,
    });

    // Send OTP email
    await this.emailService.sendBrandOtp(email, otp);

    return {
      message:
        'OTP sent to your email address. Please verify to complete login.',
      requiresOtp: true,
      email: email,
    };
  }

  async verifyBrandOtp(
    verifyOtpDto: BrandVerifyOtpDto,
    deviceId?: string,
    userAgent?: string,
  ) {
    const { email, otp } = verifyOtpDto;

    // Create hash of email for searching
    const identifierHash = crypto
      .createHash('sha256')
      .update(email)
      .digest('hex');

    // Get stored OTP from database using hash
    const otpRecord = await this.otpModel.findOne({
      where: {
        identifierHash,
        type: 'email',
        otp,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!otpRecord) {
      // Check if there's an OTP record for tracking attempts
      const existingRecord = await this.otpModel.findOne({
        where: {
          identifierHash,
          type: 'email',
          isUsed: false,
        },
        order: [['createdAt', 'DESC']],
      });

      if (existingRecord) {
        // Increment attempts
        existingRecord.attempts += 1;

        if (existingRecord.attempts >= 5) {
          // Too many failed attempts, invalidate OTP
          await existingRecord.update({ isUsed: true });
          throw new UnauthorizedException(
            'Too many failed attempts. Please request a new OTP.',
          );
        }

        await existingRecord.save();
      }

      throw new UnauthorizedException('OTP has expired or is invalid');
    }

    // Get temporary session data
    const tempSessionKey = `temp:brand:${email}`;
    const tempSessionData = await this.redisService
      .getClient()
      .get(tempSessionKey);

    if (!tempSessionData) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    const sessionInfo = JSON.parse(tempSessionData);
    const brandId = sessionInfo.brandId;
    const isExistingAccount = sessionInfo.isExistingAccount || false;

    // Get brand details to determine if it's a new signup or existing login
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

    // Reactivate account if deactivated
    if (!brand.isActive) {
      await brand.update({ isActive: true });
      this.loggerService.info(`Account reactivated for brand: ${brand.id}`);
    }

    // Check if this is a new signup (profile not completed yet)
    const isNewSignup = !brand.isProfileCompleted && !isExistingAccount;

    // Mark email as verified if not already
    if (!brand.isEmailVerified) {
      await brand.update({ isEmailVerified: true });
      // Reload to get fresh decrypted data after update
      await brand.reload();
    }

    // Mark OTP as used
    await otpRecord.update({ isUsed: true });

    // Generate tokens with appropriate profile status
    const { accessToken, refreshToken, jti } = await this.generateTokens(
      brandId,
      brand.isProfileCompleted,
      'brand',
    );

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
    await this.redisService
      .getClient()
      .multi()
      .del(tempSessionKey) // Remove temporary session
      .set(sessionKey, sessionPayload) // No expiry - session persists until logout
      .sadd(sessionsSetKey, jti)
      .exec();

    // Return different responses based on context
    if (isNewSignup) {
      // New signup flow - minimal brand info, indicate profile completion needed
      return {
        message: 'Email verified successfully. Please complete your profile.',
        accessToken,
        refreshToken,
        requiresProfileCompletion: true,
        brand: {
          id: brand.id,
          email: brand.email,
          isEmailVerified: true,
          isProfileCompleted: brand.isProfileCompleted,
        },
      };
    }

    // Existing account login flow - full brand details
    return {
      message: isExistingAccount
        ? 'Account verified successfully. Login successful'
        : 'Email verified successfully. Login successful',
      accessToken,
      refreshToken,
      brand: {
        id: brand.id,
        email: brand.email,
        brandName: brand.brandName,
        username: brand.username,
        legalEntityName: brand.legalEntityName,
        companyType: brand.companyType,
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
    // Step 1: Verify token signature & decode payload
    const decoded: DecodedRefresh = this.jwtService.verify<DecodedRefresh>(
      refreshToken,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      },
    );

    const userId = decoded.id;
    const jti = decoded.jti;

    // Safety check → if token doesn't contain expected fields, just return success
    if (!userId || !jti) return { message: 'Logged out' };

    // Step 2: Prepare Redis keys for this session
    const key = this.sessionKey(userId, jti); // key for this session
    const setKey = this.sessionsSetKey(userId); // set of all active sessions

    // Step 3: Calculate TTL = seconds left until token expiry
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    const expTtl = ttl > 0 ? ttl : 60; // fallback: 1 min minimum

    // Step 4: Redis transaction to clean up session + blacklist token
    await this.redisService
      .getClient()
      .multi()
      .set(this.blacklistKey(jti), '1', 'EX', expTtl) // mark JTI as blacklisted
      .del(key) // delete session for this device
      .srem(setKey, jti) // remove JTI from user's active set
      .exec();

    // Step 5: Return confirmation
    return { message: 'Logged out' };
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
        multi.set(this.blacklistKey(jti), '1', 'EX', 365 * 24 * 60 * 60);
      }

      // Step 3: Remove the user's session set itself
      multi.del(setKey);

      // Execute all Redis operations atomically
      await multi.exec();
    }

    // Step 4: Return confirmation
    return { message: 'Logged out from all devices' };
  }

  async refreshToken({
    refreshToken,
  }: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    // Step 1: Decode & validate the refresh token
    const decoded: DecodedRefresh = this.jwtService.verify<DecodedRefresh>(
      refreshToken,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      },
    );

    const userId = decoded.id;
    const jti = decoded.jti;

    // Sanity check → must have userId and JTI
    if (!userId || !jti)
      throw new UnauthorizedException('Malformed refresh token');

    // Step 2: Check blacklist and active session in Redis
    const [isBlacklisted, exists] = await Promise.all([
      this.redisService.getClient().get(this.blacklistKey(jti)), // was revoked?
      this.redisService.getClient().get(this.sessionKey(userId, jti)), // still active?
    ]);

    if (isBlacklisted) throw new ForbiddenException('Refresh token revoked');
    if (!exists) throw new UnauthorizedException('Session expired or revoked');

    // Step 3: Determine user type by checking which table the user belongs to
    const [influencer, brand] = await Promise.all([
      this.influencerModel.findByPk(userId),
      this.brandModel.findByPk(userId),
    ]);

    const userType = influencer ? 'influencer' : 'brand';
    const profileCompleted = influencer
      ? Boolean(influencer.name && influencer.username)
      : Boolean(brand?.brandName && brand?.email);

    // Step 4: Rotate refresh token (security best practice)
    const {
      accessToken,
      refreshToken: newRefresh,
      jti: newJti,
    } = await this.generateTokens(userId, profileCompleted, userType);

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
    const oldPayload =
      (await this.redisService.getClient().get(oldKey)) || '{}';

    // Merge old payload with new data & add rotation timestamp
    const merged = JSON.stringify({
      ...JSON.parse(oldPayload),
      ...extra,
      rotatedAt: new Date().toISOString(),
    });

    // Atomic operations to rotate session in Redis
    const multi = this.redisService
      .getClient()
      .multi()
      .del(oldKey) // delete old session key
      .srem(setKey, oldJti) // remove old JTI from user's session set
      .set(newKey, merged); // store new session payload

    // No expiry - sessions persist until explicit logout

    // Add new JTI to user's session set
    multi.sadd(setKey, newJti);
    await multi.exec();

    // Blacklist the old JTI for a long period (1 year) since tokens don't naturally expire
    await this.redisService
      .getClient()
      .set(this.blacklistKey(oldJti), '1', 'EX', 365 * 24 * 60 * 60);
  }

  /**
   * Forgot password - Send password reset email with token
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Step 1: Check if brand exists
    const brand = await this.brandModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: ['id', 'email', 'brandName'],
    });

    if (!brand) {
      // Don't reveal if email exists or not for security
      return {
        message: 'If the email exists, a password reset link has been sent',
        success: true,
      };
    }

    // Step 2: Generate password reset token (JWT with brand ID and expiration)
    const resetPayload = {
      brandId: brand.id,
      email: brand.email,
      type: 'password-reset',
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
        brandId: brand.id,
        email: brand.email,
        createdAt: new Date().toISOString(),
      }),
      3600,
    ); // 1 hour

    // Step 4: Generate password reset URL
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Step 5: Send password reset email
    await this.emailService.sendPasswordResetEmail(
      brand.email,
      brand.brandName,
      resetUrl,
      resetToken,
    );

    return {
      message: 'If the email exists, a password reset link has been sent',
      success: true,
    };
  }

  /**
   * Reset password - Verify token and set new password
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Step 1: Verify and decode the reset token
    let decoded: { brandId: number; email: string; type: string };
    decoded = this.jwtService.verify<{
      brandId: number;
      email: string;
      type: string;
    }>(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });

    // Step 2: Validate token payload
    if (
      decoded.type !== 'password-reset' ||
      !decoded.brandId ||
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

    // Step 4: Find the brand
    const brand = await this.brandModel.findOne({
      where: {
        id: decoded.brandId,
        email: decoded.email.toLowerCase(),
      },
    });

    if (!brand) {
      throw new UnauthorizedException('Brand not found');
    }

    // Step 5: Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Step 6: Update brand password in database
    await brand.update({ password: hashedPassword });

    // Step 7: Invalidate the reset token (delete from Redis)
    await this.redisService.del(tokenKey);

    // Step 8: Logout from all devices for security (invalidate all sessions)
    await this.logoutAll(brand.id);

    return {
      message:
        'Password has been reset successfully. Please log in with your new password.',
      success: true,
    };
  }

  // Two-step brand signup methods

  /**
   * Initial brand signup - Create account and send OTP
   */
  async brandInitialSignup(
    signupDto: BrandInitialSignupDto,
    deviceId?: string,
    userAgent?: string,
  ) {
    const { email, password } = signupDto;

    // Create hash of email for searching
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');

    // Check if brand already exists
    const existingBrand = await this.brandModel.findOne({
      where: { emailHash },
    });

    if (existingBrand) {
      if (existingBrand.isEmailVerified) {
        throw new ConflictException('Brand already exists with this email');
      } else {
        // Brand exists but email not verified - resend OTP
        const otp = await this.generateAndStoreOtp(email, {
          brandId: existingBrand.id,
          deviceId,
          userAgent,
        });

        await this.emailService.sendBrandOtp(email, otp);

        return {
          message: 'OTP sent to your email for verification.',
          email: email,
          requiresOtp: true,
          brandId: existingBrand.id,
        };
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Encrypt email manually (hooks don't fire reliably)
    const encryptedEmail = this.encryptionService.encrypt(email);

    // Create brand with basic info
    const brand = await this.brandModel.create({
      email: encryptedEmail,
      emailHash: emailHash,
      password: hashedPassword,
      isEmailVerified: false,
      isProfileCompleted: false,
    });

    // Generate and store OTP
    const otp = await this.generateAndStoreOtp(email, {
      brandId: brand.id,
      deviceId,
      userAgent,
    });

    // Send OTP email
    await this.emailService.sendBrandOtp(email, otp);

    return {
      message:
        'Account created successfully. OTP sent to your email for verification.',
      email: email,
      requiresOtp: true,
      brandId: brand.id,
    };
  }

  /**
   * Complete brand profile with all required information
   */
  async brandCompleteProfile(
    brandId: number,
    profileDto: BrandProfileCompletionDto,
    files?: {
      profileImage?: Express.Multer.File[];
      incorporationDocument?: Express.Multer.File[];
      gstDocument?: Express.Multer.File[];
      panDocument?: Express.Multer.File[];
    },
  ) {
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new UnauthorizedException('Brand not found');
    }

    if (!brand.isEmailVerified) {
      throw new UnauthorizedException('Email must be verified first');
    }

    // Check for username uniqueness
    if (profileDto.username) {
      const existingUsername = await this.brandModel.findOne({
        where: { username: profileDto.username },
      });

      if (existingUsername && existingUsername.id !== brandId) {
        throw new ConflictException('Username already exists');
      }
    }

    // Validate niche IDs
    const validNiches = await this.nicheModel.findAll({
      where: { id: profileDto.nicheIds, isActive: true },
    });

    if (validNiches.length !== profileDto.nicheIds.length) {
      throw new BadRequestException('One or more invalid niche IDs provided');
    }

    // Look up company type ID from company type name
    let companyTypeId: number | undefined;
    if (profileDto.companyType) {
      const companyType = await this.companyTypeModel.findOne({
        where: { name: profileDto.companyType },
      });
      if (!companyType) {
        throw new BadRequestException('Invalid company type provided');
      }
      companyTypeId = companyType.id;
    }

    let profileImageUrl: string | undefined;
    let incorporationDocumentUrl: string | undefined;
    let gstDocumentUrl: string | undefined;
    let panDocumentUrl: string | undefined;

    // Upload files if provided
    // if (files) {
    //   if (files.profileImage?.[0]) {
    //     profileImageUrl = await this.uploadService.uploadProfileImage(
    //       files.profileImage[0],
    //       'brand',
    //       brandId,
    //     );
    //   }

    //   if (files.incorporationDocument?.[0]) {
    //     incorporationDocumentUrl = await this.uploadService.uploadDocument(
    //       files.incorporationDocument[0],
    //       'brand',
    //       brandId,
    //       'incorporation',
    //     );
    //   }

    //   if (files.gstDocument?.[0]) {
    //     gstDocumentUrl = await this.uploadService.uploadDocument(
    //       files.gstDocument[0],
    //       'brand',
    //       brandId,
    //       'gst',
    //     );
    //   }

    //   if (files.panDocument?.[0]) {
    //     panDocumentUrl = await this.uploadService.uploadDocument(
    //       files.panDocument[0],
    //       'brand',
    //       brandId,
    //       'pan',
    //     );
    //   }
    // }

    const uploadedFiles = await this.uploadSignupFiles(files);

    profileImageUrl = uploadedFiles.profileImage;
    incorporationDocumentUrl = uploadedFiles.incorporationDocument;
    gstDocumentUrl = uploadedFiles.gstDocument;
    panDocumentUrl = uploadedFiles.panDocument;

    // Update brand with profile data
    const updatedData = {
      brandName: profileDto.brandName,
      username: profileDto.username,
      legalEntityName: profileDto.legalEntityName,
      companyTypeId: companyTypeId,
      pocName: profileDto.pocName,
      pocDesignation: profileDto.pocDesignation,
      pocEmailId: profileDto.pocEmailId,
      pocContactNumber: profileDto.pocContactNumber,
      brandBio: profileDto.brandBio,
      profileImage: profileImageUrl || brand.profileImage,
      incorporationDocument:
        incorporationDocumentUrl || brand.incorporationDocument,
      gstDocument: gstDocumentUrl || brand.gstDocument,
      panDocument: panDocumentUrl || brand.panDocument,
      isProfileCompleted: true,
    };

    await brand.update(updatedData);

    // Create brand-niche associations
    for (const nicheId of profileDto.nicheIds) {
      await this.brandNicheModel.findOrCreate({
        where: { brandId: brand.id, nicheId },
        defaults: { brandId: brand.id, nicheId },
      });
    }

    // Remove old associations not in the new list
    await this.brandNicheModel.destroy({
      where: {
        brandId: brand.id,
        nicheId: {
          [Op.notIn]: profileDto.nicheIds,
        },
      },
    });

    // Fetch updated brand with niches and company type
    const updatedBrand = await this.brandModel.findByPk(brandId, {
      include: [
        {
          model: this.nicheModel,
          as: 'niches',
          attributes: ['id', 'name'],
        },
        {
          model: this.companyTypeModel,
          attributes: ['id', 'name', 'description'],
        },
      ],
    });

    if (!updatedBrand) {
      throw new NotFoundException('Brand not found after update');
    }

    return {
      message: 'Profile completed successfully',
      brand: {
        id: updatedBrand.id,
        email: updatedBrand.email,
        brandName: updatedBrand.brandName,
        username: updatedBrand.username,
        isEmailVerified: updatedBrand.isEmailVerified,
        isProfileCompleted: updatedBrand.isProfileCompleted,
        profileImage: updatedBrand.profileImage,
        niches: updatedBrand.niches,
      },
    };
  }

  async deleteAccount(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<{ message: string }> {
    // Invalidate all user sessions first
    const sessionsKey = this.sessionsSetKey(userId);
    const sessionJtis = await this.redisService.getClient().smembers(sessionsKey);

    for (const jti of sessionJtis) {
      await this.redisService.del(this.sessionKey(userId, jti));
    }
    await this.redisService.del(sessionsKey);

    // Soft delete using paranoid mode (sets deletedAt timestamp and isActive=false)
    if (userType === 'influencer') {
      const influencer = await this.influencerModel.findByPk(userId);
      if (!influencer) {
        throw new NotFoundException('Influencer not found');
      }
      await influencer.update({ isActive: false });
      await influencer.destroy(); // Sets deletedAt with paranoid mode
    } else if (userType === 'brand') {
      const brand = await this.brandModel.findByPk(userId);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
      await brand.update({ isActive: false });
      await brand.destroy(); // Sets deletedAt with paranoid mode
    }

    return { message: 'Account deleted successfully' };
  }
}
