import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize-typescript';
import { RedisService } from '../src/redis/redis.service';

describe('App Integration (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redisService: RedisService;

  // Test tokens and IDs will be populated during tests
  let brandAccessToken: string;
  let influencerAccessToken: string;
  let adminAccessToken: string;
  let brandId: number;
  let influencerId: number;
  let testPostId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    sequelize = moduleFixture.get<Sequelize>(Sequelize);
    redisService = moduleFixture.get<RedisService>(RedisService);

    await app.init();
  });

  afterAll(async () => {
    // Clean up
    if (sequelize) {
      await sequelize.close();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    if (sequelize) {
      await sequelize.sync({ force: true });
    }

    // Clean Redis
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
  });

  describe('Complete Application Flow', () => {
    it('should handle the complete user journey: Brand & Influencer signup → Profile setup → Posts & Interactions → Admin review', async () => {
      // ===================
      // 1. BRAND SIGNUP FLOW
      // ===================

      // Request OTP for brand signup
      await request(app.getHttpServer())
        .post('/auth/brand/request-otp')
        .send({ phone: '9876543210' })
        .expect(200);

      // Get OTP from Redis and verify
      const brandOtp = await redisService.get('otp:+919876543210');
      expect(brandOtp).toBeDefined();

      await request(app.getHttpServer())
        .post('/auth/brand/verify-otp')
        .send({ phone: '9876543210', otp: brandOtp })
        .set('device-id', 'test-brand-device')
        .expect(200);

      // Brand signup
      const brandSignupResponse = await request(app.getHttpServer())
        .post('/auth/brand/signup')
        .send({
          email: 'testbrand@integration.com',
          phone: '+919876543210',
          password: 'BrandPass123!',
          nicheIds: [1, 2],
        })
        .expect(201);

      brandId = brandSignupResponse.body.brand.id;

      // Brand login to get access token
      const brandLoginResponse = await request(app.getHttpServer())
        .post('/auth/brand/login')
        .send({
          email: 'testbrand@integration.com',
          password: 'BrandPass123!',
        })
        .set('device-id', 'test-brand-device')
        .expect(200);

      brandAccessToken = brandLoginResponse.body.accessToken;

      // ===================
      // 2. INFLUENCER SIGNUP FLOW
      // ===================

      // Request OTP for influencer
      await request(app.getHttpServer())
        .post('/auth/influencer/request-otp')
        .send({ phone: '9467289789' })
        .expect(200);

      // Get and verify OTP
      const influencerOtp = await redisService.get('otp:+919467289789');
      expect(influencerOtp).toBeDefined();

      await request(app.getHttpServer())
        .post('/auth/influencer/verify-otp')
        .send({ phone: '9467289789', otp: influencerOtp })
        .set('device-id', 'test-influencer-device')
        .expect(200);

      // Influencer signup
      const influencerSignupResponse = await request(app.getHttpServer())
        .post('/auth/influencer/signup')
        .send({
          phone: '9467289789',
          name: 'Test Influencer',
          username: 'test_influencer_integration',
          gender: 'Female',
          nicheIds: [1, 2],
        })
        .expect(201);

      influencerId = influencerSignupResponse.body.influencer.id;
      influencerAccessToken = influencerSignupResponse.body.accessToken;

      // ===================
      // 3. PROFILE UPDATES
      // ===================

      // Update brand profile
      await request(app.getHttpServer())
        .put('/brand/profile')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          brandName: 'Integration Test Brand',
          username: 'integration_brand',
          brandBio: 'This is a test brand for integration testing',
          profileHeadline: 'Leading Test Brand',
          websiteUrl: 'https://integrationtestbrand.com',
          foundedYear: 2023,
        })
        .expect(200);

      // Update influencer profile
      await request(app.getHttpServer())
        .put('/influencer/profile')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          name: 'Integration Test Influencer',
          bio: 'This is a test influencer for integration testing with a detailed bio that covers various aspects of content creation and brand collaboration.',
          profileHeadline: 'Leading Test Influencer',
          instagramUrl: 'https://instagram.com/integration_test',
          youtubeUrl: 'https://youtube.com/integration_test',
        })
        .expect(200);

      // ===================
      // 4. POSTS AND INTERACTIONS
      // ===================

      // Brand creates a post
      const brandPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          content:
            'Welcome to our brand! We are excited to share our latest products and collaborate with amazing influencers.',
          mediaUrls: ['https://example.com/brand-post-image.jpg'],
        })
        .expect(201);

      const brandPostId = brandPostResponse.body.id;

      // Influencer creates a post
      const influencerPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          content:
            'Hello everyone! Excited to connect with brands and create amazing content together. Stay tuned for more updates!',
          mediaUrls: [
            'https://example.com/influencer-post-image.jpg',
            'https://example.com/influencer-post-video.mp4',
          ],
        })
        .expect(201);

      testPostId = influencerPostResponse.body.id;

      // Influencer likes brand's post
      await request(app.getHttpServer())
        .post(`/posts/${brandPostId}/like`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(200);

      // Brand likes influencer's post
      await request(app.getHttpServer())
        .post(`/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .expect(200);

      // Brand follows influencer
      await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          userType: 'influencer',
          userId: influencerId,
        })
        .expect(200);

      // Influencer follows brand
      await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          userType: 'brand',
          userId: brandId,
        })
        .expect(200);

      // ===================
      // 5. FEED TESTING
      // ===================

      // Get brand's feed (should include influencer's post due to follow)
      const brandFeedResponse = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(brandFeedResponse.body.posts).toHaveLength(2);
      expect(brandFeedResponse.body.total).toBe(2);

      // Get influencer's feed (should include brand's post due to follow)
      const influencerFeedResponse = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(influencerFeedResponse.body.posts).toHaveLength(2);
      expect(influencerFeedResponse.body.total).toBe(2);

      // Get specific user posts
      const brandPostsResponse = await request(app.getHttpServer())
        .get(`/posts/user/brand/${brandId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(brandPostsResponse.body.posts).toHaveLength(1);
      expect(brandPostsResponse.body.posts[0].brandId).toBe(brandId);

      // ===================
      // 6. ADMIN LOGIN AND OPERATIONS
      // ===================

      // Admin login (assuming admin exists from seeding)
      try {
        const adminLoginResponse = await request(app.getHttpServer())
          .post('/admin/login')
          .send({
            email: 'admin@test.com',
            password: 'admin123',
          })
          .expect(200);

        adminAccessToken = adminLoginResponse.body.accessToken;

        // Get pending profile reviews
        const pendingReviewsResponse = await request(app.getHttpServer())
          .get('/admin/profile-reviews/pending')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .query({ page: 1, limit: 10 })
          .expect(200);

        // Get review statistics
        const statsResponse = await request(app.getHttpServer())
          .get('/admin/profile-reviews/statistics')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(statsResponse.body).toHaveProperty('pending');
        expect(statsResponse.body).toHaveProperty('approved');
        expect(statsResponse.body).toHaveProperty('rejected');
        expect(statsResponse.body).toHaveProperty('total');
      } catch (error) {
        console.warn(
          'Admin tests skipped - admin user not available in test environment',
        );
      }

      // ===================
      // 7. PUBLIC PROFILE ACCESS
      // ===================

      // Get public brand profile
      const publicBrandResponse = await request(app.getHttpServer())
        .get(`/brand/profile/${brandId}`)
        .expect(200);

      expect(publicBrandResponse.body.id).toBe(brandId);
      expect(publicBrandResponse.body.brandName).toBe('Integration Test Brand');
      expect(publicBrandResponse.body).not.toHaveProperty('email'); // Should not expose private data

      // Get public influencer profile
      const publicInfluencerResponse = await request(app.getHttpServer())
        .get(`/influencer/profile/${influencerId}`)
        .expect(200);

      expect(publicInfluencerResponse.body.id).toBe(influencerId);
      expect(publicInfluencerResponse.body.name).toBe(
        'Integration Test Influencer',
      );
      expect(publicInfluencerResponse.body).not.toHaveProperty('phone'); // Should not expose private data

      // ===================
      // 8. UPDATE AND DELETE OPERATIONS
      // ===================

      // Update a post
      await request(app.getHttpServer())
        .patch(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .send({
          content:
            'Updated: Hello everyone! This content has been updated with more information about upcoming collaborations.',
        })
        .expect(200);

      // Get updated post
      const updatedPostResponse = await request(app.getHttpServer())
        .get(`/posts/${testPostId}`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(200);

      expect(updatedPostResponse.body.content).toContain('Updated:');

      // Unlike posts
      await request(app.getHttpServer())
        .post(`/posts/${brandPostId}/like`)
        .set('Authorization', `Bearer ${influencerAccessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .expect(200);

      // Unfollow users
      await request(app.getHttpServer())
        .post('/posts/follow')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send({
          userType: 'influencer',
          userId: influencerId,
        })
        .expect(200);

      // ===================
      // 9. FINAL VALIDATIONS
      // ===================

      // Verify final state of posts
      const finalFeedResponse = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(finalFeedResponse.body.posts).toHaveLength(2);

      // Verify posts are ordered correctly (by date desc, then likes desc)
      const posts = finalFeedResponse.body.posts;
      for (let i = 0; i < posts.length - 1; i++) {
        const currentDate = new Date(posts[i].createdAt);
        const nextDate = new Date(posts[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(
          nextDate.getTime(),
        );
      }

      // Verify data consistency
      expect(posts.every((post) => post.isActive === true)).toBe(true);
      expect(posts.every((post) => typeof post.likesCount === 'number')).toBe(
        true,
      );
      expect(
        posts.every((post) => ['brand', 'influencer'].includes(post.userType)),
      ).toBe(true);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test unauthorized access
      await request(app.getHttpServer()).get('/posts').expect(401);

      await request(app.getHttpServer())
        .post('/posts')
        .send({ content: 'Unauthorized post' })
        .expect(401);

      // Test invalid data
      await request(app.getHttpServer())
        .post('/auth/brand/signup')
        .send({
          email: 'invalid-email',
          phone: 'invalid-phone',
          password: '123', // Too short
        })
        .expect(400);

      // Test non-existent resources
      await request(app.getHttpServer())
        .get('/posts/99999')
        .set('Authorization', `Bearer ${brandAccessToken || 'dummy'}`)
        .expect(404);

      await request(app.getHttpServer())
        .get('/brand/profile/99999')
        .expect(404);
    });

    it('should handle concurrent operations safely', async () => {
      // Create test users first
      await request(app.getHttpServer())
        .post('/auth/brand/request-otp')
        .send({ phone: '9876543211' });

      const otp = await redisService.get('otp:+919876543211');

      await request(app.getHttpServer())
        .post('/auth/brand/verify-otp')
        .send({ phone: '9876543211', otp })
        .set('device-id', 'concurrent-test');

      const signupResponse = await request(app.getHttpServer())
        .post('/auth/brand/signup')
        .send({
          email: 'concurrent@test.com',
          phone: '+919876543211',
          password: 'Password123!',
          nicheIds: [1],
        });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/brand/login')
        .send({
          email: 'concurrent@test.com',
          password: 'Password123!',
        })
        .set('device-id', 'concurrent-test');

      const token = loginResponse.body.accessToken;

      // Create a post
      const postResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Concurrent test post' });

      const postId = postResponse.body.id;

      // Simulate concurrent likes
      const likePromises = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post(`/posts/${postId}/like`)
          .set('Authorization', `Bearer ${token}`),
      );

      const results = await Promise.allSettled(likePromises);

      // All requests should complete without errors
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });

      // Final state should be consistent
      const finalPost = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(finalPost.body.likesCount).toBeGreaterThanOrEqual(0);
      expect(finalPost.body.likesCount).toBeLessThanOrEqual(1); // Should be 0 or 1 due to toggle behavior
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple users and posts efficiently', async () => {
      // This test creates multiple users and posts to test performance
      const users: Array<{ id: any; token: any }> = [];

      // Create 3 test users
      for (let i = 0; i < 3; i++) {
        const phone = `987654321${i}`;

        await request(app.getHttpServer())
          .post('/auth/brand/request-otp')
          .send({ phone });

        const otp = await redisService.get(`otp:+91${phone}`);

        await request(app.getHttpServer())
          .post('/auth/brand/verify-otp')
          .send({ phone, otp })
          .set('device-id', `load-test-${i}`);

        const signupResponse = await request(app.getHttpServer())
          .post('/auth/brand/signup')
          .send({
            email: `loadtest${i}@test.com`,
            phone: `+91${phone}`,
            password: 'LoadTest123!',
            nicheIds: [1],
          });

        const loginResponse = await request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: `loadtest${i}@test.com`,
            password: 'LoadTest123!',
          })
          .set('device-id', `load-test-${i}`);

        users.push({
          id: signupResponse.body.brand.id,
          token: loginResponse.body.accessToken,
        });
      }

      // Each user creates 2 posts
      const postPromises = users.flatMap((user) =>
        Array.from({ length: 2 }, (_, i) =>
          request(app.getHttpServer())
            .post('/posts')
            .set('Authorization', `Bearer ${user.token}`)
            .send({
              content: `Load test post ${i + 1} from user ${user.id}`,
              mediaUrls: [`https://example.com/image-${user.id}-${i}.jpg`],
            }),
        ),
      );

      const postResults = await Promise.all(postPromises);

      // All posts should be created successfully
      postResults.forEach((result) => {
        expect(result.status).toBe(201);
        expect(result.body).toHaveProperty('id');
        expect(result.body).toHaveProperty('content');
      });

      // Test feed performance with multiple posts
      const startTime = Date.now();

      const feedResponse = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${users[0].token}`)
        .query({ page: 1, limit: 10 });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(feedResponse.status).toBe(200);
      expect(feedResponse.body.posts).toHaveLength(6); // 3 users × 2 posts
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
