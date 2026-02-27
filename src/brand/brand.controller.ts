import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  SetMetadata,
  BadRequestException,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { BrandService } from './brand.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';
import { UpdateBrandNichesDto } from './dto/update-brand-niches.dto';
import { BrandProfileResponseDto } from './dto/brand-profile-response.dto';
import { CompanyTypeDto } from './dto/company-type.dto';
import { Public } from '../auth/decorators/public.decorator';
import type { SignupFiles } from '../types/file-upload.types';
import type { RequestWithUser } from '../types/request.types';
import { SupportTicketService } from '../shared/support-ticket.service';
import { CreateSupportTicketDto } from '../shared/dto/create-support-ticket.dto';
import { GetMyTicketsDto } from '../shared/dto/get-my-tickets.dto';
import { CreateTicketReplyDto } from '../shared/dto/create-ticket-reply.dto';
import { UserType } from '../shared/models/support-ticket.model';
import {
  CreateSupportTicketMultipartDto,
  CreateTicketReplyMultipartDto,
} from '../shared/dto/support-ticket-multipart.dto';
import {
  CreateTicketResponseDto,
  CreateReplyResponseDto,
  GetTicketsResponseDto,
  GetRepliesResponseDto,
} from '../shared/dto/support-ticket-response.dto';
import { S3Service } from '../shared/s3.service';
import { MaxCampaignPaymentService } from '../campaign/services/max-campaign-payment.service';
import { VerifyMaxCampaignPaymentDto } from '../campaign/dto/max-campaign.dto';
import { InviteOnlyPaymentService } from '../campaign/services/invite-only-payment.service';
import { VerifyInviteOnlyPaymentDto } from '../campaign/dto/invite-only-payment.dto';
import { AiCreditPaymentService } from './ai-credit-payment.service';
import { VerifyAiCreditPaymentDto } from './dto/ai-credit-payment.dto';

@ApiTags('Brand Profile')
@Controller('brand')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly supportTicketService: SupportTicketService,
    private readonly maxCampaignPaymentService: MaxCampaignPaymentService,
    private readonly inviteOnlyPaymentService: InviteOnlyPaymentService,
    private readonly s3Service: S3Service,
    private readonly aiCreditPaymentService: AiCreditPaymentService,
  ) {}

  @Get('company-types')
  @Public()
  @ApiOperation({
    summary: 'Get all company types',
    description:
      'Fetch all available company types for brand registration/profile update',
  })
  @ApiResponse({
    status: 200,
    description: 'Company types retrieved successfully',
    type: [CompanyTypeDto],
  })
  async getCompanyTypes(): Promise<CompanyTypeDto[]> {
    return await this.brandService.getCompanyTypes();
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get comprehensive brand profile',
    description:
      'Returns complete brand profile with all fields pre-populated for form mapping. Includes profile completion status, document information, and social links. Supports pagination for campaigns via query parameters.',
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
    status: 200,
    description: 'Brand profile retrieved successfully with all details',
    type: BrandProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only brands can access this endpoint',
  })
  async getBrandProfile(
    @Req() req: RequestWithUser,
    @Query('campaignPage') campaignPage?: number,
    @Query('campaignLimit') campaignLimit?: number,
    @Query('campaignFilter') campaignFilter?: 'invite' | 'open',
  ): Promise<BrandProfileResponseDto> {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can access this endpoint');
    }
    const brandId = req.user.id;
    return await this.brandService.getBrandProfile(
      brandId,
      undefined,
      undefined,
      campaignPage,
      campaignLimit,
      campaignFilter,
    );
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update brand profile',
    description:
      'Update brand profile with text fields and optional file uploads (profileImage, profileBanner, incorporationDocument, gstDocument, panDocument)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Brand profile update with optional file uploads',
    schema: {
      type: 'object',
      properties: {
        // Text fields from DTO
        brandBio: { type: 'string', description: 'Brand bio/description' },
        profileHeadline: { type: 'string', description: 'Profile headline' },
        websiteUrl: {
          type: 'string',
          format: 'uri',
          description: 'Brand website URL',
        },
        foundedYear: {
          type: 'number',
          description: 'Founded year',
          example: 2000,
        },
        headquarterCountryId: {
          type: 'number',
          description: 'Headquarter country ID',
          example: 1,
        },
        headquarterCityId: {
          type: 'number',
          description: 'Headquarter city ID',
          example: 1,
        },
        activeRegions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Active regions for campaigns',
        },
        facebookUrl: { type: 'string', description: 'Facebook page URL' },
        instagramUrl: { type: 'string', description: 'Instagram profile URL' },
        youtubeUrl: { type: 'string', description: 'YouTube channel URL' },
        linkedinUrl: {
          type: 'string',
          description: 'LinkedIn company page URL',
        },
        twitterUrl: { type: 'string', description: 'Twitter/X profile URL' },
        fcmToken: {
          type: 'string',
          description: 'Firebase Cloud Messaging token for push notifications',
          example: 'dxyz123abc...',
        },
        nicheIds: {
          type: 'string',
          description:
            'Array of regular niche IDs (1-5 niches allowed). Accepts JSON array [1,2,3] or comma-separated "1,2,3".',
          example: '[1,2,3]',
        },
        customNiches: {
          type: 'string',
          description:
            'Array of custom niche names for bulk replacement. Accepts JSON array ["Sustainable Fashion","Tech Reviews"] or comma-separated "Sustainable Fashion,Tech Reviews". Will replace ALL existing custom niches.',
          example: '["Sustainable Fashion","Tech Reviews"]',
        },

        // File upload fields
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file (JPG, PNG, etc.)',
        },
        profileBanner: {
          type: 'string',
          format: 'binary',
          description: 'Profile banner image file (JPG, PNG, etc.)',
        },
        clearProfileBanner: {
          type: 'boolean',
          description:
            'Set to true to clear/remove the profile banner. If false or not provided, existing banner is preserved unless a new file is uploaded.',
          example: false,
        },
        incorporationDocument: {
          type: 'string',
          format: 'binary',
          description: 'Company incorporation document (PDF, JPG, PNG)',
        },
        gstDocument: {
          type: 'string',
          format: 'binary',
          description: 'GST registration document (PDF, JPG, PNG)',
        },
        panDocument: {
          type: 'string',
          format: 'binary',
          description: 'PAN document (PDF, JPG, PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Brand profile updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profileImage', maxCount: 1 },
        { name: 'profileBanner', maxCount: 1 },
        { name: 'incorporationDocument', maxCount: 1 },
        { name: 'gstDocument', maxCount: 1 },
        { name: 'panDocument', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB per file
          fieldSize: 10 * 1024 * 1024, // 10MB for field data
        },
      },
    ),
  )
  async updateBrandProfile(
    @Req() req: RequestWithUser,
    @Body() updateBrandProfileDto: UpdateBrandProfileDto,
    @UploadedFiles() files: SignupFiles,
  ) {
    // Check if user is a brand
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can update brand profiles');
    }

    // Validate file sizes - 5MB for profile image and banner
    const maxImageSize = 5 * 1024 * 1024; // 5MB

    if (files?.profileImage?.[0] && files.profileImage[0].size > maxImageSize) {
      throw new BadRequestException('Profile image size must not exceed 5MB');
    }

    if (
      files?.profileBanner?.[0] &&
      files.profileBanner[0].size > maxImageSize
    ) {
      throw new BadRequestException('Profile banner size must not exceed 5MB');
    }

    const brandId = req.user.id;
    return await this.brandService.updateBrandProfile(
      brandId,
      updateBrandProfileDto,
      files,
    );
  }

  @Put('niches')
  @ApiOperation({ summary: 'Update brand niches' })
  @ApiResponse({
    status: 200,
    description: 'Brand niches updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({ status: 400, description: 'Invalid niche IDs' })
  async updateBrandNiches(
    @Req() req: RequestWithUser,
    @Body() updateBrandNichesDto: UpdateBrandNichesDto,
  ) {
    const brandId = req.user.id;
    return await this.brandService.updateBrandNiches(
      brandId,
      updateBrandNichesDto.nicheIds,
    );
  }

  @Get('profile/:id')
  @ApiOperation({
    summary:
      'Get brand profile by ID (public). If authenticated, includes isFollowing flag. Supports campaign pagination via query parameters.',
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
    status: 200,
    description: 'Brand profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async getBrandProfileById(
    @Param('id', ParseIntPipe) brandId: number,
    @Req() req?: RequestWithUser,
    @Query('campaignPage') campaignPage?: number,
    @Query('campaignLimit') campaignLimit?: number,
    @Query('campaignFilter') campaignFilter?: 'invite' | 'open',
  ) {
    // Pass current user info if authenticated
    const currentUserId = req?.user?.id;
    const currentUserType = req?.user?.userType;

    return await this.brandService.getBrandProfile(
      brandId,
      currentUserId,
      currentUserType,
      campaignPage,
      campaignLimit,
      campaignFilter,
    );
  }

  @Get('dropdown-data/countries')
  @Public()
  @ApiOperation({ summary: 'Get list of countries for dropdown' })
  @ApiResponse({
    status: 200,
    description: 'List of countries retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'IN' },
              name: { type: 'string', example: 'India' },
            },
          },
        },
      },
    },
  })
  async getCountries() {
    return await this.brandService.getCountriesList();
  }

  @Get('dropdown-data/cities/:countryId')
  @Public()
  @ApiOperation({ summary: 'Get list of cities for a specific country' })
  @ApiResponse({
    status: 200,
    description: 'List of cities retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              name: { type: 'string', example: 'Mumbai' },
              state: { type: 'string', example: 'Maharashtra' },
              tier: {
                type: 'number',
                example: 1,
                description: 'City tier (1, 2, or 3)',
              },
            },
          },
        },
      },
    },
  })
  async getCities(@Param('countryId', ParseIntPipe) countryId: number) {
    return await this.brandService.getCitiesList(countryId);
  }

  @Get('dropdown-data/founded-years')
  @Public()
  @ApiOperation({ summary: 'Get list of years for founded year dropdown' })
  @ApiResponse({
    status: 200,
    description: 'List of years retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { type: 'string', example: '2024' },
        },
      },
    },
  })
  async getFoundedYears() {
    return await this.brandService.getFoundedYearsList();
  }

  @Get('top-brands')
  @Public()
  @ApiOperation({
    summary: 'Get top brands',
    description: 'Fetch list of top brands curated by admin (public endpoint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Top brands fetched successfully',
  })
  async getTopBrands(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.brandService.getTopBrands(parsedLimit, parsedOffset);
  }

  // Support Ticket endpoints
  @Post('support-ticket')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 5 }], {
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a support ticket',
    description:
      'Create a new support ticket with optional image attachments. You can upload up to 5 images (max 10MB each). Supported formats: JPG, PNG, WEBP.',
  })
  @ApiResponse({
    status: 201,
    description: 'Support ticket created successfully',
    type: CreateTicketResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or file type not allowed',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 10MB per file)',
  })
  async createSupportTicket(
    @Req() req: RequestWithUser,
    @Body() createDto: CreateSupportTicketMultipartDto,
    @UploadedFiles()
    files?: { images?: Express.Multer.File[] },
  ) {
    const userId = req.user.id;

    // Upload images to S3 if provided
    let imageUrls: string[] = [];
    if (files?.images && files.images.length > 0) {
      imageUrls = await Promise.all(
        files.images.map((file) =>
          this.s3Service.uploadFileToS3(file, 'support-tickets', 'ticket'),
        ),
      );
    }

    // Create the ticket DTO
    const ticketDto: CreateSupportTicketDto = {
      subject: createDto.subject,
      description: createDto.description,
      reportType: createDto.reportType as any,
      imageUrls,
    };

    if (createDto.reportedUserType) {
      ticketDto.reportedUserType = createDto.reportedUserType as any;
    }
    if (createDto.reportedUserId) {
      ticketDto.reportedUserId = parseInt(createDto.reportedUserId);
    }

    return this.supportTicketService.createTicket(
      ticketDto,
      userId,
      UserType.BRAND,
    );
  }

  @Get('support-tickets')
  @ApiOperation({
    summary: 'Get my support tickets',
    description:
      'Retrieve all support tickets created by the authenticated brand. Supports filtering by status, report type, and search query with pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Support tickets fetched successfully',
    type: GetTicketsResponseDto,
  })
  async getMySupportTickets(
    @Req() req: RequestWithUser,
    @Query() filters: GetMyTicketsDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.supportTicketService.getMyTickets(
      userId,
      UserType.BRAND,
      filters,
    );
  }

  @Post('support-tickets/:id/reply')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'images', maxCount: 5 }], {
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Reply to a support ticket',
    description:
      'Add a reply to your support ticket with optional image attachments. You can upload up to 5 images (max 10MB each). Only the ticket creator can reply.',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: 'number',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Reply added successfully',
    type: CreateReplyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({
    status: 403,
    description: 'Cannot reply to this ticket - not the ticket owner',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 10MB per file)',
  })
  async replyToTicket(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() replyDto: CreateTicketReplyMultipartDto,
    @UploadedFiles()
    files?: { images?: Express.Multer.File[] },
  ) {
    const userId = req.user.id;

    // Upload images to S3 if provided
    let imageUrls: string[] = [];
    if (files?.images && files.images.length > 0) {
      imageUrls = await Promise.all(
        files.images.map((file) =>
          this.s3Service.uploadFileToS3(file, 'support-tickets', 'reply'),
        ),
      );
    }

    // Create the reply DTO
    const ticketReplyDto: CreateTicketReplyDto = {
      message: replyDto.message,
      imageUrls,
    };

    return this.supportTicketService.createReply(
      ticketId,
      ticketReplyDto,
      userId,
      'brand',
    );
  }

  @Get('support-tickets/:id/replies')
  @ApiOperation({
    summary: 'Get all replies for a support ticket',
    description:
      'Retrieve all replies for a specific support ticket. Only the ticket creator can view replies.',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: 'number',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Replies fetched successfully',
    type: GetRepliesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({
    status: 403,
    description: 'Cannot view replies for this ticket - not the ticket owner',
  })
  async getTicketReplies(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) ticketId: number,
  ) {
    const userId = req.user.id;
    return this.supportTicketService.getTicketReplies(
      ticketId,
      userId,
      'brand',
    );
  }

  @Put('support-tickets/:id/mark-admin-replies-read')
  @ApiOperation({
    summary: 'Mark all admin replies as read',
    description:
      'Marks all unread admin replies in a support ticket as read when the brand opens/views the ticket. Only the ticket creator can mark replies as read.',
  })
  @ApiParam({
    name: 'id',
    description: 'Support ticket ID',
    type: 'number',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Admin replies marked as read successfully',
    schema: {
      example: {
        message: 'Admin replies marked as read',
        markedCount: 3,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({
    status: 403,
    description: 'Cannot mark replies for this ticket - not the ticket owner',
  })
  async markAdminRepliesAsRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) ticketId: number,
  ) {
    const userId = req.user.id;
    return this.supportTicketService.markAdminRepliesAsRead(
      ticketId,
      userId,
      'brand',
    );
  }

  // Max Campaign Payment Endpoints
  @Post('campaigns/:campaignId/upgrade-to-max')
  @ApiOperation({
    summary: 'Upgrade campaign to Max Campaign',
    description:
      'Upgrade a campaign to Max Campaign for Rs 299. Max Campaigns are exclusive to Pro influencers only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment order created successfully',
    schema: {
      example: {
        campaign: {
          id: 1,
          name: 'Summer Fashion Campaign',
          currentStatus: {
            isMaxCampaign: false,
            paymentStatus: 'pending',
          },
        },
        payment: {
          orderId: 'order_MNpJx1234567890',
          amount: 29900,
          currency: 'INR',
          keyId: 'rzp_test_...',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({
    status: 403,
    description: 'You can only upgrade your own campaigns',
  })
  @ApiResponse({
    status: 400,
    description: 'Campaign is already a Max Campaign, is marked as organic, or payment is pending',
  })
  async upgradeToMaxCampaign(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can upgrade campaigns');
    }
    return await this.maxCampaignPaymentService.createMaxCampaignOrder(
      campaignId,
      req.user.id,
    );
  }

  @Post('campaigns/:campaignId/verify-max-payment')
  @ApiOperation({
    summary: 'Verify Max Campaign payment',
    description: 'Verify Razorpay payment and activate Max Campaign status',
  })
  @ApiResponse({
    status: 200,
    description:
      'Payment verified and campaign upgraded to Max Campaign successfully',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({ status: 400, description: 'Invalid payment signature' })
  async verifyMaxCampaignPayment(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() verifyDto: VerifyMaxCampaignPaymentDto,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can verify campaign payments');
    }
    return await this.maxCampaignPaymentService.verifyAndActivateMaxCampaign(
      campaignId,
      req.user.id,
      verifyDto.paymentId,
      verifyDto.orderId,
      verifyDto.signature,
    );
  }

  @Get('campaigns/:campaignId/max-status')
  @ApiOperation({
    summary: 'Get Max Campaign status',
    description: 'Get Max Campaign payment status and details for a campaign',
  })
  @ApiResponse({
    status: 200,
    description: 'Max Campaign status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getMaxCampaignStatus(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view campaign status');
    }
    return await this.maxCampaignPaymentService.getMaxCampaignStatus(
      campaignId,
      req.user.id,
    );
  }

  // Invite-Only Campaign Payment Endpoints
  @Post('campaigns/:campaignId/unlock-invite-only')
  @ApiOperation({
    summary: 'Create payment order for invite-only feature',
    description: 'Create Razorpay payment order to unlock invite-only campaign feature (Rs 499)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment order created successfully',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({
    status: 403,
    description: 'You can only unlock features for your own campaigns',
  })
  @ApiResponse({
    status: 400,
    description: 'Campaign is not invite-only or feature is already unlocked',
  })
  async unlockInviteOnlyFeature(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can unlock campaign features');
    }
    return await this.inviteOnlyPaymentService.createInviteOnlyPaymentOrder(
      campaignId,
      req.user.id,
    );
  }

  @Post('campaigns/:campaignId/verify-invite-only-payment')
  @ApiOperation({
    summary: 'Verify invite-only payment',
    description: 'Verify Razorpay payment and unlock invite-only feature',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and invite-only feature unlocked successfully',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({ status: 400, description: 'Invalid payment signature' })
  async verifyInviteOnlyPayment(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() verifyDto: VerifyInviteOnlyPaymentDto,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can verify campaign payments');
    }
    return await this.inviteOnlyPaymentService.verifyAndUnlockInviteOnly(
      campaignId,
      req.user.id,
      verifyDto.paymentId,
      verifyDto.orderId,
      verifyDto.signature,
    );
  }

  @Get('campaigns/:campaignId/invite-only-status')
  @ApiOperation({
    summary: 'Get invite-only payment status',
    description: 'Get invite-only feature payment status and details for a campaign',
  })
  @ApiResponse({
    status: 200,
    description: 'Invite-only status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getInviteOnlyStatus(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view campaign status');
    }
    return await this.inviteOnlyPaymentService.getInviteOnlyStatus(
      campaignId,
      req.user.id,
    );
  }

  @Get('billing/history')
  @ApiOperation({
    summary: 'Get billing history',
    description: 'Get all Max Campaign invoices and payment history for the brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing history retrieved successfully',
    schema: {
      example: {
        invoices: [
          {
            id: 1,
            invoiceNumber: 'MAXINV-202511-00001',
            campaignId: 123,
            campaignName: 'Summer Fashion Campaign',
            amount: 299,
            status: 'paid',
            paymentMethod: 'razorpay',
            razorpayOrderId: 'order_ABC123',
            razorpayPaymentId: 'pay_XYZ789',
            paidAt: '2025-11-04T10:30:00+05:30',
            invoiceUrl: 'https://s3.amazonaws.com/invoices/...',
            createdAt: '2025-11-04T10:25:00+05:30',
          },
        ],
      },
    },
  })
  async getBillingHistory(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view billing history');
    }
    return await this.maxCampaignPaymentService.getBillingHistory(req.user.id);
  }

  @Get('max-campaign/invoices/:invoiceId')
  @ApiOperation({
    summary: 'Get Max Campaign invoice',
    description: 'Get invoice details for Max Campaign upgrade payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getMaxCampaignInvoice(
    @Req() req: RequestWithUser,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view invoices');
    }
    return await this.maxCampaignPaymentService.getInvoiceDetails(
      invoiceId,
      req.user.id,
    );
  }

  @Post('max-campaign/invoices/:invoiceId/regenerate-pdf')
  @ApiOperation({
    summary: 'Regenerate PDF for Max Campaign invoice',
    description: 'Regenerate and upload PDF for an existing invoice',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF regenerated successfully',
  })
  async regenerateInvoicePDF(
    @Req() req: RequestWithUser,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can regenerate invoices');
    }
    return await this.maxCampaignPaymentService.regenerateInvoicePDF(
      invoiceId,
      req.user.id,
    );
  }

  // AI Credit Purchase Endpoints

  @Post('campaigns/:campaignId/purchase-ai-credit')
  @ApiOperation({
    summary: 'Purchase 1 AI credit',
    description:
      'Create a Razorpay payment order to purchase 1 AI credit for Rs 299. Credit is added to brand general balance. Only allowed when aiCreditsRemaining = 0.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment order created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'AI credits still remaining – purchase not allowed',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  @ApiResponse({
    status: 403,
    description: 'You can only purchase credits for your own campaigns',
  })
  async purchaseAiCredit(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can purchase AI credits');
    }
    return await this.aiCreditPaymentService.createAiCreditOrder(
      campaignId,
      req.user.id,
    );
  }

  @Post('campaigns/:campaignId/verify-ai-credit-payment')
  @ApiOperation({
    summary: 'Verify AI credit payment',
    description:
      'Verify Razorpay payment signature and add 1 AI credit to brand balance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and AI credit added successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid payment signature' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async verifyAiCreditPayment(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() verifyDto: VerifyAiCreditPaymentDto,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException(
        'Only brands can verify AI credit payments',
      );
    }
    return await this.aiCreditPaymentService.verifyAndActivateAiCredit(
      campaignId,
      req.user.id,
      verifyDto.paymentId,
      verifyDto.orderId,
      verifyDto.signature,
    );
  }

  @Get('campaigns/:campaignId/ai-credit-status')
  @ApiOperation({
    summary: 'Get AI credit status',
    description:
      'Get current AI credit balance, purchase eligibility, and latest invoice for the brand.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI credit status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getAiCreditStatus(
    @Req() req: RequestWithUser,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view AI credit status');
    }
    return await this.aiCreditPaymentService.getAiCreditStatus(
      campaignId,
      req.user.id,
    );
  }

  @Get('billing/ai-credit-history')
  @ApiOperation({
    summary: 'Get AI credit billing history',
    description: 'Get all AI credit purchase invoices for the brand.',
  })
  @ApiResponse({
    status: 200,
    description: 'AI credit billing history retrieved successfully',
  })
  async getAiCreditBillingHistory(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view billing history');
    }
    return await this.aiCreditPaymentService.getAiCreditBillingHistory(
      req.user.id,
    );
  }

  @Get('ai-credit/invoices/:invoiceId')
  @ApiOperation({
    summary: 'Get AI credit invoice details',
    description: 'Get details for a specific AI credit invoice.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getAiCreditInvoice(
    @Req() req: RequestWithUser,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    if (req.user.userType !== 'brand') {
      throw new BadRequestException('Only brands can view invoices');
    }
    return await this.aiCreditPaymentService.getAiCreditInvoiceDetails(
      invoiceId,
      req.user.id,
    );
  }
}
