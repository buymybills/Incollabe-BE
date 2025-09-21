import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FollowDto, FollowUserType } from './dto/follow.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { UserType } from './models/post.model';
import { User } from '../types/request.types';

const mockPostService = {
  createPost: jest.fn(),
  updatePost: jest.fn(),
  deletePost: jest.fn(),
  likePost: jest.fn(),
  followUser: jest.fn(),
  getPosts: jest.fn(),
  getPostById: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};

describe('PostController', () => {
  let controller: PostController;
  let postService: PostService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mockPostService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<PostController>(PostController);
    postService = module.get<PostService>(PostService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('createPost', () => {
    it('should create a post for influencer', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Test post content',
        mediaUrls: ['https://example.com/image.jpg'],
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockPost = {
        id: 1,
        content: 'Test post content',
        mediaUrls: ['https://example.com/image.jpg'],
        userType: UserType.INFLUENCER,
        influencerId: 1,
        isActive: true,
        likesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostService.createPost.mockResolvedValue(mockPost);

      const result = await controller.createPost(createPostDto, mockUser);

      expect(result).toEqual(mockPost);
      expect(postService.createPost).toHaveBeenCalledWith(
        createPostDto,
        UserType.INFLUENCER,
        1,
      );
    });

    it('should create a post for brand', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Brand post content',
      };

      const mockUser: User = {
        id: 2,
        email: 'test@brand.com',
        userType: 'brand',
        profileCompleted: true,
      };

      const mockPost = {
        id: 2,
        content: 'Brand post content',
        userType: UserType.BRAND,
        brandId: 2,
        isActive: true,
        likesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPostService.createPost.mockResolvedValue(mockPost);

      const result = await controller.createPost(createPostDto, mockUser);

      expect(result).toEqual(mockPost);
      expect(postService.createPost).toHaveBeenCalledWith(
        createPostDto,
        UserType.BRAND,
        2,
      );
    });
  });

  describe('getPosts', () => {
    it('should get posts feed for user', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockResponse = {
        posts: [
          {
            id: 1,
            content: 'Test post',
            userType: UserType.INFLUENCER,
            influencerId: 1,
            likesCount: 5,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockPostService.getPosts.mockResolvedValue(mockResponse);

      const result = await controller.getPosts(getPostsDto, mockUser);

      expect(result).toEqual(mockResponse);
      expect(postService.getPosts).toHaveBeenCalledWith(
        getPostsDto,
        UserType.INFLUENCER,
        1,
      );
    });
  });

  describe('getPostById', () => {
    it('should get a specific post by ID', async () => {
      const mockPost = {
        id: 1,
        content: 'Test post',
        userType: UserType.INFLUENCER,
        influencerId: 1,
        isActive: true,
        likesCount: 5,
      };

      mockPostService.getPostById.mockResolvedValue(mockPost);

      const result = await controller.getPostById(1);

      expect(result).toEqual(mockPost);
      expect(postService.getPostById).toHaveBeenCalledWith(1);
    });
  });

  describe('updatePost', () => {
    it('should update a post', async () => {
      const updatePostDto: UpdatePostDto = {
        content: 'Updated content',
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockUpdatedPost = {
        id: 1,
        content: 'Updated content',
        userType: UserType.INFLUENCER,
        influencerId: 1,
        isActive: true,
        likesCount: 0,
      };

      mockPostService.updatePost.mockResolvedValue(mockUpdatedPost);

      const result = await controller.updatePost(1, updatePostDto, mockUser);

      expect(result).toEqual(mockUpdatedPost);
      expect(postService.updatePost).toHaveBeenCalledWith(
        1,
        updatePostDto,
        UserType.INFLUENCER,
        1,
      );
    });
  });

  describe('deletePost', () => {
    it('should delete a post', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      mockPostService.deletePost.mockResolvedValue(undefined);

      const result = await controller.deletePost(1, mockUser);

      expect(result).toEqual({ message: 'Post deleted successfully' });
      expect(postService.deletePost).toHaveBeenCalledWith(
        1,
        UserType.INFLUENCER,
        1,
      );
    });
  });

  describe('likePost', () => {
    it('should like a post', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockResponse = { liked: true };

      mockPostService.likePost.mockResolvedValue(mockResponse);

      const result = await controller.likePost(1, mockUser);

      expect(result).toEqual(mockResponse);
      expect(postService.likePost).toHaveBeenCalledWith(
        1,
        UserType.INFLUENCER,
        1,
      );
    });

    it('should unlike a post', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockResponse = { liked: false };

      mockPostService.likePost.mockResolvedValue(mockResponse);

      const result = await controller.likePost(1, mockUser);

      expect(result).toEqual(mockResponse);
      expect(postService.likePost).toHaveBeenCalledWith(
        1,
        UserType.INFLUENCER,
        1,
      );
    });
  });

  describe('followUser', () => {
    it('should follow a user', async () => {
      const followDto: FollowDto = {
        userType: FollowUserType.BRAND,
        userId: 2,
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockResponse = { followed: true };

      mockPostService.followUser.mockResolvedValue(mockResponse);

      const result = await controller.followUser(followDto, mockUser);

      expect(result).toEqual(mockResponse);
      expect(postService.followUser).toHaveBeenCalledWith(
        followDto,
        UserType.INFLUENCER,
        1,
      );
    });

    it('should unfollow a user', async () => {
      const followDto: FollowDto = {
        userType: FollowUserType.BRAND,
        userId: 2,
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const mockResponse = { followed: false };

      mockPostService.followUser.mockResolvedValue(mockResponse);

      const result = await controller.followUser(followDto, mockUser);

      expect(result).toEqual(mockResponse);
      expect(postService.followUser).toHaveBeenCalledWith(
        followDto,
        UserType.INFLUENCER,
        1,
      );
    });
  });

  describe('getUserPosts', () => {
    it('should get posts by specific user', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
      };

      const mockResponse = {
        posts: [
          {
            id: 1,
            content: 'User specific post',
            userType: UserType.INFLUENCER,
            influencerId: 1,
            likesCount: 3,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockPostService.getPosts.mockResolvedValue(mockResponse);

      const result = await controller.getUserPosts(
        'influencer',
        1,
        getPostsDto,
      );

      expect(result).toEqual(mockResponse);
      expect(postService.getPosts).toHaveBeenCalledWith({
        ...getPostsDto,
        userType: 'influencer',
        userId: 1,
      });
    });
  });

  describe('User Type Conversion', () => {
    it('should convert influencer userType correctly', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Test post',
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      mockPostService.createPost.mockResolvedValue({});

      await controller.createPost(createPostDto, mockUser);

      expect(postService.createPost).toHaveBeenCalledWith(
        createPostDto,
        UserType.INFLUENCER,
        1,
      );
    });

    it('should convert brand userType correctly', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Test post',
      };

      const mockUser: User = {
        id: 1,
        email: 'test@brand.com',
        userType: 'brand',
        profileCompleted: true,
      };

      mockPostService.createPost.mockResolvedValue({});

      await controller.createPost(createPostDto, mockUser);

      expect(postService.createPost).toHaveBeenCalledWith(
        createPostDto,
        UserType.BRAND,
        1,
      );
    });
  });

  describe('Parameter Validation', () => {
    it('should parse ID parameter correctly', async () => {
      const mockPost = {
        id: 123,
        content: 'Test post',
      };

      mockPostService.getPostById.mockResolvedValue(mockPost);

      await controller.getPostById(123);

      expect(postService.getPostById).toHaveBeenCalledWith(123);
    });

    it('should handle string parameters in getUserPosts', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
      };

      mockPostService.getPosts.mockResolvedValue({
        posts: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      await controller.getUserPosts('brand', 456, getPostsDto);

      expect(postService.getPosts).toHaveBeenCalledWith({
        ...getPostsDto,
        userType: 'brand',
        userId: 456,
      });
    });
  });

  describe('Error Propagation', () => {
    it('should propagate service errors in createPost', async () => {
      const createPostDto: CreatePostDto = {
        content: 'Test post',
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const error = new Error('Service error');
      mockPostService.createPost.mockRejectedValue(error);

      await expect(
        controller.createPost(createPostDto, mockUser),
      ).rejects.toThrow('Service error');
    });

    it('should propagate service errors in updatePost', async () => {
      const updatePostDto: UpdatePostDto = {
        content: 'Updated content',
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const error = new Error('Update failed');
      mockPostService.updatePost.mockRejectedValue(error);

      await expect(
        controller.updatePost(1, updatePostDto, mockUser),
      ).rejects.toThrow('Update failed');
    });

    it('should propagate service errors in deletePost', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const error = new Error('Delete failed');
      mockPostService.deletePost.mockRejectedValue(error);

      await expect(controller.deletePost(1, mockUser)).rejects.toThrow(
        'Delete failed',
      );
    });

    it('should propagate service errors in likePost', async () => {
      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const error = new Error('Like failed');
      mockPostService.likePost.mockRejectedValue(error);

      await expect(controller.likePost(1, mockUser)).rejects.toThrow(
        'Like failed',
      );
    });

    it('should propagate service errors in followUser', async () => {
      const followDto: FollowDto = {
        userType: FollowUserType.BRAND,
        userId: 2,
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const error = new Error('Follow failed');
      mockPostService.followUser.mockRejectedValue(error);

      await expect(controller.followUser(followDto, mockUser)).rejects.toThrow(
        'Follow failed',
      );
    });

    it('should propagate service errors in getPosts', async () => {
      const getPostsDto: GetPostsDto = {
        page: 1,
        limit: 10,
      };

      const mockUser: User = {
        id: 1,
        email: 'test@influencer.com',
        userType: 'influencer',
        profileCompleted: true,
      };

      const error = new Error('Get posts failed');
      mockPostService.getPosts.mockRejectedValue(error);

      await expect(controller.getPosts(getPostsDto, mockUser)).rejects.toThrow(
        'Get posts failed',
      );
    });

    it('should propagate service errors in getPostById', async () => {
      const error = new Error('Get post failed');
      mockPostService.getPostById.mockRejectedValue(error);

      await expect(controller.getPostById(1)).rejects.toThrow(
        'Get post failed',
      );
    });
  });
});
