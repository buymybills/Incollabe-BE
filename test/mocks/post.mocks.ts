import { UserType } from '../../src/post/models/post.model';
import { LikerType } from '../../src/post/models/like.model';
import {
  FollowerType,
  FollowingType,
} from '../../src/post/models/follow.model';

/**
 * Mock post data for testing
 */
export const mockPosts = {
  influencerPost: {
    id: 1,
    content: 'Test influencer post content',
    mediaUrls: ['https://example.com/influencer-image.jpg'],
    userType: UserType.INFLUENCER,
    influencerId: 1,
    brandId: null,
    isActive: true,
    likesCount: 5,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  },

  brandPost: {
    id: 2,
    content: 'Test brand post content',
    mediaUrls: [
      'https://example.com/brand-image.jpg',
      'https://example.com/brand-video.mp4',
    ],
    userType: UserType.BRAND,
    influencerId: null,
    brandId: 1,
    isActive: true,
    likesCount: 3,
    createdAt: new Date('2024-01-01T11:00:00Z'),
    updatedAt: new Date('2024-01-01T11:00:00Z'),
  },

  deletedPost: {
    id: 3,
    content: 'Deleted post content',
    mediaUrls: [],
    userType: UserType.INFLUENCER,
    influencerId: 2,
    brandId: null,
    isActive: false,
    likesCount: 0,
    createdAt: new Date('2024-01-01T09:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z'),
  },
};

/**
 * Mock user data for testing
 */
export const mockUsers = {
  influencer: {
    id: 1,
    name: 'Test Influencer',
    username: 'test_influencer',
    email: 'test@influencer.com',
    phone: '+919876543210',
    profileImage: 'https://example.com/influencer-profile.jpg',
    profileHeadline: 'Test Influencer Headline',
    isActive: true,
    isVerified: true,
    isPhoneVerified: true,
    userType: 'influencer',
    profileCompleted: true,
  },

  brand: {
    id: 1,
    brandName: 'Test Brand',
    username: 'test_brand',
    email: 'test@brand.com',
    phone: '+919876543211',
    profileImage: 'https://example.com/brand-profile.jpg',
    profileHeadline: 'Test Brand Headline',
    isActive: true,
    isVerified: true,
    isPhoneVerified: true,
    userType: 'brand',
    profileCompleted: true,
  },

  secondInfluencer: {
    id: 2,
    name: 'Second Influencer',
    username: 'second_influencer',
    email: 'second@influencer.com',
    phone: '+919876543212',
    profileImage: 'https://example.com/second-influencer-profile.jpg',
    profileHeadline: 'Second Influencer Headline',
    isActive: true,
    isVerified: true,
    isPhoneVerified: true,
    userType: 'influencer',
    profileCompleted: true,
  },
};

/**
 * Mock like data for testing
 */
export const mockLikes = {
  influencerLikingBrandPost: {
    id: 1,
    postId: 2,
    likerType: LikerType.INFLUENCER,
    likerInfluencerId: 1,
    likerBrandId: null,
    createdAt: new Date('2024-01-01T11:30:00Z'),
    updatedAt: new Date('2024-01-01T11:30:00Z'),
  },

  brandLikingInfluencerPost: {
    id: 2,
    postId: 1,
    likerType: LikerType.BRAND,
    likerInfluencerId: null,
    likerBrandId: 1,
    createdAt: new Date('2024-01-01T10:30:00Z'),
    updatedAt: new Date('2024-01-01T10:30:00Z'),
  },
};

/**
 * Mock follow data for testing
 */
export const mockFollows = {
  influencerFollowingBrand: {
    id: 1,
    followerType: FollowerType.INFLUENCER,
    followerInfluencerId: 1,
    followerBrandId: null,
    followingType: FollowingType.BRAND,
    followingInfluencerId: null,
    followingBrandId: 1,
    createdAt: new Date('2024-01-01T08:00:00Z'),
    updatedAt: new Date('2024-01-01T08:00:00Z'),
  },

  brandFollowingInfluencer: {
    id: 2,
    followerType: FollowerType.BRAND,
    followerInfluencerId: null,
    followerBrandId: 1,
    followingType: FollowingType.INFLUENCER,
    followingInfluencerId: 2,
    followingBrandId: null,
    createdAt: new Date('2024-01-01T08:30:00Z'),
    updatedAt: new Date('2024-01-01T08:30:00Z'),
  },
};

/**
 * Mock niche data for testing
 */
export const mockNiches = [
  {
    id: 1,
    name: 'Fashion',
    icon: '👗',
    isActive: true,
  },
  {
    id: 2,
    name: 'Beauty',
    icon: '💄',
    isActive: true,
  },
  {
    id: 3,
    name: 'Technology',
    icon: '💻',
    isActive: true,
  },
];

/**
 * Mock influencer-niche relationships
 */
export const mockInfluencerNiches = [
  {
    influencerId: 1,
    nicheId: 1,
  },
  {
    influencerId: 1,
    nicheId: 2,
  },
  {
    influencerId: 2,
    nicheId: 2,
  },
  {
    influencerId: 2,
    nicheId: 3,
  },
];

/**
 * Mock brand-niche relationships
 */
export const mockBrandNiches = [
  {
    brandId: 1,
    nicheId: 1,
  },
  {
    brandId: 1,
    nicheId: 3,
  },
];

/**
 * Factory functions for creating mock data
 */
export class MockDataFactory {
  /**
   * Create a mock post with custom properties
   */
  static createMockPost(
    overrides: Partial<typeof mockPosts.influencerPost> = {},
  ) {
    return {
      ...mockPosts.influencerPost,
      ...overrides,
      id: overrides.id || Math.floor(Math.random() * 1000) + 100,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
    };
  }

  /**
   * Create a mock user with custom properties
   */
  static createMockUser(type: 'influencer' | 'brand', overrides: any = {}) {
    const baseUser =
      type === 'influencer' ? mockUsers.influencer : mockUsers.brand;
    return {
      ...baseUser,
      ...overrides,
      id: overrides.id || Math.floor(Math.random() * 1000) + 100,
    };
  }

  /**
   * Create a mock like with custom properties
   */
  static createMockLike(
    overrides: Partial<typeof mockLikes.influencerLikingBrandPost> = {},
  ) {
    return {
      ...mockLikes.influencerLikingBrandPost,
      ...overrides,
      id: overrides.id || Math.floor(Math.random() * 1000) + 100,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
    };
  }

  /**
   * Create a mock follow with custom properties
   */
  static createMockFollow(
    overrides: Partial<typeof mockFollows.influencerFollowingBrand> = {},
  ) {
    return {
      ...mockFollows.influencerFollowingBrand,
      ...overrides,
      id: overrides.id || Math.floor(Math.random() * 1000) + 100,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
    };
  }

  /**
   * Create multiple mock posts
   */
  static createMockPosts(count: number, basePost: any = {}) {
    return Array.from({ length: count }, (_, index) =>
      this.createMockPost({
        ...basePost,
        content: `${basePost.content || 'Test post'} ${index + 1}`,
        createdAt: new Date(Date.now() - index * 60000), // Each post 1 minute apart
      }),
    );
  }

  /**
   * Create pagination response mock
   */
  static createMockPaginationResponse(
    posts: any[],
    page: number = 1,
    limit: number = 10,
    total?: number,
  ) {
    const actualTotal = total || posts.length;
    const totalPages = Math.ceil(actualTotal / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    return {
      posts: paginatedPosts,
      total: actualTotal,
      page,
      limit,
      totalPages,
    };
  }
}

/**
 * Mock Sequelize model methods
 */
export const createMockSequelizeModel = () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
  bulkCreate: jest.fn(),
  count: jest.fn(),
  max: jest.fn(),
  min: jest.fn(),
  sum: jest.fn(),
});

/**
 * Mock model instance methods
 */
export const createMockModelInstance = (data: any = {}) => ({
  ...data,
  update: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(true),
  reload: jest.fn().mockResolvedValue(true),
  increment: jest.fn().mockResolvedValue(true),
  decrement: jest.fn().mockResolvedValue(true),
  toJSON: jest.fn().mockReturnValue(data),
});

/**
 * Common test assertions
 */
export class PostTestAssertions {
  /**
   * Assert that a post object has the correct structure
   */
  static assertPostStructure(post: any) {
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('content');
    expect(post).toHaveProperty('mediaUrls');
    expect(post).toHaveProperty('userType');
    expect(post).toHaveProperty('isActive');
    expect(post).toHaveProperty('likesCount');
    expect(post).toHaveProperty('createdAt');
    expect(post).toHaveProperty('updatedAt');

    expect(typeof post.id).toBe('number');
    expect(typeof post.content).toBe('string');
    expect(Array.isArray(post.mediaUrls)).toBe(true);
    expect(['brand', 'influencer'].includes(post.userType)).toBe(true);
    expect(typeof post.isActive).toBe('boolean');
    expect(typeof post.likesCount).toBe('number');
  }

  /**
   * Assert that a pagination response has the correct structure
   */
  static assertPaginationStructure(response: any) {
    expect(response).toHaveProperty('posts');
    expect(response).toHaveProperty('total');
    expect(response).toHaveProperty('page');
    expect(response).toHaveProperty('limit');
    expect(response).toHaveProperty('totalPages');

    expect(Array.isArray(response.posts)).toBe(true);
    expect(typeof response.total).toBe('number');
    expect(typeof response.page).toBe('number');
    expect(typeof response.limit).toBe('number');
    expect(typeof response.totalPages).toBe('number');
  }

  /**
   * Assert that posts are ordered correctly (by date desc, then by likes desc)
   */
  static assertPostsOrdering(posts: any[]) {
    for (let i = 0; i < posts.length - 1; i++) {
      const current = posts[i];
      const next = posts[i + 1];

      const currentDate = new Date(current.createdAt);
      const nextDate = new Date(next.createdAt);

      // If same date, check likes count
      if (currentDate.getTime() === nextDate.getTime()) {
        expect(current.likesCount).toBeGreaterThanOrEqual(next.likesCount);
      } else {
        // Otherwise, check date order (newer first)
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(
          nextDate.getTime(),
        );
      }
    }
  }

  /**
   * Assert that a like response has the correct structure
   */
  static assertLikeResponse(response: any) {
    expect(response).toHaveProperty('liked');
    expect(typeof response.liked).toBe('boolean');
  }

  /**
   * Assert that a follow response has the correct structure
   */
  static assertFollowResponse(response: any) {
    expect(response).toHaveProperty('followed');
    expect(typeof response.followed).toBe('boolean');
  }
}
