import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RedisService } from '../../src/redis/redis.service';

/**
 * Common test utilities for all modules
 */
export class TestUtils {
  /**
   * Clean Redis data between tests
   */
  static async cleanRedis(redisService: RedisService): Promise<void> {
    const redisClient = redisService.getClient();
    await redisClient.flushdb();
  }

  /**
   * Wait for a specified amount of time
   */
  static async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate random test data
   */
  static generateRandomEmail(): string {
    return `test${Date.now()}${Math.floor(Math.random() * 1000)}@test.com`;
  }

  static generateRandomPhone(): string {
    return `9${Math.floor(Math.random() * 900000000) + 100000000}`;
  }

  static generateRandomUsername(): string {
    return `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * Create a test brand user
   */
  static async createTestBrand(
    app: INestApplication,
    redisService: RedisService,
    overrides: any = {},
  ): Promise<{ token: string; id: number; email: string }> {
    const phone = overrides.phone || TestUtils.generateRandomPhone();
    const email = overrides.email || TestUtils.generateRandomEmail();

    // Request OTP
    await request(app.getHttpServer())
      .post('/auth/brand/request-otp')
      .send({ phone });

    // Get OTP from Redis
    const otp = await redisService.get(`otp:+91${phone}`);

    // Verify OTP
    await request(app.getHttpServer())
      .post('/auth/brand/verify-otp')
      .send({ phone, otp })
      .set('device-id', 'test-device');

    // Signup
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/brand/signup')
      .send({
        email,
        phone: `+91${phone}`,
        password: 'TestPass123!',
        nicheIds: [1, 2],
        ...overrides,
      });

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/brand/login')
      .send({
        email,
        password: 'TestPass123!',
      })
      .set('device-id', 'test-device');

    return {
      token: loginResponse.body.accessToken,
      id: signupResponse.body.brand.id,
      email,
    };
  }

  /**
   * Create a test influencer user
   */
  static async createTestInfluencer(
    app: INestApplication,
    redisService: RedisService,
    overrides: any = {},
  ): Promise<{ token: string; id: number; username: string }> {
    const phone = overrides.phone || TestUtils.generateRandomPhone();
    const username = overrides.username || TestUtils.generateRandomUsername();

    // Request OTP
    await request(app.getHttpServer())
      .post('/auth/influencer/request-otp')
      .send({ phone });

    // Get OTP from Redis
    const otp = await redisService.get(`otp:+91${phone}`);

    // Verify OTP
    await request(app.getHttpServer())
      .post('/auth/influencer/verify-otp')
      .send({ phone, otp })
      .set('device-id', 'test-device');

    // Signup
    const signupResponse = await request(app.getHttpServer())
      .post('/auth/influencer/signup')
      .send({
        phone,
        name: 'Test Influencer',
        username,
        gender: 'Female',
        nicheIds: [1, 2],
        ...overrides,
      });

    return {
      token: signupResponse.body.accessToken,
      id: signupResponse.body.influencer.id,
      username,
    };
  }

  /**
   * Create test admin (if admin endpoint exists)
   */
  static async loginTestAdmin(
    app: INestApplication,
  ): Promise<{ token: string; id: number } | null> {
    try {
      const adminResponse = await request(app.getHttpServer())
        .post('/admin/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123',
        });

      return {
        token: adminResponse.body.accessToken,
        id: adminResponse.body.admin.id,
      };
    } catch {
      return null; // Admin not available in test environment
    }
  }

  /**
   * Create a test post
   */
  static async createTestPost(
    app: INestApplication,
    token: string,
    content: string = 'Test post content',
    mediaUrls: string[] = [],
  ): Promise<{ id: number; content: string }> {
    const response = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content, mediaUrls });

    return {
      id: response.body.id,
      content: response.body.content,
    };
  }

  /**
   * Assert response structure for common endpoints
   */
  static assertPaginationResponse(response: any): void {
    expect(response).toHaveProperty('total');
    expect(response).toHaveProperty('page');
    expect(response).toHaveProperty('limit');
    expect(response).toHaveProperty('totalPages');
    expect(typeof response.total).toBe('number');
    expect(typeof response.page).toBe('number');
    expect(typeof response.limit).toBe('number');
    expect(typeof response.totalPages).toBe('number');
  }

  static assertPostStructure(post: any): void {
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

  static assertUserProfileStructure(
    profile: any,
    userType: 'brand' | 'influencer',
  ): void {
    expect(profile).toHaveProperty('id');
    expect(typeof profile.id).toBe('number');

    if (userType === 'brand') {
      expect(profile).toHaveProperty('brandName');
      expect(profile).toHaveProperty('email');
    } else {
      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('username');
    }

    expect(profile).toHaveProperty('isActive');
    expect(typeof profile.isActive).toBe('boolean');
  }

  /**
   * Performance testing utilities
   */
  static async measureResponseTime(
    operation: () => Promise<any>,
  ): Promise<{ result: any; responseTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();

    return {
      result,
      responseTime: endTime - startTime,
    };
  }

  /**
   * Load testing utilities
   */
  static async runConcurrentOperations<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency: number = 10,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];

    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchResults = await Promise.allSettled(batch.map((op) => op()));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Data seeding utilities
   */
  static async seedTestData(
    app: INestApplication,
    redisService: RedisService,
  ): Promise<{
    brands: Array<{ token: string; id: number; email: string }>;
    influencers: Array<{ token: string; id: number; username: string }>;
    posts: Array<{
      id: number;
      content: string;
      authorId: number;
      authorType: string;
    }>;
  }> {
    const brands: Array<{ token: string; id: number; email: string }> = [];
    const influencers: Array<{ token: string; id: number; username: string }> =
      [];
    const posts: Array<{
      id: number;
      content: string;
      authorId: number;
      authorType: string;
    }> = [];

    // Create 2 brands
    for (let i = 0; i < 2; i++) {
      const brand = await TestUtils.createTestBrand(app, redisService, {
        email: `brand${i}@seed.com`,
      });
      brands.push(brand);

      // Each brand creates a post
      const post = await TestUtils.createTestPost(
        app,
        brand.token,
        `Brand ${i} seed post`,
      );
      posts.push({
        ...post,
        authorId: brand.id,
        authorType: 'brand',
      });
    }

    // Create 2 influencers
    for (let i = 0; i < 2; i++) {
      const influencer = await TestUtils.createTestInfluencer(
        app,
        redisService,
        {
          username: `influencer_seed_${i}`,
        },
      );
      influencers.push(influencer);

      // Each influencer creates a post
      const post = await TestUtils.createTestPost(
        app,
        influencer.token,
        `Influencer ${i} seed post`,
      );
      posts.push({
        ...post,
        authorId: influencer.id,
        authorType: 'influencer',
      });
    }

    return { brands, influencers, posts };
  }

  /**
   * Cleanup utilities
   */
  static async cleanupTestData(
    app: INestApplication,
    redisService: RedisService,
  ): Promise<void> {
    // Clean Redis
    await TestUtils.cleanRedis(redisService);

    // Note: Database cleanup should be handled by the test setup
    // using sequelize.sync({ force: true }) or similar
  }

  /**
   * Test data validation utilities
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+91[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mock data generators
   */
  static generateMockBrandData(): any {
    return {
      brandName: `Test Brand ${Date.now()}`,
      username: TestUtils.generateRandomUsername(),
      brandBio:
        'This is a test brand created for testing purposes with detailed information.',
      profileHeadline: 'Leading Test Brand in the Industry',
      websiteUrl: 'https://testbrand.com',
      foundedYear: 2020,
      activeRegions: ['Asia', 'Europe'],
      facebookUrl: 'https://facebook.com/testbrand',
      instagramUrl: 'https://instagram.com/testbrand',
    };
  }

  static generateMockInfluencerData(): any {
    return {
      name: `Test Influencer ${Date.now()}`,
      username: TestUtils.generateRandomUsername(),
      bio: 'This is a test influencer created for testing purposes with detailed information about content creation.',
      profileHeadline: 'Leading Test Influencer in Fashion',
      instagramUrl: 'https://instagram.com/testinfluencer',
      youtubeUrl: 'https://youtube.com/testinfluencer',
      collaborationCosts: {
        postCost: 1000,
        storyCost: 500,
        reelCost: 1500,
        videoCost: 3000,
      },
    };
  }

  static generateMockPostData(): any {
    return {
      content: `Test post content created at ${new Date().toISOString()} with engaging information.`,
      mediaUrls: [
        'https://example.com/test-image.jpg',
        'https://example.com/test-video.mp4',
      ],
    };
  }

  /**
   * Test environment utilities
   */
  static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  static getTestDatabaseName(): string {
    return process.env.POSTGRES_DB || 'collabkaroo_test_db';
  }

  static getTestRedisDatabase(): string {
    return process.env.REDIS_DB || '1';
  }

  /**
   * Logging utilities for tests
   */
  static logTestResult(
    testName: string,
    success: boolean,
    duration?: number,
  ): void {
    const status = success ? '✅ PASS' : '❌ FAIL';
    const time = duration ? ` (${duration}ms)` : '';
    console.log(`${status} ${testName}${time}`);
  }

  static logTestSuite(suiteName: string, passed: number, total: number): void {
    const percentage = Math.round((passed / total) * 100);
    console.log(
      `\n📊 ${suiteName}: ${passed}/${total} tests passed (${percentage}%)`,
    );
  }
}

/**
 * Test decorators and helpers
 */
export function testTimeout(ms: number) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    descriptor.value = function (...args: any[]) {
      jest.setTimeout(ms);
      return method.apply(this, args);
    };
  };
}

export function retryOnFailure(attempts: number = 3) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let lastError;

      for (let i = 0; i < attempts; i++) {
        try {
          return await method.apply(this, args);
        } catch (error) {
          lastError = error;
          if (i < attempts - 1) {
            await TestUtils.wait(100 * (i + 1)); // Exponential backoff
          }
        }
      }

      throw lastError;
    };
  };
}

/**
 * Custom matchers for Jest
 */
export const customMatchers = {
  toBeValidEmail(received: string) {
    const pass = TestUtils.validateEmail(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
      pass,
    };
  },

  toBeValidPhoneNumber(received: string) {
    const pass = TestUtils.validatePhoneNumber(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass,
    };
  },

  toBeValidUrl(received: string) {
    const pass = TestUtils.validateUrl(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid URL`,
      pass,
    };
  },

  toHaveResponseTimeUnder(received: number, expected: number) {
    const pass = received < expected;
    return {
      message: () =>
        `expected response time ${received}ms ${pass ? 'not ' : ''}to be under ${expected}ms`,
      pass,
    };
  },
};

// Jest matcher extensions can be added here if needed
// Currently not implemented to avoid linting issues with namespaces

export default TestUtils;
