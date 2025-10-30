import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize-typescript';
import { RedisService } from '../src/redis/redis.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redisService: RedisService;

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
    // Clean up database and Redis
    if (sequelize) {
      await sequelize.close();
    }
    if (redisService) {
      // Clear test data from Redis
      await redisService.del('otp:+919467289789');
      await redisService.del('otp:verified:9467289789');
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    if (sequelize) {
      await sequelize.sync({ force: true });
    }
  });

  describe('/auth/niches (GET)', () => {
    it('should return all niches', () => {
      return request(app.getHttpServer())
        .get('/auth/niches')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty(
            'message',
            'Niches fetched successfully',
          );
          expect(res.body).toHaveProperty('niches');
          expect(Array.isArray(res.body.niches)).toBe(true);
        });
    });
  });

  describe('/auth/check-username (POST)', () => {
    it('should check username availability - valid format', () => {
      return request(app.getHttpServer())
        .post('/auth/check-username')
        .send({ username: 'test_user_123' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('available');
          expect(res.body).toHaveProperty('username', 'test_user_123');
          expect(res.body).toHaveProperty('message');
          if (res.body.available) {
            expect(res.body.message).toBe(
              'Username is unique and available to use',
            );
            expect(res.body).not.toHaveProperty('suggestions');
          } else {
            expect(res.body.message).toBe('Username is already taken');
            expect(res.body).toHaveProperty('suggestions');
            expect(Array.isArray(res.body.suggestions)).toBe(true);
            expect(res.body.suggestions).toHaveLength(5);
          }
        });
    });

    it('should reject invalid username format', () => {
      return request(app.getHttpServer())
        .post('/auth/check-username')
        .send({ username: 'invalid-username!' })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(Array.isArray(res.body.message)).toBe(true);
        });
    });

    it('should reject short username', () => {
      return request(app.getHttpServer())
        .post('/auth/check-username')
        .send({ username: 'ab' })
        .expect(400);
    });

    it('should reject long username', () => {
      return request(app.getHttpServer())
        .post('/auth/check-username')
        .send({ username: 'a'.repeat(31) })
        .expect(400);
    });
  });

  describe('Influencer Flow', () => {
    const testPhone = '9467289789';
    const testInfluencerData = {
      name: 'Test Influencer',
      username: 'test_influencer_e2e',
      phone: testPhone,
      dateOfBirth: '1995-01-15',
      gender: 'Male',
      bio: 'Test bio for e2e testing',
      nicheIds: [1],
    };

    describe('/auth/influencer/request-otp (POST)', () => {
      it('should request OTP for valid phone number', () => {
        return request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: testPhone })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('message', 'OTP sent successfully');
            expect(res.body).toHaveProperty('phone', `+91${testPhone}`);
            expect(res.body).toHaveProperty('expiresIn', 300);
          });
      });

      it('should reject invalid phone number format', () => {
        return request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: '12345' })
          .expect(400);
      });

      it('should reject phone number starting with invalid digit', () => {
        return request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: '5467289789' })
          .expect(400);
      });
    });

    describe('/auth/influencer/verify-otp (POST)', () => {
      it('should verify correct OTP', async () => {
        // First request OTP
        await request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        // Get OTP from Redis for testing
        const storedOtp = await redisService.get(`otp:+91${testPhone}`);

        return request(app.getHttpServer())
          .post('/auth/influencer/verify-otp')
          .send({ phone: testPhone, otp: storedOtp })
          .set('device-id', 'test-device-123')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty(
              'message',
              'OTP verified successfully',
            );
            expect(res.body).toHaveProperty('phone', `+91${testPhone}`);
            expect(res.body).toHaveProperty('verified', true);
          });
      });

      it('should reject incorrect OTP', async () => {
        // First request OTP
        await request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        return request(app.getHttpServer())
          .post('/auth/influencer/verify-otp')
          .send({ phone: testPhone, otp: '000000' })
          .expect(401);
      });
    });

    describe('/auth/influencer/signup (POST)', () => {
      it('should signup influencer after OTP verification', async () => {
        // Request and verify OTP first
        await request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        const storedOtp = await redisService.get(`otp:+91${testPhone}`);

        await request(app.getHttpServer())
          .post('/auth/influencer/verify-otp')
          .send({ phone: testPhone, otp: storedOtp })
          .expect(200);

        return request(app.getHttpServer())
          .post('/auth/influencer/signup')
          .send(testInfluencerData)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty(
              'message',
              'Influencer registered successfully',
            );
            expect(res.body).toHaveProperty('influencer');
            expect(res.body.influencer).toHaveProperty('id');
            expect(res.body.influencer).toHaveProperty(
              'phone',
              `+91${testPhone}`,
            );
            expect(res.body.influencer).toHaveProperty('isPhoneVerified', true);
          });
      });

      it('should reject signup without OTP verification', () => {
        return request(app.getHttpServer())
          .post('/auth/influencer/signup')
          .send(testInfluencerData)
          .expect(401);
      });

      it('should reject invalid niche IDs', async () => {
        // Request and verify OTP first
        await request(app.getHttpServer())
          .post('/auth/influencer/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        const storedOtp = await redisService.get(`otp:+91${testPhone}`);

        await request(app.getHttpServer())
          .post('/auth/influencer/verify-otp')
          .send({ phone: testPhone, otp: storedOtp })
          .expect(200);

        return request(app.getHttpServer())
          .post('/auth/influencer/signup')
          .send({ ...testInfluencerData, nicheIds: [999] })
          .expect(400);
      });
    });
  });

  describe('Brand Flow', () => {
    const testPhone = '9876543210';
    const testBrandData = {
      email: 'test@brand.com',
      phone: testPhone,
      password: 'TestPassword123!',
      brandName: 'Test Brand E2E',
      username: 'test_brand_e2e',
    };

    describe('/auth/brand/request-otp (POST)', () => {
      it('should request OTP for brand', () => {
        return request(app.getHttpServer())
          .post('/auth/brand/request-otp')
          .send({ phone: testPhone })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('message', 'OTP sent successfully');
            expect(res.body).toHaveProperty('phone', `+91${testPhone}`);
            expect(res.body).toHaveProperty('expiresIn', 300);
          });
      });
    });

    describe('/auth/brand/verify-otp (POST)', () => {
      it('should verify OTP for brand', async () => {
        await request(app.getHttpServer())
          .post('/auth/brand/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        const storedOtp = await redisService.get(`otp:+91${testPhone}`);

        return request(app.getHttpServer())
          .post('/auth/brand/verify-otp')
          .send({ phone: testPhone, otp: storedOtp })
          .set('device-id', 'test-device-456')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty(
              'message',
              'OTP verified successfully',
            );
            expect(res.body).toHaveProperty('userType', 'brand');
          });
      });
    });

    describe('/auth/brand/signup (POST)', () => {
      it('should signup brand after OTP verification', async () => {
        await request(app.getHttpServer())
          .post('/auth/brand/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        const storedOtp = await redisService.get(`otp:+91${testPhone}`);

        await request(app.getHttpServer())
          .post('/auth/brand/verify-otp')
          .send({ phone: testPhone, otp: storedOtp })
          .expect(200);

        return request(app.getHttpServer())
          .post('/auth/brand/signup')
          .send(testBrandData)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty(
              'message',
              'Brand registered successfully',
            );
            expect(res.body).toHaveProperty('brand');
            expect(res.body.brand).toHaveProperty('id');
            expect(res.body.brand).toHaveProperty('email', testBrandData.email);
            expect(res.body.brand).not.toHaveProperty('password');
          });
      });
    });

    describe('/auth/brand/login (POST)', () => {
      it('should login brand with correct credentials', async () => {
        // First signup the brand
        await request(app.getHttpServer())
          .post('/auth/brand/request-otp')
          .send({ phone: testPhone })
          .expect(200);

        const storedOtp = await redisService.get(`otp:+91${testPhone}`);

        await request(app.getHttpServer())
          .post('/auth/brand/verify-otp')
          .send({ phone: testPhone, otp: storedOtp })
          .expect(200);

        await request(app.getHttpServer())
          .post('/auth/brand/signup')
          .send(testBrandData)
          .expect(201);

        // Now login
        return request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: testBrandData.email,
            password: testBrandData.password,
          })
          .set('device-id', 'test-device-789')
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('message', 'Login successful');
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body).toHaveProperty('brand');
            expect(res.body.brand).toHaveProperty('email', testBrandData.email);
            expect(res.body.brand).not.toHaveProperty('password');
          });
      });

      it('should reject login with incorrect credentials', () => {
        return request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: 'nonexistent@brand.com',
            password: 'wrongpassword',
          })
          .expect(401);
      });
    });
  });

  describe('Brand Two-Step Signup - Case Insensitive Email', () => {
    const testPassword = 'SecurePass123!';
    const baseEmail = 'vinay@gmail.com';

    describe('/auth/brand/initial-signup (POST)', () => {
      it('should create brand account with lowercase email', async () => {
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
            expect(res.body.message).toContain('OTP sent to your email');
            expect(res.body).toHaveProperty('email', baseEmail);
            expect(res.body).toHaveProperty('requiresOtp', true);
            expect(res.body).toHaveProperty('brandId');
          });
      });

      it('should reject duplicate email with exact same case (vinay@gmail.com)', async () => {
        // First signup
        await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        // Try to signup with same email - should resend OTP
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.message).toContain('OTP sent to your email');
            expect(res.body).toHaveProperty('requiresOtp', true);
          });
      });

      it('should reject email with different case - uppercase first letter (Vinay@gmail.com)', async () => {
        // First signup with lowercase
        await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        // Try with different case - should get same response (resend OTP)
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: 'Vinay@gmail.com',
            password: testPassword,
          })
          .expect(201)
          .expect((res) => {
            // Should normalize to lowercase and find existing account
            expect(res.body.message).toContain('OTP sent to your email');
            expect(res.body).toHaveProperty('email', baseEmail); // Should be normalized
            expect(res.body).toHaveProperty('requiresOtp', true);
          });
      });

      it('should reject email with different case - uppercase V and I (VInay@gmail.com)', async () => {
        // First signup with lowercase
        await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        // Try with different case variation
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: 'VInay@gmail.com',
            password: testPassword,
          })
          .expect(201)
          .expect((res) => {
            // Should normalize to lowercase and find existing account
            expect(res.body.message).toContain('OTP sent to your email');
            expect(res.body).toHaveProperty('email', baseEmail); // Should be normalized
            expect(res.body).toHaveProperty('requiresOtp', true);
          });
      });

      it('should reject email with all uppercase (VINAY@GMAIL.COM)', async () => {
        // First signup with lowercase
        await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        // Try with all uppercase
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: 'VINAY@GMAIL.COM',
            password: testPassword,
          })
          .expect(201)
          .expect((res) => {
            // Should normalize to lowercase and find existing account
            expect(res.body.message).toContain('OTP sent to your email');
            expect(res.body).toHaveProperty('email', baseEmail); // Should be normalized
            expect(res.body).toHaveProperty('requiresOtp', true);
          });
      });

      it('should reject email with mixed case (vInAy@GmAiL.cOm)', async () => {
        // First signup with lowercase
        await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        // Try with random mixed case
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: 'vInAy@GmAiL.cOm',
            password: testPassword,
          })
          .expect(201)
          .expect((res) => {
            // Should normalize to lowercase and find existing account
            expect(res.body.message).toContain('OTP sent to your email');
            expect(res.body).toHaveProperty('email', baseEmail); // Should be normalized
            expect(res.body).toHaveProperty('requiresOtp', true);
          });
      });

      it('should reject verified brand with case variation (409 Conflict)', async () => {
        // Create and verify brand with lowercase email
        const signupResponse = await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        const brandId = signupResponse.body.brandId;

        // Manually mark as verified for testing
        const Brand = sequelize.model('Brand');
        await Brand.update(
          { isEmailVerified: true },
          { where: { id: brandId } },
        );

        // Try to signup with different case - should get conflict
        return request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: 'VINAY@GMAIL.COM',
            password: testPassword,
          })
          .expect(409)
          .expect((res) => {
            expect(res.body).toHaveProperty('message', 'Brand already exists with this email');
          });
      });
    });

    describe('/auth/brand/login (POST) - Case Insensitive', () => {
      it('should login with lowercase email', async () => {
        // Create and verify brand
        const signupResponse = await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        const brandId = signupResponse.body.brandId;

        // Manually mark as verified and profile completed for testing
        const Brand = sequelize.model('Brand');
        await Brand.update(
          { 
            isEmailVerified: true,
            isProfileCompleted: true,
            brandName: 'Test Brand',
            username: 'testbrand123',
          },
          { where: { id: brandId } },
        );

        // Login with lowercase
        return request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
          });
      });

      it('should login with uppercase email (Vinay@gmail.com)', async () => {
        // Create and verify brand with lowercase
        const signupResponse = await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        const brandId = signupResponse.body.brandId;

        // Mark as verified and profile completed
        const Brand = sequelize.model('Brand');
        await Brand.update(
          { 
            isEmailVerified: true,
            isProfileCompleted: true,
            brandName: 'Test Brand',
            username: 'testbrand456',
          },
          { where: { id: brandId } },
        );

        // Login with different case
        return request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: 'Vinay@gmail.com',
            password: testPassword,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
          });
      });

      it('should login with all uppercase email (VINAY@GMAIL.COM)', async () => {
        // Create and verify brand with lowercase
        const signupResponse = await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        const brandId = signupResponse.body.brandId;

        // Mark as verified and profile completed
        const Brand = sequelize.model('Brand');
        await Brand.update(
          { 
            isEmailVerified: true,
            isProfileCompleted: true,
            brandName: 'Test Brand',
            username: 'testbrand789',
          },
          { where: { id: brandId } },
        );

        // Login with all uppercase
        return request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: 'VINAY@GMAIL.COM',
            password: testPassword,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
          });
      });

      it('should reject login with wrong password regardless of email case', async () => {
        // Create and verify brand
        const signupResponse = await request(app.getHttpServer())
          .post('/auth/brand/initial-signup')
          .send({
            email: baseEmail,
            password: testPassword,
          })
          .expect(201);

        const brandId = signupResponse.body.brandId;

        // Mark as verified and profile completed
        const Brand = sequelize.model('Brand');
        await Brand.update(
          { 
            isEmailVerified: true,
            isProfileCompleted: true,
            brandName: 'Test Brand',
            username: 'testbrand000',
          },
          { where: { id: brandId } },
        );

        // Try login with different case but wrong password
        return request(app.getHttpServer())
          .post('/auth/brand/login')
          .send({
            email: 'VINAY@GMAIL.COM',
            password: 'WrongPassword123!',
          })
          .expect(401);
      });
    });
  });
});
