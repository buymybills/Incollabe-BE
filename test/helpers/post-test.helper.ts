import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RedisService } from '../../src/redis/redis.service';
import { AuthService } from '../../src/auth/auth.service';
import { BrandSignupDto } from '../../src/auth/dto/brand-signup.dto';
import { InfluencerSignupDto } from '../../src/auth/dto/influencer-signup.dto';
import { Gender } from '../../src/auth/types/gender.enum';
import { CreatePostDto } from '../../src/post/dto/create-post.dto';
import { FollowDto, FollowUserType } from '../../src/post/dto/follow.dto';

export interface TestUser {
  id: number;
  accessToken: string;
  refreshToken?: string;
  userType: 'brand' | 'influencer';
}

export interface TestPost {
  id: number;
  content: string;
  mediaUrls?: string[];
  userType: 'brand' | 'influencer';
  userId: number;
  likesCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export class PostTestHelper {
  constructor(
    private app: INestApplication,
    private redisService: RedisService,
    private authService: AuthService,
  ) {}

  /**
   * Create a test brand user with authentication
   */
  async createTestBrand(
    overrides: Partial<BrandSignupDto> = {},
  ): Promise<TestUser> {
    const phoneNumber = `987654${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
    const defaultBrandData: BrandSignupDto = {
      email: `testbrand${Date.now()}@test.com`,
      phone: `+91${phoneNumber}`,
      password: 'TestPassword123!',
      nicheIds: [1, 2],
      ...overrides,
    };

    try {
      // Request OTP for brand
      await request(this.app.getHttpServer())
        .post('/auth/brand/request-otp')
        .send({ phone: phoneNumber })
        .expect(200);

      // Get OTP from Redis
      const otp = await this.redisService.get(`otp:+91${phoneNumber}`);
      if (!otp) {
        throw new Error('Failed to get OTP for brand verification');
      }

      // Verify OTP
      await request(this.app.getHttpServer())
        .post('/auth/brand/verify-otp')
        .send({ phone: phoneNumber, otp })
        .set('device-id', 'test-device')
        .expect(200);

      // Brand signup
      const signupResponse = await request(this.app.getHttpServer())
        .post('/auth/brand/signup')
        .send(defaultBrandData)
        .expect(201);

      const brandId = signupResponse.body.brand.id;

      // Brand login to get access token
      const loginResponse = await request(this.app.getHttpServer())
        .post('/auth/brand/login')
        .send({
          email: defaultBrandData.email,
          password: defaultBrandData.password,
        })
        .set('device-id', 'test-device')
        .expect(200);

      return {
        id: brandId,
        accessToken: loginResponse.body.accessToken,
        refreshToken: loginResponse.body.refreshToken,
        userType: 'brand',
      };
    } catch (error) {
      console.error('Failed to create test brand:', error);
      throw error;
    }
  }

  /**
   * Create a test influencer user with authentication
   */
  async createTestInfluencer(
    overrides: Partial<InfluencerSignupDto> = {},
  ): Promise<TestUser> {
    const defaultInfluencerData: InfluencerSignupDto = {
      phone: `946728${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`,
      name: `Test Influencer ${Date.now()}`,
      username: `test_inf_${Date.now()}`,
      gender: Gender.FEMALE,
      nicheIds: [1, 2],
      ...overrides,
    };

    try {
      // Request OTP for influencer
      await request(this.app.getHttpServer())
        .post('/auth/influencer/request-otp')
        .send({ phone: defaultInfluencerData.phone })
        .expect(200);

      // Get OTP from Redis
      const otp = await this.redisService.get(
        `otp:+91${defaultInfluencerData.phone}`,
      );
      if (!otp) {
        throw new Error('Failed to get OTP for influencer verification');
      }

      // Verify OTP
      await request(this.app.getHttpServer())
        .post('/auth/influencer/verify-otp')
        .send({ phone: defaultInfluencerData.phone, otp })
        .set('device-id', 'test-device')
        .expect(200);

      // Signup influencer
      const signupResponse = await request(this.app.getHttpServer())
        .post('/auth/influencer/signup')
        .send(defaultInfluencerData)
        .expect(201);

      return {
        id: signupResponse.body.influencer.id,
        accessToken: signupResponse.body.accessToken,
        refreshToken: signupResponse.body.refreshToken,
        userType: 'influencer',
      };
    } catch (error) {
      console.error('Failed to create test influencer:', error);
      throw error;
    }
  }

  /**
   * Create a test post for a user
   */
  async createTestPost(
    user: TestUser,
    postData: Partial<CreatePostDto> = {},
  ): Promise<TestPost> {
    const defaultPostData: CreatePostDto = {
      content: `Test post content ${Date.now()}`,
      mediaUrls: [`https://example.com/test-image-${Date.now()}.jpg`],
      ...postData,
    };

    const response = await request(this.app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(defaultPostData)
      .expect(201);

    return response.body;
  }

  /**
   * Create multiple test posts
   */
  async createTestPosts(
    user: TestUser,
    count: number,
    postDataArray?: Partial<CreatePostDto>[],
  ): Promise<TestPost[]> {
    const posts: TestPost[] = [];

    for (let i = 0; i < count; i++) {
      const postData = postDataArray?.[i] || {
        content: `Test post ${i + 1} - ${Date.now()}`,
      };

      const post = await this.createTestPost(user, postData);
      posts.push(post);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return posts;
  }

  /**
   * Like a post
   */
  async likePost(user: TestUser, postId: number): Promise<{ liked: boolean }> {
    const response = await request(this.app.getHttpServer())
      .post(`/posts/${postId}/like`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    return response.body;
  }

  /**
   * Follow a user
   */
  async followUser(
    follower: TestUser,
    targetUser: TestUser,
  ): Promise<{ followed: boolean }> {
    const followDto: FollowDto = {
      userType:
        targetUser.userType === 'brand'
          ? FollowUserType.BRAND
          : FollowUserType.INFLUENCER,
      userId: targetUser.id,
    };

    const response = await request(this.app.getHttpServer())
      .post('/posts/follow')
      .set('Authorization', `Bearer ${follower.accessToken}`)
      .send(followDto)
      .expect(200);

    return response.body;
  }

  /**
   * Get posts feed for a user
   */
  async getPostsFeed(
    user: TestUser,
    query: any = {},
  ): Promise<{
    posts: TestPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await request(this.app.getHttpServer())
      .get('/posts')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .query({ page: 1, limit: 10, ...query })
      .expect(200);

    return response.body;
  }

  /**
   * Get posts by specific user
   */
  async getUserPosts(
    requestingUser: TestUser,
    targetUser: TestUser,
    query: any = {},
  ): Promise<{
    posts: TestPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await request(this.app.getHttpServer())
      .get(`/posts/user/${targetUser.userType}/${targetUser.id}`)
      .set('Authorization', `Bearer ${requestingUser.accessToken}`)
      .query({ page: 1, limit: 10, ...query })
      .expect(200);

    return response.body;
  }

  /**
   * Get a specific post by ID
   */
  async getPostById(user: TestUser, postId: number): Promise<TestPost> {
    const response = await request(this.app.getHttpServer())
      .get(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    return response.body;
  }

  /**
   * Update a post
   */
  async updatePost(
    user: TestUser,
    postId: number,
    updateData: any,
  ): Promise<TestPost> {
    const response = await request(this.app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send(updateData)
      .expect(200);

    return response.body;
  }

  /**
   * Delete a post
   */
  async deletePost(
    user: TestUser,
    postId: number,
  ): Promise<{ message: string }> {
    const response = await request(this.app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    return response.body;
  }

  /**
   * Create a scenario with users, follows, and posts for testing feed algorithm
   */
  async createFeedTestScenario(): Promise<{
    brand1: TestUser;
    brand2: TestUser;
    influencer1: TestUser;
    influencer2: TestUser;
    posts: TestPost[];
  }> {
    // Create users
    const brand1 = await this.createTestBrand();
    const brand2 = await this.createTestBrand();
    const influencer1 = await this.createTestInfluencer();
    const influencer2 = await this.createTestInfluencer();

    // Create follows
    await this.followUser(brand1, influencer1);
    await this.followUser(brand1, brand2);
    await this.followUser(influencer1, brand1);
    await this.followUser(influencer1, influencer2);

    // Create posts
    const posts: TestPost[] = [];

    // Brand1 posts
    posts.push(await this.createTestPost(brand1, { content: 'Brand1 post 1' }));
    posts.push(await this.createTestPost(brand1, { content: 'Brand1 post 2' }));

    // Brand2 posts
    posts.push(await this.createTestPost(brand2, { content: 'Brand2 post 1' }));

    // Influencer1 posts
    posts.push(
      await this.createTestPost(influencer1, { content: 'Influencer1 post 1' }),
    );

    // Influencer2 posts
    posts.push(
      await this.createTestPost(influencer2, { content: 'Influencer2 post 1' }),
    );

    // Add likes to some posts
    await this.likePost(influencer1, posts[0].id); // Like brand1's first post
    await this.likePost(brand2, posts[0].id); // Like brand1's first post again
    await this.likePost(brand1, posts[3].id); // Like influencer1's post

    return {
      brand1,
      brand2,
      influencer1,
      influencer2,
      posts,
    };
  }

  /**
   * Clean up test data from Redis
   */
  async cleanupRedisTestData(users: TestUser[]): Promise<void> {
    const keys: string[] = [];

    for (const user of users) {
      // Add potential Redis keys for cleanup
      keys.push(`user:${user.id}:session:*`);
      keys.push(`otp:*`);
      keys.push(`jwt:blacklist:*`);
    }

    // Clean up each key pattern
    for (const keyPattern of keys) {
      try {
        const redisClient = this.redisService.getClient();
        const keys = await redisClient.keys(keyPattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (error) {
        console.warn(
          `Failed to cleanup Redis key pattern ${keyPattern}:`,
          error,
        );
      }
    }
  }

  /**
   * Assert post structure is correct
   */
  assertPostStructure(post: any): void {
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
    expect(['brand', 'influencer']).toContain(post.userType);
    expect(typeof post.isActive).toBe('boolean');
    expect(typeof post.likesCount).toBe('number');
    expect(typeof post.createdAt).toBe('string');
    expect(typeof post.updatedAt).toBe('string');

    // Check user-specific fields
    if (post.userType === 'brand') {
      expect(post).toHaveProperty('brandId');
      expect(typeof post.brandId).toBe('number');
      expect(post.influencerId).toBeNull();
    } else {
      expect(post).toHaveProperty('influencerId');
      expect(typeof post.influencerId).toBe('number');
      expect(post.brandId).toBeNull();
    }
  }

  /**
   * Assert pagination structure is correct
   */
  assertPaginationStructure(response: any): void {
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

    // Verify each post structure
    response.posts.forEach((post: any) => {
      this.assertPostStructure(post);
    });
  }
}
