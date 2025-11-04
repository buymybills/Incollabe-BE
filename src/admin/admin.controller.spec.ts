import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminAuthService } from './admin-auth.service';
import { ProfileReviewService } from './profile-review.service';
import { AdminCampaignService } from './services/admin-campaign.service';
import { InfluencerScoringService } from './services/influencer-scoring.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ApproveProfileDto, RejectProfileDto } from './dto/profile-review.dto';
import { CampaignFilter, CampaignSortBy } from './dto/get-campaigns.dto';
import { DashboardTimeFrame } from './dto/admin-dashboard.dto';
import { AdminRole, AdminStatus } from './models/admin.model';
import { ReviewStatus, ProfileType } from './models/profile-review.model';
import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

const mockAdminAuthService = {
  login: jest.fn(),
  createAdmin: jest.fn(),
  getAdminProfile: jest.fn(),
  updateAdminStatus: jest.fn(),
  getAllAdmins: jest.fn(),
  deleteAdmin: jest.fn(),
};

const mockProfileReviewService = {
  getPendingProfiles: jest.fn(),
  getProfileDetails: jest.fn(),
  approveProfile: jest.fn(),
  rejectProfile: jest.fn(),
  getDashboardStats: jest.fn(),
};

const mockAdminCampaignService = {
  getCampaignApplicationsWithAI: jest.fn(),
  getCampaigns: jest.fn(),
};

const mockInfluencerScoringService = {
  getTopInfluencers: jest.fn(),
  getInfluencers: jest.fn(),
};

const mockDashboardStatsService = {
  getMainDashboardStats: jest.fn(),
  getInfluencerDashboardStats: jest.fn(),
  getCampaignDashboardStats: jest.fn(),
};

const mockAdminAuthGuard = {
  canActivate: jest.fn(() => true),
};

const mockRolesGuard = {
  canActivate: jest.fn(() => true),
};

describe('AdminController', () => {
  let controller: AdminController;
  let adminAuthService: AdminAuthService;
  let profileReviewService: ProfileReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminAuthService,
          useValue: mockAdminAuthService,
        },
        {
          provide: ProfileReviewService,
          useValue: mockProfileReviewService,
        },
        {
          provide: AdminCampaignService,
          useValue: mockAdminCampaignService,
        },
        {
          provide: InfluencerScoringService,
          useValue: mockInfluencerScoringService,
        },
        {
          provide: DashboardStatsService,
          useValue: mockDashboardStatsService,
        },
      ],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue(mockAdminAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminAuthService = module.get<AdminAuthService>(AdminAuthService);
    profileReviewService =
      module.get<ProfileReviewService>(ProfileReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('login', () => {
    const loginDto: AdminLoginDto = {
      email: 'admin@test.com',
      password: 'password123',
    };

    it('should login admin successfully', async () => {
      const mockLoginResult = {
        accessToken: 'jwt-token',
        admin: {
          id: 1,
          email: 'admin@test.com',
          firstName: 'Admin',
          lastName: 'User',
          role: AdminRole.SUPER_ADMIN,
          status: AdminStatus.ACTIVE,
        },
      };

      mockAdminAuthService.login.mockResolvedValue(mockLoginResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockLoginResult);
      expect(adminAuthService.login).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const error = new UnauthorizedException('Invalid credentials');
      mockAdminAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      mockAdminAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('createAdmin', () => {
    const createAdminDto: CreateAdminDto = {
      email: 'newadmin@test.com',
      password: 'password123',
      name: 'Admin',
      role: AdminRole.CONTENT_MODERATOR,
    };

    it('should create admin successfully', async () => {
      const mockCreatedAdmin = {
        id: 2,
        email: 'newadmin@test.com',
        firstName: 'New',
        lastName: 'Admin',
        role: AdminRole.CONTENT_MODERATOR,
        status: AdminStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockAdminAuthService.createAdmin.mockResolvedValue(mockCreatedAdmin);

      const result = await controller.createAdmin(createAdminDto);

      expect(result).toEqual(mockCreatedAdmin);
      expect(adminAuthService.createAdmin).toHaveBeenCalledWith(createAdminDto);
    });

    it('should throw BadRequestException for duplicate email', async () => {
      const error = new BadRequestException(
        'Admin with this email already exists',
      );
      mockAdminAuthService.createAdmin.mockRejectedValue(error);

      await expect(controller.createAdmin(createAdminDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle validation errors', async () => {
      const invalidDto = {
        ...createAdminDto,
        email: 'invalid-email',
      };

      const error = new BadRequestException('Invalid email format');
      mockAdminAuthService.createAdmin.mockRejectedValue(error);

      await expect(controller.createAdmin(invalidDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPendingProfiles', () => {
    it('should return pending profile reviews with pagination', async () => {
      const mockPendingReviews = [
        {
          id: 1,
          profileId: 1,
          profileType: ProfileType.BRAND,
          status: ReviewStatus.PENDING,
          submittedAt: new Date(),
          submittedData: {
            brandName: 'Test Brand',
            brandBio: 'Test bio',
          },
        },
        {
          id: 2,
          profileId: 2,
          profileType: ProfileType.INFLUENCER,
          status: ReviewStatus.PENDING,
          submittedAt: new Date(),
          submittedData: {
            name: 'Test Influencer',
            bio: 'Test bio',
          },
        },
      ];

      mockProfileReviewService.getPendingProfiles.mockResolvedValue(
        mockPendingReviews,
      );

      const result = await controller.getPendingProfiles(
        {
          admin: { id: 1 },
        } as any,
        {} as any,
      );

      expect(result).toEqual(mockPendingReviews);
      expect(profileReviewService.getPendingProfiles).toHaveBeenCalledWith(
        1,
        undefined,
      );
    });

    it('should handle request without pagination', async () => {
      mockProfileReviewService.getPendingProfiles.mockResolvedValue([]);

      await controller.getPendingProfiles(
        { admin: { id: 1 } } as any,
        {} as any,
      );

      expect(profileReviewService.getPendingProfiles).toHaveBeenCalledWith(
        1,
        undefined,
      );
    });

    it('should extract admin ID from request', async () => {
      mockProfileReviewService.getPendingProfiles.mockResolvedValue([]);

      await controller.getPendingProfiles(
        { admin: { id: 3 } } as any,
        {} as any,
      );

      expect(profileReviewService.getPendingProfiles).toHaveBeenCalledWith(
        3,
        undefined,
      );
    });
  });

  describe('approveProfile', () => {
    const mockReq = {
      admin: {
        id: 1,
        email: 'admin@test.com',
        role: AdminRole.SUPER_ADMIN,
      },
    };

    const approveDto: ApproveProfileDto = {
      comments: 'Profile approved',
    };

    it('should approve profile successfully', async () => {
      const mockApproveResult = {
        message: 'Profile approved successfully',
        review: {
          id: 1,
          profileId: 1,
          status: ReviewStatus.APPROVED,
          adminComments: 'Profile approved',
          reviewedBy: 1,
          reviewedAt: new Date(),
        },
      };

      mockProfileReviewService.approveProfile.mockResolvedValue(
        mockApproveResult,
      );

      const result = await controller.approveProfile(
        1,
        mockReq as any,
        approveDto,
      );

      expect(result).toEqual(mockApproveResult);
      expect(profileReviewService.approveProfile).toHaveBeenCalledWith(
        1,
        1,
        'Profile approved',
      );
    });

    it('should throw NotFoundException for non-existent review', async () => {
      const error = new NotFoundException('Profile review not found');
      mockProfileReviewService.approveProfile.mockRejectedValue(error);

      await expect(
        controller.approveProfile(999, mockReq as any, approveDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectProfile', () => {
    const mockReq = {
      admin: {
        id: 1,
        email: 'admin@test.com',
        role: AdminRole.SUPER_ADMIN,
      },
    };

    const rejectDto: RejectProfileDto = {
      reason: 'Missing required documents',
      comments: 'Please provide valid ID proof',
    };

    it('should reject profile successfully', async () => {
      const mockRejectResult = {
        message: 'Profile rejected successfully',
        review: {
          id: 1,
          profileId: 1,
          status: ReviewStatus.REJECTED,
          rejectionReason: 'Missing required documents',
          adminComments: 'Please provide valid ID proof',
          reviewedBy: 1,
          reviewedAt: new Date(),
        },
      };

      mockProfileReviewService.rejectProfile.mockResolvedValue(
        mockRejectResult,
      );

      const result = await controller.rejectProfile(
        1,
        mockReq as any,
        rejectDto,
      );

      expect(result).toEqual(mockRejectResult);
      expect(profileReviewService.rejectProfile).toHaveBeenCalledWith(
        1,
        1,
        'Missing required documents',
        'Please provide valid ID proof',
      );
    });

    it('should throw NotFoundException for non-existent review', async () => {
      const error = new NotFoundException('Profile review not found');
      mockProfileReviewService.rejectProfile.mockRejectedValue(error);

      await expect(
        controller.rejectProfile(999, mockReq as any, rejectDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboardStats', () => {
    it('should return review statistics', async () => {
      const mockStats = {
        pending: 15,
        approved: 50,
        rejected: 5,
        total: 70,
      };

      mockProfileReviewService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(mockStats);
      expect(profileReviewService.getDashboardStats).toHaveBeenCalledTimes(1);
    });

    it('should handle zero statistics', async () => {
      const mockStats = {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };

      mockProfileReviewService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(mockStats);
    });

    it('should handle service errors', async () => {
      const error = new Error('Database query failed');
      mockProfileReviewService.getDashboardStats.mockRejectedValue(error);

      await expect(controller.getDashboardStats()).rejects.toThrow(
        'Database query failed',
      );
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require admin authentication for all routes', () => {
      expect(mockAdminAuthGuard.canActivate).toBeDefined();
    });

    it('should check roles for restricted endpoints', () => {
      expect(mockRolesGuard.canActivate).toBeDefined();
    });

    it('should extract admin ID from request correctly', async () => {
      const mockReq = {
        admin: {
          id: 123,
          email: 'admin@test.com',
          role: AdminRole.SUPER_ADMIN,
        },
      };

      const approveDto: ApproveProfileDto = {
        comments: 'Good',
      };

      mockProfileReviewService.approveProfile.mockResolvedValue({
        message: 'Success',
        review: {},
      });

      await controller.approveProfile(1, mockReq as any, approveDto);

      expect(profileReviewService.approveProfile).toHaveBeenCalledWith(
        1,
        123,
        'Good',
      );
    });
  });

  describe('Parameter Validation and Conversion', () => {
    it('should parse integer parameters correctly', async () => {
      mockProfileReviewService.approveProfile.mockResolvedValue({
        message: 'Success',
        review: {},
      });

      const mockReq = { admin: { id: 1 } };

      await controller.approveProfile(456, mockReq as any, {
        comments: 'Approved',
      });

      expect(profileReviewService.approveProfile).toHaveBeenCalledWith(
        456,
        1,
        'Approved',
      );
    });

    it('should handle different admin IDs', async () => {
      mockProfileReviewService.getPendingProfiles.mockResolvedValue([]);

      await controller.getPendingProfiles(
        { admin: { id: 2 } } as any,
        {} as any,
      );

      expect(profileReviewService.getPendingProfiles).toHaveBeenCalledWith(
        2,
        undefined,
      );
    });

    it('should handle invalid number strings gracefully', async () => {
      mockProfileReviewService.getPendingProfiles.mockResolvedValue([]);

      await controller.getPendingProfiles(
        { admin: { id: 1 } } as any,
        {} as any,
      );

      // Should extract admin ID from request
      expect(profileReviewService.getPendingProfiles).toHaveBeenCalledWith(
        1,
        undefined,
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate all service errors', async () => {
      const serviceError = new Error('Service unavailable');
      mockAdminAuthService.login.mockRejectedValue(serviceError);

      await expect(
        controller.login({
          email: 'test@test.com',
          password: 'password',
        }),
      ).rejects.toThrow('Service unavailable');
    });

    it('should handle concurrent operations gracefully', async () => {
      mockProfileReviewService.getPendingProfiles.mockResolvedValue([]);

      const promises = [
        controller.getPendingProfiles({ admin: { id: 1 } } as any, {} as any),
        controller.getPendingProfiles({ admin: { id: 1 } } as any, {} as any),
        controller.getPendingProfiles({ admin: { id: 1 } } as any, {} as any),
      ];

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toEqual([]);
      });

      expect(profileReviewService.getPendingProfiles).toHaveBeenCalledTimes(3);
    });
  });

  describe('Campaign Admin APIs', () => {
    describe('getCampaigns', () => {
      it('should return campaigns with filters', async () => {
        const requestDto = {
          campaignFilter: CampaignFilter.ACTIVE_CAMPAIGNS,
          page: 1,
          limit: 20,
        };

        const mockResponse = {
          campaigns: [
            {
              id: 1,
              name: 'Test Campaign',
              status: 'active',
              applicationsCount: 10,
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        };

        mockAdminCampaignService.getCampaigns.mockResolvedValue(mockResponse);

        const result = await controller.getCampaigns(requestDto as any);

        expect(result).toEqual(mockResponse);
        expect(mockAdminCampaignService.getCampaigns).toHaveBeenCalledWith(
          requestDto,
        );
      });

      it('should handle search and filter combinations', async () => {
        const requestDto = {
          campaignFilter: CampaignFilter.ALL_CAMPAIGNS,
          searchQuery: 'Fashion',
          brandSearch: 'Nike',
          locationSearch: 'Mumbai',
          nicheSearch: 'Fashion',
          campaignType: 'paid' as any,
          sortBy: CampaignSortBy.APPLICATIONS,
          page: 1,
          limit: 20,
        };

        const mockResponse = {
          campaigns: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        };

        mockAdminCampaignService.getCampaigns.mockResolvedValue(mockResponse);

        const result = await controller.getCampaigns(requestDto as any);

        expect(mockAdminCampaignService.getCampaigns).toHaveBeenCalledWith(
          requestDto,
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getCampaignDashboardStats', () => {
      it('should return campaign dashboard stats with default timeframe', async () => {
        const requestDto = {
          timeFrame: DashboardTimeFrame.LAST_7_DAYS,
        };

        const mockResponse = {
          campaignMetrics: {
            totalCampaigns: { count: 100, percentageChange: 10 },
            campaignsLive: { count: 50, percentageChange: 5 },
            campaignsCompleted: { count: 40, percentageChange: -2 },
            totalCampaignApplications: 500,
          },
          totalCityPresence: 25,
          citiesWithMostActiveCampaigns: [
            { cityName: 'Mumbai', percentage: 30 },
            { cityName: 'Delhi', percentage: 25 },
          ],
          campaignPostedVsApplications: {
            currentVerifiedProfileApplicants: 300,
            currentUnverifiedProfileApplicants: 200,
            timeSeriesData: [],
          },
          campaignCategoryDistribution: [
            { categoryName: 'Fashion', campaignCount: 40, percentage: 40 },
          ],
        };

        mockDashboardStatsService.getCampaignDashboardStats.mockResolvedValue(
          mockResponse,
        );

        const result = await controller.getCampaignDashboardStats(
          requestDto as any,
        );

        expect(result).toEqual(mockResponse);
        expect(
          mockDashboardStatsService.getCampaignDashboardStats,
        ).toHaveBeenCalledWith(
          DashboardTimeFrame.LAST_7_DAYS,
          undefined,
          undefined,
          undefined,
          undefined,
        );
      });

      it('should handle custom date range', async () => {
        const requestDto = {
          chartTimeFrame: DashboardTimeFrame.CUSTOM,
          chartStartDate: '2025-01-01',
          chartEndDate: '2025-01-31',
          metricsStartDate: '2025-01-01',
          metricsEndDate: '2025-01-31',
        };

        const mockResponse = {
          campaignMetrics: {
            totalCampaigns: { count: 50, percentageChange: 0 },
            campaignsLive: { count: 25, percentageChange: 0 },
            campaignsCompleted: { count: 20, percentageChange: 0 },
            totalCampaignApplications: 250,
          },
          totalCityPresence: 15,
          citiesWithMostActiveCampaigns: [],
          campaignPostedVsApplications: {
            currentVerifiedProfileApplicants: 150,
            currentUnverifiedProfileApplicants: 100,
            timeSeriesData: [],
          },
          campaignCategoryDistribution: [],
        };

        mockDashboardStatsService.getCampaignDashboardStats.mockResolvedValue(
          mockResponse,
        );

        const result = await controller.getCampaignDashboardStats(
          requestDto as any,
        );

        expect(result).toEqual(mockResponse);
        expect(
          mockDashboardStatsService.getCampaignDashboardStats,
        ).toHaveBeenCalledWith(
          DashboardTimeFrame.CUSTOM,
          '2025-01-01',
          '2025-01-31',
          '2025-01-01',
          '2025-01-31',
        );
      });

      it('should handle last_15_days timeframe', async () => {
        const requestDto = {
          chartTimeFrame: DashboardTimeFrame.LAST_15_DAYS,
        };

        const mockResponse = {
          campaignMetrics: {
            totalCampaigns: { count: 75, percentageChange: 5 },
            campaignsLive: { count: 35, percentageChange: 3 },
            campaignsCompleted: { count: 30, percentageChange: -1 },
            totalCampaignApplications: 375,
          },
          totalCityPresence: 20,
          citiesWithMostActiveCampaigns: [],
          campaignPostedVsApplications: {
            currentVerifiedProfileApplicants: 225,
            currentUnverifiedProfileApplicants: 150,
            timeSeriesData: [],
          },
          campaignCategoryDistribution: [],
        };

        mockDashboardStatsService.getCampaignDashboardStats.mockResolvedValue(
          mockResponse,
        );

        const result = await controller.getCampaignDashboardStats(
          requestDto as any,
        );

        expect(result).toEqual(mockResponse);
        expect(
          mockDashboardStatsService.getCampaignDashboardStats,
        ).toHaveBeenCalledWith(
          DashboardTimeFrame.LAST_15_DAYS,
          undefined,
          undefined,
          undefined,
          undefined,
        );
      });
    });
  });
});
