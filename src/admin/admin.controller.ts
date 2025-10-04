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
} from './dto/profile-review.dto';
import {
  AdminSearchDto,
  AdminSearchResultDto,
  UserType,
} from './dto/admin-search.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly profileReviewService: ProfileReviewService,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate admin user with email and password to get JWT access token',
  })
  @ApiBody({
    description: 'Admin login credentials',
    type: AdminLoginDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful - Returns JWT token and admin profile',
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
      'Get all brand and influencer profiles that are pending verification, ordered by submission time',
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
  async getPendingProfiles(@Req() req: RequestWithAdmin) {
    return await this.profileReviewService.getPendingProfiles(req.admin.id);
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
}
