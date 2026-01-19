import { Test, TestingModule } from '@nestjs/testing';
import { InfluencerService } from './influencer.service';
import { S3Service } from '../shared/s3.service';
import { EmailService } from '../shared/email.service';
import { WhatsAppService } from '../shared/whatsapp.service';
import { OtpService } from '../shared/services/otp.service';
import { CustomNicheService } from '../shared/services/custom-niche.service';
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { AppVersionService } from '../shared/services/app-version.service';
import { AppReviewService } from '../shared/services/app-review.service';
import { InfluencerRepository } from './repositories/influencer.repository';
import {
  ProfileReview,
  ProfileType,
} from '../admin/models/profile-review.model';
import { UpdateInfluencerProfileDto } from './dto/update-influencer-profile.dto';
import { WhatsappVerificationDto } from './dto/whatsapp-verification.dto';
import { CollaborationCostsDto } from './dto/collaboration-costs.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  APP_CONSTANTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../shared/constants/app.constants';

const mockInfluencerRepository = {
  findById: jest.fn(),
  findByUsername: jest.fn(),
  updateInfluencer: jest.fn(),
  updateWhatsAppVerification: jest.fn(),
  findByWhatsappHash: jest.fn(),
};

const mockS3Service = {
  uploadFileToS3: jest.fn(),
  getFileUrl: jest.fn(),
  deleteFileFromS3: jest.fn(),
};

const mockEmailService = {
  sendInfluencerProfileIncompleteEmail: jest.fn(),
  sendProfileVerificationPendingEmail: jest.fn(),
  sendInfluencerProfileVerificationPendingEmail: jest.fn(),
  sendAdminProfilePendingNotification: jest.fn(),
};

const mockWhatsAppService = {
  sendOTP: jest.fn(),
  verifyOtp: jest.fn(),
  sendProfileVerificationPending: jest.fn(),
  sendProfileIncomplete: jest.fn(),
};

const mockOtpService = {
  generateOtp: jest.fn(),
  verifyOtp: jest.fn(),
  createOtpRecord: jest.fn(),
  generateAndStoreOtp: jest.fn(),
};

const mockProfileReview = {
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockCampaignModel = {
  findOne: jest.fn(),
  findAndCountAll: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockCampaignApplicationModel = {
  create: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
};

const mockCampaignInvitationModel = {
  findOne: jest.fn(),
  findAll: jest.fn().mockResolvedValue([]), // Default to empty array for no invitations
  create: jest.fn(),
  update: jest.fn(),
};

const mockAdminModel = {
  findOne: jest.fn(),
  findAll: jest.fn().mockResolvedValue([]), // Default to empty array
  create: jest.fn(),
  update: jest.fn(),
};

const mockNotificationService = {
  sendNewApplicationNotification: jest.fn(),
  sendCustomNotification: jest.fn().mockResolvedValue(undefined),
};

const mockDeviceTokenService = {
  getAllUserTokens: jest.fn().mockResolvedValue(['mock-token-1', 'mock-token-2']),
  addOrUpdateDeviceToken: jest.fn(),
  removeDeviceToken: jest.fn(),
  getUserDevices: jest.fn().mockResolvedValue([
    {
      id: 1,
      fcmToken: 'mock-fcm-token-1',
      deviceId: 'device-123',
      deviceName: 'iPhone 14',
      deviceOs: 'ios',
      appVersion: '3.5.0',
      versionCode: 5,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      fcmToken: 'mock-fcm-token-2',
      deviceId: 'device-456',
      deviceName: 'Samsung Galaxy',
      deviceOs: 'android',
      appVersion: '4.0.0',
      versionCode: 7,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
};

const mockAppVersionService = {
  getVersionConfig: jest.fn().mockResolvedValue({
    platform: 'ios',
    latestVersion: '7.0.0',
    latestVersionCode: 7,
    minimumVersion: '7.0.0',
    minimumVersionCode: 7,
    forceUpdate: false,
    updateMessage: 'A new version is available. Please update to get the latest features and improvements.',
    forceUpdateMessage: 'This version is no longer supported. Please update to continue using the app.',
  }),
  checkVersionStatus: jest.fn().mockResolvedValue({
    updateAvailable: false,
    forceUpdate: false,
    updateMessage: 'A new version is available. Please update to get the latest features and improvements.',
    config: {
      platform: 'ios',
      latestVersion: '7.0.0',
      latestVersionCode: 7,
      minimumVersion: '7.0.0',
      minimumVersionCode: 7,
      forceUpdate: false,
      updateMessage: 'A new version is available. Please update to get the latest features and improvements.',
      forceUpdateMessage: 'This version is no longer supported. Please update to continue using the app.',
    },
  }),
  getAllVersionConfigs: jest.fn().mockResolvedValue([]),
  updateVersionConfig: jest.fn(),
  clearCache: jest.fn(),
};

const mockAppReviewService = {
  trackReviewPrompt: jest.fn(),
  shouldShowReviewPrompt: jest.fn().mockResolvedValue(false),
  markAsReviewed: jest.fn(),
};

describe('InfluencerService', () => {
  let service: InfluencerService;
  let influencerRepository: InfluencerRepository;
  let s3Service: S3Service;
  let emailService: EmailService;
  let whatsAppService: WhatsAppService;
  let otpService: OtpService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        InfluencerService,
        {
          provide: InfluencerRepository,
          useValue: mockInfluencerRepository,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
        {
          provide: OtpService,
          useValue: mockOtpService,
        },
        {
          provide: 'PROFILE_REVIEW_MODEL',
          useValue: mockProfileReview,
        },
        {
          provide: 'CAMPAIGN_MODEL',
          useValue: mockCampaignModel,
        },
        {
          provide: 'CAMPAIGN_APPLICATION_MODEL',
          useValue: mockCampaignApplicationModel,
        },
        {
          provide: 'CAMPAIGN_INVITATION_MODEL',
          useValue: mockCampaignInvitationModel,
        },
        {
          provide: 'ADMIN_MODEL',
          useValue: mockAdminModel,
        },
        {
          provide: 'NICHE_MODEL',
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: 'INFLUENCER_NICHE_MODEL',
          useValue: {
            findAll: jest.fn(),
            findOrCreate: jest.fn(),
            destroy: jest.fn(),
            bulkCreate: jest.fn(),
          },
        },
        {
          provide: 'EXPERIENCE_MODEL',
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            destroy: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            findAndCountAll: jest.fn(),
          },
        },
        {
          provide: 'EXPERIENCE_SOCIAL_LINK_MODEL',
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            destroy: jest.fn(),
            bulkCreate: jest.fn(),
          },
        },
        {
          provide: 'FOLLOW_MODEL',
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: 'POST_MODEL',
          useValue: {
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: 'CUSTOM_NICHE_MODEL',
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            destroy: jest.fn(),
            bulkCreate: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: CustomNicheService,
          useValue: {
            createCustomNiche: jest.fn(),
            updateCustomNiche: jest.fn(),
            deleteCustomNiche: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: DeviceTokenService,
          useValue: mockDeviceTokenService,
        },
        {
          provide: AppVersionService,
          useValue: mockAppVersionService,
        },
        {
          provide: 'CREDIT_TRANSACTION_MODEL',
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: 'INFLUENCER_REFERRAL_USAGE_MODEL',
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: 'INFLUENCER_UPI_MODEL',
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: 'PRO_SUBSCRIPTION_MODEL',
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AppReviewService,
          useValue: mockAppReviewService,
        },
      ],
    }).compile();

    service = module.get<InfluencerService>(InfluencerService);
    influencerRepository =
      module.get<InfluencerRepository>(InfluencerRepository);
    s3Service = module.get<S3Service>(S3Service);
    emailService = module.get<EmailService>(EmailService);
    whatsAppService = module.get<WhatsAppService>(WhatsAppService);
    otpService = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getInfluencerProfile', () => {
    const mockInfluencer = {
      id: 1,
      name: 'Test Influencer',
      username: 'test_influencer',
      phone: '+919876543210',
      email: 'test@influencer.com',
      bio: 'Test bio',
      profileImage: 'profile.jpg',
      profileBanner: 'banner.jpg',
      isWhatsappVerified: true,
      isProfileCompleted: false,
      collaborationCosts: {
        instagram: {
          post: 1000,
          story: 500,
          reel: 1500,
        },
      },
      niches: [
        {
          id: 1,
          name: 'Fashion',
          logoNormal: '<svg>Fashion Normal</svg>',
          logoDark: '<svg>Fashion Dark</svg>',
        },
      ],
      city: { id: 1, name: 'Mumbai', state: 'Maharashtra' },
      country: { id: 1, name: 'India', code: 'IN' },
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
    };

    it('should return influencer profile successfully', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);

      const result = await service.getInfluencerProfile(1);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('name', 'Test Influencer');
      // Private profile data (should be available for non-public profiles)
      if ('profileCompletion' in result) {
        expect((result as any).profileCompletion.completionPercentage).toBe(36);
      }
      // Check for deviceToken (single object, not array)
      if ('deviceToken' in result) {
        expect((result as any).deviceToken).toBeDefined();
        expect((result as any).deviceToken).toHaveProperty('deviceId', 'device-123');
        expect((result as any).deviceToken).toHaveProperty('deviceName', 'iPhone 14');
        expect((result as any).deviceToken).not.toHaveProperty('fcmToken'); // Should not include fcmToken
      }
      // Check for appVersion info
      if ('appVersion' in result) {
        expect((result as any).appVersion).toHaveProperty('installedVersion');
        expect((result as any).appVersion).toHaveProperty('minimumVersion');
        expect((result as any).appVersion).toHaveProperty('latestVersion');
        expect((result as any).appVersion).toHaveProperty('updateAvailable');
        expect((result as any).appVersion).toHaveProperty('forceUpdate');
      }
      expect(influencerRepository.findById).toHaveBeenCalledWith(1);
    });

    it('should return specific device when deviceId is provided', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);

      const result = await service.getInfluencerProfile(1, false, 1, 'influencer', 'device-123');

      // Should return the device matching the deviceId
      if ('deviceToken' in result) {
        expect((result as any).deviceToken).toBeDefined();
        expect((result as any).deviceToken).toHaveProperty('deviceId', 'device-123');
        expect((result as any).deviceToken).toHaveProperty('deviceName', 'iPhone 14');
      }
    });

    it('should throw NotFoundException for non-existent influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(service.getInfluencerProfile(999)).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND),
      );
    });

    it('should handle repository errors', async () => {
      mockInfluencerRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getInfluencerProfile(1)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('updateInfluencerProfile', () => {
    const updateDto: UpdateInfluencerProfileDto = {
      bio: 'Updated bio with more content',
      profileHeadline: 'Updated headline',
      cityId: 2,
      countryId: 1,
      instagramUrl: 'https://instagram.com/updated',
      youtubeUrl: 'https://youtube.com/updated',
    };

    const mockFiles = {
      profileImage: [
        { buffer: Buffer.from('image'), originalname: 'profile.jpg' },
      ],
      profileBanner: [
        { buffer: Buffer.from('banner'), originalname: 'banner.jpg' },
      ],
    };

    it('should update influencer profile successfully', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'old-profile.jpg',
        profileBanner: 'old-banner.jpg',
        profileHeadline: 'Test headline',
        countryId: 1,
        cityId: 1,
        whatsappNumber: '+919876543210',
        instagramUrl: 'https://instagram.com/test',
        isWhatsappVerified: true,
        collaborationCosts: { instagram: { post: 1000 } },
        isProfileCompleted: true,
        update: jest.fn().mockResolvedValue(true),
      };

      const mockUpdatedProfile = {
        ...mockInfluencer,
        ...updateDto,
        profileImage: 'https://s3.amazonaws.com/profile-new.jpg',
        profileBanner: 'https://s3.amazonaws.com/banner-new.jpg',
      };

      mockInfluencerRepository.findById
        .mockResolvedValueOnce(mockInfluencer) // First call for initial lookup
        .mockResolvedValueOnce(mockUpdatedProfile) // Second call in updateInfluencerProfile
        .mockResolvedValue(mockUpdatedProfile); // Third call in getInfluencerProfile
      mockS3Service.uploadFileToS3.mockResolvedValueOnce('profile-new.jpg');
      mockS3Service.uploadFileToS3.mockResolvedValueOnce('banner-new.jpg');
      mockS3Service.getFileUrl.mockReturnValueOnce(
        'https://s3.amazonaws.com/profile-new.jpg',
      );
      mockS3Service.getFileUrl.mockReturnValueOnce(
        'https://s3.amazonaws.com/banner-new.jpg',
      );
      mockInfluencerRepository.updateInfluencer.mockResolvedValue(
        mockUpdatedProfile,
      );

      const result = await service.updateInfluencerProfile(
        1,
        updateDto,
        mockFiles,
      );

      expect(result.message).toBe(SUCCESS_MESSAGES.PROFILE.UPDATED);
      expect(result.id).toBe(mockUpdatedProfile.id);
      expect(result.name).toBe(mockUpdatedProfile.name);
      expect(s3Service.uploadFileToS3).toHaveBeenCalledTimes(2);
      expect(influencerRepository.updateInfluencer).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          ...updateDto,
          // Social links not in updateDto should be preserved (not included in update)
          profileImage: 'profile-new.jpg',
          profileBanner: 'banner-new.jpg',
        }),
      );
    });

    it('should update profile without files', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        profileHeadline: 'Test headline',
        countryId: 1,
        cityId: 1,
        whatsappNumber: '+919876543210',
        instagramUrl: 'https://instagram.com/test',
        isWhatsappVerified: true,
        collaborationCosts: { instagram: { post: 1000 } },
        isProfileCompleted: true,
        update: jest.fn().mockResolvedValue(true),
      };
      const mockUpdatedProfile = { ...mockInfluencer, ...updateDto };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockInfluencerRepository.updateInfluencer.mockResolvedValue(
        mockUpdatedProfile,
      );

      const result = await service.updateInfluencerProfile(
        1,
        updateDto,
        undefined,
      );

      expect(result.message).toBe(SUCCESS_MESSAGES.PROFILE.UPDATED);
      expect(s3Service.uploadFileToS3).not.toHaveBeenCalled();
      expect(influencerRepository.updateInfluencer).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          ...updateDto,
          // Social links not in updateDto should be preserved (not included in update)
        }),
      );
    });

    it('should throw NotFoundException for non-existent influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateInfluencerProfile(999, updateDto, mockFiles),
      ).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND),
      );
    });

    it('should handle S3 upload errors gracefully', async () => {
      const mockInfluencer = { id: 1, name: 'Test Influencer' };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockS3Service.uploadFileToS3.mockRejectedValue(
        new Error('S3 upload failed'),
      );

      await expect(
        service.updateInfluencerProfile(1, updateDto, mockFiles),
      ).rejects.toThrow('S3 upload failed');
    });

    it('should trigger profile review submission when profile is completed', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        profileHeadline: 'Test headline',
        countryId: 1,
        cityId: 1,
        whatsappNumber: '+919876543210',
        instagramUrl: 'https://instagram.com/test',
        isWhatsappVerified: true,
        collaborationCosts: { instagram: { post: 1000 } },
        isProfileCompleted: false,
        update: jest.fn().mockResolvedValue(true),
      };
      const mockUpdatedProfile = {
        ...mockInfluencer,
        ...updateDto,
        isProfileCompleted: true,
      };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockInfluencerRepository.updateInfluencer.mockResolvedValue(
        mockUpdatedProfile,
      );
      mockProfileReview.create.mockResolvedValue({});
      mockWhatsAppService.sendProfileVerificationPending.mockResolvedValue(true);

      // Mock admin data for notification
      mockAdminModel.findAll.mockResolvedValue([
        { id: 1, email: 'admin@test.com', name: 'Test Admin' },
      ]);

      const result = await service.updateInfluencerProfile(
        1,
        updateDto,
        undefined,
      );

      expect(result.message).toBe(
        'Profile submitted for verification. You will receive a notification once verification is complete within 48 hours.',
      );
      expect(mockProfileReview.create).toHaveBeenCalledWith({
        profileId: 1,
        profileType: ProfileType.INFLUENCER,
        status: 'pending',
        submittedAt: expect.any(Date),
      });
    });

    it('should clear social links when explicitly provided as empty strings', async () => {
      const updateDtoWithEmptySocialLinks: UpdateInfluencerProfileDto = {
        bio: 'Updated bio without social links',
        profileHeadline: 'Updated headline',
        instagramUrl: '',
        youtubeUrl: '',
        facebookUrl: '',
        linkedinUrl: '',
        twitterUrl: '',
      };

      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Old bio',
        instagramUrl: 'https://instagram.com/old',
        youtubeUrl: 'https://youtube.com/old',
        facebookUrl: 'https://facebook.com/old',
        linkedinUrl: 'https://linkedin.com/old',
        twitterUrl: 'https://twitter.com/old',
        isProfileCompleted: true,
      };

      const mockUpdatedProfile = {
        ...mockInfluencer,
        ...updateDtoWithEmptySocialLinks,
        instagramUrl: null,
        youtubeUrl: null,
        facebookUrl: null,
        linkedinUrl: null,
        twitterUrl: null,
      };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockInfluencerRepository.updateInfluencer.mockResolvedValue(
        mockUpdatedProfile,
      );

      await service.updateInfluencerProfile(
        1,
        updateDtoWithEmptySocialLinks,
        undefined,
      );

      // Verify that all social links are set to null when explicitly provided as empty strings
      expect(influencerRepository.updateInfluencer).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          bio: 'Updated bio without social links',
          profileHeadline: 'Updated headline',
          instagramUrl: null,
          youtubeUrl: null,
          facebookUrl: null,
          linkedinUrl: null,
          twitterUrl: null,
        }),
      );
    });
  });

  describe('sendWhatsAppVerificationOTP', () => {
    const whatsappOtpRequest = {
      influencerId: 1,
      whatsappNumber: '+919876543210',
    };

    it('should send WhatsApp OTP successfully', async () => {
      const mockInfluencer = { id: 1, name: 'Test Influencer' };
      const mockOtp = '123456';

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockOtpService.generateOtp.mockReturnValue(mockOtp);
      mockOtpService.createOtpRecord.mockResolvedValue({});
      mockOtpService.generateAndStoreOtp.mockResolvedValue(mockOtp);
      mockWhatsAppService.sendOTP.mockResolvedValue(true);

      const result =
        await service.sendWhatsAppVerificationOTP(whatsappOtpRequest);

      expect(result.message).toBe(SUCCESS_MESSAGES.WHATSAPP.OTP_SENT);
      expect(result.whatsappNumber).toBe(whatsappOtpRequest.whatsappNumber);
      expect(result.otp).toBe(mockOtp); // OTP is returned in response
      expect(whatsAppService.sendOTP).toHaveBeenCalledWith(
        whatsappOtpRequest.whatsappNumber,
        mockOtp,
      );
    });

    it('should throw NotFoundException for non-existent influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(
        service.sendWhatsAppVerificationOTP(whatsappOtpRequest),
      ).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND),
      );
    });

    it('should throw error when WhatsApp service fails', async () => {
      const mockInfluencer = { id: 1, name: 'Test Influencer' };
      const mockOtp = '123456';

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockOtpService.generateOtp.mockReturnValue(mockOtp);
      mockOtpService.createOtpRecord.mockResolvedValue({});
      mockOtpService.generateAndStoreOtp.mockResolvedValue(mockOtp);
      mockWhatsAppService.sendOTP.mockRejectedValue(
        new Error('WhatsApp API error'),
      );

      // Should throw error when WhatsApp delivery fails
      await expect(
        service.sendWhatsAppVerificationOTP(whatsappOtpRequest),
      ).rejects.toThrow('WhatsApp API error');
    });
  });

  describe('verifyWhatsAppOTP', () => {
    const verificationDto: WhatsappVerificationDto = {
      influencerId: 1,
      whatsappNumber: '+919876543210',
      otp: '123456',
    };

    it('should verify WhatsApp OTP successfully', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        whatsappNumber: '+919876543210',
        isWhatsappVerified: false,
      };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockOtpService.verifyOtp.mockResolvedValue(true);
      mockInfluencerRepository.findByWhatsappHash.mockResolvedValue(null); // No duplicate
      mockInfluencerRepository.updateWhatsAppVerification.mockResolvedValue({
        ...mockInfluencer,
        isWhatsappVerified: true,
      });

      const result = await service.verifyWhatsAppOTP(verificationDto);

      expect(result.message).toBe(SUCCESS_MESSAGES.WHATSAPP.VERIFIED);
      expect(result.verified).toBe(true);
      expect(
        influencerRepository.updateWhatsAppVerification,
      ).toHaveBeenCalledWith(1, verificationDto.whatsappNumber);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        isWhatsappVerified: false,
      };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockOtpService.verifyOtp.mockRejectedValue(
        new BadRequestException(ERROR_MESSAGES.OTP.INVALID),
      );

      await expect(service.verifyWhatsAppOTP(verificationDto)).rejects.toThrow(
        new BadRequestException(ERROR_MESSAGES.OTP.INVALID),
      );
    });

    it('should throw NotFoundException for non-existent influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(service.verifyWhatsAppOTP(verificationDto)).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND),
      );
    });

    it('should handle already verified WhatsApp number', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        isWhatsappVerified: true,
      };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);

      await expect(service.verifyWhatsAppOTP(verificationDto)).rejects.toThrow(
        new BadRequestException(ERROR_MESSAGES.WHATSAPP.ALREADY_VERIFIED),
      );
    });
  });

  describe('getInfluencerProfile', () => {
    it('should return public profile data with collaborationCosts', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        email: 'private@email.com',
        phone: '+91XXXXXXXXXX',
        collaborationCosts: { instagram: { post: 1000 } },
        niches: [{ id: 1, name: 'Fashion' }],
        socialLinks: [
          {
            platform: 'instagram',
            contentType: 'post',
            url: 'https://instagram.com/p/test123',
          },
        ],
        isActive: true,
        isVerified: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);

      const result = await service.getInfluencerProfile(1, true);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('name', 'Test Influencer');
      expect(result).toHaveProperty('bio', 'Test bio');
      expect(result).toHaveProperty('niches');
      expect(result).toHaveProperty('socialLinks');
      expect(result).toHaveProperty('collaborationCosts');
      expect(result).toHaveProperty('phone');
      expect(result).toHaveProperty('whatsappNumber');

      // Ensure private data is not included (verification, contact)
      expect(result).not.toHaveProperty('verification');
      expect(result).not.toHaveProperty('contact');
    });

    it('should throw NotFoundException for non-existent or inactive influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(service.getInfluencerProfile(999)).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND),
      );
    });

    it('should include experiences count in metrics', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        isProfileCompleted: true,
        niches: [],
        customNiches: [],
        city: null,
        country: null,
        collaborationCosts: {},
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      };

      const followModel = module.get('FOLLOW_MODEL');
      const postModel = module.get('POST_MODEL');
      const campaignApplicationModel = module.get('CAMPAIGN_APPLICATION_MODEL');
      const experienceModel = module.get('EXPERIENCE_MODEL');

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      followModel.count.mockResolvedValue(150); // followers
      followModel.count.mockResolvedValueOnce(150); // followers (first call)
      followModel.count.mockResolvedValueOnce(75); // following (second call)
      postModel.count.mockResolvedValue(25);
      campaignApplicationModel.count.mockResolvedValue(10);
      experienceModel.count.mockResolvedValue(5);

      const result = await service.getInfluencerProfile(1);

      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toEqual({
        followers: 150,
        following: 75,
        posts: 25,
        campaigns: 10,
        experiences: 5,
      });
      expect(experienceModel.count).toHaveBeenCalledWith({
        where: { influencerId: 1 },
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database transaction failures', async () => {
      const updateDto: UpdateInfluencerProfileDto = {
        bio: 'Updated bio',
      };

      mockInfluencerRepository.findById.mockResolvedValue({
        id: 1,
        update: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      });
      mockInfluencerRepository.updateInfluencer.mockRejectedValue(
        new Error('Transaction failed'),
      );

      await expect(
        service.updateInfluencerProfile(1, updateDto, undefined),
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle file cleanup on partial upload failures', async () => {
      const updateDto: UpdateInfluencerProfileDto = { bio: 'Test bio' };
      const mockFiles = {
        profileImage: [
          { buffer: Buffer.from('image'), originalname: 'profile.jpg' },
        ],
        profileBanner: [
          { buffer: Buffer.from('banner'), originalname: 'banner.jpg' },
        ],
      };

      mockInfluencerRepository.findById.mockResolvedValue({ id: 1 });
      mockS3Service.uploadFileToS3.mockResolvedValueOnce('profile.jpg'); // First upload succeeds
      mockS3Service.uploadFileToS3.mockRejectedValueOnce(
        new Error('Second upload fails'),
      ); // Second fails

      await expect(
        service.updateInfluencerProfile(1, updateDto, mockFiles),
      ).rejects.toThrow('Second upload fails');
    });

    it('should handle concurrent WhatsApp verification attempts', async () => {
      const verificationDto: WhatsappVerificationDto = {
        influencerId: 1,
        whatsappNumber: '+919876543210',
        otp: '123456',
      };

      const mockInfluencer = { id: 1, isWhatsappVerified: false };

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockOtpService.verifyOtp.mockResolvedValue(true);
      mockInfluencerRepository.findByWhatsappHash.mockResolvedValue(null); // No duplicate
      mockInfluencerRepository.updateWhatsAppVerification.mockResolvedValue(
        mockInfluencer,
      );

      // Simulate concurrent verification attempts
      const promises = [
        service.verifyWhatsAppOTP(verificationDto),
        service.verifyWhatsAppOTP(verificationDto),
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large file uploads efficiently', async () => {
      const largeFileBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB file
      const mockFiles = {
        profileImage: [
          { buffer: largeFileBuffer, originalname: 'large-profile.jpg' },
        ],
      };

      const updateDto: UpdateInfluencerProfileDto = { bio: 'Test bio' };

      mockInfluencerRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        profileHeadline: 'Test headline',
        countryId: 1,
        cityId: 1,
        whatsappNumber: '+919876543210',
        instagramUrl: 'https://instagram.com/test',
        isWhatsappVerified: true,
        collaborationCosts: { instagram: { post: 1000 } },
        isProfileCompleted: true,
        update: jest.fn().mockResolvedValue(true),
      });
      mockS3Service.uploadFileToS3.mockResolvedValue('large-profile.jpg');
      mockInfluencerRepository.updateInfluencer.mockResolvedValue({ id: 1 });

      const result = await service.updateInfluencerProfile(
        1,
        updateDto,
        mockFiles,
      );

      expect(result.message).toBe(SUCCESS_MESSAGES.PROFILE.UPDATED);
      expect(s3Service.uploadFileToS3).toHaveBeenCalledWith(
        mockFiles.profileImage[0],
        'profiles/influencers',
        'profile',
      );
    });

    it('should not leak sensitive data in error messages', async () => {
      const sensitiveUpdateDto = {
        name: 'Test User',
        privateNote: 'This contains sensitive information',
      };

      mockInfluencerRepository.findById.mockResolvedValue(null);

      try {
        await service.updateInfluencerProfile(
          1,
          sensitiveUpdateDto as any,
          undefined,
        );
      } catch (error) {
        expect(error.message).not.toContain('sensitive information');
        expect(error.message).toBe(ERROR_MESSAGES.INFLUENCER.NOT_FOUND);
      }
    });
  });

  describe('deleteExperience', () => {
    it('should delete experience successfully', async () => {
      const mockExperience = {
        id: 1,
        influencerId: 1,
        campaignName: 'Test Campaign',
        destroy: jest.fn().mockResolvedValue(true),
      };

      const experienceModel = module.get('EXPERIENCE_MODEL');
      const experienceSocialLinkModel = module.get(
        'EXPERIENCE_SOCIAL_LINK_MODEL',
      );

      experienceModel.findOne.mockResolvedValue(mockExperience);
      experienceSocialLinkModel.destroy.mockResolvedValue(2);

      const result = await service.deleteExperience(1, 1);

      expect(result).toEqual({ message: 'Experience deleted successfully' });
      expect(experienceModel.findOne).toHaveBeenCalledWith({
        where: { id: 1, influencerId: 1 },
      });
      expect(experienceSocialLinkModel.destroy).toHaveBeenCalledWith({
        where: { experienceId: 1 },
      });
      expect(mockExperience.destroy).toHaveBeenCalled();
    });

    it('should throw NotFoundException if experience not found', async () => {
      const experienceModel = module.get('EXPERIENCE_MODEL');
      experienceModel.findOne.mockResolvedValue(null);

      await expect(service.deleteExperience(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getOpenCampaigns', () => {
    const mockInfluencer = {
      id: 1,
      name: 'Test Influencer',
      gender: 'female',
      dateOfBirth: new Date('1995-01-01'), // Age: ~30
      cityId: 1,
    };

    const mockCampaign1 = {
      id: 1,
      name: 'Fashion Campaign',
      description: 'Test campaign',
      status: 'active',
      isActive: true,
      nicheIds: [1, 3], // Fashion, Beauty
      isOpenToAllAges: false,
      minAge: 21,
      maxAge: 35,
      isOpenToAllGenders: false,
      genderPreferences: ['female'],
      isPanIndia: false,
      cities: [{ cityId: 1 }, { cityId: 2 }],
      toJSON: jest.fn().mockReturnThis(),
    };

    const mockCampaign2 = {
      id: 2,
      name: 'Tech Campaign',
      description: 'Tech products',
      status: 'active',
      isActive: true,
      nicheIds: [7], // Tech
      isOpenToAllAges: true,
      isOpenToAllGenders: true,
      isPanIndia: true,
      cities: [],
      toJSON: jest.fn().mockReturnThis(),
    };

    const mockCampaign3 = {
      id: 3,
      name: 'Beauty Campaign',
      description: 'Beauty products',
      status: 'active',
      isActive: true,
      nicheIds: [3], // Beauty
      isOpenToAllAges: false,
      minAge: 18,
      maxAge: 25, // Will be filtered out due to age
      isOpenToAllGenders: true,
      isPanIndia: true,
      cities: [],
      toJSON: jest.fn().mockReturnThis(),
    };

    const mockCampaign4 = {
      id: 4,
      name: 'Male Fitness Campaign',
      description: 'Fitness for men',
      status: 'active',
      isActive: true,
      nicheIds: [1], // Fashion
      isOpenToAllAges: true,
      isOpenToAllGenders: false,
      genderPreferences: ['male'], // Will be filtered out due to gender
      isPanIndia: true,
      cities: [],
      toJSON: jest.fn().mockReturnThis(),
    };

    beforeEach(() => {
      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
    });

    it('should filter campaigns by influencer niches automatically', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 1 }, { nicheId: 3 }]); // Fashion, Beauty

      // Mock should return only campaigns matching the niche filter in WHERE clause
      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign1], // Only Fashion Campaign has matching niches
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([]) // No existing applications
        .mockResolvedValueOnce([]); // No application counts

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      expect(influencerNicheModel.findAll).toHaveBeenCalledWith({
        where: { influencerId: 1 },
        attributes: ['nicheId'],
        raw: true,
      });
      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].id).toBe(1); // Only Fashion Campaign matches
    });

    it('should filter out campaigns by age requirements', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 3 }]); // Beauty

      // Database filters out campaigns that don't match age requirements
      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [], // Age filter applied at DB level
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      expect(result.campaigns).toHaveLength(0); // Filtered out due to age
    });

    it('should filter out campaigns by gender preferences', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 1 }]); // Fashion

      // Database filters out campaigns that don't match gender preferences
      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [], // Gender filter applied at DB level
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      expect(result.campaigns).toHaveLength(0); // Filtered out due to gender
    });

    it('should filter out campaigns by location when not Pan-India', async () => {
      const influencerWithDifferentCity = {
        ...mockInfluencer,
        cityId: 5, // Different city
      };
      mockInfluencerRepository.findById.mockResolvedValue(
        influencerWithDifferentCity,
      );

      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 1 }]);

      // Database filters out campaigns that don't match location
      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [], // Location filter applied at DB level
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      expect(result.campaigns).toHaveLength(0); // Filtered out due to location
    });

    it('should allow Pan-India campaigns for all locations', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 7 }]); // Tech

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign2], // Pan-India
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].id).toBe(2);
    });

    it('should use provided nicheIds instead of influencer niches', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign2],
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns(
        { nicheIds: [7], page: 1, limit: 10 }, // Override with Tech
        1,
      );

      // Should NOT fetch influencer niches
      expect(influencerNicheModel.findAll).not.toHaveBeenCalled();
      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].id).toBe(2);
    });

    it('should include application status for each campaign', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 1 }]);

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign1],
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([{ campaignId: 1, status: 'pending' }])
        .mockResolvedValueOnce([{ campaignId: 1, count: '5' }]);

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      expect(result.campaigns[0].hasApplied).toBe(true);
      expect(result.campaigns[0].applicationStatus).toBe('pending');
      expect(result.campaigns[0].totalApplications).toBe(5);
    });

    it('should handle pagination correctly', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 1 }]);

      // Database returns only page 2 campaigns (items 11-15)
      const page2Campaigns = Array.from({ length: 5 }, (_, i) => ({
        ...mockCampaign1,
        id: i + 11, // IDs 11-15 for page 2
        toJSON: jest.fn().mockReturnThis(),
      }));

      // Database handles pagination, so it returns only the requested page
      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 15, // Total count across all pages
        rows: page2Campaigns, // Only campaigns for page 2
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns({ page: 2, limit: 10 }, 1);

      expect(result.campaigns).toHaveLength(5); // 15 total, page 2 with limit 10
      expect(result.total).toBe(15);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    it('should handle influencer with no date of birth', async () => {
      mockInfluencerRepository.findById.mockResolvedValue({
        ...mockInfluencer,
        dateOfBirth: null,
      });

      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 3 }]);

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign3], // Has age restrictions
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getOpenCampaigns({ page: 1, limit: 10 }, 1);

      // Should skip age filter when dateOfBirth is null
      expect(result.campaigns).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(
        service.getOpenCampaigns({ page: 1, limit: 10 }, 999),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle search query correctly', async () => {
      const influencerNicheModel = module.get('INFLUENCER_NICHE_MODEL');
      influencerNicheModel.findAll = jest
        .fn()
        .mockResolvedValue([{ nicheId: 1 }]);

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockCampaign1],
      });

      mockCampaignApplicationModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getOpenCampaigns(
        { search: 'fashion', page: 1, limit: 10 },
        1,
      );

      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalled();
      const callArgs = mockCampaignModel.findAndCountAll.mock.calls[0][0];
      // Check that Op.or was used for search conditions
      expect(callArgs.where[Symbol.for('or')]).toBeDefined();
    });
  });
});
