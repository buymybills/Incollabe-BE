import { Test, TestingModule } from '@nestjs/testing';
import { AdminCampaignService } from './admin-campaign.service';
import { AIScoringService } from './ai-scoring.service';
import { getModelToken } from '@nestjs/sequelize';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
} from '../../campaign/models/campaign.model';
import {
  CampaignApplication,
  ApplicationStatus,
} from '../../campaign/models/campaign-application.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Niche } from '../../auth/model/niche.model';
import { CampaignCity } from '../../campaign/models/campaign-city.model';
import { City } from '../../shared/models/city.model';
import { Brand } from '../../brand/model/brand.model';
import { Experience } from '../../influencer/models/experience.model';
import { Follow } from '../../post/models/follow.model';
import { Post } from '../../post/models/post.model';
import { Op } from 'sequelize';

describe('AdminCampaignService', () => {
  let service: AdminCampaignService;
  let campaignModel: any;
  let campaignApplicationModel: any;
  let nicheModel: any;
  let campaignCityModel: any;

  const mockCampaignModel = {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  };

  const mockCampaignApplicationModel = {
    count: jest.fn(),
    findAll: jest.fn(),
  };

  const mockNicheModel = {
    findAll: jest.fn(),
  };

  const mockCampaignCityModel = {
    findAll: jest.fn(),
  };

  const mockInfluencerModel = {
    findAll: jest.fn(),
  };

  const mockExperienceModel = {
    findAll: jest.fn(),
  };

  const mockFollowModel = {
    count: jest.fn(),
  };

  const mockPostModel = {
    findAll: jest.fn(),
  };

  const mockAIScoringService = {
    scoreInfluencerForCampaign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCampaignService,
        {
          provide: getModelToken(Campaign),
          useValue: mockCampaignModel,
        },
        {
          provide: getModelToken(CampaignApplication),
          useValue: mockCampaignApplicationModel,
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
          provide: getModelToken(CampaignCity),
          useValue: mockCampaignCityModel,
        },
        {
          provide: getModelToken(Experience),
          useValue: mockExperienceModel,
        },
        {
          provide: getModelToken(Follow),
          useValue: mockFollowModel,
        },
        {
          provide: getModelToken(Post),
          useValue: mockPostModel,
        },
        {
          provide: AIScoringService,
          useValue: mockAIScoringService,
        },
      ],
    }).compile();

    service = module.get<AdminCampaignService>(AdminCampaignService);
    campaignModel = module.get(getModelToken(Campaign));
    campaignApplicationModel = module.get(getModelToken(CampaignApplication));
    nicheModel = module.get(getModelToken(Niche));
    campaignCityModel = module.get(getModelToken(CampaignCity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCampaigns', () => {
    const mockBrand = {
      id: 1,
      brandName: 'Test Brand',
      username: 'testbrand',
    };

    const mockCity = {
      id: 1,
      name: 'Mumbai',
      city: { id: 1, name: 'Mumbai' },
    };

    const mockCampaign = {
      id: 1,
      name: 'Test Campaign',
      description: 'Test Description',
      type: CampaignType.PAID,
      status: CampaignStatus.ACTIVE,
      category: 'Fashion',
      isInviteOnly: false,
      isPanIndia: false,
      nicheIds: [1, 2],
      createdAt: new Date('2025-10-15'),
      brand: mockBrand,
      cities: [mockCity],
    };

    it('should return all campaigns when filter is allCampaigns', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(5);
      mockNicheModel.findAll.mockResolvedValue([
        { id: 1, name: 'Fashion' },
        { id: 2, name: 'Lifestyle' },
      ]);

      const result = await service.getCampaigns(filters);

      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].name).toBe('Test Campaign');
      expect(result.campaigns[0].niches).toEqual(['Fashion', 'Lifestyle']);
      expect(result.campaigns[0].cities).toEqual(['Mumbai']);
      expect(result.campaigns[0].applicationsCount).toBe(5);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter campaigns by status when statusFilter is provided', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        statusFilter: CampaignStatus.ACTIVE,
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(3);
      mockNicheModel.findAll.mockResolvedValue([{ id: 1, name: 'Fashion' }]);

      await service.getCampaigns(filters);

      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CampaignStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should filter campaigns by type when campaignType is provided', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        campaignType: 'paid',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);
      mockNicheModel.findAll.mockResolvedValue([]);

      await service.getCampaigns(filters);

      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'paid',
          }),
        }),
      );
    });

    it('should search campaigns by name', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        searchQuery: 'Test',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);
      mockNicheModel.findAll.mockResolvedValue([]);

      await service.getCampaigns(filters);

      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({
              [Op.iLike]: '%Test%',
            }),
          }),
        }),
      );
    });

    it('should filter campaigns by brand search', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        brandSearch: 'Test Brand',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);
      mockNicheModel.findAll.mockResolvedValue([]);

      await service.getCampaigns(filters);

      const callArgs = mockCampaignModel.findAndCountAll.mock.calls[0][0];
      const brandInclude = callArgs.include[0];

      expect(brandInclude.where).toBeDefined();
      expect(brandInclude.required).toBe(true);
    });

    it('should filter campaigns by location search', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        locationSearch: 'Mumbai',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);
      mockNicheModel.findAll.mockResolvedValue([]);

      await service.getCampaigns(filters);

      const callArgs = mockCampaignModel.findAndCountAll.mock.calls[0][0];
      const cityInclude = callArgs.include[1];

      expect(cityInclude.include[0].where).toBeDefined();
      expect(cityInclude.required).toBe(true);
    });

    it('should sort campaigns by applications count', async () => {
      const campaign1 = {
        ...mockCampaign,
        id: 1,
        name: 'Campaign 1',
        nicheIds: [],
        cities: [],
      };
      const campaign2 = {
        ...mockCampaign,
        id: 2,
        name: 'Campaign 2',
        nicheIds: [],
        cities: [],
      };

      const filters = {
        campaignFilter: 'allCampaigns',
        sortBy: 'applications',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [campaign1, campaign2],
        count: 2,
      });

      // Mock count to return different values for different campaigns
      const countCallIndex = 0;
      mockCampaignApplicationModel.count.mockImplementation(({ where }) => {
        if (where.campaignId === 1) {
          return Promise.resolve(where.status ? 0 : 10); // 10 applications, 0 selected
        } else {
          return Promise.resolve(where.status ? 0 : 5); // 5 applications, 0 selected
        }
      });

      const result = await service.getCampaigns(filters);

      // Should be sorted by applications count (highest first)
      expect(result.campaigns).toHaveLength(2);
      expect(result.campaigns[0].id).toBe(1);
      expect(result.campaigns[0].applicationsCount).toBe(10);
      expect(result.campaigns[1].id).toBe(2);
      expect(result.campaigns[1].applicationsCount).toBe(5);
    });

    it('should handle pagination correctly', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        page: 2,
        limit: 10,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 25,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);
      mockNicheModel.findAll.mockResolvedValue([]);

      const result = await service.getCampaigns(filters);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10,
        }),
      );
    });

    it('should count selected applications correctly', async () => {
      const filters = {
        campaignFilter: 'allCampaigns',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count
        .mockResolvedValueOnce(10) // total applications
        .mockResolvedValueOnce(3); // selected applications

      mockNicheModel.findAll.mockResolvedValue([]);

      const result = await service.getCampaigns(filters);

      expect(result.campaigns[0].applicationsCount).toBe(10);
      expect(result.campaigns[0].selectedCount).toBe(3);
      expect(mockCampaignApplicationModel.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ApplicationStatus.SELECTED,
          }),
        }),
      );
    });

    it('should handle campaigns with no niches', async () => {
      const campaignWithoutNiches = {
        ...mockCampaign,
        nicheIds: null,
      };

      const filters = {
        campaignFilter: 'allCampaigns',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [campaignWithoutNiches],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);

      const result = await service.getCampaigns(filters);

      expect(result.campaigns[0].niches).toEqual([]);
    });

    it('should handle campaigns with no cities', async () => {
      const campaignWithoutCities = {
        ...mockCampaign,
        cities: [],
      };

      const filters = {
        campaignFilter: 'allCampaigns',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [campaignWithoutCities],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(0);
      mockNicheModel.findAll.mockResolvedValue([]);

      const result = await service.getCampaigns(filters);

      expect(result.campaigns[0].cities).toEqual([]);
    });

    it('should apply all status filters correctly via statusFilter', async () => {
      const testCases = [
        {
          statusFilter: CampaignStatus.DRAFT,
          expectedStatus: CampaignStatus.DRAFT,
        },
        {
          statusFilter: CampaignStatus.COMPLETED,
          expectedStatus: CampaignStatus.COMPLETED,
        },
        {
          statusFilter: CampaignStatus.PAUSED,
          expectedStatus: CampaignStatus.PAUSED,
        },
        {
          statusFilter: CampaignStatus.CANCELLED,
          expectedStatus: CampaignStatus.CANCELLED,
        },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        mockCampaignModel.findAndCountAll.mockResolvedValue({
          rows: [],
          count: 0,
        });

        await service.getCampaigns({
          campaignFilter: 'allCampaigns',
          statusFilter: testCase.statusFilter,
          page: 1,
          limit: 20,
        });

        expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: testCase.expectedStatus,
            }),
          }),
        );
      }
    });

    it('should filter campaigns by invite type (openCampaigns)', async () => {
      const filters = {
        campaignFilter: 'openCampaigns',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(3);
      mockNicheModel.findAll.mockResolvedValue([{ id: 1, name: 'Fashion' }]);

      await service.getCampaigns(filters);

      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isInviteOnly: false,
          }),
        }),
      );
    });

    it('should filter campaigns by invite type (inviteCampaigns)', async () => {
      const filters = {
        campaignFilter: 'inviteCampaigns',
        page: 1,
        limit: 20,
      };

      mockCampaignModel.findAndCountAll.mockResolvedValue({
        rows: [mockCampaign],
        count: 1,
      });

      mockCampaignApplicationModel.count.mockResolvedValue(3);
      mockNicheModel.findAll.mockResolvedValue([{ id: 1, name: 'Fashion' }]);

      await service.getCampaigns(filters);

      expect(mockCampaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isInviteOnly: true,
          }),
        }),
      );
    });
  });
});
