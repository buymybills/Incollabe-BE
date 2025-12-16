import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpStatus,
  Query,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthService } from './admin-auth.service';
import { ProfileReviewService } from './profile-review.service';
import { AdminCampaignService } from './services/admin-campaign.service';
import { AdminPostService } from './services/admin-post.service';
import { InfluencerScoringService } from './services/influencer-scoring.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { BrandService } from '../brand/brand.service';
import { InfluencerService } from '../influencer/influencer.service';
import { PostService } from '../post/post.service';
import { AuthService } from '../auth/auth.service';
import { CampaignService } from '../campaign/campaign.service';
import { S3Service } from '../shared/s3.service';
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
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { TopInfluencersResponseDto } from './dto/top-influencer-response.dto';
import {
  DashboardRequestDto,
  CampaignDashboardRequestDto,
  PostDashboardRequestDto,
  MainDashboardResponseDto,
  InfluencerDashboardResponseDto,
  BrandDashboardResponseDto,
  CampaignDashboardResponseDto,
  PostDashboardResponseDto,
  DashboardTimeFrame,
  TimeFrameOptionsResponseDto,
} from './dto/admin-dashboard.dto';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import {
  VerifyLoginOtpDto,
  ResendLoginOtpDto,
} from './dto/verify-login-otp.dto';
import {
  RefreshTokenDto,
  AdminRefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  Enable2FADto,
  Disable2FADto,
  TwoFactorStatusDto,
  TwoFactorResponseDto,
  BrowserSessionsResponseDto,
  LogoutSessionResponseDto,
  DeleteAccountDto,
  DeleteAccountResponseDto,
} from './dto/admin-settings.dto';
import { LogoutDto, LogoutResponseDto } from './dto/logout.dto';
import { GetAuditLogsDto, AuditLogListResponseDto } from './dto/audit-log.dto';
import { UpdateDisplayOrderDto } from './dto/update-display-order.dto';
import { AuditLogService } from './services/audit-log.service';
import { ReferralProgramService } from './services/referral-program.service';
import { MaxxSubscriptionAdminService } from './services/maxx-subscription-admin.service';
import { MaxSubscriptionBrandService } from './services/max-subscription-brand.service';
import { SupportTicketService } from '../shared/support-ticket.service';
import { CreateSupportTicketDto } from '../shared/dto/create-support-ticket.dto';
import { GetSupportTicketsDto } from '../shared/dto/get-support-tickets.dto';
import { UpdateSupportTicketDto } from '../shared/dto/update-support-ticket.dto';
import {
  GetNewAccountsWithReferralDto,
  NewAccountsWithReferralResponseDto,
  GetAccountReferrersDto,
  AccountReferrersResponseDto,
  GetReferralTransactionsDto,
  ReferralTransactionsResponseDto,
  ReferralProgramStatisticsDto,
  GetRedemptionRequestsDto,
  RedemptionRequestsResponseDto,
  ProcessRedemptionDto,
  ProcessRedemptionResponseDto,
} from './dto/referral-program.dto';
import {
  GetMaxxSubscriptionsDto,
  MaxxSubscriptionStatisticsDto,
  MaxxSubscriptionsResponseDto,
  SubscriptionDetailsDto,
  PauseSubscriptionDto,
  ResumeSubscriptionDto,
  CancelSubscriptionDto,
  SubscriptionActionResponseDto,
} from './dto/maxx-subscription.dto';
import {
  MaxSubscriptionBrandStatisticsDto,
  GetMaxPurchasesDto,
  MaxPurchasesResponseDto,
} from './dto/max-subscription-brand.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly profileReviewService: ProfileReviewService,
    private readonly adminCampaignService: AdminCampaignService,
    private readonly adminPostService: AdminPostService,
    private readonly influencerScoringService: InfluencerScoringService,
    private readonly dashboardStatsService: DashboardStatsService,
    private readonly referralProgramService: ReferralProgramService,
    private readonly maxxSubscriptionAdminService: MaxxSubscriptionAdminService,
    private readonly maxSubscriptionBrandService: MaxSubscriptionBrandService,
    private readonly brandService: BrandService,
    private readonly influencerService: InfluencerService,
    private readonly postService: PostService,
    private readonly auditLogService: AuditLogService,
    private readonly supportTicketService: SupportTicketService,
    private readonly authService: AuthService,
    private readonly campaignService: CampaignService,
    private readonly s3Service: S3Service,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate admin user with email and password. If 2FA is enabled, sends OTP to email. If 2FA is disabled, returns tokens directly.',
  })
  @ApiBody({
    description: 'Admin login credentials',
    type: AdminLoginDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful - Returns OTP requirement status or tokens',
    type: AdminLoginResponseDto,
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
    type: AdminRefreshTokenResponseDto,
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

  @Post('upload')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        // Accept images only
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload file to S3',
    description:
      'Generic admin file upload endpoint. Upload images for various admin features. Domain parameter determines S3 folder structure.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'domain',
    required: true,
    enum: [
      'push_notification',
      'campaigns',
      'banners',
      'profiles',
      'posts',
      'brands',
      'influencers',
    ],
    description: 'Domain/folder name for S3 storage',
    example: 'push_notification',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload (max 10MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        url: {
          type: 'string',
          example: 'https://bucket.s3.region.amazonaws.com/push_notification/image-123.jpg',
        },
        fileName: { type: 'string', example: 'banner.jpg' },
        fileSize: { type: 'number', example: 2048576 },
        fileType: { type: 'string', example: 'image/jpeg' },
        domain: { type: 'string', example: 'push_notification' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file type, missing file, or invalid domain',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('domain') domain: string,
  ) {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate domain parameter
    if (!domain || typeof domain !== 'string') {
      throw new BadRequestException('Domain parameter is required');
    }

    // Whitelist allowed domains
    const allowedDomains = [
      'push_notification',
      'campaigns',
      'banners',
      'profiles',
      'posts',
      'brands',
      'influencers',
    ];

    if (!allowedDomains.includes(domain)) {
      throw new BadRequestException(
        `Invalid domain. Allowed domains: ${allowedDomains.join(', ')}`,
      );
    }

    // Upload to S3
    const fileUrl = await this.s3Service.uploadFileToS3(
      file,
      domain,
      'admin',
    );

    return {
      success: true,
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      domain,
    };
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

  // ==================== Admin Settings APIs ====================

  @Put('change-password')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change admin password',
    description:
      'Change password for authenticated admin. Requires current password for verification.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
    type: ChangePasswordResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Current password is incorrect',
  })
  @ApiBadRequestResponse({
    description: 'Passwords do not match or invalid format',
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.changePassword(
      req.admin.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      changePasswordDto.confirmPassword,
    );
  }

  @Get('2fa-status')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get 2FA status',
    description: 'Check if two-factor authentication is enabled for admin',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA status retrieved successfully',
    type: TwoFactorStatusDto,
  })
  async get2FAStatus(@Req() req: RequestWithAdmin) {
    return await this.adminAuthService.get2FAStatus(req.admin.id);
  }

  @Post('enable-2fa')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enable two-factor authentication',
    description:
      'Enable 2FA for admin account. OTP will be sent to email during login.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA enabled successfully',
    type: TwoFactorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Password is incorrect',
  })
  async enable2FA(
    @Body() enable2FADto: Enable2FADto,
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.enable2FA(
      req.admin.id,
      enable2FADto.password,
    );
  }

  @Post('disable-2fa')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description:
      'Disable 2FA for admin account. Requires password confirmation.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA disabled successfully',
    type: TwoFactorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Password is incorrect',
  })
  async disable2FA(
    @Body() disable2FADto: Disable2FADto,
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.disable2FA(
      req.admin.id,
      disable2FADto.password,
    );
  }

  @Get('sessions')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active browser sessions',
    description:
      'Get all active browser sessions for admin. Shows device info, IP address, and last activity.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active sessions retrieved successfully',
    type: BrowserSessionsResponseDto,
  })
  async getActiveSessions(@Req() req: RequestWithAdmin) {
    if (!req.admin.jti) {
      throw new UnauthorizedException('Session ID not found in token');
    }
    return await this.adminAuthService.getActiveSessions(
      req.admin.id,
      req.admin.jti,
    );
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout specific session',
    description:
      'Logout from a specific browser session. Cannot logout current session.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID (JTI) to logout',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Session logged out successfully',
    type: LogoutSessionResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Cannot logout current session',
  })
  @ApiNotFoundResponse({
    description: 'Session not found',
  })
  async logoutSession(
    @Param('sessionId') sessionId: string,
    @Req() req: RequestWithAdmin,
  ) {
    if (!req.admin.jti) {
      throw new UnauthorizedException('Session ID not found in token');
    }
    return await this.adminAuthService.logoutSession(
      req.admin.id,
      sessionId,
      req.admin.jti,
    );
  }

  @Delete('account')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete admin account',
    description:
      'Permanently delete admin account. Requires password and confirmation text. Cannot delete last super admin.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account deleted successfully',
    type: DeleteAccountResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Password is incorrect',
  })
  @ApiBadRequestResponse({
    description: 'Invalid confirmation text',
  })
  @ApiForbiddenResponse({
    description: 'Cannot delete last super admin',
  })
  async deleteAccount(
    @Body() deleteAccountDto: DeleteAccountDto,
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.deleteAccount(
      req.admin.id,
      deleteAccountDto.password,
      deleteAccountDto.confirmationText,
      deleteAccountDto.reason,
    );
  }

  // ==================== End Admin Settings APIs ====================

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
      'Get brand and/or influencer profiles that are pending verification, ordered by submission time. Optionally filter by profileType to get only brands or only influencers. Supports pagination.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending profiles retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
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
        pagination: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 50 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 3 },
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
      filters.profileType,
      filters.page || 1,
      filters.limit || 20,
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

  @Get('campaigns')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get campaigns with filters, search, and sorting',
    description:
      'Get campaigns with multiple filters: campaignFilter (allCampaigns, openCampaigns, inviteCampaigns) controls invite type tabs, statusFilter (active, draft, completed, paused, cancelled) controls campaign status dropdown. Supports search by campaign name/title, brand name, location (city), and niche. Campaign type filter (paid/barter/hybrid) available via campaignType parameter. Sorting by createdAt, applications, or title supported.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaigns retrieved successfully with filters applied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getCampaigns(@Query() requestDto: GetCampaignsDto) {
    return await this.adminCampaignService.getCampaigns(requestDto);
  }

  @Get('posts')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get posts with filters, search, and sorting',
    description:
      'Get posts with multiple filters: postFilter (allPosts, influencerPosts, brandPosts) controls user type tabs. Supports search by post content, user name (influencer or brand), and location (city). Sorting by createdAt, likes, or engagement supported.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Posts retrieved successfully with filters applied',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getPosts(@Query() requestDto: GetPostsDto) {
    return await this.adminPostService.getPosts(requestDto);
  }

  @Get('posts/user/:userType/:userId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get posts by specific user (Admin)',
    description: 'Get all posts created by a specific influencer or brand user',
  })
  @ApiParam({
    name: 'userType',
    enum: ['influencer', 'brand'],
    description: 'User type',
  })
  @ApiParam({ name: 'userId', description: 'User ID', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User posts retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getUserPosts(
    @Param('userType') userType: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: any,
  ) {
    // Use the existing PostService.getPosts with userType and userId
    const getPostsDto = { ...query, userType, userId };
    return await this.postService.getPosts(getPostsDto);
  }

  @Get('audit-logs')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get audit logs for admin actions',
    description:
      'Retrieve audit logs with filters: section (Auth, Campaigns, Notification Centre, etc.), action type, admin/employee ID, target type, date range, and search. Logs include employee name, email, audit section, audit type, details, IP address, user agent, and timestamp.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs retrieved successfully',
    type: AuditLogListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getAuditLogs(@Query() filters: GetAuditLogsDto) {
    return await this.auditLogService.getAuditLogs(filters);
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

  @Put('influencer/:influencerId/display-order')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update influencer display order',
    description:
      'Update the display order of an influencer for manual positioning in admin lists. Lower numbers appear first.',
  })
  @ApiParam({
    name: 'influencerId',
    description: 'ID of the influencer',
    type: 'number',
  })
  @ApiBody({
    type: UpdateDisplayOrderDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Display order updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Display order updated successfully',
        },
        displayOrder: { type: 'number', example: 1 },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  @ApiNotFoundResponse({
    description: 'Influencer not found',
  })
  async updateInfluencerDisplayOrder(
    @Param('influencerId', ParseIntPipe) influencerId: number,
    @Body() body: UpdateDisplayOrderDto,
    @Req() req: RequestWithAdmin,
  ) {
    return await this.adminAuthService.updateInfluencerDisplayOrder(
      influencerId,
      body.displayOrder,
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

  @Get('brand/profile/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get brand public profile (as seen by users)',
    description:
      'Get the complete public profile of a brand including bio, social links, platform metrics (followers, posts, campaigns), and recent campaigns list. Supports pagination and filtering for campaigns.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the brand',
    type: 'number',
  })
  @ApiQuery({
    name: 'campaignPage',
    required: false,
    type: Number,
    description: 'Page number for campaign pagination (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'campaignLimit',
    required: false,
    type: Number,
    description: 'Number of campaigns per page (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'campaignFilter',
    required: false,
    enum: ['invite', 'open'],
    description:
      'Filter campaigns by type: "invite" for invite-only campaigns, "open" for open campaigns. Omit to show all campaigns.',
    example: 'open',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand public profile retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Brand not found',
  })
  async getBrandPublicProfile(
    @Param('id', ParseIntPipe) id: number,
    @Query('campaignPage') campaignPage?: number,
    @Query('campaignLimit') campaignLimit?: number,
    @Query('campaignFilter') campaignFilter?: 'invite' | 'open',
  ) {
    return await this.brandService.getBrandProfile(
      id,
      undefined,
      undefined,
      campaignPage,
      campaignLimit,
      campaignFilter,
    );
  }

  @Get('influencer/profile/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get influencer public profile (as seen by users)',
    description:
      'Get the complete public profile of an influencer including bio, social links, platform metrics (followers, posts, completed campaigns), niches, and experience',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of the influencer',
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Influencer public profile retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Influencer not found',
  })
  async getInfluencerPublicProfile(@Param('id', ParseIntPipe) id: number) {
    const profile = await this.influencerService.getInfluencerProfile(id, true);

    // Fetch experiences for the influencer
    const experiences = await this.influencerService.getExperiences(
      id,
      undefined,
      1,
      100,
    );

    // Return public fields with experiences
    return {
      ...profile,
      collaborationCosts: profile.collaborationCosts || {},
      experiences:
        typeof experiences === 'object' && 'experiences' in experiences
          ? experiences.experiences
          : [],
    };
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

  @Get('dashboard/timeframe-options')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get time frame options for dashboard dropdowns',
    description:
      'Returns available time frame options (Last 24 hours, Last 7 days, etc.) for chart filters with their values, labels, and descriptions.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Time frame options retrieved successfully',
    type: TimeFrameOptionsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  getTimeFrameOptions() {
    return this.dashboardStatsService.getTimeFrameOptions();
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
      'Get detailed influencer analytics including city presence, city distribution, daily active influencers time series, and niche distribution. Supports different time frames for the chart data. For custom date ranges, set timeFrame=custom and provide startDate and endDate.',
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
      requestDto.startDate,
      requestDto.endDate,
    );
  }

  @Get('dashboard/brands')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get brand dashboard statistics',
    description:
      'Get detailed brand analytics including city presence, city distribution, daily active brands time series, and niche distribution. Supports different time frames for the chart data. For custom date ranges, set timeFrame=custom and provide startDate and endDate.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Brand dashboard statistics retrieved successfully',
    type: BrandDashboardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getBrandDashboardStats(@Query() requestDto: DashboardRequestDto) {
    return await this.dashboardStatsService.getBrandDashboardStats(
      requestDto.timeFrame || DashboardTimeFrame.LAST_7_DAYS,
      requestDto.startDate,
      requestDto.endDate,
    );
  }

  @Get('dashboard/campaigns')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get campaign dashboard statistics',
    description:
      'Get detailed campaign analytics with separate date ranges: chartTimeFrame (24h/3d/7d/15d/30d) for time series chart, and metricsStartDate/metricsEndDate (monthly range like Sep 2025-Oct 2025) for aggregate metrics (cards, city presence, categories).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campaign dashboard statistics retrieved successfully',
    type: CampaignDashboardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getCampaignDashboardStats(
    @Query() requestDto: CampaignDashboardRequestDto,
  ) {
    return await this.dashboardStatsService.getCampaignDashboardStats(
      requestDto.chartTimeFrame || DashboardTimeFrame.LAST_7_DAYS,
      requestDto.chartStartDate,
      requestDto.chartEndDate,
      requestDto.metricsStartDate,
      requestDto.metricsEndDate,
    );
  }

  @Get('dashboard/posts')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get post/content dashboard statistics',
    description:
      'Get detailed content/post analytics with separate date ranges: chartTimeFrame (24h/3d/7d/15d/30d) for time series chart (Content Posted vs Engagement), and metricsStartDate/metricsEndDate (monthly range like Sep 2025-Oct 2025) for aggregate metrics (cards, city presence, categories).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Post dashboard statistics retrieved successfully',
    type: PostDashboardResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getPostDashboardStats(@Query() requestDto: PostDashboardRequestDto) {
    return await this.dashboardStatsService.getPostDashboardStats(requestDto);
  }

  @Get('dashboard/date-range')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get available date range',
    description:
      'Get the earliest and latest dates where data exists in the system. Use this to populate date range dropdowns in the frontend.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available date range retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        minDate: {
          type: 'string',
          description: 'Earliest date with data (YYYY-MM-DD)',
          example: '2024-01-01',
        },
        maxDate: {
          type: 'string',
          description: 'Latest date with data (YYYY-MM-DD)',
          example: '2025-11-01',
        },
        influencerMinDate: {
          type: 'string',
          description: 'Earliest influencer registration date (YYYY-MM-DD)',
          example: '2024-01-15',
        },
        influencerMaxDate: {
          type: 'string',
          description: 'Latest influencer registration date (YYYY-MM-DD)',
          example: '2025-11-01',
        },
        brandMinDate: {
          type: 'string',
          description: 'Earliest brand registration date (YYYY-MM-DD)',
          example: '2024-01-01',
        },
        brandMaxDate: {
          type: 'string',
          description: 'Latest brand registration date (YYYY-MM-DD)',
          example: '2025-10-31',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getAvailableDateRange() {
    return await this.dashboardStatsService.getAvailableDateRange();
  }

  // ============================================
  // REFERRAL PROGRAM
  // ============================================

  @Get('referral-program/statistics')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get referral program statistics',
    description:
      'Get comprehensive referral program statistics including total referral codes generated, accounts created with referral, amount spent, and redeem requests with month-over-month growth percentages',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Referral program statistics retrieved successfully',
    type: ReferralProgramStatisticsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getReferralProgramStatistics() {
    return await this.referralProgramService.getReferralStatistics();
  }

  @Get('referral-program/new-accounts')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get new accounts created with referral codes',
    description:
      'Get paginated list of new accounts (influencers) that were created using referral codes. Supports filtering by verification status, search, and date range.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New accounts with referral retrieved successfully',
    type: NewAccountsWithReferralResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getNewAccountsWithReferral(@Query() filters: GetNewAccountsWithReferralDto) {
    return await this.referralProgramService.getNewAccountsWithReferral(filters);
  }

  @Get('referral-program/account-referrers')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get list of influencers who have referred others',
    description:
      'Get paginated list of influencers who have referral codes and have referred other users. Includes total referrals count, earnings, redeemed and pending amounts. Supports search and sorting.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Account referrers retrieved successfully',
    type: AccountReferrersResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getAccountReferrers(@Query() filters: GetAccountReferrersDto) {
    return await this.referralProgramService.getAccountReferrers(filters);
  }

  @Get('referral-program/transactions')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get referral transaction history',
    description:
      'Get paginated list of all referral bonus transactions. Supports filtering by payment status, search by influencer, and date range.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Referral transactions retrieved successfully',
    type: ReferralTransactionsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getReferralTransactions(@Query() filters: GetReferralTransactionsDto) {
    return await this.referralProgramService.getReferralTransactions(filters);
  }

  @Get('referral-program/redemption-requests')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get redemption requests',
    description:
      'Get paginated list of credit redemption requests from influencers. Supports filtering by status, search by influencer, sorting, and date range.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Redemption requests retrieved successfully',
    type: RedemptionRequestsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getRedemptionRequests(@Query() filters: GetRedemptionRequestsDto) {
    return await this.referralProgramService.getRedemptionRequests(filters);
  }

  @Put('referral-program/redemption-requests/:id/process')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Process a redemption request',
    description:
      'Mark a redemption request as processed (paid). Sends a push notification to the influencer confirming the payment. Requires SUPER_ADMIN or CONTENT_MODERATOR role.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Redemption processed successfully',
    type: ProcessRedemptionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - requires SUPER_ADMIN or CONTENT_MODERATOR role',
  })
  @ApiNotFoundResponse({
    description: 'Redemption request not found',
  })
  @ApiBadRequestResponse({
    description: 'Redemption request already processed or cancelled',
  })
  async processRedemption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessRedemptionDto,
    @Req() req: any,
  ) {
    const adminId = req.admin.id;
    return await this.referralProgramService.processRedemption(id, adminId, dto);
  }

  // ============================================
  // MAXX SUBSCRIPTION
  // ============================================

  @Get('maxx-subscription/statistics')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Maxx subscription statistics',
    description:
      'Get comprehensive statistics for Maxx (Pro) subscriptions including total profiles, active/inactive counts, average usage duration, and autopay subscriptions with month-over-month growth percentages',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Maxx subscription statistics retrieved successfully',
    type: MaxxSubscriptionStatisticsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMaxxSubscriptionStatistics() {
    return await this.maxxSubscriptionAdminService.getMaxxSubscriptionStatistics();
  }

  @Get('maxx-subscription/subscriptions')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Maxx subscriptions list',
    description:
      'Get paginated list of Maxx (Pro) subscriptions with filters for status, payment type, search, and date range. Supports sorting by usage months or valid till date.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Maxx subscriptions retrieved successfully',
    type: MaxxSubscriptionsResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMaxxSubscriptions(@Query() filters: GetMaxxSubscriptionsDto) {
    return await this.maxxSubscriptionAdminService.getMaxxSubscriptions(filters);
  }

  @Get('maxx-subscription/subscriptions/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Maxx subscription details',
    description:
      'Get detailed information about a specific Maxx (Pro) subscription including influencer details, payment history, pause information, and subscription status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription details retrieved successfully',
    type: SubscriptionDetailsDto,
  })
  @ApiNotFoundResponse({
    description: 'Subscription not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMaxxSubscriptionDetails(@Param('id', ParseIntPipe) id: number) {
    return await this.maxxSubscriptionAdminService.getSubscriptionDetails(id);
  }

  @Put('maxx-subscription/subscriptions/:id/pause')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pause a Maxx subscription',
    description:
      'Admin action to pause a Maxx (Pro) subscription. Requires Super Admin or Content Moderator role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: 123,
  })
  @ApiBody({ type: PauseSubscriptionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription paused successfully',
    type: SubscriptionActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Subscription not found',
  })
  @ApiBadRequestResponse({
    description: 'Cannot pause this subscription (already paused or cancelled)',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  async pauseMaxxSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PauseSubscriptionDto,
  ) {
    return await this.maxxSubscriptionAdminService.pauseSubscription(id, dto);
  }

  @Put('maxx-subscription/subscriptions/:id/resume')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resume a paused Maxx subscription',
    description:
      'Admin action to resume a paused Maxx (Pro) subscription. Adjusts billing dates based on pause duration. Requires Super Admin or Content Moderator role.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: 123,
  })
  @ApiBody({ type: ResumeSubscriptionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription resumed successfully',
    type: SubscriptionActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Subscription not found',
  })
  @ApiBadRequestResponse({
    description: 'Subscription is not paused',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  async resumeMaxxSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResumeSubscriptionDto,
  ) {
    return await this.maxxSubscriptionAdminService.resumeSubscription(id, dto);
  }

  @Put('maxx-subscription/subscriptions/:id/cancel')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel a Maxx subscription',
    description:
      'Admin action to cancel a Maxx (Pro) subscription. Can cancel immediately or at period end. Requires Super Admin role only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: 123,
  })
  @ApiBody({ type: CancelSubscriptionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription cancelled successfully',
    type: SubscriptionActionResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Subscription not found',
  })
  @ApiBadRequestResponse({
    description: 'Subscription is already cancelled',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Super Admin only',
  })
  async cancelMaxxSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return await this.maxxSubscriptionAdminService.cancelSubscription(id, dto);
  }

  // ============================================
  // MAX SUBSCRIPTION - BRAND
  // ============================================

  @Get('max-subscription-brand/statistics')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Max Campaign Brand statistics',
    description:
      'Get comprehensive statistics for brand Max Campaign purchases including total profiles, active/inactive campaigns, and cancelled subscriptions with month-over-month growth percentages',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Max subscription brand statistics retrieved successfully',
    type: MaxSubscriptionBrandStatisticsDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMaxSubscriptionBrandStatistics() {
    return await this.maxSubscriptionBrandService.getStatistics();
  }

  @Get('max-subscription-brand/purchases')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get list of Max Campaign purchases by brands',
    description:
      'Get paginated list of Max Campaign purchases with filters for purchase type (Invite Campaign vs Maxx Campaign), status, search, and date range. Supports sorting by date or amount.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Max campaign purchases retrieved successfully',
    type: MaxPurchasesResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getMaxPurchases(@Query() filters: GetMaxPurchasesDto) {
    return await this.maxSubscriptionBrandService.getMaxPurchases(filters);
  }

  // ============================================
  // SUPPORT TICKETS
  // ============================================

  @Get('support-tickets')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all support tickets',
    description:
      'Get all support tickets with filters for status, priority, report type, user type. Supports search and pagination.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Support tickets retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getAllSupportTickets(@Query() filters: GetSupportTicketsDto) {
    return await this.supportTicketService.getAllTickets(filters);
  }

  @Get('support-tickets/statistics')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get support ticket statistics',
    description:
      'Get statistics about support tickets including counts by status, type, and priority',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getSupportTicketStatistics() {
    return await this.supportTicketService.getTicketStatistics();
  }

  @Get('support-tickets/:id')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get support ticket details',
    description: 'Get detailed information about a specific support ticket',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ticket details retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  async getSupportTicketById(@Param('id', ParseIntPipe) id: number) {
    return await this.supportTicketService.getTicketById(id);
  }

  @Put('support-tickets/:id')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update support ticket',
    description:
      'Update ticket status, priority, add admin notes, or provide resolution',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: 'number',
  })
  @ApiBody({
    type: UpdateSupportTicketDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ticket updated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions',
  })
  async updateSupportTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSupportTicketDto,
    @Req() req: RequestWithAdmin,
  ) {
    return await this.supportTicketService.updateTicket(
      id,
      updateDto,
      req.admin.id,
    );
  }

  @Delete('support-tickets/:id')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete support ticket',
    description: 'Permanently delete a support ticket (Super Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: 'number',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ticket deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
  })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Super Admin only',
  })
  async deleteSupportTicket(@Param('id', ParseIntPipe) id: number) {
    return await this.supportTicketService.deleteTicket(id);
  }

  // Master Data Endpoints
  @Get('niches')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all niches',
    description: 'Fetch all active niches that influencers and brands can choose from',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Niches fetched successfully',
  })
  async getNiches() {
    return await this.authService.getNiches();
  }

  @Get('cities/popular')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get popular cities',
    description: 'Get tier 1 and tier 2 cities commonly used for campaign targeting',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Popular cities retrieved successfully',
  })
  async getPopularCities() {
    return await this.campaignService.getPopularCities();
  }

  @Get('cities/search')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search cities',
    description: 'Search cities by name for campaign targeting. Returns popular cities if query is less than 2 characters.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search query for city name (minimum 2 characters)',
    example: 'Mumb',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cities retrieved successfully',
  })
  async searchCities(@Query('q') query: string) {
    return await this.campaignService.searchCities(query);
  }

  // Credit Transaction Management Endpoints
  @Get('credit-transactions')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.PROFILE_REVIEWER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all credit transactions',
    description:
      'Retrieve all credit transactions with optional filters for payment status, transaction type, and influencer',
  })
  @ApiQuery({
    name: 'paymentStatus',
    required: false,
    enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
    description: 'Filter by payment status',
  })
  @ApiQuery({
    name: 'transactionType',
    required: false,
    enum: ['referral_bonus', 'early_selection_bonus'],
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'influencerId',
    required: false,
    type: Number,
    description: 'Filter by influencer ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credit transactions retrieved successfully',
  })
  async getCreditTransactions(
    @Query('paymentStatus') paymentStatus?: string,
    @Query('transactionType') transactionType?: string,
    @Query('influencerId') influencerId?: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return await this.profileReviewService.getCreditTransactions({
      paymentStatus,
      transactionType,
      influencerId,
      page,
      limit,
    });
  }

  @Put('credit-transactions/:id/status')
  @UseGuards(AdminAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update credit transaction payment status',
    description:
      'Update the payment status of a credit transaction (mark as paid, failed, etc.)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Transaction ID',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        paymentStatus: {
          type: 'string',
          enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
        },
        paymentReferenceId: {
          type: 'string',
          description: 'Payment reference/transaction ID',
        },
        adminNotes: {
          type: 'string',
          description: 'Admin notes about the payment',
        },
      },
      required: ['paymentStatus'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction status updated successfully',
  })
  async updateCreditTransactionStatus(
    @Param('id', ParseIntPipe) transactionId: number,
    @Body()
    updateData: {
      paymentStatus: string;
      paymentReferenceId?: string;
      adminNotes?: string;
    },
    @Req() req: RequestWithAdmin,
  ) {
    return await this.profileReviewService.updateCreditTransactionStatus(
      transactionId,
      updateData,
      req.admin.id,
    );
  }
}
