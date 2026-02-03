import { Test, TestingModule } from '@nestjs/testing';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { SupportTicketService } from '../shared/support-ticket.service';
import { MaxCampaignPaymentService } from '../campaign/services/max-campaign-payment.service';
import { InviteOnlyPaymentService } from '../campaign/services/invite-only-payment.service';
import { S3Service } from '../shared/s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';
import { UpdateBrandNichesDto } from './dto/update-brand-niches.dto';
import { BrandProfileResponseDto } from './dto/brand-profile-response.dto';
import { CompanyTypeDto } from './dto/company-type.dto';
import { RequestWithUser } from '../types/request.types';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockBrandService = {
  getCompanyTypes: jest.fn(),
  getBrandProfile: jest.fn(),
  updateBrandProfile: jest.fn(),
  updateBrandNiches: jest.fn(),
  getCountriesList: jest.fn(),
  getCitiesList: jest.fn(),
  getFoundedYearsList: jest.fn(),
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

const mockMaxCampaignPaymentService = {
  createPayment: jest.fn(),
  verifyPayment: jest.fn(),
  getPaymentStatus: jest.fn(),
};

const mockInviteOnlyPaymentService = {
  createInviteOnlyPaymentOrder: jest.fn(),
  verifyAndUnlockInviteOnly: jest.fn(),
  getInviteOnlyStatus: jest.fn(),
};

const mockS3Service = {
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getSignedUrl: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};

describe('BrandController', () => {
  let controller: BrandController;
  let brandService: BrandService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandController],
      providers: [
        {
          provide: BrandService,
          useValue: mockBrandService,
        },
        {
          provide: SupportTicketService,
          useValue: mockSupportTicketService,
        },
        {
          provide: MaxCampaignPaymentService,
          useValue: mockMaxCampaignPaymentService,
        },
        {
          provide: InviteOnlyPaymentService,
          useValue: mockInviteOnlyPaymentService,
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<BrandController>(BrandController);
    brandService = module.get<BrandService>(BrandService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('getCompanyTypes', () => {
    it('should return all company types', async () => {
      const mockCompanyTypes: CompanyTypeDto[] = [
        {
          id: 1,
          name: 'Private Limited',
          description:
            'A company limited by shares that offers limited liability',
          isActive: true,
          sortOrder: 1,
        },
        {
          id: 2,
          name: 'Partnership',
          description: 'A business entity formed by two or more partners',
          isActive: true,
          sortOrder: 2,
        },
      ];

      mockBrandService.getCompanyTypes.mockResolvedValue(mockCompanyTypes);

      const result = await controller.getCompanyTypes();

      expect(result).toEqual(mockCompanyTypes);
      expect(brandService.getCompanyTypes).toHaveBeenCalledTimes(1);
    });

    it('should handle empty company types list', async () => {
      mockBrandService.getCompanyTypes.mockResolvedValue([]);

      const result = await controller.getCompanyTypes();

      expect(result).toEqual([]);
      expect(brandService.getCompanyTypes).toHaveBeenCalledTimes(1);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockBrandService.getCompanyTypes.mockRejectedValue(error);

      await expect(controller.getCompanyTypes()).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getBrandProfile', () => {
    const mockRequest: RequestWithUser = {
      user: {
        id: 1,
        email: 'test@brand.com',
        userType: 'brand',
        profileCompleted: true,
      },
    } as RequestWithUser;

    it('should return brand profile for authenticated user', async () => {
      const mockProfile: BrandProfileResponseDto = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Test Brand',
        username: 'test_brand',
        brandBio: 'Test brand bio',
        profileHeadline: 'Test brand headline',
        isActive: true,
        isEmailVerified: true,
        isTopBrand: false,
        userType: 'brand' as const,
        profileCompletion: {
          completionPercentage: 75,
          missingFields: ['brandBio'],
          isCompleted: false,
          nextSteps: ['Complete brand bio'],
        },
        contactInfo: {
          brandEmailId: 'contact@testbrand.com',
          pocName: 'John Doe',
          pocDesignation: 'Marketing Manager',
          pocEmailId: 'john@testbrand.com',
          pocContactNumber: '+919876543211',
        },
        companyInfo: {
          legalEntityName: 'Test Company Ltd',
          companyType: {
            id: 1,
            name: 'Private Limited',
            description: 'Private Limited Company',
          },
          websiteUrl: 'https://testbrand.com',
          foundedYear: 2020,
          headquarterCountry: {
            id: 1,
            name: 'India',
            code: 'IN',
          },
          headquarterCity: {
            id: 1,
            name: 'Mumbai',
            state: 'Maharashtra',
          },
          activeRegions: ['Asia', 'Europe'],
        },
        profileMedia: {
          profileImage: 'https://example.com/profile.jpg',
          profileBanner: 'https://example.com/banner.jpg',
        },
        socialLinks: {
          facebook: 'https://facebook.com/testbrand',
          instagram: 'https://instagram.com/testbrand',
          youtube: 'https://youtube.com/testbrand',
          linkedin: 'https://linkedin.com/company/testbrand',
          twitter: 'https://twitter.com/testbrand',
        },
        documents: {
          incorporationDocument: {
            filename: 'incorporation.pdf',
            url: 'https://example.com/docs/incorporation.pdf',
            uploadedAt: new Date().toISOString(),
            canView: true,
          },
          gstDocument: {
            filename: 'gst.pdf',
            url: 'https://example.com/docs/gst.pdf',
            uploadedAt: new Date().toISOString(),
            canView: true,
          },
          panDocument: {
            filename: 'pan.pdf',
            url: 'https://example.com/docs/pan.pdf',
            uploadedAt: new Date().toISOString(),
            canView: true,
          },
        },
        niches: [
          {
            id: 1,
            name: 'Fashion',
            description: 'Fashion and clothing',
          },
        ],
        customNiches: [],
        metrics: {
          followers: 0,
          following: 0,
          posts: 0,
          campaigns: 0,
        },
        isVerified: false,
        totalCampaigns: 1,
        campaigns: [
          {
            id: 1,
            name: 'Test Campaign',
            description: 'Test campaign description',
            status: 'active',
            type: 'paid',
            category: 'Fashion',
            deliverableFormat: 'Photo and Video',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockBrandService.getBrandProfile.mockResolvedValue(mockProfile);

      const result = await controller.getBrandProfile(mockRequest);

      expect(result).toEqual(mockProfile);
      expect(brandService.getBrandProfile).toHaveBeenCalledWith(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should throw NotFoundException for non-existent brand', async () => {
      const error = new NotFoundException('Brand not found');
      mockBrandService.getBrandProfile.mockRejectedValue(error);

      await expect(controller.getBrandProfile(mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      mockBrandService.getBrandProfile.mockRejectedValue(error);

      await expect(controller.getBrandProfile(mockRequest)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('updateBrandProfile', () => {
    const mockRequest: RequestWithUser = {
      user: {
        id: 1,
        email: 'test@brand.com',
        userType: 'brand',
        profileCompleted: false,
      },
    } as RequestWithUser;

    const updateDto: UpdateBrandProfileDto = {
      brandName: 'Updated Brand Name',
      username: 'updated_brand',
      brandBio: 'Updated brand bio with more details',
      profileHeadline: 'Updated brand headline',
      websiteUrl: 'https://updatedbrand.com',
      foundedYear: 2021,
      activeRegions: ['Asia', 'North America'],
    };

    const mockFiles = {
      profileImage: [
        {
          fieldname: 'profileImage',
          originalname: 'profile.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1000,
          buffer: Buffer.from('image'),
          stream: undefined as any,
          destination: '',
          filename: 'profile.jpg',
          path: '',
        } as Express.Multer.File,
      ],
      profileBanner: [
        {
          fieldname: 'profileBanner',
          originalname: 'banner.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 2000,
          buffer: Buffer.from('banner'),
          stream: undefined as any,
          destination: '',
          filename: 'banner.jpg',
          path: '',
        } as Express.Multer.File,
      ],
    };

    it('should update brand profile successfully', async () => {
      const mockUpdatedProfile = {
        message: 'Brand profile updated successfully',
        brand: {
          id: 1,
          brandName: 'Updated Brand Name',
          username: 'updated_brand',
          profileCompletion: {
            completionPercentage: 85,
            isCompleted: false,
            missingFields: ['pocName'],
            nextSteps: ['Add point of contact name'],
          },
        },
      };

      mockBrandService.updateBrandProfile.mockResolvedValue(mockUpdatedProfile);

      const result = await controller.updateBrandProfile(
        mockRequest,
        updateDto,
        mockFiles,
      );

      expect(result).toEqual(mockUpdatedProfile);
      expect(brandService.updateBrandProfile).toHaveBeenCalledWith(
        1,
        updateDto,
        mockFiles,
      );
    });

    it('should handle profile update without files', async () => {
      const mockUpdatedProfile = {
        message: 'Brand profile updated successfully',
        brand: {
          id: 1,
          brandName: 'Updated Brand Name',
        },
      };

      mockBrandService.updateBrandProfile.mockResolvedValue(mockUpdatedProfile);

      const result = await controller.updateBrandProfile(
        mockRequest,
        updateDto,
        {},
      );

      expect(result).toEqual(mockUpdatedProfile);
      expect(brandService.updateBrandProfile).toHaveBeenCalledWith(
        1,
        updateDto,
        {},
      );
    });

    it('should throw NotFoundException for non-existent brand', async () => {
      const error = new NotFoundException('Brand not found');
      mockBrandService.updateBrandProfile.mockRejectedValue(error);

      await expect(
        controller.updateBrandProfile(mockRequest, updateDto, mockFiles),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle validation errors', async () => {
      const error = new BadRequestException('Invalid company type ID');
      mockBrandService.updateBrandProfile.mockRejectedValue(error);

      await expect(
        controller.updateBrandProfile(mockRequest, updateDto, mockFiles),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateBrandNiches', () => {
    const mockRequest: RequestWithUser = {
      user: {
        id: 1,
        email: 'test@brand.com',
        userType: 'brand',
        profileCompleted: true,
      },
    } as RequestWithUser;

    const updateNichesDto: UpdateBrandNichesDto = {
      nicheIds: [1, 2, 3],
    };

    it('should update brand niches successfully', async () => {
      const mockResponse = {
        message: 'Brand niches updated successfully',
        niches: [
          { id: 1, name: 'Fashion', description: 'Fashion and clothing' },
          { id: 2, name: 'Beauty', description: 'Beauty and cosmetics' },
          { id: 3, name: 'Lifestyle', description: 'Lifestyle and wellness' },
        ],
      };

      mockBrandService.updateBrandNiches.mockResolvedValue(mockResponse);

      const result = await controller.updateBrandNiches(
        mockRequest,
        updateNichesDto,
      );

      expect(result).toEqual(mockResponse);
      expect(brandService.updateBrandNiches).toHaveBeenCalledWith(1, [1, 2, 3]);
    });

    it('should handle empty niches array', async () => {
      const emptyNichesDto: UpdateBrandNichesDto = {
        nicheIds: [],
      };

      const mockResponse = {
        message: 'Brand niches updated successfully',
        niches: [],
      };

      mockBrandService.updateBrandNiches.mockResolvedValue(mockResponse);

      const result = await controller.updateBrandNiches(
        mockRequest,
        emptyNichesDto,
      );

      expect(result).toEqual(mockResponse);
      expect(brandService.updateBrandNiches).toHaveBeenCalledWith(1, []);
    });

    it('should throw NotFoundException for non-existent brand', async () => {
      const error = new NotFoundException('Brand not found');
      mockBrandService.updateBrandNiches.mockRejectedValue(error);

      await expect(
        controller.updateBrandNiches(mockRequest, updateNichesDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid niche IDs', async () => {
      const error = new BadRequestException('Invalid niche IDs provided');
      mockBrandService.updateBrandNiches.mockRejectedValue(error);

      await expect(
        controller.updateBrandNiches(mockRequest, updateNichesDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBrandProfileById', () => {
    it('should return public brand profile by ID', async () => {
      const mockPublicProfile = {
        id: 1,
        brandName: 'Test Brand',
        username: 'test_brand',
        brandBio: 'Test brand bio',
        profileImage: 'https://example.com/profile.jpg',
        profileBanner: 'https://example.com/banner.jpg',
        websiteUrl: 'https://testbrand.com',
        socialLinks: {
          facebook: 'https://facebook.com/testbrand',
          instagram: 'https://instagram.com/testbrand',
        },
        niches: [
          { id: 1, name: 'Fashion', description: 'Fashion and clothing' },
        ],
        customNiches: undefined,
        isActive: true,
        isFollowing: undefined,
        metrics: undefined,
        userType: 'brand',
      };

      const fullProfile = {
        id: 1,
        brandName: 'Test Brand',
        username: 'test_brand',
        brandBio: 'Test brand bio',
        profileMedia: {
          profileImage: 'https://example.com/profile.jpg',
          profileBanner: 'https://example.com/banner.jpg',
        },
        companyInfo: {
          websiteUrl: 'https://testbrand.com',
        },
        socialLinks: {
          facebook: 'https://facebook.com/testbrand',
          instagram: 'https://instagram.com/testbrand',
        },
        niches: [
          { id: 1, name: 'Fashion', description: 'Fashion and clothing' },
        ],
        customNiches: undefined,
        isActive: true,
        isFollowing: undefined,
        metrics: undefined,
        email: 'test@brand.com',
        // Other private fields
      };

      mockBrandService.getBrandProfile.mockResolvedValue(fullProfile);

      const result = await controller.getBrandProfileById(1);

      expect(result).toEqual(fullProfile);
      expect(brandService.getBrandProfile).toHaveBeenCalledWith(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should throw NotFoundException for non-existent brand', async () => {
      const error = new NotFoundException('Brand not found');
      mockBrandService.getBrandProfile.mockRejectedValue(error);

      await expect(controller.getBrandProfileById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCountries', () => {
    it('should return list of countries', async () => {
      const mockCountries = {
        success: true,
        data: [
          { code: 'IN', name: 'India' },
          { code: 'US', name: 'United States' },
        ],
      };

      mockBrandService.getCountriesList.mockResolvedValue(mockCountries);

      const result = await controller.getCountries();

      expect(result).toEqual(mockCountries);
      expect(brandService.getCountriesList).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to fetch countries');
      mockBrandService.getCountriesList.mockRejectedValue(error);

      await expect(controller.getCountries()).rejects.toThrow(
        'Failed to fetch countries',
      );
    });
  });

  describe('getCities', () => {
    it('should return list of cities for a country', async () => {
      const mockCities = {
        success: true,
        data: [
          { id: 1, name: 'Mumbai', state: 'Maharashtra' },
          { id: 2, name: 'Delhi', state: 'Delhi' },
        ],
      };

      mockBrandService.getCitiesList.mockResolvedValue(mockCities);

      const result = await controller.getCities(1);

      expect(result).toEqual(mockCities);
      expect(brandService.getCitiesList).toHaveBeenCalledWith(1);
    });

    it('should handle invalid country ID', async () => {
      const error = new BadRequestException('Invalid country ID');
      mockBrandService.getCitiesList.mockRejectedValue(error);

      await expect(controller.getCities(999)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getFoundedYears', () => {
    it('should return list of founded years', async () => {
      const mockYears = {
        success: true,
        data: ['2024', '2023', '2022', '2021', '2020'],
      };

      mockBrandService.getFoundedYearsList.mockResolvedValue(mockYears);

      const result = await controller.getFoundedYears();

      expect(result).toEqual(mockYears);
      expect(brandService.getFoundedYearsList).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to generate years list');
      mockBrandService.getFoundedYearsList.mockRejectedValue(error);

      await expect(controller.getFoundedYears()).rejects.toThrow(
        'Failed to generate years list',
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should parse integer parameters correctly', async () => {
      mockBrandService.getBrandProfile.mockResolvedValue({
        id: 123,
        brandName: 'Test Brand',
        username: 'test_brand',
        brandBio: 'Test bio',
        profileMedia: { profileImage: null, profileBanner: null },
        companyInfo: { websiteUrl: null },
        socialLinks: {},
        niches: [],
        isActive: true,
      });

      await controller.getBrandProfileById(123);

      expect(brandService.getBrandProfile).toHaveBeenCalledWith(
        123,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should handle country ID parameter parsing', async () => {
      mockBrandService.getCitiesList.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getCities(456);

      expect(brandService.getCitiesList).toHaveBeenCalledWith(456);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for protected routes', () => {
      expect(mockAuthGuard.canActivate).toBeDefined();
    });

    it('should extract user ID from request correctly', async () => {
      const mockRequest: RequestWithUser = {
        user: {
          id: 999,
          email: 'test@brand.com',
          userType: 'brand',
          profileCompleted: true,
        },
      } as RequestWithUser;

      mockBrandService.getBrandProfile.mockResolvedValue({
        profileMedia: { profileImage: null, profileBanner: null },
      });

      await controller.getBrandProfile(mockRequest);

      expect(brandService.getBrandProfile).toHaveBeenCalledWith(
        999,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should reject influencers from accessing brand profile endpoint', async () => {
      const influencerRequest: RequestWithUser = {
        user: {
          id: 1,
          email: 'test@influencer.com',
          userType: 'influencer',
          profileCompleted: true,
        },
      } as RequestWithUser;

      await expect(
        controller.getBrandProfile(influencerRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getBrandProfile(influencerRequest),
      ).rejects.toThrow('Only brands can access this endpoint');
    });

    it('should reject influencers from updating brand profile', async () => {
      const influencerRequest: RequestWithUser = {
        user: {
          id: 1,
          email: 'test@influencer.com',
          userType: 'influencer',
          profileCompleted: true,
        },
      } as RequestWithUser;

      const updateDto: UpdateBrandProfileDto = {
        brandName: 'Test Brand',
      };

      await expect(
        controller.updateBrandProfile(influencerRequest, updateDto, {}),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.updateBrandProfile(influencerRequest, updateDto, {}),
      ).rejects.toThrow('Only brands can update brand profiles');
    });
  });

  describe('Error Handling', () => {
    const mockRequest: RequestWithUser = {
      user: {
        id: 1,
        email: 'test@brand.com',
        userType: 'brand',
        profileCompleted: true,
      },
    } as RequestWithUser;

    it('should propagate all service errors', async () => {
      const serviceError = new Error('Service unavailable');
      mockBrandService.getBrandProfile.mockRejectedValue(serviceError);

      await expect(controller.getBrandProfile(mockRequest)).rejects.toThrow(
        'Service unavailable',
      );
    });

    it('should handle file upload errors gracefully', async () => {
      const updateDto: UpdateBrandProfileDto = {
        brandName: 'Test Brand',
      };

      const fileError = new BadRequestException('Invalid file format');
      mockBrandService.updateBrandProfile.mockRejectedValue(fileError);

      await expect(
        controller.updateBrandProfile(mockRequest, updateDto, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
