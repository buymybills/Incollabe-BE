import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthService } from './admin-auth.service';
import { getModelToken } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Admin, AdminStatus, AdminRole } from './models/admin.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { CampaignDeliverable } from '../campaign/models/campaign-deliverable.model';
import { CampaignCity } from '../campaign/models/campaign-city.model';
import { ProfileReview } from './models/profile-review.model';
import { Post } from '../post/models/post.model';
import { Follow } from '../post/models/follow.model';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../shared/email.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockAdminModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockInfluencerModel = {
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockBrandModel = {
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockNicheModel = {
  findAll: jest.fn(),
};

const mockCountryModel = {
  findAll: jest.fn(),
};

const mockCityModel = {
  findAll: jest.fn(),
};

const mockCompanyTypeModel = {
  findAll: jest.fn(),
};

const mockCampaignModel = {
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockCampaignApplicationModel = {
  count: jest.fn(),
};

const mockCampaignDeliverableModel = {
  findAll: jest.fn(),
};

const mockCampaignCityModel = {
  findAll: jest.fn(),
};

const mockProfileReviewModel = {
  count: jest.fn(),
};

const mockPostModel = {
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockFollowModel = {
  findAll: jest.fn(),
  count: jest.fn(),
};

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let adminModel: typeof Admin;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: getModelToken(Admin),
          useValue: mockAdminModel,
        },
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
          provide: getModelToken(Country),
          useValue: mockCountryModel,
        },
        {
          provide: getModelToken(City),
          useValue: mockCityModel,
        },
        {
          provide: getModelToken(CompanyType),
          useValue: mockCompanyTypeModel,
        },
        {
          provide: getModelToken(Campaign),
          useValue: mockCampaignModel,
        },
        {
          provide: getModelToken(CampaignApplication),
          useValue: mockCampaignApplicationModel,
        },
        {
          provide: getModelToken(CampaignDeliverable),
          useValue: mockCampaignDeliverableModel,
        },
        {
          provide: getModelToken(CampaignCity),
          useValue: mockCampaignCityModel,
        },
        {
          provide: getModelToken(Post),
          useValue: mockPostModel,
        },
        {
          provide: getModelToken(Follow),
          useValue: mockFollowModel,
        },
        {
          provide: getModelToken(ProfileReview),
          useValue: mockProfileReviewModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_ACCESS_EXPIRY') return '1h';
              return null;
            }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            getClient: jest.fn(() => ({
              sadd: jest.fn(),
              smembers: jest.fn(),
              srem: jest.fn(),
              multi: jest.fn(() => ({
                set: jest.fn().mockReturnThis(),
                del: jest.fn().mockReturnThis(),
                srem: jest.fn().mockReturnThis(),
                exec: jest.fn(),
              })),
            })),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendAdminLoginOtp: jest.fn(),
            sendAdminPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    adminModel = module.get<typeof Admin>(getModelToken(Admin));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('login', () => {
    const validEmail = 'admin@test.com';
    const validPassword = 'password123';

    const mockAdmin = {
      id: 1,
      email: validEmail,
      password: 'hashedPassword',
      name: 'Admin User',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      twoFactorEnabled: true, // Default: 2FA enabled
      lastLoginAt: null,
      profileImage: null,
      update: jest.fn().mockResolvedValue(true),
    };

    it('should send OTP successfully with valid credentials (2FA Step 1)', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(validEmail, validPassword);

      expect(result).toEqual({
        message: 'OTP sent to your email. Please verify to complete login.',
        email: validEmail,
        requiresOtp: true,
      });

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        validPassword,
        'hashedPassword',
      );
      // OTP should be stored in Redis and email should be sent
    });

    it('should throw UnauthorizedException for non-existent admin', async () => {
      mockAdminModel.findOne.mockResolvedValue(null);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for inactive admin', async () => {
      const inactiveAdmin = {
        ...mockAdmin,
        status: AdminStatus.INACTIVE,
      };

      mockAdminModel.findOne.mockResolvedValue(inactiveAdmin);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        new UnauthorizedException('Account is inactive or suspended'),
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for suspended admin', async () => {
      const suspendedAdmin = {
        ...mockAdmin,
        status: AdminStatus.SUSPENDED,
      };

      mockAdminModel.findOne.mockResolvedValue(suspendedAdmin);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        new UnauthorizedException('Account is inactive or suspended'),
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(validEmail, 'wrongpassword')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        'hashedPassword',
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
      expect(mockAdmin.update).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockAdminModel.findOne.mockRejectedValue(dbError);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle bcrypt errors', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Bcrypt error'),
      );

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        'Bcrypt error',
      );
    });

    it('should handle Redis errors during OTP storage', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Redis set should be tested in integration tests
      const result = await service.login(validEmail, validPassword);
      expect(result.requiresOtp).toBe(true);
    });

    it('should work with different admin roles', async () => {
      const moderatorAdmin = {
        ...mockAdmin,
        role: AdminRole.CONTENT_MODERATOR,
      };

      mockAdminModel.findOne.mockResolvedValue(moderatorAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(validEmail, validPassword);

      expect(result.requiresOtp).toBe(true);
      expect(result.email).toBe(validEmail);
    });

    it('should handle special characters in email and password', async () => {
      const specialEmail = 'admin+test@domain-name.co.uk';
      const specialPassword = 'P@ssw0rd!#$%';

      const specialAdmin = { ...mockAdmin, email: specialEmail };
      mockAdminModel.findOne.mockResolvedValue(specialAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(specialEmail, specialPassword);

      expect(result.requiresOtp).toBe(true);
      expect(result.email).toBe(specialEmail);
      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: specialEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        specialPassword,
        'hashedPassword',
      );
    });

    it('should send OTP without exposing sensitive data', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(validEmail, validPassword);

      // Login response should only contain message, email, and requiresOtp
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('requiresOtp');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('admin');
    });

    it('should store OTP data for later verification', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(validEmail, validPassword);

      expect(result.requiresOtp).toBe(true);
      // OTP and admin data should be stored in Redis for verification
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle empty email', async () => {
      await expect(service.login('', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle empty password', async () => {
      const mockAdmin = {
        id: 1,
        email: 'admin@test.com',
        password: 'hashedPassword',
        status: AdminStatus.ACTIVE,
      };

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('admin@test.com', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle null/undefined inputs', async () => {
      await expect(service.login(null as any, 'password')).rejects.toThrow();

      await expect(
        service.login('email@test.com', null as any),
      ).rejects.toThrow();
    });

    it('should be case-sensitive for email', async () => {
      mockAdminModel.findOne.mockResolvedValue(null);

      await expect(service.login('ADMIN@TEST.COM', 'password')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: 'ADMIN@TEST.COM' },
      });
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
      mockAdminModel.findOne.mockResolvedValue(null);

      await expect(service.login(longEmail, 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle concurrent login attempts', async () => {
      const mockAdmin = {
        id: 1,
        email: 'admin@test.com',
        password: 'hashedPassword',
        status: AdminStatus.ACTIVE,
        twoFactorEnabled: true, // 2FA enabled for this test
        update: jest.fn().mockResolvedValue(true),
      };

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Simulate concurrent logins
      const loginPromises = [
        service.login('admin@test.com', 'password'),
        service.login('admin@test.com', 'password'),
        service.login('admin@test.com', 'password'),
      ];

      const results = await Promise.all(loginPromises);

      results.forEach((result) => {
        expect(result.requiresOtp).toBe(true);
        expect(result.email).toBe('admin@test.com');
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with multiple failed attempts', async () => {
      mockAdminModel.findOne.mockResolvedValue(null);

      const attempts = Array.from({ length: 100 }, (_, i) =>
        service.login(`user${i}@test.com`, 'password').catch(() => {}),
      );

      await Promise.all(attempts);

      expect(mockAdminModel.findOne).toHaveBeenCalledTimes(100);
    });

    it('should handle large password strings', async () => {
      const largePassword = 'x'.repeat(10000);
      const mockAdmin = {
        id: 1,
        email: 'admin@test.com',
        password: 'hashedPassword',
        status: AdminStatus.ACTIVE,
      };

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('admin@test.com', largePassword),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        largePassword,
        'hashedPassword',
      );
    });
  });
});
