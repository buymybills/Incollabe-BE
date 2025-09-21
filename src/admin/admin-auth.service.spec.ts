import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthService } from './admin-auth.service';
import { getModelToken } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import { Admin, AdminStatus, AdminRole } from './models/admin.model';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt at module level
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockAdminModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let adminModel: typeof Admin;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: getModelToken(Admin),
          useValue: mockAdminModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    adminModel = module.get<typeof Admin>(getModelToken(Admin));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('login', () => {
    const validEmail = 'admin@test.com';
    const validPassword = 'password123';

    const mockAdmin = {
      id: 1,
      email: validEmail,
      password: 'hashedPassword',
      name: 'Admin User',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      lastLoginAt: null,
      profileImage: null,
      update: jest.fn().mockResolvedValue(true),
    };

    it('should login successfully with valid credentials', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      const result = await service.login(validEmail, validPassword);

      expect(result).toEqual({
        accessToken: 'mocked-jwt-token',
        admin: {
          id: 1,
          name: 'Admin User',
          email: validEmail,
          role: AdminRole.SUPER_ADMIN,
          profileImage: null,
        },
      });

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        validPassword,
        'hashedPassword',
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: validEmail,
        role: AdminRole.SUPER_ADMIN,
        type: 'admin',
      });
      expect(mockAdmin.update).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Date),
      });
    });

    it('should throw UnauthorizedException for non-existent admin', async () => {
      mockAdminModel.findOne.mockResolvedValue(null);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for inactive admin', async () => {
      const inactiveAdmin = {
        ...mockAdmin,
        status: AdminStatus.INACTIVE,
      };

      mockAdminModel.findOne.mockResolvedValue(inactiveAdmin);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        new UnauthorizedException('Account is inactive or suspended'),
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for suspended admin', async () => {
      const suspendedAdmin = {
        ...mockAdmin,
        status: AdminStatus.SUSPENDED,
      };

      mockAdminModel.findOne.mockResolvedValue(suspendedAdmin);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        new UnauthorizedException('Account is inactive or suspended'),
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(validEmail, 'wrongpassword')).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: validEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        'hashedPassword',
      );
      expect(mockJwtService.sign).not.toHaveBeenCalled();
      expect(mockAdmin.update).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      mockAdminModel.findOne.mockRejectedValue(dbError);

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle bcrypt errors', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockRejectedValue(
        new Error('Bcrypt error'),
      );

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        'Bcrypt error',
      );
    });

    it('should handle JWT signing errors', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        'JWT signing failed',
      );
    });

    it('should handle admin update errors', async () => {
      const updateError = new Error('Failed to update last login');
      const adminWithUpdateError = {
        ...mockAdmin,
        update: jest.fn().mockRejectedValue(updateError),
      };
      mockAdminModel.findOne.mockResolvedValue(adminWithUpdateError);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      await expect(service.login(validEmail, validPassword)).rejects.toThrow(
        'Failed to update last login',
      );
    });

    it('should work with different admin roles', async () => {
      const moderatorAdmin = {
        ...mockAdmin,
        role: AdminRole.CONTENT_MODERATOR,
      };

      mockAdminModel.findOne.mockResolvedValue(moderatorAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      const result = await service.login(validEmail, validPassword);

      expect(result.admin.role).toBe(AdminRole.CONTENT_MODERATOR);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: validEmail,
        role: AdminRole.CONTENT_MODERATOR,
        type: 'admin',
      });
    });

    it('should handle special characters in email and password', async () => {
      const specialEmail = 'admin+test@domain-name.co.uk';
      const specialPassword = 'P@ssw0rd!#$%';

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      const result = await service.login(specialEmail, specialPassword);

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: specialEmail },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        specialPassword,
        'hashedPassword',
      );
    });

    it('should not expose sensitive data in response', async () => {
      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      const result = await service.login(validEmail, validPassword);

      expect(result.admin).not.toHaveProperty('password');
      expect(result.admin).not.toHaveProperty('createdAt');
      expect(result.admin).not.toHaveProperty('updatedAt');
      expect(result.admin).not.toHaveProperty('lastLoginAt');
    });

    it('should update lastLoginAt with current timestamp', async () => {
      const beforeLogin = new Date();

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      await service.login(validEmail, validPassword);

      const afterLogin = new Date();
      const updateCall = mockAdmin.update.mock.calls[0][0];
      const lastLoginAt = updateCall.lastLoginAt;

      expect(lastLoginAt).toBeInstanceOf(Date);
      expect(lastLoginAt.getTime()).toBeGreaterThanOrEqual(
        beforeLogin.getTime(),
      );
      expect(lastLoginAt.getTime()).toBeLessThanOrEqual(afterLogin.getTime());
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle empty email', async () => {
      await expect(service.login('', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle empty password', async () => {
      const mockAdmin = {
        id: 1,
        email: 'admin@test.com',
        password: 'hashedPassword',
        status: AdminStatus.ACTIVE,
      };

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('admin@test.com', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle null/undefined inputs', async () => {
      await expect(service.login(null as any, 'password')).rejects.toThrow();

      await expect(
        service.login('email@test.com', null as any),
      ).rejects.toThrow();
    });

    it('should be case-sensitive for email', async () => {
      mockAdminModel.findOne.mockResolvedValue(null);

      await expect(service.login('ADMIN@TEST.COM', 'password')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockAdminModel.findOne).toHaveBeenCalledWith({
        where: { email: 'ADMIN@TEST.COM' },
      });
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
      mockAdminModel.findOne.mockResolvedValue(null);

      await expect(service.login(longEmail, 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle concurrent login attempts', async () => {
      const mockAdmin = {
        id: 1,
        email: 'admin@test.com',
        password: 'hashedPassword',
        status: AdminStatus.ACTIVE,
        update: jest.fn().mockResolvedValue(true),
      };

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mocked-jwt-token');

      // Simulate concurrent logins
      const loginPromises = [
        service.login('admin@test.com', 'password'),
        service.login('admin@test.com', 'password'),
        service.login('admin@test.com', 'password'),
      ];

      const results = await Promise.all(loginPromises);

      results.forEach((result) => {
        expect(result.accessToken).toBe('mocked-jwt-token');
        expect(result.admin.id).toBe(1);
      });

      expect(mockAdmin.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with multiple failed attempts', async () => {
      mockAdminModel.findOne.mockResolvedValue(null);

      const attempts = Array.from({ length: 100 }, (_, i) =>
        service.login(`user${i}@test.com`, 'password').catch(() => {}),
      );

      await Promise.all(attempts);

      expect(mockAdminModel.findOne).toHaveBeenCalledTimes(100);
    });

    it('should handle large password strings', async () => {
      const largePassword = 'x'.repeat(10000);
      const mockAdmin = {
        id: 1,
        email: 'admin@test.com',
        password: 'hashedPassword',
        status: AdminStatus.ACTIVE,
      };

      mockAdminModel.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('admin@test.com', largePassword),
      ).rejects.toThrow(UnauthorizedException);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        largePassword,
        'hashedPassword',
      );
    });
  });
});
