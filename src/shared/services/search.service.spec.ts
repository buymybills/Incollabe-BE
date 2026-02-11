import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { SearchService } from './search.service';
import { Brand } from '../../brand/model/brand.model';
import { Influencer } from '../../auth/model/influencer.model';
import { UserType } from '../dto/search-users.dto';

const mockModel = () => ({
  findOne: jest.fn(),
  findAndCountAll: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
});

describe('SearchService', () => {
  let service: SearchService;
  let brandModel: any;
  let influencerModel: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getModelToken(Brand),
          useValue: mockModel(),
        },
        {
          provide: getModelToken(Influencer),
          useValue: mockModel(),
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    brandModel = module.get(getModelToken(Brand));
    influencerModel = module.get(getModelToken(Influencer));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('searchUsers', () => {
    it('should search and return influencers only', async () => {
      const mockInfluencers = [
        {
          id: 1,
          name: 'Test Influencer',
          username: 'testinfluencer',
          profileImage: 'https://example.com/image.jpg',
          cityId: 1,
          gender: 'male',
          bio: 'Test bio',
          isVerified: true,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            name: 'Test Influencer',
            username: 'testinfluencer',
            profileImage: 'https://example.com/image.jpg',
            cityId: 1,
            gender: 'male',
            bio: 'Test bio',
            isVerified: true,
          }),
        },
      ];

      influencerModel.findAndCountAll.mockResolvedValue({
        rows: mockInfluencers,
        count: 1,
      });

      const result = await service.searchUsers({
        search: 'test',
        type: UserType.INFLUENCER,
        page: 1,
        limit: 20,
      });

      expect(result.influencers).toHaveLength(1);
      expect(result.influencers[0].userType).toBe('influencer');
      expect(result.brands).toHaveLength(0);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isProfileCompleted: true,
          }),
          limit: 20,
          offset: 0,
          distinct: true,
        }),
      );
    });

    it('should search and return brands only', async () => {
      const mockBrands = [
        {
          id: 1,
          brandName: 'Test Brand',
          username: 'testbrand',
          profileImage: 'https://example.com/brand.jpg',
          headquarterCityId: 1,
          brandBio: 'Test brand bio',
          isVerified: true,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            brandName: 'Test Brand',
            username: 'testbrand',
            profileImage: 'https://example.com/brand.jpg',
            headquarterCityId: 1,
            brandBio: 'Test brand bio',
            isVerified: true,
          }),
        },
      ];

      brandModel.findAndCountAll.mockResolvedValue({
        rows: mockBrands,
        count: 1,
      });

      const result = await service.searchUsers({
        search: 'test',
        type: UserType.BRAND,
        page: 1,
        limit: 20,
      });

      expect(result.brands).toHaveLength(1);
      expect(result.brands[0].userType).toBe('brand');
      expect(result.influencers).toHaveLength(0);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(brandModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isProfileCompleted: true,
          }),
          limit: 20,
          offset: 0,
          distinct: true,
        }),
      );
    });

    it('should search and return both influencers and brands', async () => {
      const mockInfluencers = [
        {
          id: 1,
          name: 'Test Influencer',
          username: 'testinfluencer',
          profileImage: 'https://example.com/image.jpg',
          cityId: 1,
          gender: 'male',
          bio: 'Test bio',
          isVerified: true,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            name: 'Test Influencer',
            username: 'testinfluencer',
            profileImage: 'https://example.com/image.jpg',
            cityId: 1,
            gender: 'male',
            bio: 'Test bio',
            isVerified: true,
          }),
        },
      ];

      const mockBrands = [
        {
          id: 1,
          brandName: 'Test Brand',
          username: 'testbrand',
          profileImage: 'https://example.com/brand.jpg',
          headquarterCityId: 1,
          brandBio: 'Test brand bio',
          isVerified: true,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            brandName: 'Test Brand',
            username: 'testbrand',
            profileImage: 'https://example.com/brand.jpg',
            headquarterCityId: 1,
            brandBio: 'Test brand bio',
            isVerified: true,
          }),
        },
      ];

      influencerModel.findAndCountAll.mockResolvedValue({
        rows: mockInfluencers,
        count: 1,
      });

      brandModel.findAndCountAll.mockResolvedValue({
        rows: mockBrands,
        count: 1,
      });

      const result = await service.searchUsers({
        search: 'test',
        type: UserType.ALL,
        page: 1,
        limit: 20,
      });

      expect(result.influencers).toHaveLength(1);
      expect(result.brands).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(influencerModel.findAndCountAll).toHaveBeenCalled();
      expect(brandModel.findAndCountAll).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const mockInfluencers = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Influencer ${i + 1}`,
        username: `influencer${i + 1}`,
        profileImage: null,
        cityId: 1,
        gender: 'male',
        bio: null,
        isVerified: false,
        toJSON: jest.fn().mockReturnValue({
          id: i + 1,
          name: `Influencer ${i + 1}`,
          username: `influencer${i + 1}`,
          profileImage: null,
          cityId: 1,
          gender: 'male',
          bio: null,
          isVerified: false,
        }),
      }));

      influencerModel.findAndCountAll.mockResolvedValue({
        rows: mockInfluencers,
        count: 50,
      });

      const result = await service.searchUsers({
        search: 'influencer',
        type: UserType.INFLUENCER,
        page: 2,
        limit: 10,
      });

      expect(result.influencers).toHaveLength(10);
      expect(result.total).toBe(50);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10, // (page 2 - 1) * 10 = 10
        }),
      );
    });

    it('should return empty results when no matches found', async () => {
      influencerModel.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      brandModel.findAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      const result = await service.searchUsers({
        search: 'nonexistent',
        type: UserType.ALL,
        page: 1,
        limit: 20,
      });

      expect(result.influencers).toHaveLength(0);
      expect(result.brands).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should search without search term', async () => {
      const mockInfluencers = [
        {
          id: 1,
          name: 'Test Influencer',
          username: 'testinfluencer',
          profileImage: null,
          cityId: 1,
          gender: 'male',
          bio: null,
          isVerified: false,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            name: 'Test Influencer',
            username: 'testinfluencer',
            profileImage: null,
            cityId: 1,
            gender: 'male',
            bio: null,
            isVerified: false,
          }),
        },
      ];

      influencerModel.findAndCountAll.mockResolvedValue({
        rows: mockInfluencers,
        count: 1,
      });

      const result = await service.searchUsers({
        type: UserType.INFLUENCER,
        page: 1,
        limit: 20,
      });

      expect(result.influencers).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isProfileCompleted: true,
          }),
        }),
      );
    });

    it('should use default values for page and limit', async () => {
      const mockInfluencers = [
        {
          id: 1,
          name: 'Test Influencer',
          username: 'testinfluencer',
          profileImage: null,
          cityId: 1,
          gender: 'male',
          bio: null,
          isVerified: false,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            name: 'Test Influencer',
            username: 'testinfluencer',
            profileImage: null,
            cityId: 1,
            gender: 'male',
            bio: null,
            isVerified: false,
          }),
        },
      ];

      influencerModel.findAndCountAll.mockResolvedValue({
        rows: mockInfluencers,
        count: 1,
      });

      const result = await service.searchUsers({
        search: 'test',
        type: UserType.INFLUENCER,
      });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(influencerModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 0,
        }),
      );
    });

    it('should search brands by brandName', async () => {
      const mockBrands = [
        {
          id: 1,
          brandName: 'Nike',
          username: 'nike_official',
          profileImage: 'https://example.com/nike.jpg',
          headquarterCityId: 1,
          brandBio: 'Just Do It',
          isVerified: true,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            brandName: 'Nike',
            username: 'nike_official',
            profileImage: 'https://example.com/nike.jpg',
            headquarterCityId: 1,
            brandBio: 'Just Do It',
            isVerified: true,
          }),
        },
      ];

      brandModel.findAndCountAll.mockResolvedValue({
        rows: mockBrands,
        count: 1,
      });

      const result = await service.searchUsers({
        search: 'Nike',
        type: UserType.BRAND,
        page: 1,
        limit: 20,
      });

      expect(result.brands).toHaveLength(1);
      expect(result.brands[0].brandName).toBe('Nike');
      expect(brandModel.findAndCountAll).toHaveBeenCalled();
    });

    it('should search influencers by name or username', async () => {
      const mockInfluencers = [
        {
          id: 1,
          name: 'John Doe',
          username: 'johndoe',
          profileImage: 'https://example.com/john.jpg',
          cityId: 1,
          gender: 'male',
          bio: 'Fitness influencer',
          isVerified: true,
          toJSON: jest.fn().mockReturnValue({
            id: 1,
            name: 'John Doe',
            username: 'johndoe',
            profileImage: 'https://example.com/john.jpg',
            cityId: 1,
            gender: 'male',
            bio: 'Fitness influencer',
            isVerified: true,
          }),
        },
      ];

      influencerModel.findAndCountAll.mockResolvedValue({
        rows: mockInfluencers,
        count: 1,
      });

      const result = await service.searchUsers({
        search: 'John',
        type: UserType.INFLUENCER,
        page: 1,
        limit: 20,
      });

      expect(result.influencers).toHaveLength(1);
      expect(result.influencers[0].name).toBe('John Doe');
      expect(influencerModel.findAndCountAll).toHaveBeenCalled();
    });
  });
});
