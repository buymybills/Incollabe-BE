import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { InfluencerSignupMultipartDto } from './dto/influencer-signup-multipart.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandLoginDto } from './dto/brand-login.dto';
import { BrandVerifyOtpDto } from './dto/brand-verify-otp.dto';
import { CheckUsernameDto } from './dto/check-username.dto';

const mockAuthService = {
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  verifyBrandOtp: jest.fn(),
  influencerSignup: jest.fn(),
  // brandSignup: jest.fn(), // Commented out - replaced with two-step signup
  brandInitialSignup: jest.fn(),
  // verifyBrandOtpAndLogin: jest.fn(), // Merged into verifyBrandOtp
  brandCompleteProfile: jest.fn(),
  brandLogin: jest.fn(),
  getNiches: jest.fn(),
  checkUsernameAvailability: jest.fn(),
  deleteAccount: jest.fn(),
};

const mockAuthGuard = {
  canActivate: jest.fn(() => true),
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestInfluencerOtp', () => {
    it('should request OTP for influencer', async () => {
      const requestOtpDto: RequestOtpDto = { phone: '9467289789' };
      const expectedResult = {
        message: 'OTP sent successfully',
        phone: '+919467289789',
        expiresIn: 300,
      };

      mockAuthService.requestOtp.mockResolvedValue(expectedResult);

      const result = await controller.requestInfluencerOtp(requestOtpDto);

      expect(authService.requestOtp).toHaveBeenCalledWith(requestOtpDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyInfluencerOtp', () => {
    it('should verify OTP for influencer', async () => {
      const verifyOtpDto: VerifyOtpDto = { phone: '9467289789', otp: '123456' };
      const deviceId = 'device-123';
      const userAgent = 'Mozilla/5.0 (test browser)';
      const mockReq = { headers: { 'user-agent': userAgent } } as any;
      const expectedResult = {
        message: 'OTP verified successfully',
        phone: '+919467289789',
        verified: true,
      };

      mockAuthService.verifyOtp.mockResolvedValue(expectedResult);

      const result = await controller.verifyInfluencerOtp(
        verifyOtpDto,
        deviceId,
        mockReq,
      );

      expect(authService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpDto,
        deviceId,
        userAgent,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle missing device ID and user agent', async () => {
      const verifyOtpDto: VerifyOtpDto = { phone: '9467289789', otp: '123456' };
      const expectedResult = {
        message: 'OTP verified successfully',
        phone: '+919467289789',
        verified: true,
      };

      mockAuthService.verifyOtp.mockResolvedValue(expectedResult);

      const result = await controller.verifyInfluencerOtp(verifyOtpDto);

      expect(authService.verifyOtp).toHaveBeenCalledWith(
        verifyOtpDto,
        undefined,
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('influencerSignup', () => {
    it('should signup influencer', async () => {
      const signupDto: InfluencerSignupMultipartDto = {
        name: 'Test User',
        username: 'test_user',
        dateOfBirth: '1995-01-15',
        gender: 'Male',
        bio: 'Test bio',
        nicheIds: [1, 2],
      };
      const verificationKey = 'verify_1640995200000_abc123def';
      const mockProfileImage = {
        fieldname: 'profileImage',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1000,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;
      const expectedResult = {
        message: 'Influencer registered successfully',
        influencer: {
          id: 1,
          name: 'Test User',
          username: 'test_user',
          phone: '+919467289789',
          isPhoneVerified: true,
          niches: [
            { id: 1, name: 'Fashion' },
            { id: 2, name: 'Beauty' },
          ],
        },
      };

      mockAuthService.influencerSignup.mockResolvedValue(expectedResult);

      const result = await controller.influencerSignup(
        signupDto,
        verificationKey,
        mockProfileImage,
      );

      expect(authService.influencerSignup).toHaveBeenCalledWith(
        signupDto,
        verificationKey,
        mockProfileImage,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getNiches', () => {
    it('should get all niches', async () => {
      const expectedResult = {
        message: 'Niches fetched successfully',
        niches: [
          {
            id: 1,
            name: 'Fashion',
            logoNormal: '<svg>Fashion Normal</svg>',
            logoDark: '<svg>Fashion Dark</svg>',
          },
          {
            id: 2,
            name: 'Beauty',
            logoNormal: '<svg>Beauty Normal</svg>',
            logoDark: '<svg>Beauty Dark</svg>',
          },
        ],
      };

      mockAuthService.getNiches.mockResolvedValue(expectedResult);

      const result = await controller.getNiches();

      expect(authService.getNiches).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('checkUsername', () => {
    it('should check username availability - available', async () => {
      const checkUsernameDto: CheckUsernameDto = { username: 'test_user' };
      const expectedResult = {
        available: true,
        username: 'test_user',
        message: 'Username is unique and available to use',
      };

      mockAuthService.checkUsernameAvailability.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.checkUsername(checkUsernameDto);

      expect(authService.checkUsernameAvailability).toHaveBeenCalledWith(
        checkUsernameDto,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should check username availability - taken with suggestions', async () => {
      const checkUsernameDto: CheckUsernameDto = { username: 'taken_user' };
      const expectedResult = {
        available: false,
        username: 'taken_user',
        message: 'Username is already taken',
        suggestions: [
          'taken_user_1',
          'taken_user_official',
          'taken_user_2025',
          'taken_user_user',
          'taken_user_pro',
        ],
      };

      mockAuthService.checkUsernameAvailability.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.checkUsername(checkUsernameDto);

      expect(authService.checkUsernameAvailability).toHaveBeenCalledWith(
        checkUsernameDto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyBrandOtp', () => {
    it('should verify OTP for brand', async () => {
      const verifyOtpDto: BrandVerifyOtpDto = {
        email: 'test@brand.com',
        otp: '123456',
      };
      const deviceId = 'device-123';
      const userAgent = 'Mozilla/5.0 (test browser)';
      const mockReq = { headers: { 'user-agent': userAgent } } as any;
      const expectedResult = {
        message: 'Login successful',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        brand: {
          id: 1,
          email: 'test@brand.com',
          brandName: 'Test Brand',
        },
      };

      mockAuthService.verifyBrandOtp.mockResolvedValue(expectedResult);

      const result = await controller.verifyBrandOtp(
        verifyOtpDto,
        deviceId,
        mockReq,
      );

      expect(authService.verifyBrandOtp).toHaveBeenCalledWith(
        verifyOtpDto,
        deviceId,
        userAgent,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('brandLogin', () => {
    it('should login brand', async () => {
      const loginDto: BrandLoginDto = {
        email: 'test@brand.com',
        password: 'password123',
      };
      const deviceId = 'device-123';
      const userAgent = 'Mozilla/5.0 (test browser)';
      const mockReq = { headers: { 'user-agent': userAgent } } as any;
      const expectedResult = {
        message: 'Login successful',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        brand: {
          id: 1,
          email: 'test@brand.com',
          brandName: 'Test Brand',
        },
        profileCompleted: true,
        requiresProfileCompletion: false,
      };

      mockAuthService.brandLogin.mockResolvedValue(expectedResult);

      const result = await controller.brandLogin(loginDto, deviceId, mockReq);

      expect(authService.brandLogin).toHaveBeenCalledWith(
        loginDto,
        deviceId,
        userAgent,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle missing device ID and user agent', async () => {
      const loginDto: BrandLoginDto = {
        email: 'test@brand.com',
        password: 'password123',
      };
      const expectedResult = {
        message: 'Login successful',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        brand: {
          id: 1,
          email: 'test@brand.com',
          brandName: 'Test Brand',
        },
      };

      mockAuthService.brandLogin.mockResolvedValue(expectedResult);

      const result = await controller.brandLogin(loginDto);

      expect(authService.brandLogin).toHaveBeenCalledWith(
        loginDto,
        undefined,
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteAccount', () => {
    it('should delete influencer account', async () => {
      const mockReq = {
        user: { id: 1, userType: 'influencer' },
      } as any;
      const expectedResult = { message: 'Account deleted successfully' };

      mockAuthService.deleteAccount.mockResolvedValue(expectedResult);

      const result = await controller.deleteAccount(mockReq);

      expect(authService.deleteAccount).toHaveBeenCalledWith(1, 'influencer');
      expect(result).toEqual(expectedResult);
    });

    it('should delete brand account', async () => {
      const mockReq = {
        user: { id: 2, userType: 'brand' },
      } as any;
      const expectedResult = { message: 'Account deleted successfully' };

      mockAuthService.deleteAccount.mockResolvedValue(expectedResult);

      const result = await controller.deleteAccount(mockReq);

      expect(authService.deleteAccount).toHaveBeenCalledWith(2, 'brand');
      expect(result).toEqual(expectedResult);
    });
  });
});
