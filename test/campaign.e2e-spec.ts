import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize-typescript';
import { RedisService } from '../src/redis/redis.service';
import {
  CampaignType,
  CampaignStatus,
} from '../src/campaign/models/campaign.model';
import {
  Platform,
  DeliverableType,
} from '../src/campaign/models/campaign-deliverable.model';
import { Brand } from '../src/brand/model/brand.model';
import { Influencer } from '../src/auth/model/influencer.model';
import { Campaign } from '../src/campaign/models/campaign.model';
import { City } from '../src/shared/models/city.model';
import { Country } from '../src/shared/models/country.model';
import { CompanyType } from '../src/shared/models/company-type.model';
import { Niche } from '../src/auth/model/niche.model';
import * as bcrypt from 'bcrypt';

describe('Campaign (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let redisService: RedisService;
  let brandAccessToken: string;
  let influencerAccessToken: string;
  let testBrand: Brand;
  let testInfluencer: Influencer;
  let testCampaign: Campaign;
  let testCity: City;
  let testCountry: Country;
  let testCompanyType: CompanyType;
  let testNiche: Niche;

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
    if (sequelize) {
      await sequelize.close();
    }
    if (redisService) {
      // Clean up test data from Redis
      const redisClient = redisService.getClient();
      await redisClient.flushdb();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up and reset database
    if (sequelize) {
      await sequelize.sync({ force: true });
    }

    // Create test data
    await createTestData();
    await createTestUsers();
  });

  async function createTestData() {
    // Create test country
    testCountry = await Country.create({
      name: 'India',
      code: 'IN',
      isActive: true,
    } as any);

    // Create test company type
    testCompanyType = await CompanyType.create({
      name: 'Private Limited Company (Pvt. Ltd.)',
      isActive: true,
    } as any);

    // Create test city
    testCity = await City.create({
      name: 'Mumbai',
      state: 'Maharashtra',
      countryId: testCountry.id,
      tier: 1,
      isActive: true,
    } as any);

    // Create test niche
    testNiche = await Niche.create({
      name: 'Fashion',
      icon: '👗',
      isActive: true,
    } as any);
  }

  async function createTestUsers() {
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

    // Create test brand
    testBrand = await Brand.create({
      email: 'testbrand@example.com',
      phone: '+919876543210',
      password: hashedPassword,
      brandName: 'Test Brand',
      username: 'testbrand',
      isEmailVerified: true,
      isPhoneVerified: true,
      isActive: true,
      headquarterCountryId: testCountry.id,
      headquarterCityId: testCity.id,
      companyTypeId: testCompanyType.id,
    } as any);

    // Create test influencer
    testInfluencer = await Influencer.create({
      phone: '+919876543211',
      name: 'Test Influencer',
      username: 'testinfluencer',
      email: 'testinfluencer@example.com',
      gender: 'female',
      dateOfBirth: '1995-01-01',
      isPhoneVerified: true,
      isWhatsappVerified: true,
      isProfileCompleted: true,
      whatsappNumber: '+919876543211',
      countryId: testCountry.id,
      cityId: testCity.id,
    } as any);

    // Generate tokens for authentication
    brandAccessToken = await generateToken(testBrand.id, 'brand');
    influencerAccessToken = await generateToken(
      testInfluencer.id,
      'influencer',
    );
  }

  async function generateToken(
    userId: number,
    userType: string,
  ): Promise<string> {
    // This is a simplified token generation for testing
    // In real implementation, use the actual JWT service
    const payload = {
      id: userId,
      userType: userType,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    // Mock JWT token for testing - in real app this would be properly signed
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  describe('Campaign Management', () => {
    describe('POST /api/campaign', () => {
      it('should create a campaign successfully', async () => {
        const createCampaignDto = {
          name: 'Test Campaign',
          description: 'This is a test campaign',
          type: CampaignType.PAID,
          isPanIndia: false,
          cityIds: [testCity.id],
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

        const response = await request(app.getHttpServer())
          .post('/api/campaign')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send(createCampaignDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('name', 'Test Campaign');
        expect(response.body.data).toHaveProperty('brandId', testBrand.id);
        expect(response.body).toHaveProperty(
          'message',
          'Campaign created successfully',
        );
      });

      it('should fail to create campaign without authentication', async () => {
        const createCampaignDto = {
          name: 'Test Campaign',
          description: 'This is a test campaign',
          type: CampaignType.PAID,
          isPanIndia: true,
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

        await request(app.getHttpServer())
          .post('/api/campaign')
          .send(createCampaignDto)
          .expect(401);
      });

      it('should fail to create campaign with invalid city for non-pan-India', async () => {
        const createCampaignDto = {
          name: 'Test Campaign',
          description: 'This is a test campaign',
          type: CampaignType.PAID,
          isPanIndia: false,
          cityIds: [],
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

        await request(app.getHttpServer())
          .post('/api/campaign')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send(createCampaignDto)
          .expect(400);
      });

      it('should fail to create campaign with invalid deliverables', async () => {
        const createCampaignDto = {
          name: 'Test Campaign',
          description: 'This is a test campaign',
          type: CampaignType.PAID,
          isPanIndia: true,
          isOpenToAllGenders: true,
          deliverables: [], // Empty deliverables should fail
        };

        await request(app.getHttpServer())
          .post('/api/campaign')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send(createCampaignDto)
          .expect(400);
      });
    });

    describe('GET /api/campaign', () => {
      beforeEach(async () => {
        // Create test campaign
        testCampaign = await Campaign.create({
          name: 'Test Campaign',
          description: 'Test Description',
          type: CampaignType.PAID,
          status: CampaignStatus.ACTIVE,
          brandId: testBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);
      });

      it('should get campaigns with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign?page=1&limit=10')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('campaigns');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('page', 1);
        expect(response.body.data).toHaveProperty('limit', 10);
        expect(Array.isArray(response.body.data.campaigns)).toBe(true);
      });

      it('should filter campaigns by status', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/campaign?status=${CampaignStatus.ACTIVE}`)
          .expect(200);

        expect(response.body.data.campaigns).toHaveLength(1);
        expect(response.body.data.campaigns[0]).toHaveProperty(
          'status',
          CampaignStatus.ACTIVE,
        );
      });

      it('should search campaigns by name', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign?search=Test')
          .expect(200);

        expect(response.body.data.campaigns).toHaveLength(1);
        expect(response.body.data.campaigns[0]).toHaveProperty(
          'name',
          'Test Campaign',
        );
      });

      it('should get brand-specific campaigns when authenticated', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.campaigns).toHaveLength(1);
        expect(response.body.data.campaigns[0]).toHaveProperty(
          'brandId',
          testBrand.id,
        );
      });
    });

    describe('GET /api/campaign/:id', () => {
      beforeEach(async () => {
        testCampaign = await Campaign.create({
          name: 'Test Campaign Detail',
          description: 'Test Description',
          type: CampaignType.PAID,
          status: CampaignStatus.ACTIVE,
          brandId: testBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);
      });

      it('should get campaign by id', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/campaign/${testCampaign.id}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id', testCampaign.id);
        expect(response.body.data).toHaveProperty(
          'name',
          'Test Campaign Detail',
        );
      });

      it('should return 404 for non-existent campaign', async () => {
        await request(app.getHttpServer())
          .get('/api/campaign/999999')
          .expect(404);
      });
    });

    describe('PATCH /api/campaign/:id/status', () => {
      beforeEach(async () => {
        testCampaign = await Campaign.create({
          name: 'Test Campaign Status',
          description: 'Test Description',
          type: CampaignType.PAID,
          status: CampaignStatus.DRAFT,
          brandId: testBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);
      });

      it('should update campaign status', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/campaign/${testCampaign.id}/status`)
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send({ status: CampaignStatus.ACTIVE })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty(
          'status',
          CampaignStatus.ACTIVE,
        );
      });

      it('should fail to update campaign status without authentication', async () => {
        await request(app.getHttpServer())
          .patch(`/api/campaign/${testCampaign.id}/status`)
          .send({ status: CampaignStatus.ACTIVE })
          .expect(401);
      });

      it('should fail to update campaign status of other brands', async () => {
        // Create another brand
        const otherBrand = await Brand.create({
          email: 'otherbrand@example.com',
          phone: '+919876543212',
          password: await bcrypt.hash('TestPassword123!', 10),
          brandName: 'Other Brand',
          username: 'otherbrand',
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
        } as any);

        const otherBrandToken = await generateToken(otherBrand.id, 'brand');

        await request(app.getHttpServer())
          .patch(`/api/campaign/${testCampaign.id}/status`)
          .set('Authorization', `Bearer ${otherBrandToken}`)
          .send({ status: CampaignStatus.ACTIVE })
          .expect(404);
      });
    });

    describe('DELETE /api/campaign/:id', () => {
      beforeEach(async () => {
        testCampaign = await Campaign.create({
          name: 'Test Campaign Delete',
          description: 'Test Description',
          type: CampaignType.PAID,
          status: CampaignStatus.DRAFT,
          brandId: testBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);
      });

      it('should delete campaign successfully', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/api/campaign/${testCampaign.id}`)
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty(
          'message',
          'Campaign deleted successfully',
        );
      });

      it('should fail to delete active campaign', async () => {
        // Update campaign to active
        await testCampaign.update({ status: CampaignStatus.ACTIVE });

        await request(app.getHttpServer())
          .delete(`/api/campaign/${testCampaign.id}`)
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .expect(400);
      });

      it('should fail to delete campaign without authentication', async () => {
        await request(app.getHttpServer())
          .delete(`/api/campaign/${testCampaign.id}`)
          .expect(401);
      });
    });
  });

  describe('City Management', () => {
    describe('GET /api/campaign/cities/popular', () => {
      it('should get popular cities without authentication', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/cities/popular')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should get Indian cities for Indian brand', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/cities/popular')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should get Indian cities for Indian influencer', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/cities/popular')
          .set('Authorization', `Bearer ${influencerAccessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /api/campaign/cities/search', () => {
      it('should search cities by query', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/cities/search?q=mum')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return popular cities for short query', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/cities/search?q=a')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Influencer Management', () => {
    describe('GET /api/campaign/influencers/search', () => {
      it('should search influencers with basic query', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/influencers/search')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('influencers');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('page');
        expect(response.body.data).toHaveProperty('limit');
        expect(Array.isArray(response.body.data.influencers)).toBe(true);
      });

      it('should search influencers by name', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/influencers/search?search=Test')
          .expect(200);

        expect(response.body.data.influencers).toHaveLength(1);
        expect(response.body.data.influencers[0]).toHaveProperty(
          'name',
          'Test Influencer',
        );
      });

      it('should filter influencers by gender', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/influencers/search?gender=female')
          .expect(200);

        expect(response.body.data.influencers).toHaveLength(1);
        expect(response.body.data.influencers[0]).toHaveProperty(
          'gender',
          'female',
        );
      });

      it('should filter influencers by city', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/campaign/influencers/search?cityIds=${testCity.id}`)
          .expect(200);

        expect(response.body.data.influencers).toHaveLength(1);
        expect(response.body.data.influencers[0]).toHaveProperty(
          'cityId',
          testCity.id,
        );
      });

      it('should handle pagination correctly', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/influencers/search?page=1&limit=5')
          .expect(200);

        expect(response.body.data).toHaveProperty('page', 1);
        expect(response.body.data).toHaveProperty('limit', 5);
        expect(response.body.data.influencers.length).toBeLessThanOrEqual(5);
      });
    });

    describe('POST /api/campaign/invite', () => {
      beforeEach(async () => {
        testCampaign = await Campaign.create({
          name: 'Test Campaign Invite',
          description: 'Test Description',
          type: CampaignType.PAID,
          status: CampaignStatus.ACTIVE,
          brandId: testBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);
      });

      it('should invite influencers to campaign', async () => {
        const inviteDto = {
          campaignId: testCampaign.id,
          influencerIds: [testInfluencer.id],
          personalMessage: 'Join our amazing campaign!',
        };

        const response = await request(app.getHttpServer())
          .post('/api/campaign/invite')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send(inviteDto)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('invitationsSent', 1);
        expect(response.body.data).toHaveProperty('failedInvitations');
        expect(Array.isArray(response.body.data.failedInvitations)).toBe(true);
      });

      it('should fail to invite without authentication', async () => {
        const inviteDto = {
          campaignId: testCampaign.id,
          influencerIds: [testInfluencer.id],
          personalMessage: 'Join our amazing campaign!',
        };

        await request(app.getHttpServer())
          .post('/api/campaign/invite')
          .send(inviteDto)
          .expect(401);
      });

      it('should fail to invite to non-existent campaign', async () => {
        const inviteDto = {
          campaignId: 999999,
          influencerIds: [testInfluencer.id],
          personalMessage: 'Join our amazing campaign!',
        };

        await request(app.getHttpServer())
          .post('/api/campaign/invite')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send(inviteDto)
          .expect(404);
      });

      it('should fail to invite to campaign of other brand', async () => {
        // Create campaign for another brand
        const otherBrand = await Brand.create({
          email: 'otherbrand2@example.com',
          phone: '+919876543213',
          password: await bcrypt.hash('TestPassword123!', 10),
          brandName: 'Other Brand 2',
          username: 'otherbrand2',
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
        } as any);

        const otherCampaign = await Campaign.create({
          name: 'Other Campaign',
          description: 'Other Description',
          type: CampaignType.PAID,
          status: CampaignStatus.ACTIVE,
          brandId: otherBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);

        const inviteDto = {
          campaignId: otherCampaign.id,
          influencerIds: [testInfluencer.id],
          personalMessage: 'Join our amazing campaign!',
        };

        await request(app.getHttpServer())
          .post('/api/campaign/invite')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .send(inviteDto)
          .expect(404);
      });
    });
  });

  describe('Brand Campaigns', () => {
    describe('GET /api/campaign/brand/campaigns', () => {
      beforeEach(async () => {
        await Campaign.create({
          name: 'Brand Campaign 1',
          description: 'Test Description 1',
          type: CampaignType.PAID,
          status: CampaignStatus.ACTIVE,
          brandId: testBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);

        await Campaign.create({
          name: 'Brand Campaign 2',
          description: 'Test Description 2',
          type: CampaignType.BARTER,
          status: CampaignStatus.DRAFT,
          brandId: testBrand.id,
          isPanIndia: false,
          isOpenToAllGenders: false,
          isActive: true,
        } as any);
      });

      it('should get all campaigns for authenticated brand', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/campaign/brand/campaigns')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0]).toHaveProperty('brandId', testBrand.id);
        expect(response.body.data[1]).toHaveProperty('brandId', testBrand.id);
      });

      it('should fail to get campaigns without authentication', async () => {
        await request(app.getHttpServer())
          .get('/api/campaign/brand/campaigns')
          .expect(401);
      });

      it('should only return campaigns for the authenticated brand', async () => {
        // Create another brand with campaigns
        const otherBrand = await Brand.create({
          email: 'otherbrand3@example.com',
          phone: '+919876543214',
          password: await bcrypt.hash('TestPassword123!', 10),
          brandName: 'Other Brand 3',
          username: 'otherbrand3',
          isEmailVerified: true,
          isPhoneVerified: true,
          isActive: true,
        } as any);

        await Campaign.create({
          name: 'Other Brand Campaign',
          description: 'Other Description',
          type: CampaignType.PAID,
          status: CampaignStatus.ACTIVE,
          brandId: otherBrand.id,
          isPanIndia: true,
          isOpenToAllGenders: true,
          isActive: true,
        } as any);

        const response = await request(app.getHttpServer())
          .get('/api/campaign/brand/campaigns')
          .set('Authorization', `Bearer ${brandAccessToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2); // Only testBrand campaigns
        response.body.data.forEach((campaign: any) => {
          expect(campaign).toHaveProperty('brandId', testBrand.id);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      const invalidDto = {
        // Missing required fields
        description: 'Test Description',
      };

      const response = await request(app.getHttpServer())
        .post('/api/campaign')
        .set('Authorization', `Bearer ${brandAccessToken}`)
        .send(invalidDto)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBe(true);
    });

    it('should handle internal server errors gracefully', async () => {
      // This test would simulate a database error or service failure
      // For now, we test with malformed data that might cause issues
      const response = await request(app.getHttpServer())
        .get('/api/campaign/999999999999999999') // Extremely large ID
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });
});
