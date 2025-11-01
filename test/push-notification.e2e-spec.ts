import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Sequelize } from 'sequelize-typescript';
import { Admin } from '../src/admin/models/admin.model';
import { ReceiverType, NotificationStatus, GenderFilter } from '../src/admin/models/push-notification.model';
import * as bcrypt from 'bcrypt';

describe('Push Notifications (e2e)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let superAdminToken: string;
  let contentModeratorToken: string;
  let readOnlyAdminToken: string;
  let testNotificationId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    sequelize = moduleFixture.get<Sequelize>(Sequelize);

    await app.init();
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    if (sequelize) {
      await sequelize.sync({ force: true });
    }

    // Create test admin users
    const superAdmin = await Admin.create({
      name: 'Super Admin Test',
      email: 'superadmin@test.com',
      password: await bcrypt.hash('Test@123', 10),
      role: 'super_admin',
      isActive: true,
    });

    const contentModerator = await Admin.create({
      name: 'Content Moderator Test',
      email: 'moderator@test.com',
      password: await bcrypt.hash('Test@123', 10),
      role: 'content_moderator',
      isActive: true,
    });

    const readOnlyAdmin = await Admin.create({
      name: 'Read Only Test',
      email: 'readonly@test.com',
      password: await bcrypt.hash('Test@123', 10),
      role: 'read_only',
      isActive: true,
    });

    // Login to get tokens
    const superAdminLogin = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'superadmin@test.com', password: 'Test@123' });
    superAdminToken = superAdminLogin.body.token;

    const moderatorLogin = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'moderator@test.com', password: 'Test@123' });
    contentModeratorToken = moderatorLogin.body.token;

    const readOnlyLogin = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({ email: 'readonly@test.com', password: 'Test@123' });
    readOnlyAdminToken = readOnlyLogin.body.token;
  });

  describe('POST /admin/notifications - Create Notification', () => {
    it('should create a draft notification as super admin', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Test Notification',
          body: 'This is a test notification body',
          receiverType: ReceiverType.ALL_USERS,
          status: NotificationStatus.DRAFT,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('title', 'Test Notification');
          expect(res.body).toHaveProperty('body', 'This is a test notification body');
          expect(res.body).toHaveProperty('receiverType', ReceiverType.ALL_USERS);
          expect(res.body).toHaveProperty('status', NotificationStatus.DRAFT);
          expect(res.body).toHaveProperty('createdBy');
          testNotificationId = res.body.id;
        });
    });

    it('should create a scheduled notification with filters', () => {
      const scheduledAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Scheduled Notification',
          body: 'This is a scheduled notification',
          receiverType: ReceiverType.ALL_INFLUENCERS,
          status: NotificationStatus.SCHEDULED,
          scheduledAt,
          genderFilter: GenderFilter.FEMALE,
          minAge: 18,
          maxAge: 35,
          nicheIds: [1, 2, 3],
          locations: ['Mumbai', 'Delhi'],
          isPanIndia: false,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('status', NotificationStatus.SCHEDULED);
          expect(res.body).toHaveProperty('genderFilter', GenderFilter.FEMALE);
          expect(res.body).toHaveProperty('minAge', 18);
          expect(res.body).toHaveProperty('maxAge', 35);
          expect(res.body).toHaveProperty('nicheIds');
          expect(res.body.nicheIds).toEqual([1, 2, 3]);
          expect(res.body).toHaveProperty('locations');
          expect(res.body.locations).toEqual(['Mumbai', 'Delhi']);
        });
    });

    it('should create notification as content moderator', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${contentModeratorToken}`)
        .send({
          title: 'Moderator Notification',
          body: 'Created by content moderator',
          receiverType: ReceiverType.ALL_BRANDS,
          status: NotificationStatus.DRAFT,
        })
        .expect(201);
    });

    it('should reject notification creation for read-only admin', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${readOnlyAdminToken}`)
        .send({
          title: 'Unauthorized',
          body: 'Should not be created',
          receiverType: ReceiverType.ALL_USERS,
        })
        .expect(403);
    });

    it('should reject notification with invalid data', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: '',
          body: 'Te',
          receiverType: 'INVALID_TYPE',
        })
        .expect(400);
    });

    it('should reject notification with missing title', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          body: 'Test body without title',
          receiverType: ReceiverType.ALL_USERS,
        })
        .expect(400);
    });

    it('should reject notification without authentication', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .send({
          title: 'Unauthorized',
          body: 'Should fail',
          receiverType: ReceiverType.ALL_USERS,
        })
        .expect(401);
    });
  });

  describe('GET /admin/notifications - Get Notifications List', () => {
    beforeEach(async () => {
      // Create test notifications
      await request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Draft Notification 1',
          body: 'Test body 1',
          receiverType: ReceiverType.ALL_USERS,
          status: NotificationStatus.DRAFT,
        });

      await request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Draft Notification 2',
          body: 'Test body 2',
          receiverType: ReceiverType.ALL_INFLUENCERS,
          status: NotificationStatus.DRAFT,
        });
    });

    it('should get all notifications with default pagination', () => {
      return request(app.getHttpServer())
        .get('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('notifications');
          expect(Array.isArray(res.body.notifications)).toBe(true);
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body.notifications.length).toBeGreaterThan(0);
        });
    });

    it('should get notifications with pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/admin/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(10);
        });
    });

    it('should filter notifications by status', () => {
      return request(app.getHttpServer())
        .get(`/admin/notifications?status=${NotificationStatus.DRAFT}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.notifications.every(
            (n: any) => n.status === NotificationStatus.DRAFT
          )).toBe(true);
        });
    });

    it('should filter notifications by receiver type', () => {
      return request(app.getHttpServer())
        .get(`/admin/notifications?receiverType=${ReceiverType.ALL_INFLUENCERS}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.notifications.every(
            (n: any) => n.receiverType === ReceiverType.ALL_INFLUENCERS
          )).toBe(true);
        });
    });

    it('should allow content moderator to view notifications', () => {
      return request(app.getHttpServer())
        .get('/admin/notifications')
        .set('Authorization', `Bearer ${contentModeratorToken}`)
        .expect(200);
    });

    it('should reject unauthorized access', () => {
      return request(app.getHttpServer())
        .get('/admin/notifications')
        .expect(401);
    });
  });

  describe('GET /admin/notifications/:id - Get Notification by ID', () => {
    let createdNotificationId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Test Notification for Get',
          body: 'Test body',
          receiverType: ReceiverType.ALL_USERS,
          status: NotificationStatus.DRAFT,
        });
      createdNotificationId = response.body.id;
    });

    it('should get notification by ID', () => {
      return request(app.getHttpServer())
        .get(`/admin/notifications/${createdNotificationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', createdNotificationId);
          expect(res.body).toHaveProperty('title', 'Test Notification for Get');
          expect(res.body).toHaveProperty('createdBy');
        });
    });

    it('should return 404 for non-existent notification', () => {
      return request(app.getHttpServer())
        .get('/admin/notifications/99999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should return 400 for invalid notification ID', () => {
      return request(app.getHttpServer())
        .get('/admin/notifications/invalid')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);
    });
  });

  describe('PUT /admin/notifications/:id - Update Notification', () => {
    let draftNotificationId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Draft to Update',
          body: 'Original body',
          receiverType: ReceiverType.ALL_USERS,
          status: NotificationStatus.DRAFT,
        });
      draftNotificationId = response.body.id;
    });

    it('should update draft notification', () => {
      return request(app.getHttpServer())
        .put(`/admin/notifications/${draftNotificationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Updated Notification',
          body: 'Updated body',
          receiverType: ReceiverType.ALL_INFLUENCERS,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('title', 'Updated Notification');
          expect(res.body).toHaveProperty('body', 'Updated body');
          expect(res.body).toHaveProperty('receiverType', ReceiverType.ALL_INFLUENCERS);
        });
    });

    it('should allow content moderator to update notification', () => {
      return request(app.getHttpServer())
        .put(`/admin/notifications/${draftNotificationId}`)
        .set('Authorization', `Bearer ${contentModeratorToken}`)
        .send({
          title: 'Updated by Moderator',
        })
        .expect(200);
    });

    it('should reject update from read-only admin', () => {
      return request(app.getHttpServer())
        .put(`/admin/notifications/${draftNotificationId}`)
        .set('Authorization', `Bearer ${readOnlyAdminToken}`)
        .send({
          title: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should return 404 for non-existent notification', () => {
      return request(app.getHttpServer())
        .put('/admin/notifications/99999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Should Fail',
        })
        .expect(404);
    });
  });

  describe('DELETE /admin/notifications/:id - Delete Notification', () => {
    let draftNotificationId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Draft to Delete',
          body: 'Will be deleted',
          receiverType: ReceiverType.ALL_USERS,
          status: NotificationStatus.DRAFT,
        });
      draftNotificationId = response.body.id;
    });

    it('should delete draft notification as super admin', () => {
      return request(app.getHttpServer())
        .delete(`/admin/notifications/${draftNotificationId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Notification deleted successfully');
        });
    });

    it('should reject deletion from content moderator', () => {
      return request(app.getHttpServer())
        .delete(`/admin/notifications/${draftNotificationId}`)
        .set('Authorization', `Bearer ${contentModeratorToken}`)
        .expect(403);
    });

    it('should reject deletion from read-only admin', () => {
      return request(app.getHttpServer())
        .delete(`/admin/notifications/${draftNotificationId}`)
        .set('Authorization', `Bearer ${readOnlyAdminToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent notification', () => {
      return request(app.getHttpServer())
        .delete('/admin/notifications/99999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  describe('POST /admin/notifications/:id/send - Send Notification', () => {
    let draftNotificationId: number;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Notification to Send',
          body: 'Will be sent',
          receiverType: ReceiverType.ALL_USERS,
          status: NotificationStatus.DRAFT,
        });
      draftNotificationId = response.body.id;
    });

    it('should send notification as super admin', () => {
      return request(app.getHttpServer())
        .post(`/admin/notifications/${draftNotificationId}/send`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('totalRecipients');
          expect(res.body).toHaveProperty('successCount');
          expect(res.body).toHaveProperty('failureCount');
        });
    });

    it('should allow content moderator to send notification', () => {
      return request(app.getHttpServer())
        .post(`/admin/notifications/${draftNotificationId}/send`)
        .set('Authorization', `Bearer ${contentModeratorToken}`)
        .expect(200);
    });

    it('should reject send from read-only admin', () => {
      return request(app.getHttpServer())
        .post(`/admin/notifications/${draftNotificationId}/send`)
        .set('Authorization', `Bearer ${readOnlyAdminToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent notification', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications/99999/send')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });

  describe('Validation Tests', () => {
    it('should validate title length (minimum)', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'a',
          body: 'Valid body',
          receiverType: ReceiverType.ALL_USERS,
        })
        .expect(400);
    });

    it('should validate title length (maximum)', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'a'.repeat(256),
          body: 'Valid body',
          receiverType: ReceiverType.ALL_USERS,
        })
        .expect(400);
    });

    it('should validate body length (minimum)', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Valid Title',
          body: 'ab',
          receiverType: ReceiverType.ALL_USERS,
        })
        .expect(400);
    });

    it('should validate age range', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Valid Title',
          body: 'Valid body',
          receiverType: ReceiverType.ALL_USERS,
          minAge: 10,
          maxAge: 150,
        })
        .expect(400);
    });

    it('should validate receiver type enum', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Valid Title',
          body: 'Valid body',
          receiverType: 'INVALID_TYPE',
        })
        .expect(400);
    });

    it('should validate status enum', () => {
      return request(app.getHttpServer())
        .post('/admin/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'Valid Title',
          body: 'Valid body',
          receiverType: ReceiverType.ALL_USERS,
          status: 'INVALID_STATUS',
        })
        .expect(400);
    });
  });
});
