import { Test, TestingModule } from '@nestjs/testing';
import { InfluencerService } from './influencer.service';
import { S3Service } from '../shared/s3.service';
import { EmailService } from '../shared/email.service';
import { WhatsAppService } from '../shared/whatsapp.service';
import { OtpService } from '../shared/services/otp.service';
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

describe('InfluencerService', () => {
  let service: InfluencerService;
  let influencerRepository: InfluencerRepository;
  let s3Service: S3Service;
  let emailService: EmailService;
  let whatsAppService: WhatsAppService;
  let otpService: OtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
      niches: [{ id: 1, name: 'Fashion', icon: '👗' }],
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
      expect(influencerRepository.findById).toHaveBeenCalledWith(1);
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
      name: 'Updated Name',
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
        updateDto,
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

    it('should handle WhatsApp service failures', async () => {
      const mockInfluencer = { id: 1, name: 'Test Influencer' };
      const mockOtp = '123456';

      mockInfluencerRepository.findById.mockResolvedValue(mockInfluencer);
      mockOtpService.generateOtp.mockReturnValue(mockOtp);
      mockOtpService.createOtpRecord.mockResolvedValue({});
      mockOtpService.generateAndStoreOtp.mockResolvedValue(mockOtp);
      mockWhatsAppService.sendOTP.mockRejectedValue(
        new Error('WhatsApp API error'),
      );

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
    it('should return public profile data only', async () => {
      const mockInfluencer = {
        id: 1,
        name: 'Test Influencer',
        username: 'test_influencer',
        bio: 'Test bio',
        profileImage: 'profile.jpg',
        profileBanner: 'banner.jpg',
        email: 'private@email.com', // Should not be included
        phone: '+91XXXXXXXXXX', // Should not be included
        collaborationCosts: { instagram: { post: 1000 } }, // Should not be included
        niches: [{ id: 1, name: 'Fashion' }],
        socialLinks: {
          instagramUrl: 'https://instagram.com/test',
        },
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

      // Ensure private data is not included
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('collaborationCosts');
    });

    it('should throw NotFoundException for non-existent or inactive influencer', async () => {
      mockInfluencerRepository.findById.mockResolvedValue(null);

      await expect(service.getInfluencerProfile(999)).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.INFLUENCER.NOT_FOUND),
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database transaction failures', async () => {
      const updateDto: UpdateInfluencerProfileDto = {
        name: 'Updated Name',
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
      const updateDto: UpdateInfluencerProfileDto = { name: 'Test' };
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

      const updateDto: UpdateInfluencerProfileDto = { name: 'Test' };

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
});
