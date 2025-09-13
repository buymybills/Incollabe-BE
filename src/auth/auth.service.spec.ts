import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Influencer } from './model/influencer.model';
import { Brand } from './model/brand.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { InfluencerNiche } from './model/influencer-niche.model';
import { BrandNiche } from './model/brand-niche.model';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../shared/sms.service';
import { Sequelize } from 'sequelize-typescript';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandLoginDto } from './dto/brand-login.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import * as bcrypt from 'bcrypt';

const mockInfluencerModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
};

const mockBrandModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
};

const mockNicheModel = {
  findAll: jest.fn(),
};

const mockOtpModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
};

const mockInfluencerNicheModel = {
  findAll: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
};

const mockBrandNicheModel = {
  findAll: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
};

const mockRedisService = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  getClient: jest.fn(() => ({
    multi: jest.fn(() => ({
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([['OK'], [1]]),
    })),
  })),
};

const mockSmsService = {
  sendOtp: jest.fn(),
};

const mockSequelize = {
  transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let redisService: RedisService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(Influencer),
          useValue: mockInfluencerModel,
        },
        {
          provide: getModelToken(Brand),
          useValue: mockBrandModel,
        },
        {
          provide: getModelToken(Niche),
          useValue: mockNicheModel,
        },
        {
          provide: getModelToken(Otp),
          useValue: mockOtpModel,
        },
        {
          provide: getModelToken(InfluencerNiche),
          useValue: mockInfluencerNicheModel,
        },
        {
          provide: getModelToken(BrandNiche),
          useValue: mockBrandNicheModel,
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    redisService = module.get<RedisService>(RedisService);
    jwtService = module.get<JwtService>(JwtService);

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_REFRESH_SECRET':
          return 'refresh-secret';
        default:
          return 'default-value';
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestOtp', () => {
    const requestOtpDto: RequestOtpDto = {
      phone: '9467289789',
    };

    it('should send OTP successfully for new phone number', async () => {
      mockInfluencerModel.findOne.mockResolvedValue(null);
      mockBrandModel.findOne.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.requestOtp(requestOtpDto);

      expect(result).toEqual({
        message: 'OTP sent successfully',
        phone: '+919467289789',
        expiresIn: 300,
      });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'otp:+919467289789',
        expect.any(String),
        300,
      );
    });

    it('should throw ConflictException if phone number already exists', async () => {
      mockInfluencerModel.findOne.mockResolvedValue({ id: 1, phone: '+919467289789' });
      mockBrandModel.findOne.mockResolvedValue(null);

      await expect(service.requestOtp(requestOtpDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyOtp', () => {
    const verifyOtpDto: VerifyOtpDto = {
      phone: '9467289789',
      otp: '123456',
    };

    it('should verify OTP successfully', async () => {
      mockRedisService.get.mockResolvedValue('123456');
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.verifyOtp(verifyOtpDto);

      expect(result).toEqual({
        message: 'OTP verified successfully',
        phone: '+919467289789',
        verified: true,
      });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'otp:verified:9467289789',
        'true',
        600,
      );
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      mockRedisService.get.mockResolvedValue('654321');

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired OTP', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('influencerSignup', () => {
    const signupDto: InfluencerSignupDto = {
      name: 'Test User',
      username: 'test_user',
      phone: '9467289789',
      dateOfBirth: '1995-01-15',
      gender: 'Male',
      bio: 'Test bio',
      nicheIds: [1, 2],
    };

    it('should create influencer successfully', async () => {
      mockRedisService.get.mockResolvedValue('true');
      mockInfluencerModel.findOne.mockResolvedValue(null);
      mockNicheModel.findAll.mockResolvedValue([
        { id: 1, name: 'Fashion' },
        { id: 2, name: 'Beauty' },
      ]);
      
      const mockInfluencer = {
        id: 1,
        ...signupDto,
        phone: '+919467289789',
        isPhoneVerified: true,
        setNiches: jest.fn(),
        reload: jest.fn().mockResolvedValue({
          id: 1,
          ...signupDto,
          niches: [{ id: 1, name: 'Fashion' }, { id: 2, name: 'Beauty' }],
        }),
      };
      
      mockInfluencerModel.create.mockResolvedValue(mockInfluencer);

      const result = await service.influencerSignup(signupDto);

      expect(result.message).toBe('Influencer registered successfully');
      expect(result.influencer).toBeDefined();
      expect(result.influencer!.phone).toBe('+919467289789');
    });

    it('should throw UnauthorizedException if phone not verified', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.influencerSignup(signupDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException if username already exists', async () => {
      mockRedisService.get.mockResolvedValue('true');
      mockInfluencerModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, username: 'test_user' });

      await expect(service.influencerSignup(signupDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('checkUsernameAvailability', () => {
    const checkUsernameDto: CheckUsernameDto = {
      username: 'test_user',
    };

    it('should return available username without suggestions', async () => {
      mockInfluencerModel.findOne.mockResolvedValue(null);
      mockBrandModel.findOne.mockResolvedValue(null);

      const result = await service.checkUsernameAvailability(checkUsernameDto);

      expect(result).toEqual({
        available: true,
        username: 'test_user',
        message: 'Username is unique and available to use',
      });
    });

    it('should return unavailable username with suggestions', async () => {
      mockInfluencerModel.findOne.mockResolvedValueOnce({ id: 1, username: 'test_user' });
      mockBrandModel.findOne.mockResolvedValue(null);
      
      // Mock suggestions check - first few will be taken, then available ones
      mockInfluencerModel.findOne
        .mockResolvedValueOnce({ id: 1, username: 'test_user1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.checkUsernameAvailability(checkUsernameDto);

      expect(result.available).toBe(false);
      expect(result.message).toBe('Username is already taken');
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('getNiches', () => {
    it('should return all active niches', async () => {
      const mockNiches = [
        { id: 1, name: 'Fashion', icon: '👗', isActive: true },
        { id: 2, name: 'Beauty', icon: '💄', isActive: true },
      ];
      mockNicheModel.findAll.mockResolvedValue(mockNiches);

      const result = await service.getNiches();

      expect(result).toEqual({
        message: 'Niches fetched successfully',
        niches: mockNiches,
      });
      expect(mockNicheModel.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['name', 'ASC']],
      });
    });
  });

  describe('brandSignup', () => {
    const brandSignupDto: BrandSignupDto = {
      email: 'test@brand.com',
      phone: '9467289789',
      password: 'password123',
      brandName: 'Test Brand',
      username: 'test_brand',
    };

    it('should create brand successfully', async () => {
      mockRedisService.get.mockResolvedValue('true');
      mockBrandModel.findOne.mockResolvedValue(null);
      
      const mockBrand = {
        id: 1,
        ...brandSignupDto,
        phone: '+919467289789',
        isPhoneVerified: true,
      };
      
      mockBrandModel.create.mockResolvedValue(mockBrand);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword' as never);

      const result = await service.brandSignup(brandSignupDto);

      expect(result.message).toBe('Brand registered successfully');
      expect(result.brand).toBeDefined();
      expect(result.brand!.phone).toBe('+919467289789');
    });

    it('should throw UnauthorizedException if phone not verified', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.brandSignup(brandSignupDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('brandLogin', () => {
    const brandLoginDto: BrandLoginDto = {
      email: 'test@brand.com',
      password: 'password123',
    };

    it('should login brand successfully', async () => {
      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        password: 'hashedPassword',
        isActive: true,
        brandName: 'Test Brand',
        isProfileCompleted: true,
      };

      mockBrandModel.findOne.mockResolvedValue(mockBrand);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.brandLogin(brandLoginDto);

      expect(result.message).toBe('Login successful');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.brand).toBeDefined();
      expect(result.brand!.email).toBe('test@brand.com');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockBrandModel.findOne.mockResolvedValue(null);

      await expect(service.brandLogin(brandLoginDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});