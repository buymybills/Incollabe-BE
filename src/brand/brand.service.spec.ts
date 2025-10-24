import { Test, TestingModule } from '@nestjs/testing';
import { BrandService } from './brand.service';
import { getModelToken } from '@nestjs/sequelize';
import { Brand } from './model/brand.model';
import { BrandNiche } from './model/brand-niche.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { Region } from '../shared/models/region.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Follow } from '../post/models/follow.model';
import { Post } from '../post/models/post.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { Admin } from '../admin/models/admin.model';
import { S3Service } from '../shared/s3.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../shared/email.service';
import { MasterDataService } from '../shared/services/master-data.service';
import { ProfileReviewService } from '../admin/profile-review.service';
import { ProfileType } from '../admin/models/profile-review.model';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';
import { UpdateBrandNichesDto } from './dto/update-brand-niches.dto';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockModel = () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
});

const mockS3Service = {
  uploadFileToS3: jest.fn(),
  getFileUrl: jest.fn(),
};

const mockRedisService = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockEmailService = {
  sendBrandProfileIncompleteEmail: jest.fn(),
  sendProfileVerificationPendingEmail: jest.fn(),
  sendAdminProfilePendingNotification: jest.fn(),
};

const mockMasterDataService = {
  getCountries: jest.fn(),
  getCitiesByCountry: jest.fn(),
  getFoundedYears: jest.fn(),
  getRegions: jest.fn(),
  validateCountryId: jest.fn(),
  validateCityId: jest.fn(),
};

const mockProfileReviewService = {
  createProfileReview: jest.fn(),
  hasProfileReview: jest.fn().mockResolvedValue(false),
};

describe('BrandService', () => {
  let service: BrandService;
  let brandModel: any;
  let brandNicheModel: any;
  let nicheModel: any;
  let countryModel: any;
  let cityModel: any;
  let regionModel: any;
  let companyTypeModel: any;
  let adminModel: any;
  let s3Service: any;
  let emailService: any;
  let masterDataService: any;
  let profileReviewService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandService,
        {
          provide: getModelToken(Brand),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(BrandNiche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Niche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Country),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(City),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Region),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CompanyType),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Follow),
          useValue: { count: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getModelToken(Post),
          useValue: { count: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getModelToken(Campaign),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(CustomNiche),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(ProfileReview),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Admin),
          useValue: mockModel(),
        },
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: MasterDataService,
          useValue: mockMasterDataService,
        },
        {
          provide: ProfileReviewService,
          useValue: mockProfileReviewService,
        },
      ],
    }).compile();

    service = module.get<BrandService>(BrandService);
    brandModel = module.get(getModelToken(Brand));
    brandNicheModel = module.get(getModelToken(BrandNiche));
    nicheModel = module.get(getModelToken(Niche));
    countryModel = module.get(getModelToken(Country));
    cityModel = module.get(getModelToken(City));
    regionModel = module.get(getModelToken(Region));
    companyTypeModel = module.get(getModelToken(CompanyType));
    adminModel = module.get(getModelToken(Admin));
    s3Service = module.get(S3Service);
    emailService = module.get(EmailService);
    masterDataService = module.get(MasterDataService);
    profileReviewService = module.get(ProfileReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getBrandProfile', () => {
    it('should return comprehensive brand profile', async () => {
      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Test Brand',
        username: 'testbrand',
        brandBio: 'Test bio',
        profileHeadline: 'Test headline',
        isPhoneVerified: true,
        isEmailVerified: true,
        isActive: true,
        legalEntityName: 'Test Legal Entity',
        foundedYear: 2020,
        websiteUrl: 'https://testbrand.com',
        pocName: 'John Doe',
        pocDesignation: 'CEO',
        pocEmailId: 'john@testbrand.com',
        pocContactNumber: '+919876543210',
        brandEmailId: 'contact@testbrand.com',
        profileImage: 'https://s3.amazonaws.com/profile.jpg',
        profileBanner: 'https://s3.amazonaws.com/banner.jpg',
        activeRegions: ['Asia', 'Europe'],
        facebookUrl: 'https://facebook.com/testbrand',
        instagramUrl: 'https://instagram.com/testbrand',
        youtubeUrl: 'https://youtube.com/testbrand',
        linkedinUrl: 'https://linkedin.com/company/testbrand',
        twitterUrl: 'https://twitter.com/testbrand',
        incorporationDocument: 'https://s3.amazonaws.com/incorporation.pdf',
        gstDocument: 'https://s3.amazonaws.com/gst.pdf',
        panDocument: 'https://s3.amazonaws.com/pan.pdf',
        companyType: {
          id: 1,
          name: 'Private Limited',
          description: 'Private Limited Company',
        },
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
        niches: [
          { id: 1, name: 'Fashion', description: 'Fashion niche' },
          { id: 2, name: 'Beauty', description: 'Beauty niche' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);

      const result = await service.getBrandProfile(1);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('email', 'test@brand.com');
      expect(result).toHaveProperty('brandName', 'Test Brand');
      expect(result.companyInfo).toHaveProperty('foundedYear', 2020);
      expect(result.contactInfo).toHaveProperty('pocName', 'John Doe');
      expect(result.profileMedia).toHaveProperty('profileImage');
      expect(result.socialLinks).toHaveProperty('facebook');
      expect(result.documents).toHaveProperty('incorporationDocument');
      expect(result.profileCompletion).toHaveProperty('isCompleted');
      expect(result.niches).toHaveLength(2);
      expect(brandModel.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('should throw NotFoundException when brand not found', async () => {
      brandModel.findByPk.mockResolvedValue(null);

      await expect(service.getBrandProfile(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBrandProfile', () => {
    it('should update brand profile successfully', async () => {
      const updateDto: UpdateBrandProfileDto = {
        brandName: 'Updated Brand',
        username: 'updatedbrand',
        brandBio: 'Updated bio',
        websiteUrl: 'https://updated.com',
        foundedYear: 2021,
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Test Brand',
        isProfileCompleted: false,
        update: jest.fn(),
        reload: jest.fn(),
      };

      const mockFiles = {
        profileImage: [
          {
            fieldname: 'profileImage',
            originalname: 'profile.jpg',
            buffer: Buffer.from('test'),
          },
        ],
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);
      s3Service.uploadFileToS3.mockResolvedValue(
        'https://s3.amazonaws.com/new-profile.jpg',
      );

      // Mock the getBrandProfile method that's called at the end
      jest.spyOn(service, 'getBrandProfile').mockResolvedValue({
        id: 1,
        email: 'test@brand.com',
        brandName: 'Updated Brand',
        profileCompletion: {
          isCompleted: false,
          missingFields: [],
          nextSteps: [],
        },
      } as any);

      const result = await service.updateBrandProfile(
        1,
        updateDto,
        mockFiles as any,
      );

      expect(mockBrand.update).toHaveBeenCalled();
      expect(s3Service.uploadFileToS3).toHaveBeenCalled();
      expect(result).toHaveProperty('brandName', 'Updated Brand');
    });

    it('should throw NotFoundException when brand not found', async () => {
      const updateDto: UpdateBrandProfileDto = {
        brandName: 'Updated Brand',
      };

      brandModel.findByPk.mockResolvedValue(null);

      await expect(service.updateBrandProfile(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create profile review when profile becomes complete', async () => {
      const updateDto: UpdateBrandProfileDto = {
        brandName: 'Complete Brand',
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Complete Brand',
        username: 'completebrand',
        legalEntityName: 'Complete Legal Entity',
        companyTypeId: 1,
        brandBio: 'Complete bio',
        profileHeadline: 'Complete headline',
        websiteUrl: 'https://complete.com',
        foundedYear: 2020,
        headquarterCountryId: 1,
        headquarterCityId: 1,
        activeRegions: ['Asia'],
        pocName: 'John Doe',
        pocDesignation: 'CEO',
        pocEmailId: 'john@complete.com',
        pocContactNumber: '+919876543210',
        profileImage: 'https://s3.amazonaws.com/profile.jpg',
        profileBanner: 'https://s3.amazonaws.com/banner.jpg',
        incorporationDocument: 'https://s3.amazonaws.com/incorporation.pdf',
        gstDocument: 'https://s3.amazonaws.com/gst.pdf',
        panDocument: 'https://s3.amazonaws.com/pan.pdf',
        isProfileCompleted: false,
        update: jest.fn(),
        reload: jest.fn(),
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);
      profileReviewService.createProfileReview.mockResolvedValue({ id: 1 });
      emailService.sendProfileVerificationPendingEmail.mockResolvedValue(true);
      emailService.sendAdminProfilePendingNotification.mockResolvedValue(true);

      // Mock adminModel.findAll to return active admin users
      adminModel.findAll.mockResolvedValue([
        {
          id: 1,
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      ]);

      // Mock getBrandProfile to return complete profile
      jest.spyOn(service, 'getBrandProfile').mockResolvedValue({
        id: 1,
        email: 'test@brand.com',
        brandName: 'Complete Brand',
        profileCompletion: {
          isCompleted: true,
          missingFields: [],
          nextSteps: [],
        },
      } as any);

      // Mock both profile completion methods
      jest.spyOn(service as any, 'calculateProfileCompletion').mockReturnValue({
        isCompleted: true,
        missingFields: [],
        nextSteps: [],
      });
      jest
        .spyOn(service as any, 'checkBrandProfileCompletion')
        .mockReturnValue(true);

      const result = await service.updateBrandProfile(1, updateDto);

      expect(profileReviewService.createProfileReview).toHaveBeenCalledWith({
        profileId: 1,
        profileType: ProfileType.BRAND,
        submittedData: expect.any(Object),
      });
      expect(
        emailService.sendProfileVerificationPendingEmail,
      ).toHaveBeenCalled();
      expect((result as any).status).toBe('pending_verification');
    });

    it('should clear social links that are not provided in update', async () => {
      const updateDtoWithoutSocialLinks: UpdateBrandProfileDto = {
        brandName: 'Updated Brand Name',
        brandBio: 'Updated bio without social links',
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Old Brand',
        brandBio: 'Old bio',
        facebookUrl: 'https://facebook.com/old',
        instagramUrl: 'https://instagram.com/old',
        youtubeUrl: 'https://youtube.com/old',
        linkedinUrl: 'https://linkedin.com/old',
        twitterUrl: 'https://twitter.com/old',
        isProfileCompleted: false,
        update: jest.fn().mockImplementation(function (data) {
          Object.assign(this, data);
          return Promise.resolve();
        }),
        reload: jest.fn(),
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);

      // Mock getBrandProfile
      jest.spyOn(service, 'getBrandProfile').mockResolvedValue({
        id: 1,
        email: 'test@brand.com',
        brandName: 'Updated Brand Name',
        profileCompletion: {
          isCompleted: false,
          missingFields: [],
          nextSteps: [],
        },
      } as any);

      await service.updateBrandProfile(1, updateDtoWithoutSocialLinks);

      // Verify that all social links are set to null when not provided
      expect(mockBrand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          brandName: 'Updated Brand Name',
          brandBio: 'Updated bio without social links',
          facebookUrl: null,
          instagramUrl: null,
          youtubeUrl: null,
          linkedinUrl: null,
          twitterUrl: null,
        }),
      );
    });
  });

  describe('updateBrandNiches', () => {
    it('should update brand niches successfully', async () => {
      const updateNichesDto: UpdateBrandNichesDto = {
        nicheIds: [1, 2, 3],
      };

      const mockBrand = {
        id: 1,
        email: 'test@brand.com',
        brandName: 'Test Brand',
      };

      const mockNiches = [
        { id: 1, name: 'Fashion' },
        { id: 2, name: 'Beauty' },
        { id: 3, name: 'Lifestyle' },
      ];

      brandModel.findByPk.mockResolvedValue(mockBrand);
      nicheModel.findAll.mockResolvedValue(mockNiches);
      brandNicheModel.destroy.mockResolvedValue(1);
      brandNicheModel.bulkCreate.mockResolvedValue([]);

      jest.spyOn(service, 'getBrandProfile').mockResolvedValue({
        id: 1,
        niches: mockNiches,
      } as any);

      const result = await service.updateBrandNiches(1, [1, 2, 3]);

      expect(brandNicheModel.destroy).toHaveBeenCalledWith({
        where: { brandId: 1 },
      });
      expect(brandNicheModel.bulkCreate).toHaveBeenCalled();
      expect(result.niches).toHaveLength(3);
    });

    it('should throw NotFoundException when brand not found', async () => {
      brandModel.findByPk.mockResolvedValue(null);

      await expect(service.updateBrandNiches(999, [1, 2])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid niche IDs', async () => {
      const mockBrand = { id: 1 };
      brandModel.findByPk.mockResolvedValue(mockBrand);
      nicheModel.findAll.mockResolvedValue([{ id: 1 }]); // Only niche 1 exists

      await expect(service.updateBrandNiches(1, [1, 2, 999])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getCompanyTypes', () => {
    it('should return all active company types', async () => {
      const mockCompanyTypes = [
        {
          id: 1,
          name: 'Private Limited',
          description: 'Private Limited Company',
          isActive: true,
          sortOrder: 1,
        },
        {
          id: 2,
          name: 'Public Limited',
          description: 'Public Limited Company',
          isActive: true,
          sortOrder: 2,
        },
      ];

      companyTypeModel.findAll.mockResolvedValue(mockCompanyTypes);

      const result = await service.getCompanyTypes();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'Private Limited');
      expect(companyTypeModel.findAll).toHaveBeenCalledWith({
        where: { isActive: true },
        order: [['sortOrder', 'ASC']],
        attributes: ['id', 'name', 'description', 'isActive', 'sortOrder'],
      });
    });
  });

  describe('Dropdown Data Methods', () => {
    it('should get countries list', async () => {
      const mockCountries = [
        { id: 1, name: 'India', code: 'IN' },
        { id: 2, name: 'USA', code: 'US' },
      ];

      masterDataService.getCountries.mockResolvedValue(mockCountries);

      const result = await service.getCountriesList();

      expect(result).toEqual(mockCountries);
      expect(masterDataService.getCountries).toHaveBeenCalled();
    });

    it('should get cities list by country', async () => {
      const mockCities = [
        { id: 1, name: 'Mumbai', state: 'Maharashtra' },
        { id: 2, name: 'Delhi', state: 'Delhi' },
      ];

      masterDataService.getCitiesByCountry.mockResolvedValue(mockCities);

      const result = await service.getCitiesList(1);

      expect(result).toEqual(mockCities);
      expect(masterDataService.getCitiesByCountry).toHaveBeenCalledWith(1);
    });

    it('should get founded years list', async () => {
      const mockYears = [
        { id: 2024, value: 2024 },
        { id: 2023, value: 2023 },
      ];

      masterDataService.getFoundedYears.mockResolvedValue(mockYears);

      const result = await service.getFoundedYearsList();

      expect(result).toEqual(mockYears);
      expect(masterDataService.getFoundedYears).toHaveBeenCalled();
    });

    it('should get active regions list', async () => {
      const mockRegions = [
        { id: 1, name: 'Asia', code: 'AS' },
        { id: 2, name: 'Europe', code: 'EU' },
      ];

      masterDataService.getRegions.mockResolvedValue(mockRegions);

      const result = await service.getActiveRegionsList();

      expect(result).toEqual(mockRegions);
      expect(masterDataService.getRegions).toHaveBeenCalled();
    });
  });

  describe('Private Helper Methods', () => {
    it('should calculate profile completion correctly', async () => {
      const incompleteBrand = {
        id: 1,
        brandName: 'Test Brand',
        username: 'testbrand',
        createdAt: new Date(),
        updatedAt: new Date(),
        // Missing many required fields
      };

      brandModel.findByPk.mockResolvedValue(incompleteBrand);

      const result = await service.getBrandProfile(1);

      expect(result.profileCompletion.isCompleted).toBe(false);
      expect(result.profileCompletion.completionPercentage).toBeLessThan(100);
      expect(result.profileCompletion.missingFields.length).toBeGreaterThan(0);
      expect(result.profileCompletion.nextSteps.length).toBeGreaterThan(0);
    });

    it('should create document info correctly', async () => {
      const mockBrand = {
        id: 1,
        incorporationDocument:
          'https://s3.amazonaws.com/docs/incorporation.pdf',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      brandModel.findByPk.mockResolvedValue(mockBrand);

      const result = await service.getBrandProfile(1);

      expect(result.documents.incorporationDocument).toHaveProperty('url');
      expect(result.documents.incorporationDocument).toHaveProperty('filename');
      expect(result.documents.incorporationDocument).toHaveProperty('canView');
    });
  });

  describe('Service Dependencies', () => {
    it('should have all required dependencies injected', () => {
      expect(service['brandModel']).toBeDefined();
      expect(service['brandNicheModel']).toBeDefined();
      expect(service['nicheModel']).toBeDefined();
      expect(service['companyTypeModel']).toBeDefined();
      expect(service['s3Service']).toBeDefined();
      expect(service['redisService']).toBeDefined();
      expect(service['emailService']).toBeDefined();
      expect(service['masterDataService']).toBeDefined();
      expect(service['profileReviewService']).toBeDefined();
    });
  });
});
