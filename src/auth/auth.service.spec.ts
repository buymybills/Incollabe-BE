import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Influencer } from './model/influencer.model';
import { Brand } from './model/brand.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { InfluencerNiche } from './model/influencer-niche.model';
import { BrandNiche } from './model/brand-niche.model';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../shared/sms.service';
import { EmailService } from '../shared/email.service';
import { S3Service } from '../shared/s3.service';
import { Sequelize } from 'sequelize-typescript';

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
    smembers: jest.fn().mockResolvedValue([]),
    srem: jest.fn().mockResolvedValue(1),
  })),
};

const mockSmsService = {
  sendOtp: jest.fn(),
};

const mockEmailService = {
  sendBrandOtpEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
};

const mockS3Service = {
  uploadFile: jest.fn(),
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

describe('AuthService', () => {
  let service: AuthService;

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

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

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getNiches', () => {
    it('should return all active niches', async () => {
      const mockNiches = [
        { id: 1, name: 'Fashion', icon: '👗', isActive: true },
        { id: 2, name: 'Beauty', icon: '💄', isActive: true },
      ];

      const nicheModel = service['nicheModel'];
      jest.spyOn(nicheModel, 'findAll').mockResolvedValue(mockNiches as any);

      const result = await service.getNiches();

      expect(result).toEqual({
        message: 'Niches fetched successfully',
        niches: mockNiches,
      });
      expect(nicheModel.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['name', 'ASC']],
      });
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
});
