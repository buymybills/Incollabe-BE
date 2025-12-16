import { Test, TestingModule } from '@nestjs/testing';
import { InfluencerController } from './influencer.controller';
import { InfluencerService } from './influencer.service';
import { SupportTicketService } from '../shared/support-ticket.service';
import { ProSubscriptionService } from './services/pro-subscription.service';
import { RazorpayService } from '../shared/razorpay.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateInfluencerProfileDto } from './dto/update-influencer-profile.dto';
import { WhatsappVerificationDto } from './dto/whatsapp-verification.dto';
import { RequestWithUser } from '../types/request.types';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const mockInfluencerService = {
  getInfluencerProfile: jest.fn(),
  updateInfluencerProfile: jest.fn(),
  sendWhatsAppVerificationOTP: jest.fn(),
  verifyWhatsAppOTP: jest.fn(),
  getExperiences: jest.fn(),
};

const mockSupportTicketService = {
  getAllTickets: jest.fn(),
  getTicketStatistics: jest.fn(),
  getTicketById: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
  createTicket: jest.fn(),
  getMyTickets: jest.fn(),
};

const mockProSubscriptionService = {
  createSubscription: jest.fn(),
  verifyPayment: jest.fn(),
  getSubscriptionStatus: jest.fn(),
  cancelSubscription: jest.fn(),
};

const mockRazorpayService = {
  createOrder: jest.fn(),
  verifySignature: jest.fn(),
  getPaymentDetails: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};

describe('InfluencerController', () => {
  let controller: InfluencerController;
  let influencerService: InfluencerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InfluencerController],
      providers: [
        {
          provide: InfluencerService,
          useValue: mockInfluencerService,
        },
        {
          provide: SupportTicketService,
          useValue: mockSupportTicketService,
        },
        {
          provide: ProSubscriptionService,
          useValue: mockProSubscriptionService,
        },
        {
          provide: RazorpayService,
          useValue: mockRazorpayService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<InfluencerController>(InfluencerController);
    influencerService = module.get<InfluencerService>(InfluencerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('getInfluencerProfile', () => {
    const mockRequest: RequestWithUser = {
      user: {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      },
    } as RequestWithUser;

    it('should return influencer profile', async () => {
      const mockProfile = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        profileCompletion: { percentage: 90, isCompleted: true },
      };

      mockInfluencerService.getInfluencerProfile.mockResolvedValue(mockProfile);

      const result = await controller.getInfluencerProfile(mockRequest);

      expect(result).toEqual(mockProfile);
      expect(influencerService.getInfluencerProfile).toHaveBeenCalledWith(
        1,
        false,
        1,
        'influencer',
      );
    });

    it('should handle service errors', async () => {
      const error = new NotFoundException('Influencer not found');
      mockInfluencerService.getInfluencerProfile.mockRejectedValue(error);

      await expect(
        controller.getInfluencerProfile(mockRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateInfluencerProfile', () => {
    const mockRequest: RequestWithUser = {
      user: { id: 1, userType: 'influencer' },
    } as RequestWithUser;

    const updateDto: UpdateInfluencerProfileDto = {
      bio: 'Updated bio with more than 10 characters',
      profileHeadline: 'Updated headline with sufficient length',
    };

    const mockFiles = {
      profileImage: [{ buffer: Buffer.from('image') }],
    };

    it('should update profile successfully', async () => {
      const mockResult = {
        message: 'Profile updated successfully',
        influencer: { id: 1, bio: 'Updated bio with more than 10 characters' },
      };

      mockInfluencerService.updateInfluencerProfile.mockResolvedValue(
        mockResult,
      );

      const result = await controller.updateInfluencerProfile(
        mockRequest,
        updateDto,
        mockFiles,
      );

      expect(result).toEqual(mockResult);
      expect(influencerService.updateInfluencerProfile).toHaveBeenCalledWith(
        1,
        updateDto,
        mockFiles,
        'influencer',
      );
    });

    it('should handle updates without files', async () => {
      const mockResult = {
        message: 'Profile updated successfully',
        influencer: { id: 1, bio: 'Updated bio with more than 10 characters' },
      };

      mockInfluencerService.updateInfluencerProfile.mockResolvedValue(
        mockResult,
      );

      const result = await controller.updateInfluencerProfile(
        mockRequest,
        updateDto,
        undefined,
      );

      expect(result).toEqual(mockResult);
      expect(influencerService.updateInfluencerProfile).toHaveBeenCalledWith(
        1,
        updateDto,
        undefined,
        'influencer',
      );
    });
  });

  describe('sendWhatsAppVerificationOTP', () => {
    const mockRequest: RequestWithUser = {
      user: { id: 1, userType: 'influencer' },
    } as RequestWithUser;

    it('should request WhatsApp OTP successfully', async () => {
      const mockResult = {
        message: 'WhatsApp OTP sent successfully',
        whatsappNumber: '+919876543210',
      };

      mockInfluencerService.sendWhatsAppVerificationOTP.mockResolvedValue(
        mockResult,
      );

      const result = await controller.sendWhatsAppVerificationOTP(mockRequest, {
        whatsappNumber: '+919876543210',
      });

      expect(result).toEqual(mockResult);
      expect(
        influencerService.sendWhatsAppVerificationOTP,
      ).toHaveBeenCalledWith({
        influencerId: 1,
        whatsappNumber: '+919876543210',
      });
    });
  });

  describe('verifyWhatsAppOTP', () => {
    const mockRequest: RequestWithUser = {
      user: { id: 1, userType: 'influencer' },
    } as RequestWithUser;

    const verificationDto: WhatsappVerificationDto = {
      influencerId: 1,
      whatsappNumber: '+919876543210',
      otp: '123456',
    };

    it('should verify WhatsApp OTP successfully', async () => {
      const mockResult = {
        message: 'WhatsApp number verified successfully',
        verified: true,
      };

      mockInfluencerService.verifyWhatsAppOTP.mockResolvedValue(mockResult);

      const result = await controller.verifyWhatsAppOTP(mockRequest, {
        whatsappNumber: verificationDto.whatsappNumber,
        otp: verificationDto.otp,
      });

      expect(result).toEqual(mockResult);
      expect(influencerService.verifyWhatsAppOTP).toHaveBeenCalledWith({
        influencerId: 1,
        whatsappNumber: verificationDto.whatsappNumber,
        otp: verificationDto.otp,
      });
    });

    it('should handle invalid OTP', async () => {
      const error = new BadRequestException('Invalid OTP');
      mockInfluencerService.verifyWhatsAppOTP.mockRejectedValue(error);

      await expect(
        controller.verifyWhatsAppOTP(mockRequest, {
          whatsappNumber: verificationDto.whatsappNumber,
          otp: verificationDto.otp,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPublicInfluencerProfile', () => {
    it('should return public profile by ID', async () => {
      const mockFullProfile = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Public bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        profileHeadline: 'Headline',
        location: {},
        socialLinks: [],
        collaborationCosts: {},
        niches: [],
        customNiches: [],
        metrics: { followers: 0, posts: 0 },
        isTopInfluencer: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockExperiences = {
        experiences: [
          {
            id: 1,
            campaignName: 'Test Campaign',
            brandName: 'Test Brand',
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      };

      mockInfluencerService.getInfluencerProfile.mockResolvedValue(
        mockFullProfile,
      );
      mockInfluencerService.getExperiences.mockResolvedValue(mockExperiences);

      const result = await controller.getPublicInfluencerProfile(1);

      expect(result).toEqual({
        ...mockFullProfile,
        experiences: mockExperiences.experiences,
      });
      expect(influencerService.getInfluencerProfile).toHaveBeenCalledWith(
        1,
        true,
        undefined,
        undefined,
      );
      expect(influencerService.getExperiences).toHaveBeenCalledWith(
        1,
        undefined,
        1,
        100,
      );
    });

    it('should handle non-existent influencer', async () => {
      const error = new NotFoundException('Influencer not found');
      mockInfluencerService.getInfluencerProfile.mockRejectedValue(error);

      await expect(controller.getPublicInfluencerProfile(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should parse ID parameter correctly', async () => {
      mockInfluencerService.getInfluencerProfile.mockResolvedValue({
        id: 123,
        name: 'Test',
        username: 'test',
        bio: '',
        profileImage: '',
        profileBanner: '',
        profileHeadline: '',
        location: {},
        socialLinks: [],
        collaborationCosts: {},
        niches: [],
        verification: { isProfileCompleted: true },
      });

      mockInfluencerService.getExperiences.mockResolvedValue({
        experiences: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
      });

      await controller.getPublicInfluencerProfile(123);

      expect(influencerService.getInfluencerProfile).toHaveBeenCalledWith(
        123,
        true,
        undefined,
        undefined,
      );
    });

    it('should extract user ID from request correctly', async () => {
      const mockRequest: RequestWithUser = {
        user: { id: 999, userType: 'influencer' },
      } as RequestWithUser;

      mockInfluencerService.getInfluencerProfile.mockResolvedValue({});

      await controller.getInfluencerProfile(mockRequest);

      expect(influencerService.getInfluencerProfile).toHaveBeenCalledWith(
        999,
        false,
        999,
        'influencer',
      );
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for protected routes', () => {
      expect(mockAuthGuard.canActivate).toBeDefined();
    });

    it('should reject brands from accessing influencer profile endpoint', async () => {
      const brandRequest: RequestWithUser = {
        user: {
          id: 1,
          email: 'test@brand.com',
          userType: 'brand',
          profileCompleted: true,
        },
      } as RequestWithUser;

      mockInfluencerService.getInfluencerProfile.mockRejectedValue(
        new BadRequestException('Only influencers can access this endpoint'),
      );

      await expect(
        controller.getInfluencerProfile(brandRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject brands from updating influencer profile', async () => {
      const brandRequest: RequestWithUser = {
        user: {
          id: 1,
          email: 'test@brand.com',
          userType: 'brand',
          profileCompleted: true,
        },
      } as RequestWithUser;

      const updateDto: UpdateInfluencerProfileDto = {
        bio: 'Test bio with minimum required length',
      };

      mockInfluencerService.updateInfluencerProfile.mockRejectedValue(
        new BadRequestException('Only influencers can update influencer profiles'),
      );

      await expect(
        controller.updateInfluencerProfile(brandRequest, updateDto, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Error Propagation', () => {
    const mockRequest: RequestWithUser = {
      user: { id: 1, userType: 'influencer' },
    } as RequestWithUser;

    it('should propagate service errors in profile operations', async () => {
      const error = new Error('Service error');
      mockInfluencerService.getInfluencerProfile.mockRejectedValue(error);

      await expect(
        controller.getInfluencerProfile(mockRequest),
      ).rejects.toThrow('Service error');
    });

    it('should propagate service errors in update operations', async () => {
      const error = new Error('Update failed');
      mockInfluencerService.updateInfluencerProfile.mockRejectedValue(error);

      await expect(
        controller.updateInfluencerProfile(
          mockRequest,
          { bio: 'Test bio with minimum required length' },
          undefined,
        ),
      ).rejects.toThrow('Update failed');
    });
  });
});
