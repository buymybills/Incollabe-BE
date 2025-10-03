import { Test, TestingModule } from '@nestjs/testing';
import { CampaignService } from './campaign.service';
import { getModelToken } from '@nestjs/sequelize';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
} from './models/campaign.model';
import { CampaignCity } from './models/campaign-city.model';
import { CampaignDeliverable } from './models/campaign-deliverable.model';
import {
  CampaignInvitation,
  InvitationStatus,
} from './models/campaign-invitation.model';
import { CampaignApplication } from './models/campaign-application.model';
import { Platform, DeliverableType } from './models/campaign-deliverable.model';
import { City } from '../shared/models/city.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { WhatsAppService } from '../shared/whatsapp.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { SearchInfluencersDto } from './dto/search-influencers.dto';
import { InviteInfluencersDto } from './dto/invite-influencers.dto';
import { Follow } from '../post/models/follow.model';

const mockModel = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findAndCountAll: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  bulkCreate: jest.fn(),
  count: jest.fn(),
});

const mockWhatsAppService = {
  sendCampaignInvitation: jest.fn(),
};

describe('CampaignService', () => {
  let service: CampaignService;
  let campaignModel: any;
  let campaignCityModel: any;
  let campaignDeliverableModel: any;
  let campaignInvitationModel: any;
  let campaignApplicationModel: any;
  let cityModel: any;
  let brandModel: any;
  let influencerModel: any;
  let followModel: any;
  let whatsAppService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        {
          provide: getModelToken(Campaign),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CampaignCity),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CampaignDeliverable),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CampaignInvitation),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(CampaignApplication),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(City),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Brand),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Influencer),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Follow),
          useValue: mockModel(),
        },
        {
          provide: WhatsAppService,
          useValue: mockWhatsAppService,
        },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
    campaignModel = module.get(getModelToken(Campaign));
    campaignCityModel = module.get(getModelToken(CampaignCity));
    campaignDeliverableModel = module.get(getModelToken(CampaignDeliverable));
    campaignInvitationModel = module.get(getModelToken(CampaignInvitation));
    campaignApplicationModel = module.get(getModelToken(CampaignApplication));
    cityModel = module.get(getModelToken(City));
    brandModel = module.get(getModelToken(Brand));
    influencerModel = module.get(getModelToken(Influencer));
    followModel = module.get(getModelToken(Follow));
    whatsAppService = module.get(WhatsAppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createCampaign', () => {
    const mockCreateCampaignDto: CreateCampaignDto = {
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
    };

    it('should create a campaign successfully', async () => {
      const brandId = 1;
      const mockCampaign = {
        id: 1,
        name: 'Test Campaign',
        brandId,
        ...mockCreateCampaignDto,
      };

      cityModel.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      campaignModel.create.mockResolvedValue(mockCampaign);
      campaignCityModel.bulkCreate.mockResolvedValue([]);
      campaignDeliverableModel.bulkCreate.mockResolvedValue([]);

      // Mock getCampaignById call
      campaignModel.findOne.mockResolvedValue({
        ...mockCampaign,
        brand: { id: brandId, brandName: 'Test Brand' },
        cities: [],
        deliverables: [],
        invitations: [],
        toJSON: jest.fn().mockReturnValue({
          id: 1,
          name: 'Test Campaign',
          brandId,
          ...mockCreateCampaignDto,
          brand: { id: brandId, brandName: 'Test Brand' },
          cities: [],
          deliverables: [],
          invitations: [],
        }),
      });

      const result = await service.createCampaign(
        mockCreateCampaignDto,
        brandId,
      );

      expect(cityModel.findAll).toHaveBeenCalledWith({
        where: { id: { [Op.in]: [1, 2] } },
      });
      expect(campaignModel.create).toHaveBeenCalledWith({
        name: 'Test Campaign',
        description: 'Test Description',
        type: CampaignType.PAID,
        isPanIndia: false,
        isOpenToAllGenders: true,
        brandId,
      });
      expect(campaignCityModel.bulkCreate).toHaveBeenCalled();
      expect(campaignDeliverableModel.bulkCreate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if cities are invalid for non-pan-India campaign', async () => {
      const brandId = 1;
      const invalidDto = {
        ...mockCreateCampaignDto,
        isPanIndia: false,
        cityIds: [],
      };

      await expect(service.createCampaign(invalidDto, brandId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createCampaign(invalidDto, brandId)).rejects.toThrow(
        'At least one city must be selected for non-pan-India campaigns',
      );
    });

    it('should throw BadRequestException if some cities do not exist', async () => {
      const brandId = 1;

      cityModel.findAll.mockResolvedValue([{ id: 1 }]); // Only one city exists

      await expect(
        service.createCampaign(mockCreateCampaignDto, brandId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createCampaign(mockCreateCampaignDto, brandId),
      ).rejects.toThrow('One or more cities are invalid');
    });
  });

  describe('getCampaigns', () => {
    it('should return paginated campaigns', async () => {
      const getCampaignsDto: GetCampaignsDto = {
        page: 1,
        limit: 10,
      };
      const brandId = 1;

      const mockCampaigns = [
        {
          id: 1,
          name: 'Campaign 1',
          brandId,
          brand: { id: brandId, brandName: 'Test Brand' },
          cities: [],
          deliverables: [],
        },
      ];

      campaignModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockCampaigns,
      });

      const result = await service.getCampaigns(getCampaignsDto, brandId);

      expect(result).toEqual({
        campaigns: mockCampaigns,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(campaignModel.findAndCountAll).toHaveBeenCalledWith({
        where: { isActive: true, brandId },
        include: expect.any(Array),
        order: [['createdAt', 'DESC']],
        limit: 10,
        offset: 0,
        distinct: true,
      });
    });

    it('should filter campaigns by status', async () => {
      const getCampaignsDto: GetCampaignsDto = {
        page: 1,
        limit: 10,
        status: CampaignStatus.ACTIVE,
      };

      campaignModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await service.getCampaigns(getCampaignsDto);

      expect(campaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CampaignStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should filter campaigns by search term', async () => {
      const getCampaignsDto: GetCampaignsDto = {
        page: 1,
        limit: 10,
        search: 'test',
      };

      campaignModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await service.getCampaigns(getCampaignsDto);

      expect(campaignModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: [
              { name: { [Op.iLike]: '%test%' } },
              { description: { [Op.iLike]: '%test%' } },
            ],
          }),
        }),
      );
    });
  });

  describe('getCampaignById', () => {
    it('should return campaign by id', async () => {
      const campaignId = 1;
      const mockCampaign = {
        id: campaignId,
        name: 'Test Campaign',
        brand: { id: 1, brandName: 'Test Brand' },
        cities: [],
        deliverables: [],
        invitations: [],
        toJSON: jest.fn().mockReturnValue({
          id: campaignId,
          name: 'Test Campaign',
          brand: { id: 1, brandName: 'Test Brand' },
          cities: [],
          deliverables: [],
          invitations: [],
        }),
      };

      campaignModel.findOne.mockResolvedValue(mockCampaign);

      const result = await service.getCampaignById(campaignId);

      expect(result).toEqual({
        id: campaignId,
        name: 'Test Campaign',
        brand: { id: 1, brandName: 'Test Brand' },
        cities: [],
        deliverables: [],
        invitations: [],
      });
      expect(campaignModel.findOne).toHaveBeenCalledWith({
        where: { id: campaignId, isActive: true },
        include: expect.any(Array),
      });
    });

    it('should throw NotFoundException if campaign not found', async () => {
      const campaignId = 999;

      campaignModel.findOne.mockResolvedValue(null);

      await expect(service.getCampaignById(campaignId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getCampaignById(campaignId)).rejects.toThrow(
        'Campaign not found',
      );
    });
  });

  describe('updateCampaignStatus', () => {
    it('should update campaign status successfully', async () => {
      const campaignId = 1;
      const brandId = 1;
      const newStatus = CampaignStatus.ACTIVE;

      const mockCampaign = {
        id: campaignId,
        brandId,
        status: CampaignStatus.DRAFT,
        update: jest.fn().mockResolvedValue({}),
      };

      campaignModel.findOne.mockResolvedValue(mockCampaign);
      campaignModel.findOne
        .mockResolvedValueOnce(mockCampaign)
        .mockResolvedValueOnce({
          ...mockCampaign,
          status: newStatus,
          brand: { id: brandId, brandName: 'Test Brand' },
          cities: [],
          deliverables: [],
          invitations: [],
          toJSON: jest.fn().mockReturnValue({
            id: campaignId,
            brandId,
            status: newStatus,
            brand: { id: brandId, brandName: 'Test Brand' },
            cities: [],
            deliverables: [],
            invitations: [],
          }),
        });

      const result = await service.updateCampaignStatus(
        campaignId,
        newStatus,
        brandId,
      );

      expect(mockCampaign.update).toHaveBeenCalledWith({ status: newStatus });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if campaign not found', async () => {
      const campaignId = 999;
      const brandId = 1;
      const newStatus = CampaignStatus.ACTIVE;

      campaignModel.findOne.mockResolvedValue(null);

      await expect(
        service.updateCampaignStatus(campaignId, newStatus, brandId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCampaign', () => {
    it('should soft delete campaign successfully', async () => {
      const campaignId = 1;
      const brandId = 1;

      const mockCampaign = {
        id: campaignId,
        brandId,
        status: CampaignStatus.DRAFT,
        update: jest.fn().mockResolvedValue({}),
      };

      campaignModel.findOne.mockResolvedValue(mockCampaign);

      await service.deleteCampaign(campaignId, brandId);

      expect(mockCampaign.update).toHaveBeenCalledWith({ isActive: false });
    });

    it('should throw BadRequestException if trying to delete active campaign', async () => {
      const campaignId = 1;
      const brandId = 1;

      const mockCampaign = {
        id: campaignId,
        brandId,
        status: CampaignStatus.ACTIVE,
      };

      campaignModel.findOne.mockResolvedValue(mockCampaign);

      await expect(service.deleteCampaign(campaignId, brandId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deleteCampaign(campaignId, brandId)).rejects.toThrow(
        'Cannot delete an active campaign',
      );
    });
  });

  describe('getPopularCities', () => {
    it('should return popular cities for non-Indian users', async () => {
      const mockCities = [
        { id: 1, name: 'Mumbai', tier: 1 },
        { id: 2, name: 'Delhi', tier: 1 },
      ];

      cityModel.findAll.mockResolvedValue(mockCities);

      const result = await service.getPopularCities();

      expect(result).toEqual(mockCities);
      expect(cityModel.findAll).toHaveBeenCalledWith({
        where: { tier: { [Op.in]: [1, 2, 3] } },
        order: [['name', 'ASC']],
        limit: 20,
      });
    });

    it('should return only Indian tier 1 cities for Indian brands', async () => {
      const userId = 1;
      const userType = 'brand';
      const mockBrand = { headquarterCountryId: 1 }; // India
      const mockCities = [
        { id: 1, name: 'Mumbai', countryId: 1 },
        { id: 2, name: 'Delhi', countryId: 1 },
      ];

      brandModel.findByPk.mockResolvedValue(mockBrand);
      cityModel.findAll.mockResolvedValue(mockCities);

      const result = await service.getPopularCities(userId, userType);

      expect(result).toEqual(mockCities);
      expect(brandModel.findByPk).toHaveBeenCalledWith(userId, {
        attributes: ['headquarterCountryId'],
      });
      expect(cityModel.findAll).toHaveBeenCalledWith({
        where: {
          countryId: 1,
          name: {
            [Op.in]: expect.arrayContaining([
              'Mumbai',
              'Delhi',
              'Bangalore',
              'Chennai',
              'Kolkata',
            ]),
          },
        },
        order: [['name', 'ASC']],
        limit: 20,
      });
    });

    it('should return only Indian tier 1 cities for Indian influencers', async () => {
      const userId = 1;
      const userType = 'influencer';
      const mockInfluencer = { countryId: 1 }; // India
      const mockCities = [
        { id: 1, name: 'Mumbai', countryId: 1 },
        { id: 2, name: 'Delhi', countryId: 1 },
      ];

      influencerModel.findByPk.mockResolvedValue(mockInfluencer);
      cityModel.findAll.mockResolvedValue(mockCities);

      const result = await service.getPopularCities(userId, userType);

      expect(result).toEqual(mockCities);
      expect(influencerModel.findByPk).toHaveBeenCalledWith(userId, {
        attributes: ['countryId'],
      });
    });
  });

  describe('searchCities', () => {
    it('should return popular cities if query is too short', async () => {
      const mockCities = [
        { id: 1, name: 'Mumbai', tier: 1 },
        { id: 2, name: 'Delhi', tier: 1 },
      ];

      cityModel.findAll.mockResolvedValue(mockCities);

      const result = await service.searchCities('a');

      expect(result).toEqual(mockCities);
    });

    it('should search cities by name', async () => {
      const query = 'mum';
      const mockCities = [{ id: 1, name: 'Mumbai', tier: 1 }];

      cityModel.findAll.mockResolvedValue(mockCities);

      const result = await service.searchCities(query);

      expect(result).toEqual(mockCities);
      expect(cityModel.findAll).toHaveBeenCalledWith({
        where: {
          name: { [Op.iLike]: `%${query}%` },
        },
        order: [
          ['tier', 'ASC'],
          ['name', 'ASC'],
        ],
        limit: 50,
      });
    });
  });

  describe('searchInfluencers', () => {
    it('should search influencers with basic filters', async () => {
      const searchDto: SearchInfluencersDto = {
        page: 1,
        limit: 20,
      };

      const mockInfluencers = [
        {
          id: 1,
          name: 'Test Influencer',
          username: 'testinfluencer',
          isProfileCompleted: true,
          isWhatsappVerified: true,
        },
      ];

      influencerModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockInfluencers,
      });

      const result = await service.searchInfluencers(searchDto);

      expect(result).toEqual({
        influencers: mockInfluencers,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith({
        where: {
          isProfileCompleted: true,
          isWhatsappVerified: true,
        },
        include: expect.any(Array),
        attributes: expect.any(Array),
        order: [['createdAt', 'DESC']],
        limit: 20,
        offset: 0,
        distinct: true,
      });
    });

    it('should filter influencers by search term', async () => {
      const searchDto: SearchInfluencersDto = {
        search: 'test',
        page: 1,
        limit: 20,
      };

      influencerModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await service.searchInfluencers(searchDto);

      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: [
              { name: { [Op.iLike]: '%test%' } },
              { username: { [Op.iLike]: '%test%' } },
            ],
          }),
        }),
      );
    });

    it('should filter influencers by gender', async () => {
      const searchDto: SearchInfluencersDto = {
        gender: 'female',
        page: 1,
        limit: 20,
      };

      influencerModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await service.searchInfluencers(searchDto);

      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gender: 'female',
          }),
        }),
      );
    });

    it('should filter influencers by city', async () => {
      const searchDto: SearchInfluencersDto = {
        cityIds: [1, 2],
        page: 1,
        limit: 20,
      };

      influencerModel.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: [],
      });

      await service.searchInfluencers(searchDto);

      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cityId: { [Op.in]: [1, 2] },
          }),
        }),
      );
    });
  });

  describe('inviteInfluencers', () => {
    const mockInviteDto: InviteInfluencersDto = {
      campaignId: 1,
      influencerIds: [1, 2],
      personalMessage: 'Join our campaign!',
    };

    it('should invite influencers successfully', async () => {
      const brandId = 1;
      const mockCampaign = {
        id: 1,
        brandId,
        status: CampaignStatus.ACTIVE,
        name: 'Test Campaign',
        brand: { brandName: 'Test Brand' },
      };
      const mockInfluencers = [
        { id: 1, name: 'Influencer 1', whatsappNumber: '+919876543210' },
        { id: 2, name: 'Influencer 2', whatsappNumber: '+919876543211' },
      ];

      campaignModel.findOne.mockResolvedValue(mockCampaign);
      influencerModel.findAll.mockResolvedValue(mockInfluencers);
      campaignInvitationModel.findAll.mockResolvedValue([]);
      campaignInvitationModel.bulkCreate.mockResolvedValue([
        { id: 1, campaignId: 1, influencerId: 1 },
        { id: 2, campaignId: 1, influencerId: 2 },
      ]);
      whatsAppService.sendCampaignInvitation.mockResolvedValue(true);

      const result = await service.inviteInfluencers(mockInviteDto, brandId);

      expect(result.success).toBe(true);
      expect(result.invitationsSent).toBe(2);
      expect(result.message).toContain(
        'Successfully sent 2 campaign invitations',
      );
      expect(campaignInvitationModel.bulkCreate).toHaveBeenCalled();
      expect(whatsAppService.sendCampaignInvitation).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException if campaign not found', async () => {
      const brandId = 1;

      campaignModel.findOne.mockResolvedValue(null);

      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow('Campaign not found or access denied');
    });

    it('should throw BadRequestException if campaign status is invalid', async () => {
      const brandId = 1;
      const mockCampaign = {
        id: 1,
        brandId,
        status: CampaignStatus.COMPLETED,
        name: 'Test Campaign',
        brand: { brandName: 'Test Brand' },
      };

      campaignModel.findOne.mockResolvedValue(mockCampaign);

      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow('Cannot send invitations for campaigns in this status');
    });

    it('should throw BadRequestException if influencers not eligible', async () => {
      const brandId = 1;
      const mockCampaign = {
        id: 1,
        brandId,
        status: CampaignStatus.ACTIVE,
        name: 'Test Campaign',
        brand: { brandName: 'Test Brand' },
      };

      campaignModel.findOne.mockResolvedValue(mockCampaign);
      influencerModel.findAll.mockResolvedValue([{ id: 1 }]); // Only one influencer found

      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow(
        'Some influencers are not found or not eligible for invitations',
      );
    });

    it('should throw BadRequestException if all influencers already invited', async () => {
      const brandId = 1;
      const mockCampaign = {
        id: 1,
        brandId,
        status: CampaignStatus.ACTIVE,
        name: 'Test Campaign',
        brand: { brandName: 'Test Brand' },
      };
      const mockInfluencers = [
        { id: 1, name: 'Influencer 1', whatsappNumber: '+919876543210' },
        { id: 2, name: 'Influencer 2', whatsappNumber: '+919876543211' },
      ];
      const existingInvitations = [{ influencerId: 1 }, { influencerId: 2 }];

      campaignModel.findOne.mockResolvedValue(mockCampaign);
      influencerModel.findAll.mockResolvedValue(mockInfluencers);
      campaignInvitationModel.findAll.mockResolvedValue(existingInvitations);

      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.inviteInfluencers(mockInviteDto, brandId),
      ).rejects.toThrow(
        'All selected influencers have already been invited to this campaign',
      );
    });
  });

  describe('getBrandCampaigns', () => {
    it('should return campaigns for a specific brand', async () => {
      const brandId = 1;
      const mockCampaigns = [
        {
          id: 1,
          name: 'Campaign 1',
          brandId,
          deliverables: [],
          invitations: [],
        },
      ];

      campaignModel.findAll.mockResolvedValue(mockCampaigns);

      const result = await service.getBrandCampaigns(brandId);

      expect(result).toEqual(mockCampaigns);
      expect(campaignModel.findAll).toHaveBeenCalledWith({
        where: { brandId, isActive: true },
        include: expect.any(Array),
        order: [['createdAt', 'DESC']],
      });
    });
  });
});
