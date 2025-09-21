import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { getModelToken } from '@nestjs/sequelize';
import { Post, UserType } from './models/post.model';
import { Like, LikerType } from './models/like.model';
import { Follow, FollowerType, FollowingType } from './models/follow.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FollowDto, FollowUserType } from './dto/follow.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

const mockModel = () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
});

const mockPostModel = {
  ...mockModel(),
  findAndCountAll: jest.fn(),
};

const mockLikeModel = {
  ...mockModel(),
};

const mockFollowModel = {
  ...mockModel(),
};

const mockInfluencerModel = {
  ...mockModel(),
};

const mockBrandModel = {
  ...mockModel(),
};

const mockInfluencerNiche = {
  findAll: jest.fn(),
};

const mockBrandNiche = {
  findAll: jest.fn(),
};

describe('PostService', () => {
  let service: PostService;
  let postModel: any;
  let likeModel: any;
  let followModel: any;
  let influencerModel: any;
  let brandModel: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getModelToken(Post),
          useValue: mockPostModel,
        },
        {
          provide: getModelToken(Like),
          useValue: mockLikeModel,
        },
        {
          provide: getModelToken(Follow),
          useValue: mockFollowModel,
        },
        {
          provide: getModelToken(Influencer),
          useValue: mockInfluencerModel,
        },
        {
          provide: getModelToken(Brand),
          useValue: mockBrandModel,
        },
        {
          provide: 'InfluencerNicheRepository',
          useValue: mockInfluencerNiche,
        },
        {
          provide: 'BrandNicheRepository',
          useValue: mockBrandNiche,
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    postModel = module.get(getModelToken(Post));
    likeModel = module.get(getModelToken(Like));
    followModel = module.get(getModelToken(Follow));
    influencerModel = module.get(getModelToken(Influencer));
    brandModel = module.get(getModelToken(Brand));

    // Mock InfluencerNiche and BrandNiche static methods
    (InfluencerNiche as any).findAll = mockInfluencerNiche.findAll;
    (BrandNiche as any).findAll = mockBrandNiche.findAll;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createPost', () => {
    it('should create a post for influencer', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Test post content',
        mediaUrls: ['https://example.com/image.jpg'],
      };

      const mockPost = {
        id: 1,
        content: 'Test post content',
        mediaUrls: ['https://example.com/image.jpg'],
        userType: UserType.INFLUENCER,
        influencerId: 1,
        brandId: null,
        isActive: true,
        likesCount: 0,
      };

      postModel.create.mockResolvedValue(mockPost);

      const result = await service.createPost(
        createPostDto,
        UserType.INFLUENCER,
        1,
      );

      expect(result).toEqual(mockPost);
      expect(postModel.create).toHaveBeenCalledWith({
        content: 'Test post content',
        mediaUrls: ['https://example.com/image.jpg'],
        userType: UserType.INFLUENCER,
        influencerId: 1,
      });
    });

    it('should create a post for brand', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Brand post content',
        mediaUrls: [],
      };

      const mockPost = {
        id: 2,
        content: 'Brand post content',
        mediaUrls: [],
        userType: UserType.BRAND,
        influencerId: null,
        brandId: 1,
        isActive: true,
        likesCount: 0,
      };

      postModel.create.mockResolvedValue(mockPost);

      const result = await service.createPost(createPostDto, UserType.BRAND, 1);

      expect(result).toEqual(mockPost);
      expect(postModel.create).toHaveBeenCalledWith({
        content: 'Brand post content',
        mediaUrls: [],
        userType: UserType.BRAND,
        brandId: 1,
      });
    });
  });

  describe('updatePost', () => {
    it('should update a post by owner', async () => {
      const updatePostDto: UpdatePostDto = {
        content: 'Updated content',
      };

      const mockPost = {
        id: 1,
        content: 'Original content',
        userType: UserType.INFLUENCER,
        influencerId: 1,
        brandId: null,
        update: jest.fn().mockResolvedValue(true),
      };

      postModel.findByPk.mockResolvedValue(mockPost);

      await service.updatePost(1, updatePostDto, UserType.INFLUENCER, 1);

      expect(postModel.findByPk).toHaveBeenCalledWith(1);
      expect(mockPost.update).toHaveBeenCalledWith(updatePostDto);
    });

    it('should throw NotFoundException for non-existent post', async () => {
      const updatePostDto: UpdatePostDto = {
        content: 'Updated content',
      };

      postModel.findByPk.mockResolvedValue(null);

      await expect(
        service.updatePost(999, updatePostDto, UserType.INFLUENCER, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      const updatePostDto: UpdatePostDto = {
        content: 'Updated content',
      };

      const mockPost = {
        id: 1,
        userType: UserType.INFLUENCER,
        influencerId: 2, // Different user
        brandId: null,
      };

      postModel.findByPk.mockResolvedValue(mockPost);

      await expect(
        service.updatePost(1, updatePostDto, UserType.INFLUENCER, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deletePost', () => {
    it('should soft delete a post by owner', async () => {
      const mockPost = {
        id: 1,
        userType: UserType.INFLUENCER,
        influencerId: 1,
        brandId: null,
        update: jest.fn().mockResolvedValue(true),
      };

      postModel.findByPk.mockResolvedValue(mockPost);

      await service.deletePost(1, UserType.INFLUENCER, 1);

      expect(mockPost.update).toHaveBeenCalledWith({ isActive: false });
    });

    it('should throw NotFoundException for non-existent post', async () => {
      postModel.findByPk.mockResolvedValue(null);

      await expect(
        service.deletePost(999, UserType.INFLUENCER, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner', async () => {
      const mockPost = {
        id: 1,
        userType: UserType.INFLUENCER,
        influencerId: 2, // Different user
        brandId: null,
      };

      postModel.findByPk.mockResolvedValue(mockPost);

      await expect(
        service.deletePost(1, UserType.INFLUENCER, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('likePost', () => {
    it('should like a post when not already liked', async () => {
      const mockPost = {
        id: 1,
        increment: jest.fn().mockResolvedValue(true),
      };

      postModel.findByPk.mockResolvedValue(mockPost);
      likeModel.findOne.mockResolvedValue(null); // Not already liked
      likeModel.create.mockResolvedValue({ id: 1 });

      const result = await service.likePost(1, UserType.INFLUENCER, 1);

      expect(result).toEqual({ liked: true });
      expect(likeModel.create).toHaveBeenCalledWith({
        postId: 1,
        likerType: LikerType.INFLUENCER,
        likerInfluencerId: 1,
      });
      expect(mockPost.increment).toHaveBeenCalledWith('likesCount');
    });

    it('should unlike a post when already liked', async () => {
      const mockPost = {
        id: 1,
        decrement: jest.fn().mockResolvedValue(true),
      };

      const mockLike = {
        id: 1,
        destroy: jest.fn().mockResolvedValue(true),
      };

      postModel.findByPk.mockResolvedValue(mockPost);
      likeModel.findOne.mockResolvedValue(mockLike); // Already liked

      const result = await service.likePost(1, UserType.INFLUENCER, 1);

      expect(result).toEqual({ liked: false });
      expect(mockLike.destroy).toHaveBeenCalled();
      expect(mockPost.decrement).toHaveBeenCalledWith('likesCount');
    });

    it('should throw NotFoundException for non-existent post', async () => {
      postModel.findByPk.mockResolvedValue(null);

      await expect(
        service.likePost(999, UserType.INFLUENCER, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('followUser', () => {
    it('should follow a user when not already following', async () => {
      const followDto: FollowDto = {
        userType: FollowUserType.BRAND,
        userId: 2,
      };

      followModel.findOne.mockResolvedValue(null); // Not already following
      followModel.create.mockResolvedValue({ id: 1 });

      const result = await service.followUser(
        followDto,
        UserType.INFLUENCER,
        1,
      );

      expect(result).toEqual({ followed: true });
      expect(followModel.create).toHaveBeenCalledWith({
        followerType: FollowerType.INFLUENCER,
        followingType: FollowingType.BRAND,
        followerInfluencerId: 1,
        followingBrandId: 2,
      });
    });

    it('should unfollow a user when already following', async () => {
      const followDto: FollowDto = {
        userType: FollowUserType.BRAND,
        userId: 2,
      };

      const mockFollow = {
        id: 1,
        destroy: jest.fn().mockResolvedValue(true),
      };

      followModel.findOne.mockResolvedValue(mockFollow); // Already following

      const result = await service.followUser(
        followDto,
        UserType.INFLUENCER,
        1,
      );

      expect(result).toEqual({ followed: false });
      expect(mockFollow.destroy).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to follow self', async () => {
      const followDto: FollowDto = {
        userType: FollowUserType.INFLUENCER,
        userId: 1, // Same as current user
      };

      await expect(
        service.followUser(followDto, UserType.INFLUENCER, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPosts', () => {
    it('should return posts with pagination', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
      };

      const mockPosts = [
        {
          id: 1,
          content: 'Test post 1',
          userType: UserType.INFLUENCER,
          influencerId: 1,
          likesCount: 5,
        },
        {
          id: 2,
          content: 'Test post 2',
          userType: UserType.BRAND,
          brandId: 1,
          likesCount: 3,
        },
      ];

      // Mock getUserNiches, getFollowingUsers, and getRelevantUserIds
      mockInfluencerNiche.findAll.mockResolvedValue([
        { nicheId: 1 },
        { nicheId: 2 },
      ]);
      followModel.findAll.mockResolvedValue([
        {
          followingType: FollowingType.BRAND,
          followingBrandId: 1,
          followingInfluencerId: null,
        },
      ]);
      mockBrandNiche.findAll.mockResolvedValue([{ brandId: 1 }]);

      postModel.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockPosts,
      });

      const result = await service.getPosts(
        getPostsDto,
        UserType.INFLUENCER,
        1,
      );

      expect(result).toEqual({
        posts: mockPosts,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return posts for specific user', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
        userType: 'influencer',
        userId: 1,
      };

      const mockPosts = [
        {
          id: 1,
          content: 'Influencer post',
          userType: UserType.INFLUENCER,
          influencerId: 1,
        },
      ];

      postModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: mockPosts,
      });

      const result = await service.getPosts(getPostsDto);

      expect(result.posts).toEqual(mockPosts);
      expect(postModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            influencerId: 1,
            userType: UserType.INFLUENCER,
            isActive: true,
          }),
        }),
      );
    });
  });

  describe('getPostById', () => {
    it('should return a post by ID', async () => {
      const mockPost = {
        id: 1,
        content: 'Test post',
        userType: UserType.INFLUENCER,
        influencerId: 1,
        isActive: true,
      };

      postModel.findOne.mockResolvedValue(mockPost);

      const result = await service.getPostById(1);

      expect(result).toEqual(mockPost);
      expect(postModel.findOne).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
        include: expect.any(Array),
      });
    });

    it('should throw NotFoundException for non-existent post', async () => {
      postModel.findOne.mockResolvedValue(null);

      await expect(service.getPostById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Private Methods', () => {
    describe('getUserNiches', () => {
      it('should return influencer niches', async () => {
        mockInfluencerNiche.findAll.mockResolvedValue([
          { nicheId: 1 },
          { nicheId: 2 },
        ]);

        const result = await service['getUserNiches'](UserType.INFLUENCER, 1);

        expect(result).toEqual([1, 2]);
        expect(mockInfluencerNiche.findAll).toHaveBeenCalledWith({
          where: { influencerId: 1 },
          attributes: ['nicheId'],
        });
      });

      it('should return brand niches', async () => {
        mockBrandNiche.findAll.mockResolvedValue([
          { nicheId: 3 },
          { nicheId: 4 },
        ]);

        const result = await service['getUserNiches'](UserType.BRAND, 1);

        expect(result).toEqual([3, 4]);
        expect(mockBrandNiche.findAll).toHaveBeenCalledWith({
          where: { brandId: 1 },
          attributes: ['nicheId'],
        });
      });
    });

    describe('getFollowingUsers', () => {
      it('should return following users for influencer', async () => {
        followModel.findAll.mockResolvedValue([
          {
            followingType: FollowingType.BRAND,
            followingInfluencerId: null,
            followingBrandId: 1,
          },
          {
            followingType: FollowingType.INFLUENCER,
            followingInfluencerId: 2,
            followingBrandId: null,
          },
        ]);

        const result = await service['getFollowingUsers'](
          UserType.INFLUENCER,
          1,
        );

        expect(result).toEqual({
          influencerIds: [2],
          brandIds: [1],
        });
      });
    });

    describe('getRelevantUserIds', () => {
      it('should return relevant user IDs based on niches and follows', async () => {
        mockInfluencerNiche.findAll.mockResolvedValue([
          { influencerId: 3 },
          { influencerId: 4 },
        ]);
        mockBrandNiche.findAll.mockResolvedValue([{ brandId: 2 }]);

        const followingUsers = {
          influencerIds: [1],
          brandIds: [1],
        };

        const result = await service['getRelevantUserIds'](
          [1, 2],
          followingUsers,
        );

        expect(result.influencerIds).toContain(1);
        expect(result.influencerIds).toContain(3);
        expect(result.influencerIds).toContain(4);
        expect(result.brandIds).toContain(1);
        expect(result.brandIds).toContain(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in createPost', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Test post',
      };

      postModel.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createPost(createPostDto, UserType.INFLUENCER, 1),
      ).rejects.toThrow('Database error');
    });

    it('should handle database errors gracefully in getPosts', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
      };

      postModel.findAndCountAll.mockRejectedValue(new Error('Database error'));

      await expect(
        service.getPosts(getPostsDto, UserType.INFLUENCER, 1),
      ).rejects.toThrow('Database error');
    });
  });
});
