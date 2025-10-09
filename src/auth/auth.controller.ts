import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
  ApiBearerAuth,
  ApiConsumes, 
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { InfluencerSignupMultipartDto } from './dto/influencer-signup-multipart.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandSignupMultipartDto } from './dto/brand-signup-multipart.dto';
import { BrandInitialSignupDto } from './dto/brand-initial-signup.dto';
import { BrandProfileCompletionDto } from './dto/brand-profile-completion.dto';
import { BrandProfileCompletionMultipartDto } from './dto/brand-profile-completion-multipart.dto';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { ApiFileFields } from './decorators/api-file.decorator';
import { BrandLoginDto } from './dto/brand-login.dto';
import { BrandVerifyOtpDto } from './dto/brand-verify-otp.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import { LogoutDto } from './dto/logout.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from './guards/auth.guard';
import Request from 'express';
import { UploadedFiles } from '@nestjs/common';
import { GENDER_OPTIONS, OTHERS_GENDER_OPTIONS } from './types/gender.enum';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('influencer/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP for influencer',
    description: 'Send OTP to influencer phone number for verification',
  })
  @ApiBody({ type: RequestOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        message: 'OTP sent successfully',
        phone: '+919467289789',
        expiresIn: 300,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists with this phone number',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to send OTP',
  })
  async requestInfluencerOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  @Post('influencer/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP for influencer',
    description: 'Verify the OTP sent to influencer phone number',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      example: {
        message: 'OTP verified successfully',
        phone: '+919467289789',
        verified: true,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to verify OTP',
  })
  @ApiHeader({
    name: 'device-id',
    description: 'Unique device identifier for session tracking',
    required: false,
  })
  async verifyInfluencerOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Headers('device-id') deviceId?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] as string | undefined;
    return this.authService.verifyOtp(verifyOtpDto, deviceId, userAgent);
  }

  @Post('influencer/signup')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('profileImage', {
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB for profile image
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'x-verification-key',
    description: 'Verification key received after OTP verification',
    required: true,
    example: 'verify_1640995200000_abc123def',
  })
  @ApiOperation({
    summary: 'Sign up influencer with file upload',
    description:
      'Create a new influencer account with optional profile image upload. Bio is optional. Requires x-verification-key header from OTP verification.',
  })
  @ApiFileFields(['profileImage'], {
    name: {
      type: 'string',
      description: 'Full name of the influencer',
      example: 'Dhruv Bhatia',
      required: true,
    },
    username: {
      type: 'string',
      description: 'Unique username for the influencer',
      example: 'dhruv_1109',
      required: true,
    },
    dateOfBirth: {
      type: 'string',
      description: 'Date of birth in YYYY-MM-DD format',
      example: '1995-01-15',
      required: true,
    },
    gender: {
      type: 'string',
      enum: [
        'Male',
        'Female',
        'Abinary',
        'Trans-Women',
        'Gay',
        'Binary',
        'Trans-Feminine',
      ],
      description:
        'Gender of the influencer - can be Male, Female, or any custom gender option',
      required: true,
    },
    bio: {
      type: 'string',
      description: 'Bio or description about the influencer (optional)',
      example: '',
      required: false,
    },
    nicheIds: {
      type: 'string',
      description:
        'Array of niche IDs. Accepts JSON array "[1,4,12]" or comma-separated "1,4,12"',
      example: '[1,4,12]',
      required: true,
    },
    fcmToken: {
      type: 'string',
      description: 'FCM token for push notifications (optional)',
      required: false,
    },
    customNiches: {
      type: 'string',
      description:
        'Array of custom niche names. Accepts JSON array ["Sustainable Fashion","Tech Reviews"] or comma-separated "Sustainable Fashion,Tech Reviews" (optional, max 5 total including regular niches)',
      example: '["Sustainable Fashion","Tech Reviews"]',
      required: false,
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Influencer registered and logged in successfully',
    schema: {
      example: {
        message: 'Influencer registered and logged in successfully',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        influencer: {
          id: 1,
          name: 'Dhruv Bhatia',
          username: 'dhruv_1109',
          phone: '+919467289789',
          dateOfBirth: '1995-01-15',
          gender: 'Male',
          bio: 'Fashion and lifestyle influencer', // optional
          profileImage:
            'https://your-bucket.s3.region.amazonaws.com/profiles/influencer-123456789.jpg', // optional
          isPhoneVerified: true,
          lastLoginAt: '2024-01-15T10:30:00.000Z',
          niches: [
            {
              id: 1,
              name: 'Fashion',
              description: 'Fashion and style content',
              isActive: true,
            },
            {
              id: 4,
              name: 'Beauty',
              description: 'Beauty and makeup content',
              isActive: true,
            },
          ],
          customNiches: [
            {
              id: 1,
              name: 'Sustainable Fashion',
              description: '',
              isActive: true,
            },
            {
              id: 2,
              name: 'Tech Reviews',
              description: '',
              isActive: true,
            },
          ],
        },
        profileCompleted: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data provided or unsupported file format',
  })
  @ApiResponse({
    status: 401,
    description: 'Phone number not verified',
  })
  @ApiResponse({
    status: 409,
    description: 'User or username already exists',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 10MB)',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to create influencer account',
  })
  async influencerSignup(
    @Body() signupDto: InfluencerSignupMultipartDto,
    @Headers('x-verification-key') verificationKey: string,
    @UploadedFile() profileImage?: Express.Multer.File,
  ) {
    return this.authService.influencerSignup(
      signupDto as InfluencerSignupDto,
      verificationKey,
      profileImage,
    );
  }

  @Get('niches')
  @ApiOperation({
    summary: 'Get all available niches',
    description: 'Fetch all active niches that influencers can choose from',
  })
  @ApiResponse({
    status: 200,
    description: 'Niches fetched successfully',
    schema: {
      example: {
        message: 'Niches fetched successfully',
        niches: [
          {
            id: 1,
            name: 'Fashion',
            description: 'Fashion, style, and clothing content',
          },
          {
            id: 2,
            name: 'Food',
            description: 'Food, cooking, and culinary content',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch niches',
  })
  async getNiches() {
    return this.authService.getNiches();
  }

  @Get('gender-options')
  @ApiOperation({
    summary: 'Get available gender options',
    description: 'Fetch all available gender options for user registration',
  })
  @ApiResponse({
    status: 200,
    description: 'Gender options fetched successfully',
    schema: {
      example: {
        message: 'Gender options fetched successfully',
        genderOptions: ['Male', 'Female', 'Others'],
        othersGenderOptions: [
          'Abinary',
          'Trans-Women',
          'Gay',
          'Binary',
          'Trans-Feminine',
        ],
      },
    },
  })
  getGenderOptions() {
    return {
      message: 'Gender options fetched successfully',
      genderOptions: GENDER_OPTIONS,
      othersGenderOptions: OTHERS_GENDER_OPTIONS,
    };
  }

  @Post('check-username')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check username availability',
    description: 'Check if a username is available and get suggestions if not',
  })
  @ApiBody({ type: CheckUsernameDto })
  @ApiResponse({
    status: 200,
    description: 'Username availability checked successfully',
    schema: {
      oneOf: [
        {
          // Available username response (no suggestions needed)
          type: 'object',
          properties: {
            available: { type: 'boolean', example: true },
            username: { type: 'string', example: 'dhruv_1109' },
            message: {
              type: 'string',
              example: 'Username is unique and available to use',
            },
          },
        },
        {
          // Unavailable username response with suggestions
          type: 'object',
          properties: {
            available: { type: 'boolean', example: false },
            username: { type: 'string', example: 'john_doe' },
            message: { type: 'string', example: 'Username is already taken' },
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              example: [
                'john_doe_1',
                'john_doe_official',
                'john_doe_2025',
                'john_doe_user',
                'john_doe_pro',
              ],
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid username format',
  })
  async checkUsername(@Body() checkUsernameDto: CheckUsernameDto) {
    return this.authService.checkUsernameAvailability(checkUsernameDto);
  }

  // Brand endpoints - Two-step signup
  @Post('initial-signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initial brand signup - Step 1',
    description:
      'Create brand account with email and password, then send OTP for verification',
  })
  @ApiBody({ type: BrandInitialSignupDto })
  @ApiResponse({
    status: 200,
    description: 'Brand account created and OTP sent successfully',
    schema: {
      example: {
        message:
          'Account created successfully. OTP sent to your email for verification.',
        email: 'brand@example.com',
        requiresOtp: true,
        brandId: 1,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Brand already exists with this email',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to create brand account',
  })
  @ApiHeader({
    name: 'device-id',
    description: 'Unique device identifier for session tracking',
    required: false,
  })
  async brandInitialSignup(
    @Body() signupDto: BrandInitialSignupDto,
    @Headers('device-id') deviceId?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] as string | undefined;
    return this.authService.brandInitialSignup(signupDto, deviceId, userAgent);
  }

  @Post('brand/complete-profile')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profileImage', maxCount: 1 },
        { name: 'incorporationDocument', maxCount: 1 },
        { name: 'gstDocument', maxCount: 1 },
        { name: 'panDocument', maxCount: 1 },
      ],
      {
        fileFilter: (req, file, callback) => {
          // Allow images for profileImage
          if (file.fieldname === 'profileImage') {
            if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
              return callback(
                new Error('Profile image must be jpg, jpeg, png, or webp'),
                false,
              );
            }
          }
          // Allow PDF and images for documents
          else if (
            ['incorporationDocument', 'gstDocument', 'panDocument'].includes(
              file.fieldname,
            )
          ) {
            if (!file.mimetype.match(/\/(pdf|jpg|jpeg|png|webp)$/)) {
              return callback(
                new Error('Documents must be PDF, jpg, jpeg, png, or webp'),
                false,
              );
            }
          }
          callback(null, true);
        },
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB max for any file
        },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Complete brand profile - Step 2',
    description:
      'Complete brand profile with all required information and optional file uploads',
  })
  @ApiFileFields(
    ['profileImage', 'incorporationDocument', 'gstDocument', 'panDocument'],
    {
      brandName: {
        type: 'string',
        description: 'Brand name',
        example: 'Example Brand Inc.',
        required: true,
      },
      username: {
        type: 'string',
        description: 'Unique username for the brand',
        example: 'example_brand',
        required: true,
      },
      legalEntityName: {
        type: 'string',
        description: 'Legal entity name as registered',
        example: 'Example Brand Private Limited',
        required: true,
      },
      companyType: {
        type: 'string',
        enum: [
          'Private Limited Company (Pvt. Ltd.)',
          'Public Limited Company (PLC)',
          'One-Person Company (OPC)',
          'Limited Liability Partnership (LLP)',
          'Partnership Firm',
          'Sole Proprietorship',
          'Joint Venture (JV)',
          'Section 8 Company',
          'Foreign Company',
        ],
        description: 'Type of company registration',
        required: true,
      },
      pocName: {
        type: 'string',
        description: 'Point of contact name',
        example: 'John Smith',
        required: true,
      },
      pocDesignation: {
        type: 'string',
        description: 'Point of contact designation',
        example: 'Marketing Manager',
        required: true,
      },
      pocEmailId: {
        type: 'string',
        description: 'Point of contact email address',
        example: 'john.smith@examplebrand.com',
        required: true,
      },
      pocContactNumber: {
        type: 'string',
        description: 'Point of contact phone number',
        example: '+919876543210',
        required: true,
      },
      brandBio: {
        type: 'string',
        description: 'Brand bio or description (optional)',
        example:
          'We are a leading fashion brand focused on sustainable clothing.',
        required: false,
      },
      nicheIds: {
        type: 'string',
        description:
          'Array of niche IDs. Accepts JSON array "[1,4,12]" or comma-separated "1,4,12"',
        example: '[1,4,12]',
        required: true,
      },
      fcmToken: {
        type: 'string',
        description: 'FCM token for push notifications (optional)',
        required: false,
      },
    },
  )
  @ApiResponse({
    status: 200,
    description: 'Brand profile completed successfully',
    schema: {
      example: {
        message: 'Profile completed successfully',
        brand: {
          id: 1,
          email: 'brand@example.com',
          brandName: 'Example Brand Inc.',
          username: 'example_brand',
          isProfileCompleted: true,
          profileImage: 'https://s3-url/profile.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 409,
    description: 'Username or phone number already exists',
  })
  async brandCompleteProfile(
    @Body() profileDto: BrandProfileCompletionMultipartDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      incorporationDocument?: Express.Multer.File[];
      gstDocument?: Express.Multer.File[];
      panDocument?: Express.Multer.File[];
    },
    @Req() req: Request & { user: { id: number; profileCompleted: boolean } },
  ) {
    // Validate file sizes
    const maxProfileImageSize = 5 * 1024 * 1024; // 5MB
    const maxDocumentSize = 10 * 1024 * 1024; // 10MB

    if (
      files?.profileImage?.[0] &&
      files.profileImage[0].size > maxProfileImageSize
    ) {
      throw new BadRequestException('Profile image size must not exceed 5MB');
    }

    return this.authService.brandCompleteProfile(
      req.user.id,
      profileDto as BrandProfileCompletionDto,
      files,
    );
  }

  @Post('brand/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Brand login',
    description: 'Authenticate brand using email and password',
  })
  @ApiBody({ type: BrandLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        message: 'Login successful',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        brand: {
          id: 1,
          email: 'brand@example.com',
          phone: '+919467289789',
          brandName: 'Example Brand',
          username: 'example_brand',
        },
      },
    },
  })
  @ApiHeader({
    name: 'device-id',
    description: 'Unique device identifier for session tracking',
    required: false,
  })
  async brandLogin(
    @Body() loginDto: BrandLoginDto,
    @Headers('device-id') deviceId?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] as string | undefined;
    return this.authService.brandLogin(loginDto, deviceId, userAgent as string);
  }

  @Post('brand/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify brand email OTP',
    description:
      'Verify the OTP sent to brand email address to complete login process.',
  })
  @ApiBody({ type: BrandVerifyOtpDto })
  @ApiHeader({
    name: 'device-id',
    description: 'Device ID for session management',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully, login completed',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        brand: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            email: { type: 'string' },
            phone: { type: 'string' },
            brandName: { type: 'string' },
            username: { type: 'string' },
            isProfileCompleted: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid OTP' },
      },
    },
  })
  async verifyBrandOtp(
    @Body() verifyOtpDto: BrandVerifyOtpDto,
    @Headers('device-id') deviceId?: string,
    @Req() req?: Request,
  ) {
    const userAgent = req?.headers['user-agent'] as string | undefined;
    return this.authService.verifyBrandOtp(
      verifyOtpDto,
      deviceId,
      userAgent as string,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout from a single device',
    description: 'Revoke the provided refresh token (single session logout).',
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: 200,
    description: 'Logout successful.',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid refresh token',
        error: 'Unauthorized',
      },
    },
  })
  async logout(@Body() logoutDto: LogoutDto): Promise<LogoutResponseDto> {
    return this.authService.logout(logoutDto);
  }

  @UseGuards(AuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Revoke all active sessions for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'All sessions terminated successfully.',
    type: LogoutResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
        error: 'Unauthorized',
      },
    },
  })
  async logoutAll(
    @Req() req: Request & { user: { id: number } },
  ): Promise<LogoutResponseDto> {
    return this.authService.logoutAll(req.user.id);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchange a valid refresh token for a new access token and refresh token.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Token refresh successful.',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token.',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid refresh token',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Refresh token has been revoked.',
    schema: {
      example: {
        statusCode: 403,
        message: 'Refresh token revoked',
        error: 'Forbidden',
      },
    },
  })
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('brand/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset for brand',
    description:
      'Send a password reset link to the brand email address. The link contains a secure JWT token that expires in 1 hour.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description:
      'Password reset email sent successfully (or email not found - same response for security)',
    schema: {
      example: {
        message: 'If the email exists, a password reset link has been sent',
        success: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email format',
    schema: {
      example: {
        statusCode: 400,
        message: ['Please provide a valid email address'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal server error while processing forgot password request',
    schema: {
      example: {
        statusCode: 500,
        message: 'Failed to process forgot password request',
        error: 'Internal Server Error',
      },
    },
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('brand/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset brand password using token',
    description:
      'Reset the brand password using the token received via email. This will log out the brand from all devices for security.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    schema: {
      example: {
        message:
          'Password has been reset successfully. Please log in with your new password.',
        success: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'Reset token is required',
          'Password must be at least 8 characters long',
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        ],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, or already used reset token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid or expired reset token',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error while resetting password',
    schema: {
      example: {
        statusCode: 500,
        message: 'Failed to reset password',
        error: 'Internal Server Error',
      },
    },
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Delete('delete-account')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user account',
    description:
      'Deletes the authenticated user account (influencer or brand) and logs out all sessions. The account can be restored within 30 days by logging in again. After 30 days, the account will be permanently deleted.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully',
    schema: {
      example: {
        message: 'Account deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async deleteAccount(@Req() req: Request & { user: { id: number; userType: 'influencer' | 'brand' } }) {
    return this.authService.deleteAccount(req.user.id, req.user.userType);
  }
}
