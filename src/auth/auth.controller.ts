import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { InfluencerSignupDto } from './dto/influencer-signup.dto';
import { BrandSignupDto } from './dto/brand-signup.dto';
import { BrandLoginDto } from './dto/brand-login.dto';
import { CheckUsernameDto } from './dto/check-username.dto';
import Request from 'express';

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
    @Req() req?: Request
  ) {
    const userAgent = req?.headers['user-agent'];
    return this.authService.verifyOtp(verifyOtpDto, deviceId, userAgent);
  }

  @Post('influencer/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sign up influencer',
    description: 'Create a new influencer account with complete profile',
  })
  @ApiBody({ type: InfluencerSignupDto })
  @ApiResponse({
    status: 201,
    description: 'Influencer registered successfully',
    schema: {
      example: {
        message: 'Influencer registered successfully',
        influencer: {
          id: 1,
          name: 'Dhruv Bhatia',
          username: 'dhruv_1109',
          phone: '+919467289789',
          dateOfBirth: '1995-01-15',
          gender: 'Male',
          bio: 'Fashion and lifestyle influencer',
          isPhoneVerified: true,
          niches: [
            { id: 1, name: 'Fashion', icon: '👗' },
            { id: 4, name: 'Beauty', icon: '💄' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data provided',
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
    status: 500,
    description: 'Failed to create influencer account',
  })
  async influencerSignup(@Body() signupDto: InfluencerSignupDto) {
    return this.authService.influencerSignup(signupDto);
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
            icon: '👗',
            description: 'Fashion, style, and clothing content',
          },
          {
            id: 2,
            name: 'Food',
            icon: '🍽️',
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
            message: { type: 'string', example: 'Username is unique and available to use' },
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
              example: ['john_doe_1', 'john_doe_official', 'john_doe_2025', 'john_doe_user', 'john_doe_pro'],
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

  // Brand endpoints
  @Post('brand/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP for brand',
    description: 'Send OTP to brand phone number for verification',
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
  async requestBrandOtp(@Body() requestOtpDto: RequestOtpDto): Promise<any> {
    return this.authService.requestOtp(requestOtpDto);
  }

  @Post('brand/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Sign up brand',
    description: 'Create a new brand account with complete profile',
  })
  @ApiBody({ type: BrandSignupDto })
  @ApiResponse({
    status: 201,
    description: 'Brand registered successfully',
    schema: {
      example: {
        message: 'Brand registered successfully',
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
  async brandSignup(@Body() signupDto: BrandSignupDto) {
    return this.authService.brandSignup(signupDto);
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
    @Req() req?: Request
  ) {
    const userAgent = req?.headers['user-agent'];
    return this.authService.brandLogin(loginDto, deviceId, userAgent);
  }
}