import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { ProfileReviewService } from './profile-review.service';
import { AdminCampaignService } from './services/admin-campaign.service';
import { InfluencerScoringService } from './services/influencer-scoring.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import type { RequestWithAdmin } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { AdminRole, AdminStatus } from './models/admin.model';
import { ProfileType } from './models/profile-review.model';

// DTOs
import { AdminLoginDto, AdminLoginResponseDto } from './dto/admin-login.dto';
import { CreateAdminDto, CreateAdminResponseDto } from './dto/create-admin.dto';
import {
  ApproveProfileDto,
  RejectProfileDto,
  PendingProfileDto,
  ProfileDetailsDto,
  DashboardStatsDto,
  ReviewActionResponseDto,
  GetPendingProfilesDto,
} from './dto/profile-review.dto';
import {
  AdminSearchDto,
  AdminSearchResultDto,
  UserType,
} from './dto/admin-search.dto';
import {
  TopBrandsRequestDto,
  TopBrandsResponseDto,
} from './dto/top-brands.dto';
import {
  TopCampaignsRequestDto,
  TopCampaignsResponseDto,
} from './dto/top-campaigns.dto';
import { GetTopInfluencersDto } from './dto/get-top-influencers.dto';
import { GetInfluencersDto } from './dto/get-influencers.dto';
import { GetBrandsDto } from './dto/get-brands.dto';
import { TopInfluencersResponseDto } from './dto/top-influencer-response.dto';
import {
  DashboardRequestDto,
  MainDashboardResponseDto,
  InfluencerDashboardResponseDto,
  DashboardTimeFrame,
} from './dto/admin-dashboard.dto';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import {
  VerifyLoginOtpDto,
  ResendLoginOtpDto,
} from './dto/verify-login-otp.dto';
import { RefreshTokenDto, RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { LogoutDto, LogoutResponseDto } from './dto/logout.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly profileReviewService: ProfileReviewService,
    private readonly adminCampaignService: AdminCampaignService,
    private readonly influencerScoringService: InfluencerScoringService,
    private readonly dashboardStatsService: DashboardStatsService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Admin login - Step 1',
    description:
      'Authenticate admin user with email and password. Sends OTP to email for 2FA verification.',
  })
  @ApiBody({
    description: 'Admin login credentials',
    type: AdminLoginDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP sent to email - Requires OTP verification',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'OTP sent to your email. Please verify to complete login.',
        },
        email: { type: 'string', example: 'admin@example.com' },
        requiresOtp: { type: 'boolean', example: true },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or account inactive/suspended',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async login(@Body() loginData: AdminLoginDto) {
    return await this.adminAuthService.login(
      loginData.email,
      loginData.password,
    );
  }

  @Post('verify-otp')
  @ApiOperation({
    summary: 'Admin login - Step 2: Verify OTP',
    description:
      'Verify OTP sent to email and complete login. Returns access token, refresh token, and admin profile on success.',
  })
  @ApiBody({
    description: 'Email and OTP for verification',
    type: VerifyLoginOtpDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'OTP verified successfully - Returns access token, refresh token, and admin profile',
    type: AdminLoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired OTP, or too many failed attempts',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: {
          type: 'string',
          example: 'Invalid OTP or Too many failed attempts',
        },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  async verifyOtp(@Body() verifyOtpData: VerifyLoginOtpDto) {
    return await this.adminAuthService.verifyLoginOtp(
      verifyOtpData.email,
      verifyOtpData.otp,
    );
  }

  @Post('resend-otp')
  @ApiOperation({
    summary: 'Resend OTP for admin login',
    description:
      'Resend OTP to admin email if previous OTP expired or was not received.',
  })
  @ApiBody({
    description: 'Admin email address',
    type: ResendLoginOtpDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New OTP sent to email',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'New OTP sent to your email' },
        email: { type: 'string', example: 'admin@example.com' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Admin not found',
  })
  async resendOtp(@Body() resendOtpData: ResendLoginOtpDto) {
    return await this.adminAuthService.resendLoginOtp(resendOtpData.email);
  }

  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchange a valid refresh token for a new access token and refresh token.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refresh successful',
    type: RefreshTokenResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token',
  })
  @ApiForbiddenResponse({
    description: 'Refresh token has been revoked',
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return await this.adminAuthService.refreshToken(
      refreshTokenDto.refreshToken,
    );
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Logout from current device',
    description: 'Revoke the refresh token to logout from the current device.',
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successful',
    type: LogoutResponseDto,
  })
  async logout(@Body() logoutDto: LogoutDto) {
    return await this.adminAuthService.logout(logoutDto.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description:
      'Revoke all refresh tokens to logout from all devices. Requires authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout from all devices successful',
    type: LogoutResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async logoutAll(@Req() req: RequestWithAdmin) {
    return await this.adminAuthService.logoutAll(req.admin.id);
  }

  @Post('create')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new admin',
    description:
      'Create a new admin user with specified role and permissions. Admin status is automatically set to ACTIVE. Only Super Admins can create new admin accounts.',
  })
  @ApiBody({
    description: 'New admin user details',
    type: CreateAdminDto,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Admin created successfully',
    type: CreateAdminResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - Invalid or missing JWT token',
  })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions - Only Super Admin can create admins',
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or admin with email already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Admin with this email already exists',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async createAdmin(@Body() createAdminData: CreateAdminDto) {
    return await this.adminAuthService.createAdmin(createAdminData);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Admin forgot password',
    description:
      'Request password reset link for admin account. Sends reset token via email.',
  })
  @ApiBody({
    description: 'Admin email address for password reset',
    type: ForgotPasswordDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Password reset instructions sent (response same for security even if email not found)',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'If the email exists, a password reset link has been sent',
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid email format',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.adminAuthService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Admin reset password',
    description:
      'Reset admin password using token received via email. Invalidates all existing sessions.',
  })
  @ApiBody({
    description: 'Password reset token and new password',
    type: ResetPasswordDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful - All sessions logged out',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'Password has been reset successfully. Please log in with your new password.',
        },
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired reset token',
  })
  @ApiBadRequestResponse({
    description: 'Invalid password format or missing required fields',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.adminAuthService.resetPassword(resetPasswordDto);
  }

  @Get('profile')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get admin profile',
    description: 'Get current authenticated admin user profile information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'admin@collabkaroo.com' },
        role: { type: 'string', example: 'super_admin' },
        status: { type: 'string', example: 'active' },
        profileImage: {
          type: 'string',
          example: 'https://s3.amazonaws.com/profile.jpg',
        },
        lastLoginAt: { type: 'string', example: '2024-01-15T10:30:00Z' },
        createdAt: { type: 'string', example: '2024-01-01T00:00:00Z' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - Invalid or missing JWT token',
  })
  async getProfile(@Req() req: RequestWithAdmin) {
    return await this.adminAuthService.getAdminProfile(req.admin.id);
  }

  @Get('reviews/pending')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.PROFILE_REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get pending profile reviews',
    description:
      'Get brand and/or influencer profiles that are pending verification, ordered by submission time. Optionally filter by profileType to get only brands or only influencers.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending profiles retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          profileId: { type: 'number', example: 123 },
          profileType: {
            type: 'string',
            enum: ['brand', 'influencer'],
            example: 'influencer',
          },
          status: { type: 'string', example: 'pending' },
          submittedAt: { type: 'string', example: '2024-01-15T10:30:00Z' },
          profile: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 123 },
              name: { type: 'string', example: 'John Doe' },
              email: { type: 'string', example: 'john@example.com' },
              isProfileCompleted: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions - Only Super Admin and Profile Reviewer can access',
  })
  async getPendingProfiles(
    @Req() req: RequestWithAdmin,
    @Query() filters: GetPendingProfilesDto,
  ) {
    return await this.profileReviewService.getPendingProfiles(
      req.admin.id,
      filters.profileType,
    );
  }

  @Get('reviews/profile/:profileId/:profileType')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.PROFILE_REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get profile details for review',
    description:
      'Get comprehensive profile information for verification including all profile data, social links, documents, and review history',
  })
  @ApiParam({
    name: 'profileId',
    description: 'ID of the profile to review',
    example: 123,
    type: 'number',
  })
  @ApiParam({
    name: 'profileType',
    description: 'Type of profile',
    enum: ProfileType,
    example: 'influencer',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile details retrieved successfully',
    type: ProfileDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Profile not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  async getProfileDetails(
    @Param('profileId', ParseIntPipe) profileId: number,
    @Param('profileType') profileType: ProfileType,
  ) {
    return await this.profileReviewService.getProfileDetails(
      profileId,
      profileType,
    );
  }

  @Put('reviews/:reviewId/approve')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.PROFILE_REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve profile',
    description:
      'Approve a profile verification request. This will update the profile status to verified and send approval notifications to the user via email and WhatsApp.',
  })
  @ApiParam({
    name: 'reviewId',
    description: 'ID of the review record',
    example: 1,
    type: 'number',
  })
  @ApiBody({
    description: 'Approval details',
    type: ApproveProfileDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile approved successfully',
    type: ReviewActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  @ApiBadRequestResponse({
    description: 'Profile is not pending review',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  async approveProfile(
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Req() req: RequestWithAdmin,
    @Body() body: ApproveProfileDto,
  ) {
    return await this.profileReviewService.approveProfile(
      reviewId,
      req.admin.id,
      body.comments,
    );
  }

  @Put('reviews/:reviewId/reject')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.PROFILE_REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject profile',
    description:
      'Reject a profile verification request with a detailed reason. This will send rejection notifications to the user via email and WhatsApp with the reason and next steps.',
  })
  @ApiParam({
    name: 'reviewId',
    description: 'ID of the review record',
    example: 1,
    type: 'number',
  })
  @ApiBody({
    description: 'Rejection details with reason',
    type: RejectProfileDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile rejected successfully',
    type: ReviewActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Review not found',
  })
  @ApiBadRequestResponse({
    description: 'Profile is not pending review or invalid rejection reason',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  async rejectProfile(
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Req() req: RequestWithAdmin,
    @Body() body: RejectProfileDto,
  ) {
    return await this.profileReviewService.rejectProfile(
      reviewId,
      req.admin.id,
      body.reason,
      body.comments,
    );
  }

  @Get('dashboard/stats')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Get comprehensive overview statistics for admin dashboard including pending reviews, daily approval/rejection counts, and total user counts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard statistics retrieved successfully',
    type: DashboardStatsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getDashboardStats() {
    return await this.profileReviewService.getDashboardStats();
  }

  @Get('dashboard/comprehensive')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get comprehensive dashboard metrics',
    description:
      'Get all dashboard metrics including total counts, verified/unverified users, campaign statistics, pending verifications, and month-over-month growth percentages',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comprehensive dashboard statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalInfluencers: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 3200 },
            growth: { type: 'number', example: 36 },
          },
        },
        totalBrands: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 3200 },
            growth: { type: 'number', example: 36 },
          },
        },
        totalCampaigns: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 3200 },
            growth: { type: 'number', example: 36 },
          },
        },
        verifiedInfluencers: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1200 },
            growth: { type: 'number', example: -2.9 },
          },
        },
        verifiedBrands: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1200 },
            growth: { type: 'number', example: -2.9 },
          },
        },
        campaignsLive: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1200 },
            growth: { type: 'number', example: -2.9 },
          },
        },
        unverifiedInfluencers: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1200 },
            growth: { type: 'number', example: -2.9 },
          },
        },
        unverifiedBrands: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1200 },
            growth: { type: 'number', example: -2.9 },
          },
        },
        campaignsCompleted: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 1200 },
            growth: { type: 'number', example: -2.9 },
          },
        },
        influencersPendingVerification: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 32 },
          },
        },
        brandsPendingVerification: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 32 },
          },
        },
        totalCampaignApplications: {
          type: 'object',
          properties: {
            count: { type: 'number', example: 32000 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getComprehensiveDashboardStats() {
    return await this.adminAuthService.getComprehensiveDashboardStats();
  }

  @Get('dashboard/top-brands')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get top performing brands',
    description:
      'Get top brands based on 4 key metrics: campaigns launched, niche diversity, influencers selected, and average payout. Results can be filtered by timeframe and sorted by different metrics.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top brands retrieved successfully',
    type: TopBrandsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getTopBrands(@Query() requestDto: TopBrandsRequestDto) {
    return await this.adminAuthService.getTopBrands(requestDto);
  }

  @Get('brands')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get brands with profile filters, search, and sorting',
    description:
      'Get brands based on profile filters: allProfile (all profiles), topProfile (scored brands using comprehensive metrics), verifiedProfile (verified profiles), or unverifiedProfile (unverified profiles). Supports search by brand name, username, location (city), and niche, and sorting by posts, followers, following, campaigns, or createdAt. For topProfile filter, the same scoring metrics as top-brands API are used.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brands retrieved successfully based on selected filter',
    type: TopBrandsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getBrands(@Query() requestDto: GetBrandsDto) {
    return await this.adminAuthService.getBrands(requestDto);
  }

  @Get('dashboard/top-campaigns')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get top performing campaigns',
    description:
      'Get top campaigns based on comprehensive metrics including applications, conversion rate, budget, geographic reach, niches, selected influencers, completion rate, and recency. Supports multiple sorting options and filters.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top campaigns retrieved successfully',
    type: TopCampaignsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getTopCampaigns(@Query() requestDto: TopCampaignsRequestDto) {
    return await this.adminAuthService.getTopCampaigns(requestDto);
  }

  @Get('dashboard/top-influencers')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get top influencers with comprehensive scoring and search',
    description:
      'Get top influencers based on 6 key metrics: niche match (30%), engagement rate (25%), audience relevance (15%), location match (15%), past performance (10%), and collaboration charges match (5%). Supports search by name, username, location (city), and niche. Results include detailed score breakdown for each influencer and can be filtered by various criteria. Admins can customize the weights for each metric.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top influencers retrieved successfully with scoring details',
    type: TopInfluencersResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getTopInfluencers(@Query() requestDto: GetTopInfluencersDto) {
    return await this.influencerScoringService.getTopInfluencers(requestDto);
  }

  @Get('influencers')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get influencers with profile filters, search, and sorting',
    description:
      'Get influencers based on profile filters: allProfile (all profiles), topProfile (scored influencers using comprehensive metrics), verifiedProfile (verified profiles), or unverifiedProfile (unverified profiles). Supports search by name, username, location (city), and niche, and sorting by posts, followers, following, campaigns, or createdAt. For topProfile filter, the same scoring metrics as top-influencers API are used.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Influencers retrieved successfully based on selected filter',
    type: TopInfluencersResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getInfluencers(@Query() requestDto: GetInfluencersDto) {
    return await this.influencerScoringService.getInfluencers(requestDto);
  }

  @Put('influencer/:influencerId/top-status')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle top influencer status',
    description: 'Mark or unmark an influencer as top influencer (admin only)',
  })
  @ApiParam({
    name: 'influencerId',
    description: 'ID of the influencer',
    type: 'number',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isTopInfluencer: {
          type: 'boolean',
          description: 'Whether to mark as top influencer',
          example: true,
        },
      },
      required: ['isTopInfluencer'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top influencer status updated successfully',
  })
  async updateTopInfluencerStatus(
    @Param('influencerId', ParseIntPipe) influencerId: number,
    @Body() body: { isTopInfluencer: boolean },
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.updateTopInfluencerStatus(
      influencerId,
      body.isTopInfluencer,
      req.admin.id,
    );
  }

  @Put('brand/:brandId/top-status')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle top brand status',
    description: 'Mark or unmark a brand as top brand (admin only)',
  })
  @ApiParam({
    name: 'brandId',
    description: 'ID of the brand',
    type: 'number',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isTopBrand: {
          type: 'boolean',
          description: 'Whether to mark as top brand',
          example: true,
        },
      },
      required: ['isTopBrand'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top brand status updated successfully',
  })
  async updateTopBrandStatus(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Body() body: { isTopBrand: boolean },
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.updateTopBrandStatus(
      brandId,
      body.isTopBrand,
      req.admin.id,
    );
  }

  @Get('search/users')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search and filter influencers and brands',
    description:
      'Admin endpoint to search, filter, and manage all users (influencers and brands)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users found successfully',
    type: AdminSearchResultDto,
  })
  async searchUsers(@Query() searchDto: AdminSearchDto) {
    return await this.adminAuthService.searchUsers(searchDto);
  }

  // Brand Management Endpoints
  @Get('brands')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List and filter brands',
    description:
      'Admin endpoint to list, search, and filter brands with pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brands retrieved successfully',
    type: AdminSearchResultDto,
  })
  async listBrands(@Query() searchDto: AdminSearchDto) {
    const brandSearchDto = { ...searchDto, userType: UserType.BRAND };
    return await this.adminAuthService.searchUsers(brandSearchDto);
  }

  @Get('brands/:brandId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get brand details',
    description: 'Get comprehensive brand information for admin review',
  })
  @ApiParam({
    name: 'brandId',
    description: 'ID of the brand',
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand details retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Brand not found',
  })
  async getBrandDetails(@Param('brandId', ParseIntPipe) brandId: number) {
    return await this.adminAuthService.getBrandDetails(brandId);
  }

  @Put('brands/:brandId/status')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update brand status',
    description: 'Activate or deactivate a brand account (Super Admin only)',
  })
  @ApiParam({
    name: 'brandId',
    description: 'ID of the brand',
    type: 'number',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isActive: {
          type: 'boolean',
          description: 'Whether the brand should be active',
          example: true,
        },
      },
      required: ['isActive'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand status updated successfully',
  })
  async updateBrandStatus(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Body() body: { isActive: boolean },
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.updateBrandStatus(
      brandId,
      body.isActive,
      req.admin.id,
    );
  }

  @Get('brands/search/advanced')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Advanced brand search',
    description:
      'Advanced search and filtering for brands with brand-specific filters',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand search results retrieved successfully',
    type: AdminSearchResultDto,
  })
  async advancedBrandSearch(@Query() searchDto: AdminSearchDto) {
    const brandSearchDto = { ...searchDto, userType: UserType.BRAND };
    return await this.adminAuthService.advancedBrandSearch(brandSearchDto);
  }

  @Get('campaigns/:id/applications')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get campaign applications with AI scoring',
    description:
      'Get all applications for a campaign with AI-powered relevance scoring, strengths/concerns analysis, and smart sorting',
  })
  @ApiParam({
    name: 'id',
    description: 'Campaign ID',
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign applications retrieved successfully with AI scores',
    schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number', example: 123 },
        totalApplications: { type: 'number', example: 50 },
        topMatches: {
          type: 'array',
          description: 'Top 10 highly recommended influencers',
          items: {
            type: 'object',
            properties: {
              applicationId: { type: 'number', example: 1 },
              influencer: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 123 },
                  name: { type: 'string', example: 'Jane Doe' },
                  username: { type: 'string', example: '@janedoe' },
                  followers: { type: 'number', example: 50000 },
                  engagementRate: { type: 'number', example: 5.2 },
                  niches: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['Fashion', 'Lifestyle'],
                  },
                  location: { type: 'string', example: 'Mumbai' },
                },
              },
              aiScore: { type: 'number', example: 85 },
              recommendation: {
                type: 'string',
                enum: ['Highly Recommended', 'Recommended', 'Consider'],
                example: 'Highly Recommended',
              },
              strengths: {
                type: 'array',
                items: { type: 'string' },
                example: [
                  'Perfect niche alignment',
                  'High engagement rate (5.2%)',
                ],
              },
              concerns: {
                type: 'array',
                items: { type: 'string' },
                example: [],
              },
              appliedAt: {
                type: 'string',
                example: '2024-01-15T10:30:00Z',
              },
              status: { type: 'string', example: 'pending' },
              scoreBreakdown: {
                type: 'object',
                properties: {
                  overall: { type: 'number', example: 85 },
                  nicheMatch: { type: 'number', example: 90 },
                  audienceRelevance: { type: 'number', example: 80 },
                  engagementRate: { type: 'number', example: 85 },
                  locationMatch: { type: 'number', example: 100 },
                  pastPerformance: { type: 'number', example: 70 },
                  contentQuality: { type: 'number', example: 75 },
                },
              },
            },
          },
        },
        otherApplications: {
          type: 'array',
          description: 'Other applications (paginated)',
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 50 },
            total: { type: 'number', example: 40 },
            totalPages: { type: 'number', example: 1 },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Campaign not found',
  })
  async getCampaignApplications(
    @Param('id', ParseIntPipe) campaignId: number,
    @Query('sortBy')
    sortBy?: 'relevance' | 'date' | 'engagement' | 'followers' | null,
    @Query('filter')
    filter?: 'all' | 'highly_recommended' | 'recommended' | 'consider' | null,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return await this.adminCampaignService.getCampaignApplicationsWithAI(
      campaignId,
      {
        sortBy: sortBy || undefined,
        filter: filter || undefined,
        page,
        limit,
      },
    );
  }

  @Get('dashboard/main')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get main dashboard statistics',
    description:
      'Get comprehensive statistics for the main admin dashboard including influencers, brands, campaigns metrics with percentage changes vs last month, and lists of top influencers, top brands, and top campaigns.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Main dashboard statistics retrieved successfully',
    type: MainDashboardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMainDashboardStats() {
    return await this.dashboardStatsService.getMainDashboardStats();
  }

  @Get('dashboard/influencers')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get influencer dashboard statistics',
    description:
      'Get detailed influencer analytics including city presence, city distribution, daily active influencers time series, and niche distribution. Supports different time frames for the chart data.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Influencer dashboard statistics retrieved successfully',
    type: InfluencerDashboardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getInfluencerDashboardStats(@Query() requestDto: DashboardRequestDto) {
    return await this.dashboardStatsService.getInfluencerDashboardStats(
      requestDto.timeFrame || DashboardTimeFrame.LAST_7_DAYS,
    );
  }
}
