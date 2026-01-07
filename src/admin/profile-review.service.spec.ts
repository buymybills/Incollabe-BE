import { Test, TestingModule } from '@nestjs/testing';
import { ProfileReviewService } from './profile-review.service';
import { getModelToken } from '@nestjs/sequelize';
import {
  ProfileReview,
  ProfileType,
  ReviewStatus,
} from './models/profile-review.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { City } from '../shared/models/city.model';
import { Country } from '../shared/models/country.model';
import { Campaign } from '../campaign/models/campaign.model';
import { Admin } from './models/admin.model';
import { EmailService } from '../shared/email.service';
import { WhatsAppService } from '../shared/whatsapp.service';
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { AuditLogService } from './services/audit-log.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileReviewDto } from './dto/profile-review.dto';
import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { CreditTransaction } from './models/credit-transaction.model';

const mockProfileReviewModel = {
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  findAndCountAll: jest.fn(),
  count: jest.fn(),
};

const mockEmailService = {
  sendProfileApprovalEmail: jest.fn(),
  sendProfileRejectionEmail: jest.fn(),
  sendProfileReviewRequestEmail: jest.fn(),
};

const mockBrandModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockInfluencerModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockNicheModel = {
  findByPk: jest.fn(),
  findAll: jest.fn(),
};

const mockCityModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
};

const mockCountryModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
};

const mockAdminModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
};

const mockCampaignModel = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockWhatsAppService = {
  sendProfileApprovalNotification: jest.fn(),
  sendProfileRejectionNotification: jest.fn(),
  sendReferralCreditNotification: jest.fn(),
};

const mockInfluencerReferralUsageModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockCreditTransactionModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
};

describe('ProfileReviewService', () => {
  let service: ProfileReviewService;
  let profileReviewModel: typeof ProfileReview;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileReviewService,
        {
          provide: getModelToken(ProfileReview),
          useValue: mockProfileReviewModel,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: getModelToken(Brand),
          useValue: mockBrandModel,
        },
        {
          provide: getModelToken(Influencer),
          useValue: mockInfluencerModel,
        },
        {
          provide: getModelToken(Niche),
          useValue: mockNicheModel,
        },
        {
          provide: getModelToken(City),
          useValue: mockCityModel,
        },
        {
          provide: getModelToken(Country),
          useValue: mockCountryModel,
        },
        {
          provide: getModelToken(Campaign),
          useValue: mockCampaignModel,
        },
        {
          provide: getModelToken(Admin),
          useValue: mockAdminModel,
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
        {
          provide: AuditLogService,
          useValue: {
            createLog: jest.fn(),
            logProfileReviewAction: jest.fn(),
          },
        },
        {
          provide: getModelToken(InfluencerReferralUsage),
          useValue: mockInfluencerReferralUsageModel,
        },
        {
          provide: getModelToken(CreditTransaction),
          useValue: mockCreditTransactionModel,
        },
        {
          provide: NotificationService,
          useValue: {
            sendCustomNotification: jest.fn().mockResolvedValue(undefined),
            sendCampaignStatusUpdate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DeviceTokenService,
          useValue: {
            getAllUserTokens: jest.fn().mockResolvedValue([]),
            addOrUpdateDeviceToken: jest.fn(),
            removeDeviceToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileReviewService>(ProfileReviewService);
    profileReviewModel = module.get<typeof ProfileReview>(
      getModelToken(ProfileReview),
    );
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createProfileReview', () => {
    const mockCreateData = {
      profileId: 1,
      profileType: ProfileType.BRAND,
      submittedData: {
        brandName: 'Test Brand',
        brandBio: 'Test brand bio',
        websiteUrl: 'https://testbrand.com',
      },
    };

    it('should create a new profile review', async () => {
      const mockProfileReview = {
        id: 1,
        profileId: 1,
        profileType: ProfileType.BRAND,
        status: ReviewStatus.PENDING,
        submittedData: mockCreateData.submittedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockProfileReviewModel.findOne.mockResolvedValue(null); // No existing review
      mockProfileReviewModel.create.mockResolvedValue(mockProfileReview);
      mockEmailService.sendProfileReviewRequestEmail.mockResolvedValue(true);
      mockAdminModel.findAll.mockResolvedValue([]);

      const result = await service.createProfileReview(mockCreateData);

      expect(result).toEqual({
        message: 'Profile review request submitted successfully',
        review: mockProfileReview,
      });

      expect(mockProfileReviewModel.findOne).toHaveBeenCalledWith({
        where: {
          profileId: 1,
          profileType: ProfileType.BRAND,
          status: ReviewStatus.PENDING,
        },
      });
      expect(mockProfileReviewModel.create).toHaveBeenCalledWith({
        profileId: mockCreateData.profileId,
        profileType: mockCreateData.profileType,
        submittedData: mockCreateData.submittedData,
        status: 'pending',
        submittedAt: expect.any(Date),
      });
      // Email notifications are handled internally by the service
    });

    it('should update existing pending review', async () => {
      const existingReview = {
        id: 1,
        profileId: 1,
        profileType: ProfileType.BRAND,
        status: ReviewStatus.PENDING,
        submittedData: { oldData: 'old' },
        update: jest.fn().mockResolvedValue(true),
      };

      mockProfileReviewModel.findOne.mockResolvedValue(existingReview);

      const result = await service.createProfileReview(mockCreateData);

      expect(result).toEqual({
        message: 'Profile review request updated successfully',
        review: existingReview,
      });

      expect(existingReview.update).toHaveBeenCalledWith({
        submittedData: mockCreateData.submittedData,
        submittedAt: expect.any(Date),
      });
    });

    it('should handle influencer profile reviews', async () => {
      const influencerData = {
        profileId: 2,
        profileType: ProfileType.INFLUENCER,
        submittedData: {
          name: 'Test Influencer',
          bio: 'Test influencer bio',
          instagramUrl: 'https://instagram.com/testinfluencer',
        },
      };

      mockProfileReviewModel.findOne.mockResolvedValue(null);
      mockProfileReviewModel.create.mockResolvedValue({
        id: 2,
        ...influencerData,
        status: ReviewStatus.PENDING,
      });
      mockAdminModel.findAll.mockResolvedValue([]);

      const result = await service.createProfileReview(influencerData);

      expect(result.message).toBe(
        'Profile review request submitted successfully',
      );
      expect(mockProfileReviewModel.create).toHaveBeenCalledWith({
        profileId: influencerData.profileId,
        profileType: influencerData.profileType,
        submittedData: influencerData.submittedData,
        status: 'pending',
        submittedAt: expect.any(Date),
      });
    });

    it('should handle database errors', async () => {
      mockProfileReviewModel.findOne.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.createProfileReview(mockCreateData)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle email sending failures gracefully', async () => {
      const mockProfileReview = {
        id: 1,
        profileId: 1,
        profileType: ProfileType.BRAND,
        status: ReviewStatus.PENDING,
      };

      mockProfileReviewModel.findOne.mockResolvedValue(null);
      mockProfileReviewModel.create.mockResolvedValue(mockProfileReview);
      mockEmailService.sendProfileReviewRequestEmail.mockRejectedValue(
        new Error('Email failed'),
      );
      mockAdminModel.findAll.mockResolvedValue([]);

      const result = await service.createProfileReview(mockCreateData);

      expect(result.message).toBe(
        'Profile review request submitted successfully',
      );
      expect(result.review).toEqual(mockProfileReview);
    });
  });

  describe('reviewProfile', () => {
    const mockReviewDto: ProfileReviewDto = {
      status: ReviewStatus.APPROVED,
      adminComments: 'Profile looks good',
      reviewedBy: 1,
    };

    it('should approve a profile review', async () => {
      const mockProfileReview = {
        id: 1,
        profileId: 1,
        profileType: ProfileType.BRAND,
        status: ReviewStatus.PENDING,
        update: jest.fn().mockResolvedValue(true),
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);
      mockEmailService.sendProfileApprovalEmail.mockResolvedValue(true);

      const result = await service.reviewProfile(1, mockReviewDto);

      expect(result).toEqual({
        message: 'Profile review completed successfully',
        review: mockProfileReview,
      });

      expect(mockProfileReview.update).toHaveBeenCalledWith({
        status: ReviewStatus.APPROVED,
        adminComments: 'Profile looks good',
        reviewedBy: 1,
        reviewedAt: expect.any(Date),
      });
      // Email service calls are handled internally by the service
    });

    it('should reject a profile review', async () => {
      const rejectDto: ProfileReviewDto = {
        status: ReviewStatus.REJECTED,
        adminComments: 'Missing required information',
        reviewedBy: 1,
      };

      const mockProfileReview = {
        id: 1,
        profileId: 1,
        profileType: ProfileType.BRAND,
        status: ReviewStatus.PENDING,
        update: jest.fn().mockResolvedValue(true),
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);
      mockEmailService.sendProfileRejectionEmail.mockResolvedValue(true);

      const result = await service.reviewProfile(1, rejectDto);

      expect(result.message).toBe('Profile review completed successfully');
      expect(mockProfileReview.update).toHaveBeenCalledWith({
        status: ReviewStatus.REJECTED,
        adminComments: 'Missing required information',
        reviewedBy: 1,
        reviewedAt: expect.any(Date),
      });
      // Email service calls are handled internally by the service
    });

    it('should throw NotFoundException for non-existent review', async () => {
      mockProfileReviewModel.findByPk.mockResolvedValue(null);

      await expect(service.reviewProfile(999, mockReviewDto)).rejects.toThrow(
        new NotFoundException('Profile review not found'),
      );

      expect(mockProfileReviewModel.findByPk).toHaveBeenCalledWith(999);
    });

    it('should throw BadRequestException for already reviewed profile', async () => {
      const mockProfileReview = {
        id: 1,
        status: ReviewStatus.APPROVED,
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);

      await expect(service.reviewProfile(1, mockReviewDto)).rejects.toThrow(
        new BadRequestException('Profile review has already been completed'),
      );
    });

    it('should handle invalid status transitions', async () => {
      const invalidDto: ProfileReviewDto = {
        status: 'INVALID_STATUS' as any,
        adminComments: 'Invalid status',
        reviewedBy: 1,
      };

      const mockProfileReview = {
        id: 1,
        status: ReviewStatus.PENDING,
        update: jest.fn().mockRejectedValue(new Error('Invalid status')),
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);

      await expect(service.reviewProfile(1, invalidDto)).rejects.toThrow(
        'Invalid status',
      );
    });
  });

  describe('getPendingReviews', () => {
    it('should return paginated pending reviews', async () => {
      const mockReviews = [
        {
          id: 1,
          profileId: 1,
          profileType: ProfileType.BRAND,
          status: ReviewStatus.PENDING,
          submittedAt: new Date(),
        },
        {
          id: 2,
          profileId: 2,
          profileType: ProfileType.INFLUENCER,
          status: ReviewStatus.PENDING,
          submittedAt: new Date(),
        },
      ];

      mockProfileReviewModel.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockReviews,
      });

      const result = await service.getPendingReviews(1, 10);

      expect(result).toEqual({
        reviews: mockReviews,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      expect(mockProfileReviewModel.findAndCountAll).toHaveBeenCalledWith({
        where: { status: ReviewStatus.PENDING },
        order: [['submittedAt', 'ASC']],
        limit: 10,
        offset: 0,
      });
    });

    it('should handle empty results', async () => {
      mockProfileReviewModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      const result = await service.getPendingReviews(1, 10);

      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      mockProfileReviewModel.findAndCountAll.mockResolvedValue({
        count: 25,
        rows: [],
      });

      const result = await service.getPendingReviews(3, 10);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(mockProfileReviewModel.findAndCountAll).toHaveBeenCalledWith({
        where: { status: ReviewStatus.PENDING },
        order: [['submittedAt', 'ASC']],
        limit: 10,
        offset: 20,
      });
    });
  });

  describe('getReviewsByProfileId', () => {
    it('should return reviews for a specific profile', async () => {
      const mockReviews = [
        {
          id: 1,
          profileId: 1,
          profileType: ProfileType.BRAND,
          status: ReviewStatus.APPROVED,
        },
        {
          id: 2,
          profileId: 1,
          profileType: ProfileType.BRAND,
          status: ReviewStatus.PENDING,
        },
      ];

      mockProfileReviewModel.findAll.mockResolvedValue(mockReviews);

      const result = await service.getReviewsByProfileId(1, ProfileType.BRAND);

      expect(result).toEqual(mockReviews);
      expect(mockProfileReviewModel.findAll).toHaveBeenCalledWith({
        where: {
          profileId: 1,
          profileType: ProfileType.BRAND,
        },
        order: [['submittedAt', 'DESC']],
      });
    });

    it('should return empty array for profile with no reviews', async () => {
      mockProfileReviewModel.findAll.mockResolvedValue([]);

      const result = await service.getReviewsByProfileId(
        999,
        ProfileType.INFLUENCER,
      );

      expect(result).toEqual([]);
    });
  });

  describe('getReviewStatistics', () => {
    it('should return review statistics', async () => {
      mockProfileReviewModel.findAll
        .mockResolvedValueOnce([
          { status: ReviewStatus.PENDING },
          { status: ReviewStatus.PENDING },
        ]) // PENDING count
        .mockResolvedValueOnce([{ status: ReviewStatus.APPROVED }]) // APPROVED count
        .mockResolvedValueOnce([{ status: ReviewStatus.REJECTED }]); // REJECTED count

      const result = await service.getReviewStatistics();

      expect(result).toEqual({
        pending: 2,
        approved: 1,
        rejected: 1,
      });
    });

    it('should handle zero counts', async () => {
      mockProfileReviewModel.findAll
        .mockResolvedValueOnce([]) // PENDING count
        .mockResolvedValueOnce([]) // APPROVED count
        .mockResolvedValueOnce([]); // REJECTED count

      const result = await service.getReviewStatistics();

      expect(result).toEqual({
        pending: 0,
        approved: 0,
        rejected: 0,
      });
    });
  });

  describe('deleteReview', () => {
    it('should delete a review successfully', async () => {
      const mockProfileReview = {
        id: 1,
        profileId: 1,
        destroy: jest.fn().mockResolvedValue(true),
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);

      const result = await service.deleteReview(1);

      expect(result).toEqual({
        message: 'Profile review deleted successfully',
      });
      expect(mockProfileReview.destroy).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException for non-existent review', async () => {
      mockProfileReviewModel.findByPk.mockResolvedValue(null);

      await expect(service.deleteReview(999)).rejects.toThrow(
        new NotFoundException('Profile review not found'),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockProfileReviewModel.findAndCountAll.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(service.getPendingReviews(1, 10)).rejects.toThrow(
        'Connection timeout',
      );
    });

    it('should handle model update errors', async () => {
      const mockProfileReview = {
        id: 1,
        status: ReviewStatus.PENDING,
        update: jest.fn().mockRejectedValue(new Error('Update failed')),
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);

      await expect(
        service.reviewProfile(1, {
          status: ReviewStatus.APPROVED,
          adminComments: 'Good',
          reviewedBy: 1,
        }),
      ).rejects.toThrow('Update failed');
    });

    it('should handle email service failures without breaking the flow', async () => {
      const mockProfileReview = {
        id: 1,
        status: ReviewStatus.PENDING,
        update: jest.fn().mockResolvedValue(true),
      };

      mockProfileReviewModel.findByPk.mockResolvedValue(mockProfileReview);
      mockEmailService.sendProfileApprovalEmail.mockRejectedValue(
        new Error('Email server down'),
      );

      const result = await service.reviewProfile(1, {
        status: ReviewStatus.APPROVED,
        adminComments: 'Good',
        reviewedBy: 1,
      });

      expect(result.message).toBe('Profile review completed successfully');
      expect(mockProfileReview.update).toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      await expect(service.createProfileReview(null as any)).rejects.toThrow();

      await expect(
        service.reviewProfile(null as any, {} as any),
      ).rejects.toThrow();
    });

    it('should handle invalid pagination parameters', async () => {
      mockProfileReviewModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      // Should handle negative page numbers
      const result = await service.getPendingReviews(-1, 10);
      expect(result.page).toBe(-1);

      // Should handle zero or negative limits
      await service.getPendingReviews(1, 0);
      await service.getPendingReviews(1, -5);
    });

    it('should handle very large profile IDs', async () => {
      const largeId = Number.MAX_SAFE_INTEGER;
      mockProfileReviewModel.findByPk.mockResolvedValue(null);

      await expect(
        service.reviewProfile(largeId, {
          status: ReviewStatus.APPROVED,
          adminComments: 'Good',
          reviewedBy: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
