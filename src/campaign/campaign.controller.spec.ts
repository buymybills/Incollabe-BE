import { Test, TestingModule } from '@nestjs/testing';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../admin/guards/roles.guard';
import { CampaignStatus, CampaignType } from './models/campaign.model';
import { Platform, DeliverableType } from './models/campaign-deliverable.model';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { SearchInfluencersDto } from './dto/search-influencers.dto';
import { InviteInfluencersDto } from './dto/invite-influencers.dto';
import { RequestWithUser } from '../types/request.types';

const mockCampaignService = {
  createCampaign: jest.fn(),
  getCampaigns: jest.fn(),
  getCampaignById: jest.fn(),
  updateCampaignStatus: jest.fn(),
  deleteCampaign: jest.fn(),
  getPopularCities: jest.fn(),
  searchCities: jest.fn(),
  getBrandCampaigns: jest.fn(),
  searchInfluencers: jest.fn(),
  inviteInfluencers: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};

const mockRolesGuard = {
  canActivate: jest.fn(() => true),
};

describe('CampaignController', () => {
  let controller: CampaignController;
  let campaignService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignController],
      providers: [
        {
          provide: CampaignService,
          useValue: mockCampaignService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CampaignController>(CampaignController);
    campaignService = module.get(CampaignService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('createCampaign', () => {
    it('should create a campaign successfully', async () => {
      const createCampaignDto: CreateCampaignDto = {
        name: 'Test Campaign',
        description: 'Test Description',
        type: CampaignType.PAID,
        isPanIndia: false,
        cityIds: [1, 2],
        isOpenToAllGenders: true,
        deliverables: [
          {
            platform: Platform.INSTAGRAM,
            type: DeliverableType.INSTAGRAM_POST,
            budget: 1000,
            quantity: 1,
          },
        ],
        isOpenToAllAges: false,
      };

      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const mockCampaign = {
        id: 1,
        brandId: 1,
        ...createCampaignDto,
      };

      campaignService.createCampaign.mockResolvedValue(mockCampaign);

      const result = await controller.createCampaign(
        createCampaignDto,
        mockRequest,
      );

      expect(result).toEqual(mockCampaign);
      expect(campaignService.createCampaign).toHaveBeenCalledWith(
        createCampaignDto,
        1,
      );
    });
  });

  describe('getCampaigns', () => {
    it('should get campaigns with pagination', async () => {
      const getCampaignsDto: GetCampaignsDto = {
        page: 1,
        limit: 10,
      };

      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const mockResult = {
        campaigns: [
          {
            id: 1,
            name: 'Campaign 1',
            brandId: 1,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      campaignService.getCampaigns.mockResolvedValue(mockResult);

      const result = await controller.getCampaigns(
        getCampaignsDto,
        mockRequest,
      );

      expect(result).toEqual(mockResult);
      expect(campaignService.getCampaigns).toHaveBeenCalledWith(
        getCampaignsDto,
        1,
      );
    });

    it('should get campaigns without user (public)', async () => {
      const getCampaignsDto: GetCampaignsDto = {
        page: 1,
        limit: 10,
      };

      const mockResult = {
        campaigns: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      campaignService.getCampaigns.mockResolvedValue(mockResult);

      const result = await controller.getCampaigns(getCampaignsDto, undefined);

      expect(result).toEqual(mockResult);
      expect(campaignService.getCampaigns).toHaveBeenCalledWith(
        getCampaignsDto,
        undefined,
      );
    });
  });

  describe('getCampaignById', () => {
    it('should get campaign by id', async () => {
      const campaignId = 1;
      const mockCampaign = {
        id: campaignId,
        name: 'Test Campaign',
        brand: { id: 1, brandName: 'Test Brand' },
      };

      campaignService.getCampaignById.mockResolvedValue(mockCampaign);

      const result = await controller.getCampaignById(campaignId);

      expect(result).toEqual(mockCampaign);
      expect(campaignService.getCampaignById).toHaveBeenCalledWith(campaignId);
    });
  });

  describe('updateCampaignStatus', () => {
    it('should update campaign status', async () => {
      const campaignId = 1;
      const status = CampaignStatus.ACTIVE;
      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const mockUpdatedCampaign = {
        id: campaignId,
        status,
        brandId: 1,
      };

      campaignService.updateCampaignStatus.mockResolvedValue(
        mockUpdatedCampaign,
      );

      const result = await controller.updateCampaignStatus(
        campaignId,
        status,
        mockRequest,
      );

      expect(result).toEqual(mockUpdatedCampaign);
      expect(campaignService.updateCampaignStatus).toHaveBeenCalledWith(
        campaignId,
        status,
        1,
      );
    });
  });

  describe('deleteCampaign', () => {
    it('should delete campaign', async () => {
      const campaignId = 1;
      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      campaignService.deleteCampaign.mockResolvedValue(undefined);

      const result = await controller.deleteCampaign(campaignId, mockRequest);

      expect(result).toBeUndefined();
      expect(campaignService.deleteCampaign).toHaveBeenCalledWith(
        campaignId,
        1,
      );
    });
  });

  describe('getPopularCities', () => {
    it('should get popular cities with user context', async () => {
      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const mockCities = [
        { id: 1, name: 'Mumbai', tier: 1 },
        { id: 2, name: 'Delhi', tier: 1 },
      ];

      campaignService.getPopularCities.mockResolvedValue(mockCities);

      const result = await controller.getPopularCities(mockRequest);

      expect(result).toEqual(mockCities);
      expect(campaignService.getPopularCities).toHaveBeenCalledWith(1, 'brand');
    });

    it('should get popular cities without user context', async () => {
      const mockCities = [
        { id: 1, name: 'Mumbai', tier: 1 },
        { id: 2, name: 'Delhi', tier: 1 },
      ];

      campaignService.getPopularCities.mockResolvedValue(mockCities);

      const result = await controller.getPopularCities(undefined);

      expect(result).toEqual(mockCities);
      expect(campaignService.getPopularCities).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe('searchCities', () => {
    it('should search cities by query', async () => {
      const query = 'mum';
      const mockCities = [{ id: 1, name: 'Mumbai', tier: 1 }];

      campaignService.searchCities.mockResolvedValue(mockCities);

      const result = await controller.searchCities(query);

      expect(result).toEqual(mockCities);
      expect(campaignService.searchCities).toHaveBeenCalledWith(query);
    });
  });

  describe('getMyBrandCampaigns', () => {
    it('should get paginated brand campaigns with application count', async () => {
      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const mockResponse = {
        campaigns: [
          {
            id: 1,
            name: 'Campaign 1',
            brandId: 1,
            totalApplications: 15,
          },
        ],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      };

      campaignService.getBrandCampaigns.mockResolvedValue(mockResponse);

      const result = await controller.getMyBrandCampaigns(mockRequest, 1, 10);

      expect(result).toEqual(mockResponse);
      expect(campaignService.getBrandCampaigns).toHaveBeenCalledWith(1, 1, 10);
    });
  });

  describe('searchInfluencers', () => {
    it('should search influencers with filters', async () => {
      const searchDto: SearchInfluencersDto = {
        search: 'test',
        page: 1,
        limit: 20,
      };

      const mockResult = {
        influencers: [
          {
            id: 1,
            name: 'Test Influencer',
            username: 'testinfluencer',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      campaignService.searchInfluencers.mockResolvedValue(mockResult);

      const result = await controller.searchInfluencers(searchDto);

      expect(result).toEqual(mockResult);
      expect(campaignService.searchInfluencers).toHaveBeenCalledWith(searchDto);
    });
  });

  describe('inviteInfluencers', () => {
    it('should invite influencers to campaign', async () => {
      const inviteDto: InviteInfluencersDto = {
        campaignId: 1,
        influencerIds: [1, 2],
        personalMessage: 'Join our campaign!',
      };

      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const mockResult = {
        success: true,
        invitationsSent: 2,
        failedInvitations: [],
        message: 'Successfully sent 2 campaign invitations',
      };

      campaignService.inviteInfluencers.mockResolvedValue(mockResult);

      const result = await controller.inviteInfluencers(inviteDto, mockRequest);

      expect(result).toEqual(mockResult);
      expect(campaignService.inviteInfluencers).toHaveBeenCalledWith(
        inviteDto,
        1,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors properly', async () => {
      const createCampaignDto: CreateCampaignDto = {
        name: 'Test Campaign',
        description: 'Test Description',
        type: CampaignType.PAID,
        isPanIndia: false,
        cityIds: [1, 2],
        isOpenToAllGenders: true,
        deliverables: [
          {
            platform: Platform.INSTAGRAM,
            type: DeliverableType.INSTAGRAM_POST,
            budget: 1000,
            quantity: 1,
          },
        ],
        isOpenToAllAges: false,
      };

      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      const error = new Error('Service error');
      campaignService.createCampaign.mockRejectedValue(error);

      await expect(
        controller.createCampaign(createCampaignDto, mockRequest),
      ).rejects.toThrow('Service error');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should have proper guards configured', () => {
      const metadata = Reflect.getMetadata('__guards__', CampaignController);
      expect(metadata).toBeDefined();
    });

    it('should extract user correctly from request', async () => {
      const mockRequest: RequestWithUser = {
        user: { id: 42, userType: 'brand' },
      } as any;

      const mockCampaigns = [];
      campaignService.getBrandCampaigns.mockResolvedValue(mockCampaigns);

      await controller.getMyBrandCampaigns(mockRequest);

      expect(campaignService.getBrandCampaigns).toHaveBeenCalledWith(42, 1, 10);
    });
  });

  describe('Response Format', () => {
    it('should return cities array directly from controller', async () => {
      const mockCities = [{ id: 1, name: 'Mumbai' }];
      campaignService.getPopularCities.mockResolvedValue(mockCities);

      const result = await controller.getPopularCities(undefined);

      expect(result).toEqual(mockCities);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });

    it('should handle responses without data properly', async () => {
      const campaignId = 1;
      const mockRequest: RequestWithUser = {
        user: { id: 1, userType: 'brand' },
      } as any;

      campaignService.deleteCampaign.mockResolvedValue(undefined);

      const result = await controller.deleteCampaign(campaignId, mockRequest);

      expect(result).toBeUndefined();
    });
  });
});
