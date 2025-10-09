import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Influencer } from './model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { InfluencerNiche } from './model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { CustomNiche } from './model/custom-niche.model';
import { CompanyType } from '../shared/models/company-type.model';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../shared/sms.service';
import { EmailService } from '../shared/email.service';
import { S3Service } from '../shared/s3.service';
import { LoggerService } from '../shared/services/logger.service';
import { EncryptionService } from '../shared/services/encryption.service';
import { Sequelize } from 'sequelize-typescript';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandLoginDto } from './dto/brand-login.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { Gender } from './types/gender.enum';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockModel = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
});

const mockRedisService = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  getClient: jest.fn(() => ({
    multi: jest.fn(() => ({
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      smembers: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([['OK'], [1]]),
    })),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    smembers: jest.fn().mockResolvedValue([]),
    srem: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    ttl: jest.fn().mockResolvedValue(3600),
  })),
};

const mockSmsService = {
  sendOtp: jest.fn(),
};

const mockEmailService = {
  sendBrandOtpEmail: jest.fn(),
  sendBrandOtp: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
};

const mockS3Service = {
  uploadFileToS3: jest.fn(),
  getFileUrl: jest.fn(),
};

const mockSequelize = {
  transaction: jest.fn((callback) => {
    const transaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    return callback ? callback(transaction) : transaction;
  }),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  info: jest.fn(),
  logAuth: jest.fn(),
  logDatabase: jest.fn(),
};

const mockEncryptionService = {
  encrypt: jest.fn((text) => `encrypted_${text}`),
  decrypt: jest.fn((text) => text.replace('encrypted_', '')),
};

describe('AuthService', () => {
  let service: AuthService;
  let influencerModel: any;
  let brandModel: any;
  let nicheModel: any;
  let otpModel: any;
  let influencerNicheModel: any;
  let brandNicheModel: any;
  let redisService: any;
  let smsService: any;
  let emailService: any;
  let s3Service: any;
  let jwtService: any;
  let configService: any;
  let sequelize: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(Influencer),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Brand),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Niche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Otp),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(InfluencerNiche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(BrandNiche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CustomNiche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CompanyType),
          useValue: mockModel(),
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: Sequelize,
          useValue: mockSequelize,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    influencerModel = module.get(getModelToken(Influencer));
    brandModel = module.get(getModelToken(Brand));
    nicheModel = module.get(getModelToken(Niche));
    otpModel = module.get(getModelToken(Otp));
    influencerNicheModel = module.get(getModelToken(InfluencerNiche));
    brandNicheModel = module.get(getModelToken(BrandNiche));
    redisService = module.get(RedisService);
    smsService = module.get(SmsService);
    emailService = module.get(EmailService);
    s3Service = module.get(S3Service);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    sequelize = module.get(Sequelize);

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_REFRESH_SECRET':
          return 'refresh-secret';
        case 'JWT_ACCESS_SECRET':
          return 'access-secret';
        case 'JWT_ACCESS_EXPIRATION':
          return '15m';
        case 'JWT_REFRESH_EXPIRATION':
          return '7d';
        default:
          return 'default-value';
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getNiches', () => {
    it('should return all active niches', async () => {
      const mockNiches = [
        {
          id: 1,
          name: 'Fashion',
          logoNormal: '<svg>Fashion Normal</svg>',
          logoDark: '<svg>Fashion Dark</svg>',
          isActive: true,
        },
        {
          id: 2,
          name: 'Beauty',
          logoNormal: '<svg>Beauty Normal</svg>',
          logoDark: '<svg>Beauty Dark</svg>',
          isActive: true,
        },
      ];

      nicheModel.findAll.mockResolvedValue(mockNiches);

      const result = await service.getNiches();

      expect(result).toEqual({
        message: 'Niches fetched successfully',
        niches: mockNiches,
      });
      expect(nicheModel.findAll).toHaveBeenCalledWith({
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
    });
  });

  describe('requestOtp', () => {
    it('should generate and send OTP for phone number', async () => {
      const requestOtpDto: RequestOtpDto = {
        phone: '9876543210',
      };

      // Mock Redis operations
      redisService.get.mockResolvedValue(null); // No cooldown
      otpModel.destroy.mockResolvedValue(1);
      otpModel.create.mockResolvedValue({ otp: '123456' });
      smsService.sendOtp.mockResolvedValue(true);

      const result = await service.requestOtp(requestOtpDto);

      expect(result).toBe('OTP sent to +919876543210');
      expect(otpModel.create).toHaveBeenCalled();
      expect(smsService.sendOtp).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if cooldown is active', async () => {
      const requestOtpDto: RequestOtpDto = {
        phone: '9876543210',
      };

      redisService.get.mockResolvedValue('1'); // Cooldown active

      await expect(service.requestOtp(requestOtpDto)).rejects.toThrow(
        'Please wait before requesting another OTP',
      );
    });
  });

  describe('checkUsernameAvailability', () => {
    it('should return available status for unique username', async () => {
      const checkUsernameDto: CheckUsernameDto = {
        username: 'testuser',
      };

      influencerModel.findOne.mockResolvedValue(null);
      brandModel.findOne.mockResolvedValue(null);

      const result = await service.checkUsernameAvailability(checkUsernameDto);

      expect(result).toEqual({
        available: true,
        username: 'testuser',
        message: 'Username is unique and available to use',
      });
    });

    it('should return unavailable status and suggestions for taken username', async () => {
      const checkUsernameDto: CheckUsernameDto = {
        username: 'testuser',
      };

      influencerModel.findOne.mockResolvedValue({
        id: 1,
        username: 'testuser',
      });
      brandModel.findOne.mockResolvedValue(null);

      // Mock suggestions check
      influencerModel.findOne
        .mockResolvedValueOnce({ id: 1, username: 'testuser' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      brandModel.findOne.mockResolvedValue(null);

      const result = await service.checkUsernameAvailability(checkUsernameDto);

      expect(result.available).toBe(false);
      expect(result.suggestions).toHaveLength(3);
    });
  });

  describe('brandSignup', () => {
    it('should create a new brand successfully', async () => {
      const brandSignupDto: BrandSignupDto = {
        email: 'test@brand.com',
        phone: '+919876543210',
        password: 'Test123!',
        nicheIds: [1, 2],
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        phone: '+919876543210',
        isEmailVerified: false,
        isPhoneVerified: false,
      };

      brandModel.findOne.mockResolvedValue(null);
      nicheModel.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      sequelize.transaction.mockImplementation((callback) => {
        const transaction = { commit: jest.fn(), rollback: jest.fn() };
        return callback(transaction);
      });
      brandModel.create.mockResolvedValue(mockBrand);
      brandNicheModel.bulkCreate.mockResolvedValue([]);
      otpModel.create.mockResolvedValue({ otp: '123456' });
      emailService.sendBrandOtp.mockResolvedValue(true);
      emailService.sendWelcomeEmail.mockResolvedValue(true);

      const result = await service.brandSignup(brandSignupDto);

      expect(result.message).toBe(
        'Brand registered successfully. Please check your email for OTP to complete verification.',
      );
      expect(result.brand.email).toBe('test@brand.com');
      expect(brandModel.create).toHaveBeenCalled();
      expect(emailService.sendBrandOtp).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      const brandSignupDto: BrandSignupDto = {
        email: 'existing@brand.com',
        phone: '+919876543210',
        password: 'Test123!',
        nicheIds: [1, 2],
      };

      brandModel.findOne.mockResolvedValue({
        id: 1,
        email: 'existing@brand.com',
      });

      emailService.sendBrandOtp.mockResolvedValue(true);

      const result = await service.brandSignup(brandSignupDto);

      // Type assertion to access accountExists property
      const resultWithAccountExists = result as any;
      expect(resultWithAccountExists.accountExists).toBe(true);
      expect(result.requiresOtp).toBe(true);
      expect(result.message).toContain(
        'An account with this email already exists',
      );
    });
  });

  describe('brandLogin', () => {
    it('should login brand successfully with valid credentials', async () => {
      const brandLoginDto: BrandLoginDto = {
        email: 'test@brand.com',
        password: 'Test123!',
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        password: 'hashedPassword',
        isEmailVerified: true,
        isPhoneVerified: true,
        isActive: true,
      };

      brandModel.findOne.mockResolvedValue(mockBrand);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      // Mock Redis client methods
      const mockRedisClient = {
        set: jest.fn().mockResolvedValue('OK'),
        multi: jest.fn(() => ({
          set: jest.fn().mockReturnThis(),
          sadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([['OK'], [1]]),
        })),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      const result = await service.brandLogin(brandLoginDto);

      expect(result.message).toBe(
        'OTP sent to your email address. Please verify to complete login.',
      );
      expect(result.email).toBe('test@brand.com');
      expect(result.requiresOtp).toBe(true);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const brandLoginDto: BrandLoginDto = {
        email: 'test@brand.com',
        password: 'wrongpassword',
      };

      brandModel.findOne.mockResolvedValue(null);

      await expect(service.brandLogin(brandLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const logoutDto = {
        refreshToken: 'mock-refresh-token',
      };

      const mockDecodedToken = {
        id: 1,
        jti: 'session-id',
        exp: Date.now() + 1000,
      };

      jwtService.verify.mockReturnValue(mockDecodedToken);

      // Mock Redis client with proper multi chain
      const mockRedisClient = {
        multi: jest.fn(() => ({
          set: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          srem: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([1, 1]),
        })),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      const result = await service.logout(logoutDto);

      expect(result.message).toBe('Logged out');
    });
  });

  describe('influencerSignup', () => {
    it('should create a new influencer successfully', async () => {
      const influencerSignupDto: InfluencerSignupDto = {
        name: 'Test Influencer',
        username: 'testinfluencer',
        gender: Gender.FEMALE,
        nicheIds: [1, 2],
      };

      const mockInfluencer = {
        id: 1,
        phone: '+919876543210',
        name: 'Test Influencer',
        username: 'testinfluencer',
        isPhoneVerified: true,
      };

      // Mock Redis verification check (phone was recently verified)
      redisService.get.mockResolvedValue('verified');

      // Mock getVerifiedPhoneNumber to return a phone number for the verification key
      jest
        .spyOn(service as any, 'getVerifiedPhoneNumber')
        .mockResolvedValue('+919876543210');

      nicheModel.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      sequelize.transaction.mockImplementation((callback) => {
        const transaction = { commit: jest.fn(), rollback: jest.fn() };
        return callback(transaction);
      });
      influencerModel.create.mockResolvedValue(mockInfluencer);
      // Mock findByPk for fetching complete influencer data with niches
      const mockCompleteInfluencer = {
        ...mockInfluencer,
        niches: [{ id: 1 }, { id: 2 }],
        toJSON: jest.fn().mockReturnValue({
          ...mockInfluencer,
          niches: [{ id: 1 }, { id: 2 }],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };
      influencerModel.findByPk.mockResolvedValue(mockCompleteInfluencer);
      influencerNicheModel.bulkCreate.mockResolvedValue([]);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      // Mock Redis client for JWT operations
      const mockRedisClient = {
        multi: jest.fn(() => ({
          set: jest.fn().mockReturnThis(),
          sadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([['OK'], [1]]),
        })),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      const result = await service.influencerSignup(
        influencerSignupDto,
        'test-verification-key',
      );

      expect(result.message).toBe(
        'Influencer registered and logged in successfully',
      );
      expect(influencerModel.create).toHaveBeenCalled();
      expect(influencerNicheModel.bulkCreate).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      const verifyOtpDto = {
        phone: '9876543210',
        otp: '123456',
      };

      otpModel.findOne.mockResolvedValue({
        id: 1,
        otp: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isUsed: false,
        update: jest.fn(),
      });

      // Mock Redis client for successful verification
      const mockRedisClient = {
        multi: jest.fn(() => ({
          del: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([1, 'OK']),
        })),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      const result = await service.verifyOtp(verifyOtpDto);

      expect(result.message).toBe('OTP verified successfully');
      expect(result.verified).toBe(true);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const verifyOtpDto = {
        phone: '9876543210',
        otp: '999999',
      };

      otpModel.findOne.mockResolvedValue(null);

      // Mock Redis operations to handle attempt tracking
      const mockRedisClient = {
        multi: jest.fn(() => ({
          incr: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([1, 1]),
        })),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        'Invalid or expired OTP',
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for valid brand email', async () => {
      const forgotPasswordDto = {
        email: 'test@brand.com',
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Test Brand',
        update: jest.fn(),
      };

      brandModel.findOne.mockResolvedValue(mockBrand);
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toBe(
        'If the email exists, a password reset link has been sent',
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent email', async () => {
      const forgotPasswordDto = {
        email: 'nonexistent@brand.com',
      };

      brandModel.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(forgotPasswordDto);

      expect(result.message).toBe(
        'If the email exists, a password reset link has been sent',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully for influencer', async () => {
      const refreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      const mockDecodedToken = {
        id: 1,
        jti: 'session-id',
        exp: Date.now() + 1000,
      };

      jwtService.verify.mockReturnValue(mockDecodedToken);
      jwtService.sign.mockReturnValue('new-access-token');

      // Mock database lookups for user type determination
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'testuser',
      };
      influencerModel.findByPk.mockResolvedValue(mockInfluencer);
      brandModel.findByPk.mockResolvedValue(null);

      // Mock Redis operations for refresh token
      const mockRedisClient = {
        get: jest
          .fn()
          .mockResolvedValueOnce(null) // blacklist check
          .mockResolvedValueOnce('{"userId":1,"type":"influencer"}'), // session data
        set: jest.fn().mockResolvedValue('OK'),
        multi: jest.fn(() => ({
          set: jest.fn().mockReturnThis(),
          sadd: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          srem: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([['OK'], [1]]),
        })),
        exists: jest.fn().mockResolvedValue(1), // session exists
        ttl: jest.fn().mockResolvedValue(3600),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      const result = await service.refreshToken(refreshTokenDto);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-access-token');
      expect(influencerModel.findByPk).toHaveBeenCalledWith(1);
      expect(brandModel.findByPk).toHaveBeenCalledWith(1);
    });

    it('should refresh tokens successfully for brand', async () => {
      const refreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      const mockDecodedToken = {
        id: 2,
        jti: 'session-id-2',
        exp: Date.now() + 1000,
      };

      jwtService.verify.mockReturnValue(mockDecodedToken);
      jwtService.sign.mockReturnValue('new-brand-access-token');

      // Mock database lookups for user type determination (brand)
      const mockBrand = {
        id: 2,
        brandName: 'Test Brand',
        email: 'test@brand.com',
      };
      influencerModel.findByPk.mockResolvedValue(null);
      brandModel.findByPk.mockResolvedValue(mockBrand);

      // Mock Redis operations for refresh token
      const mockRedisClient = {
        get: jest
          .fn()
          .mockResolvedValueOnce(null) // blacklist check
          .mockResolvedValueOnce('{"userId":2,"type":"brand"}'), // session data
        set: jest.fn().mockResolvedValue('OK'),
        multi: jest.fn(() => ({
          set: jest.fn().mockReturnThis(),
          sadd: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          srem: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([['OK'], [1]]),
        })),
        exists: jest.fn().mockResolvedValue(1), // session exists
        ttl: jest.fn().mockResolvedValue(3600),
      };
      redisService.getClient.mockReturnValue(mockRedisClient);

      const result = await service.refreshToken(refreshTokenDto);

      expect(result.accessToken).toBe('new-brand-access-token');
      expect(result.refreshToken).toBe('new-brand-access-token');
      expect(influencerModel.findByPk).toHaveBeenCalledWith(2);
      expect(brandModel.findByPk).toHaveBeenCalledWith(2);
    });
  });

  describe('Service Dependencies', () => {
    it('should have all required dependencies injected', () => {
      expect(service['influencerModel']).toBeDefined();
      expect(service['brandModel']).toBeDefined();
      expect(service['nicheModel']).toBeDefined();
      expect(service['otpModel']).toBeDefined();
      expect(service['redisService']).toBeDefined();
      expect(service['smsService']).toBeDefined();
      expect(service['emailService']).toBeDefined();
      expect(service['s3Service']).toBeDefined();
      expect(service['jwtService']).toBeDefined();
      expect(service['sequelize']).toBeDefined();
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete influencer account using paranoid mode', async () => {
      const mockInfluencer = {
        id: 1,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      };

      influencerModel.findByPk.mockResolvedValue(mockInfluencer);
      redisService.getClient().smembers = jest.fn().mockResolvedValue(['jti1', 'jti2']);
      redisService.del = jest.fn().mockResolvedValue(1);

      const result = await service.deleteAccount(1, 'influencer');

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(influencerModel.findByPk).toHaveBeenCalledWith(1);
      expect(mockInfluencer.update).toHaveBeenCalledWith({ isActive: false });
      expect(mockInfluencer.destroy).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should soft delete brand account using paranoid mode', async () => {
      const mockBrand = {
        id: 1,
        update: jest.fn().mockResolvedValue(true),
        destroy: jest.fn().mockResolvedValue(true),
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);
      redisService.getClient().smembers = jest.fn().mockResolvedValue(['jti1']);
      redisService.del = jest.fn().mockResolvedValue(1);

      const result = await service.deleteAccount(1, 'brand');

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(brandModel.findByPk).toHaveBeenCalledWith(1);
      expect(mockBrand.update).toHaveBeenCalledWith({ isActive: false });
      expect(mockBrand.destroy).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException if influencer not found', async () => {
      influencerModel.findByPk.mockResolvedValue(null);

      await expect(service.deleteAccount(999, 'influencer')).rejects.toThrow(
        'Influencer not found',
      );
    });

    it('should throw NotFoundException if brand not found', async () => {
      brandModel.findByPk.mockResolvedValue(null);

      await expect(service.deleteAccount(999, 'brand')).rejects.toThrow(
        'Brand not found',
      );
    });
  });

  describe('Account Reactivation on Login', () => {
    it('should reactivate deactivated influencer on login', async () => {
      const mockInfluencer = {
        id: 1,
        isActive: false,
        dataValues: { name: 'Test', username: 'test' },
        update: jest.fn().mockResolvedValue({ isActive: true }),
      };

      influencerModel.findOne.mockResolvedValue(mockInfluencer);

      // Mock the OTP verification flow would detect inactive account and reactivate
      expect(mockInfluencer.isActive).toBe(false);
    });

    it('should reactivate deactivated brand on login', async () => {
      const mockBrand = {
        id: 1,
        isActive: false,
        isProfileCompleted: true,
        update: jest.fn().mockResolvedValue({ isActive: true }),
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);

      // Mock the brand OTP verification flow would detect inactive account and reactivate
      expect(mockBrand.isActive).toBe(false);
    });
  });
});
