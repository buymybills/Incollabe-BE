import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize-typescript';
import { RedisService } from '../src/redis/redis.service';
import { AuthService } from '../src/auth/auth.service';
import { BrandSignupDto } from '../src/auth/dto/brand-signup.dto';
import { InfluencerSignupDto } from '../src/auth/dto/influencer-signup.dto';
import { Gender } from '../src/auth/types/gender.enum';

describe('Posts (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redisService: RedisService;
  let authService: AuthService;

  // Test data
  let brandAccessToken: string;
  let influencerAccessToken: string | undefined;
  let brandId: number;
  let influencerId: number;
  let testPostId: number;

  const testBrandData: BrandSignupDto = {
    email: 'testbrand@post.com',
    password: 'TestPassword123!',
    nicheIds: [1, 2],
  };

  const testInfluencerData: InfluencerSignupDto = {
    name: 'Test Influencer',
    username: 'test_influencer_post',
    gender: Gender.FEMALE,
    nicheIds: [1, 2],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    sequelize = moduleFixture.get<Sequelize>(Sequelize);
    redisService = moduleFixture.get<RedisService>(RedisService);
    authService = moduleFixture.get<AuthService>(AuthService);

    await app.init();
  });

  afterAll(async () => {
    // Clean up database and Redis
    if (sequelize) {
      await sequelize.close();
    }
    if (redisService) {
      // Clean up any OTP data if needed
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    if (sequelize) {
      await sequelize.sync({ force: true });
    }

    // Create test users and get auth tokens
    await setupTestUsers();
  });

  async function setupTestUsers() {
    try {
      // Create brand user
      const brandResponse = await authService.brandSignup(testBrandData);
      brandId = brandResponse.brand.id;

      // Simulate email verification for brand
      const brandLoginResponse = await authService.brandLogin({
        email: testBrandData.email,
        password: testBrandData.password,
      });

      // Get OTP from Redis and verify
      const brandOtp = await redisService.get(
        `otp:email:${testBrandData.email}`,
      );
      if (brandOtp) {
        const brandVerifyResponse = await authService.verifyBrandOtp({
          email: testBrandData.email,
          otp: brandOtp,
        });
        brandAccessToken = brandVerifyResponse.accessToken;
      }

      // Create influencer user
      // First create a verification key for the phone
      const verificationKey = 'test-verification-key';
      await redisService.set(
        `phone-verification:${verificationKey}`,
        '+919876543210',
        300,
      );

      const influencerResponse = await authService.influencerSignup(
        testInfluencerData,
        verificationKey,
      );
      if (!influencerResponse.influencer) {
        throw new Error('Failed to create influencer user');
      }
      influencerId = influencerResponse.influencer.id;
      // Note: influencerSignup doesn't return accessToken, would need separate login
      influencerAccessToken = undefined;
    } catch (error) {
      console.error('Setup test users failed:', error);
      throw error;
    }
  }

  describe('/posts (POST)', () => {
    it('should create a post for brand', async () => {
      const createPostDto = {
        content: 'This is a test post from brand',
        mediaUrls: ['https://example.com/brand-image.jpg'],
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(createPostDto.content);
      expect(response.body.mediaUrls).toEqual(createPostDto.mediaUrls);
      expect(response.body.userType).toBe('brand');
      expect(response.body.brandId).toBe(brandId);
      expect(response.body.isActive).toBe(true);
      expect(response.body.likesCount).toBe(0);

      testPostId = response.body.id;
    });

    it('should create a post for influencer', async () => {
      const createPostDto = {
        content: 'This is a test post from influencer',
        mediaUrls: [
          'https://example.com/influencer-image.jpg',
          'https://example.com/influencer-video.mp4',
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(createPostDto.content);
      expect(response.body.mediaUrls).toEqual(createPostDto.mediaUrls);
      expect(response.body.userType).toBe('influencer');
      expect(response.body.influencerId).toBe(influencerId);
      expect(response.body.isActive).toBe(true);
    });

    it('should reject post creation without authentication', async () => {
      const createPostDto = {
        content: 'This should fail',
      };

      await request(app.getHttpServer())
        .post('/posts')
        .send(createPostDto)
        .expect(401);
    });

    it('should reject post with invalid content', async () => {
      const createPostDto = {
        content: '', // Empty content
      };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(createPostDto)
        .expect(400);
    });

    it('should reject post with content too long', async () => {
      const createPostDto = {
        content: 'a'.repeat(5001), // Exceeds max length
      };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(createPostDto)
        .expect(400);
    });
  });

  describe('/posts (GET)', () => {
    beforeEach(async () => {
      // Create test posts
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Brand post for feed test',
          mediaUrls: ['https://example.com/brand-feed.jpg'],
        });

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          content: 'Influencer post for feed test',
          mediaUrls: ['https://example.com/influencer-feed.jpg'],
        });
    });

    it('should get posts feed for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.posts)).toBe(true);
      expect(response.body.posts.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.posts.length).toBe(1);
      expect(response.body.limit).toBe(1);
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer()).get('/posts').expect(401);
    });
  });

  describe('/posts/:id (GET)', () => {
    beforeEach(async () => {
      // Create a test post
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Test post for individual get',
        });
      testPostId = response.body.id;
    });

    it('should get a specific post by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testPostId);
      expect(response.body.content).toBe('Test post for individual get');
      expect(response.body.userType).toBe('brand');
    });

    it('should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .get('/posts/99999')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .expect(404);
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer())
        .get(`/posts/${testPostId}`)
        .expect(401);
    });
  });

  describe('/posts/:id (PATCH)', () => {
    beforeEach(async () => {
      // Create a test post
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Original post content',
        });
      testPostId = response.body.id;
    });

    it('should update post by owner', async () => {
      const updateDto = {
        content: 'Updated post content',
        mediaUrls: ['https://example.com/updated-image.jpg'],
      };

      const response = await request(app.getHttpServer())
        .patch(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.content).toBe(updateDto.content);
      expect(response.body.mediaUrls).toEqual(updateDto.mediaUrls);
    });

    it('should reject update by non-owner', async () => {
      const updateDto = {
        content: 'Unauthorized update attempt',
      };

      await request(app.getHttpServer())
        .patch(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send(updateDto)
        .expect(403);
    });

    it('should return 404 for non-existent post', async () => {
      const updateDto = {
        content: 'Update non-existent post',
      };

      await request(app.getHttpServer())
        .patch('/posts/99999')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(updateDto)
        .expect(404);
    });

    it('should reject unauthorized access', async () => {
      const updateDto = {
        content: 'Unauthorized update',
      };

      await request(app.getHttpServer())
        .patch(`/posts/${testPostId}`)
        .send(updateDto)
        .expect(401);
    });
  });

  describe('/posts/:id (DELETE)', () => {
    beforeEach(async () => {
      // Create a test post
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Post to be deleted',
        });
      testPostId = response.body.id;
    });

    it('should delete post by owner', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Post deleted successfully');
    });

    it('should reject delete by non-owner', async () => {
      await request(app.getHttpServer())
        .delete(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .delete('/posts/99999')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .expect(404);
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer())
        .delete(`/posts/${testPostId}`)
        .expect(401);
    });
  });

  describe('/posts/:id/like (POST)', () => {
    beforeEach(async () => {
      // Create a test post
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Post to be liked',
        });
      testPostId = response.body.id;
    });

    it('should like a post', async () => {
      const response = await request(app.getHttpServer())
        .post(`/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(200);

      expect(response.body.liked).toBe(true);
    });

    it('should unlike a previously liked post', async () => {
      // First like the post
      await request(app.getHttpServer())
        .post(`/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(200);

      // Then unlike it
      const response = await request(app.getHttpServer())
        .post(`/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(200);

      expect(response.body.liked).toBe(false);
    });

    it('should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .post('/posts/99999/like')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(404);
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer())
        .post(`/posts/${testPostId}/like`)
        .expect(401);
    });
  });

  describe('/posts/follow (POST)', () => {
    it('should follow a brand from influencer', async () => {
      const followDto = {
        userType: 'brand',
        userId: brandId,
      };

      const response = await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send(followDto)
        .expect(200);

      expect(response.body.followed).toBe(true);
    });

    it('should follow an influencer from brand', async () => {
      const followDto = {
        userType: 'influencer',
        userId: influencerId,
      };

      const response = await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(followDto)
        .expect(200);

      expect(response.body.followed).toBe(true);
    });

    it('should unfollow a previously followed user', async () => {
      const followDto = {
        userType: 'brand',
        userId: brandId,
      };

      // First follow
      await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send(followDto)
        .expect(200);

      // Then unfollow
      const response = await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send(followDto)
        .expect(200);

      expect(response.body.followed).toBe(false);
    });

    it('should reject following self', async () => {
      const followDto = {
        userType: 'brand',
        userId: brandId,
      };

      await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(followDto)
        .expect(400);
    });

    it('should validate follow DTO', async () => {
      const invalidFollowDto = {
        userType: 'invalid',
        userId: 'not-a-number',
      };

      await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send(invalidFollowDto)
        .expect(400);
    });

    it('should reject unauthorized access', async () => {
      const followDto = {
        userType: 'brand',
        userId: brandId,
      };

      await request(app.getHttpServer())
        .post('/posts/follow')
        .send(followDto)
        .expect(401);
    });
  });

  describe('/posts/user/:userType/:userId (GET)', () => {
    beforeEach(async () => {
      // Create posts for both users
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Brand specific post 1',
        });

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Brand specific post 2',
        });

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          content: 'Influencer specific post',
        });
    });

    it('should get posts by specific brand', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/user/brand/${brandId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts[0].userType).toBe('brand');
      expect(response.body.posts[0].brandId).toBe(brandId);
    });

    it('should get posts by specific influencer', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/user/influencer/${influencerId}`)
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].userType).toBe('influencer');
      expect(response.body.posts[0].influencerId).toBe(influencerId);
    });

    it('should support pagination for user posts', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/user/brand/${brandId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.limit).toBe(1);
      expect(response.body.totalPages).toBe(2);
    });

    it('should reject unauthorized access', async () => {
      await request(app.getHttpServer())
        .get(`/posts/user/brand/${brandId}`)
        .expect(401);
    });
  });

  describe('Post Feed Algorithm', () => {
    beforeEach(async () => {
      // Create posts with different like counts and timestamps
      const post1Response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content: 'Older post with likes',
        });

      const post2Response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          content: 'Newer post without likes',
        });

      // Like the older post
      await request(app.getHttpServer())
        .post(`/posts/${post1Response.body.id}/like`)
        .set('Authorization', `Bearer ${influencerAccessToken}`);
    });

    it('should order posts by creation date desc and likes desc', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.posts.length).toBeGreaterThan(1);

      // Check that posts are ordered correctly
      for (let i = 0; i < response.body.posts.length - 1; i++) {
        const current = response.body.posts[i];
        const next = response.body.posts[i + 1];

        const currentDate = new Date(current.createdAt);
        const nextDate = new Date(next.createdAt);

        // If same date, check likes count
        if (currentDate.getTime() === nextDate.getTime()) {
          expect(current.likesCount).toBeGreaterThanOrEqual(next.likesCount);
        } else {
          // Otherwise, check date order
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(
            nextDate.getTime(),
          );
        }
      }
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle empty media URLs array', async () => {
      const createPostDto = {
        content: 'Post with empty media array',
        mediaUrls: [],
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body.mediaUrls).toEqual([]);
    });

    it('should handle post without media URLs', async () => {
      const createPostDto = {
        content: 'Post without media URLs field',
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body.mediaUrls).toEqual([]);
    });

    it('should validate media URLs are strings', async () => {
      const createPostDto = {
        content: 'Post with invalid media URLs',
        mediaUrls: [123, 'valid-url'],
      };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(createPostDto)
        .expect(400);
    });
  });
});
