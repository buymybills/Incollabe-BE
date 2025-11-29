import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  Delete,
  BadRequestException,
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
import { InfluencerService } from './influencer.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateInfluencerProfileDto } from './dto/update-influencer-profile.dto';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { GetExperiencesDto } from './dto/get-experiences.dto';
import {
  SendWhatsAppOTPDto,
  VerifyWhatsAppOTPDto,
} from './dto/whatsapp-verification.dto';
import { GetOpenCampaignsDto } from '../campaign/dto/get-open-campaigns.dto';
import { MyApplicationResponseDto } from '../campaign/dto/my-application-response.dto';
import { PublicProfileResponseDto } from './dto/public-profile-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import type { RequestWithUser } from '../types/request.types';
import { SupportTicketService } from '../shared/support-ticket.service';
import { CreateSupportTicketDto } from '../shared/dto/create-support-ticket.dto';
import { UserType } from '../shared/models/support-ticket.model';
import { ProSubscriptionService } from './services/pro-subscription.service';
import {
  VerifySubscriptionPaymentDto,
  CancelSubscriptionDto,
} from './dto/pro-subscription.dto';
import { RedeemRewardsDto, RedeemRewardsResponseDto } from './dto/redeem-rewards.dto';
import {
  AddUpiIdDto,
  SelectUpiIdDto,
  GetUpiIdsResponseDto,
  SelectAndRedeemDto,
} from './dto/upi-management.dto';
import { RazorpayService } from '../shared/razorpay.service';

@ApiTags('Influencer Profile')
@Controller('influencer')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InfluencerController {
  constructor(
    private readonly influencerService: InfluencerService,
    private readonly supportTicketService: SupportTicketService,
    private readonly proSubscriptionService: ProSubscriptionService,
    private readonly razorpayService: RazorpayService,
  ) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get comprehensive influencer profile',
    description:
      'Returns complete influencer profile with verification status and completion details',
  })
  @ApiResponse({
    status: 200,
    description: 'Influencer profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Influencer not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only influencers can access this endpoint',
  })
  async getInfluencerProfile(@Req() req: RequestWithUser) {
    const influencerId = req.user.id;
    const userType = req.user.userType;
    return await this.influencerService.getInfluencerProfile(influencerId, false, influencerId, userType);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update influencer profile and submit for verification',
    description:
      'Update any influencer profile fields including basic info, bio, social links, and collaboration costs. When all required fields are completed, the profile is automatically submitted for verification. This endpoint handles updating existing values that may have been skipped during signup.\n\n**Important:** Use nested form field syntax for collaboration costs:\n- `collaborationCosts[instagram][reel]=1000`\n- `collaborationCosts[youtube][short]=1500`\n\nCountry and City IDs are sent as strings but auto-converted to integers.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Comprehensive influencer profile update with optional file uploads',
    schema: {
      type: 'object',
      properties: {
        // Basic Info (can update existing values)
        bio: {
          type: 'string',
          description:
            'Bio/description - can update existing or add if skipped during signup',
        },
        profileHeadline: {
          type: 'string',
          description:
            'Profile headline - can update existing or add if skipped',
        },

        // Location
        countryId: {
          type: 'integer',
          description:
            'Country ID (sent as string in form data, auto-converted to integer)',
          example: 1,
        },
        cityId: {
          type: 'integer',
          description:
            'City ID (sent as string in form data, auto-converted to integer)',
          example: 3,
        },

        // Contact
        whatsappNumber: {
          type: 'string',
          description: 'WhatsApp number for verification',
        },
        upiId: {
          type: 'string',
          description: 'UPI ID for receiving referral credits',
          example: 'username@paytm',
        },

        // Push Notifications
        fcmToken: {
          type: 'string',
          description: 'Firebase Cloud Messaging token for push notifications',
          example: 'dxyz123abc...',
        },

        // Niches
        nicheIds: {
          type: 'string',
          description:
            'Array of niche IDs. Accepts JSON array "[1,4,12]" or comma-separated "1,4,12"',
          example: '[1,4,12]',
        },
        customNiches: {
          type: 'string',
          description:
            'Array of custom niche names for bulk replacement. Accepts JSON array ["Sustainable Fashion","Tech Reviews"] or comma-separated "Sustainable Fashion,Tech Reviews". Will REPLACE all existing custom niches. Use empty string to delete all.',
          example: '["Sustainable Fashion","Tech Reviews"]',
        },

        // Social Media Links (can update existing or add new)
        instagramUrl: { type: 'string', description: 'Instagram profile URL' },
        youtubeUrl: { type: 'string', description: 'YouTube channel URL' },
        facebookUrl: { type: 'string', description: 'Facebook profile URL' },
        linkedinUrl: { type: 'string', description: 'LinkedIn profile URL' },
        twitterUrl: { type: 'string', description: 'Twitter/X profile URL' },

        // Collaboration Costs (use nested form field syntax)
        'collaborationCosts[instagram][reel]': {
          type: 'integer',
          description:
            'Price for Instagram Reel (use form field: collaborationCosts[instagram][reel])',
          example: 1000,
        },
        'collaborationCosts[instagram][story]': {
          type: 'integer',
          description:
            'Price for Instagram Story (use form field: collaborationCosts[instagram][story])',
          example: 500,
        },
        'collaborationCosts[instagram][post]': {
          type: 'integer',
          description:
            'Price for Instagram Post (use form field: collaborationCosts[instagram][post])',
          example: 800,
        },
        'collaborationCosts[youtube][short]': {
          type: 'integer',
          description:
            'Price for YouTube Short (use form field: collaborationCosts[youtube][short])',
          example: 1500,
        },
        'collaborationCosts[youtube][longVideo]': {
          type: 'integer',
          description:
            'Price for YouTube Long Video (use form field: collaborationCosts[youtube][longVideo])',
          example: 5000,
        },
        'collaborationCosts[facebook][post]': {
          type: 'integer',
          description:
            'Price for Facebook Post (use form field: collaborationCosts[facebook][post])',
          example: 600,
        },
        'collaborationCosts[facebook][story]': {
          type: 'integer',
          description:
            'Price for Facebook Story (use form field: collaborationCosts[facebook][story])',
          example: 300,
        },
        'collaborationCosts[linkedin][post]': {
          type: 'integer',
          description:
            'Price for LinkedIn Post (use form field: collaborationCosts[linkedin][post])',
          example: 700,
        },
        'collaborationCosts[twitter][post]': {
          type: 'integer',
          description:
            'Price for Twitter/X Post (use form field: collaborationCosts[twitter][post])',
          example: 400,
        },

        // File Uploads
        profileImage: {
          type: 'string',
          format: 'binary',
          description: 'Profile image file - can update existing',
        },
        profileBanner: {
          type: 'string',
          format: 'binary',
          description: 'Profile banner image file - can update existing',
        },
        clearProfileBanner: {
          type: 'boolean',
          description:
            'Set to true to clear/remove the profile banner. If false or not provided, existing banner is preserved unless a new file is uploaded.',
          example: false,
        },
      },
      example: {
        bio: 'I am a fashion influencer creating amazing content',
        profileHeadline:
          'Fashion influencer creating amazing lifestyle content',
        countryId: '1',
        cityId: '3',
        whatsappNumber: '9870541151',
        upiId: 'username@paytm',
        fcmToken: 'dxyz123abc456def789ghi...',
        nicheIds: '[1,4,12]',
        customNiches: '["Sustainable Fashion","Tech Reviews"]',
        instagramUrl: 'https://www.instagram.com/bharti.1',
        youtubeUrl: 'https://www.youtube.com/watch?v=8_qUi4PyrYk',
        facebookUrl: 'https://www.facebook.com/mishra.bharti.1/',
        linkedinUrl: 'https://linkedin.com/in/bharti-mishra-31b088207/',
        twitterUrl: 'https://x.com/Hanumavihari/status/1970315597474136326',
        'collaborationCosts[instagram][reel]': '1000',
        'collaborationCosts[instagram][story]': '500',
        'collaborationCosts[instagram][post]': '800',
        'collaborationCosts[youtube][short]': '1500',
        'collaborationCosts[youtube][longVideo]': '5000',
        'collaborationCosts[facebook][post]': '600',
        'collaborationCosts[facebook][story]': '300',
        'collaborationCosts[linkedin][post]': '700',
        'collaborationCosts[twitter][post]': '400',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Profile updated successfully. If profile becomes complete, it is automatically submitted for verification.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 123 },
        name: { type: 'string', example: 'John Doe' },
        message: {
          type: 'string',
          example:
            'Profile submitted for verification. You will receive a notification once verification is complete within 48 hours.',
        },
        status: {
          type: 'string',
          enum: ['incomplete', 'pending_verification'],
          example: 'pending_verification',
        },
        missingFieldsCount: {
          type: 'number',
          example: 0,
          description: 'Present when status is incomplete',
        },
        verification: {
          type: 'object',
          properties: {
            isProfileCompleted: { type: 'boolean', example: true },
            isWhatsappVerified: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profileImage', maxCount: 1 },
      { name: 'profileBanner', maxCount: 1 },
    ]),
  )
  async updateInfluencerProfile(
    @Req() req: RequestWithUser,
    @Body() updateData: UpdateInfluencerProfileDto,
    @UploadedFiles() files: any,
  ) {
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

    const influencerId = req.user.id;
    const userType = req.user.userType;
    return await this.influencerService.updateInfluencerProfile(
      influencerId,
      updateData,
      files,
      userType,
    );
  }

  @Post('request-whatsapp-otp')
  @ApiOperation({
    summary: 'Request WhatsApp verification OTP',
    description:
      'Send OTP to WhatsApp number for verification. This is part of the verification flow.',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp OTP sent successfully',
  })
  async sendWhatsAppVerificationOTP(
    @Req() req: RequestWithUser,
    @Body() sendOtpDto: SendWhatsAppOTPDto,
  ) {
    const influencerId = req.user.id;
    return await this.influencerService.sendWhatsAppVerificationOTP({
      influencerId,
      whatsappNumber: sendOtpDto.whatsappNumber,
    });
  }

  @Post('verify-whatsapp-otp')
  @ApiOperation({
    summary: 'Verify WhatsApp OTP',
    description:
      'Confirm WhatsApp verification with OTP. This completes the WhatsApp verification step.',
  })
  @ApiResponse({
    status: 200,
    description: 'WhatsApp verified successfully',
  })
  async verifyWhatsAppOTP(
    @Req() req: RequestWithUser,
    @Body() verifyOtpDto: VerifyWhatsAppOTPDto,
  ) {
    const influencerId = req.user.id;
    return await this.influencerService.verifyWhatsAppOTP({
      influencerId,
      whatsappNumber: verifyOtpDto.whatsappNumber,
      otp: verifyOtpDto.otp,
    });
  }

  @Get('profile/:id')
  @ApiOperation({
    summary: 'Get public influencer profile',
    description:
      'Get public influencer profile by ID. If authenticated, includes isFollowing flag.',
  })
  @ApiResponse({
    status: 200,
    description: 'Public influencer profile retrieved successfully',
    type: PublicProfileResponseDto,
  })
  async getPublicInfluencerProfile(
    @Param('id', ParseIntPipe) influencerId: number,
    @Req() req?: RequestWithUser,
  ): Promise<PublicProfileResponseDto> {
    // Pass current user info if authenticated
    const currentUserId = req?.user?.id;
    const currentUserType = req?.user?.userType;

    const profile = await this.influencerService.getInfluencerProfile(
      influencerId,
      true,
      currentUserId,
      currentUserType,
    );

    // Fetch experiences for the influencer
    const experiences = await this.influencerService.getExperiences(
      influencerId,
      undefined,
      1,
      100,
    );

    // Return public fields with proper typing
    return {
      ...profile,
      collaborationCosts: profile.collaborationCosts || {},
      experiences:
        typeof experiences === 'object' && 'experiences' in experiences
          ? experiences.experiences
          : [],
    } as PublicProfileResponseDto;
  }

  @Get('campaigns/open')
  @ApiOperation({
    summary: 'Browse open campaigns available for application',
    description:
      'Get list of open campaigns that influencers can apply to. Campaigns are automatically filtered based on:\n' +
      '1. Niche matching (your niches vs campaign requirements)\n' +
      '2. Age requirements (if campaign has age restrictions)\n' +
      '3. Gender preferences (if campaign has gender targeting)\n' +
      '4. Location (if campaign is not Pan-India, only influencers in target cities see it)\n' +
      'You can further filter by search query, specific niches, cities, and budget range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Open campaigns retrieved successfully',
    schema: {
      example: {
        campaigns: [
          {
            id: 1,
            name: 'Summer Fashion Campaign',
            description: 'Promote our new summer collection',
            brand: {
              id: 1,
              brandName: 'Fashion Brand',
              profileImage: 'brand.jpg',
            },
            deliverables: [
              {
                platform: 'instagram',
                type: 'instagram_post',
                budget: 2000,
                quantity: 3,
              },
            ],
            cities: [
              {
                city: {
                  id: 1,
                  name: 'Mumbai',
                  tier: 1,
                },
              },
            ],
            endDate: '2024-07-31',
            totalApplications: 122,
            hasApplied: false,
          },
        ],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      },
    },
  })
  async getOpenCampaigns(
    @Query() getOpenCampaignsDto: GetOpenCampaignsDto,
    @Req() req: RequestWithUser,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.getOpenCampaigns(
      getOpenCampaignsDto,
      influencerId,
    );
  }

  @Post('campaigns/:campaignId/apply')
  @ApiOperation({
    summary: 'Apply to a campaign',
    description: 'Submit application for a specific campaign',
  })
  @ApiParam({
    name: 'campaignId',
    type: Number,
    description: 'Campaign ID to apply for',
    example: 1,
  })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    schema: {
      example: {
        success: true,
        applicationId: 1,
        message:
          'Application submitted successfully. You will be notified about the status update.',
        campaign: {
          id: 1,
          name: 'Summer Fashion Campaign',
          brand: {
            brandName: 'Fashion Brand',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Already applied or campaign not eligible',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async applyCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Req() req: RequestWithUser,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.applyCampaign(campaignId, influencerId);
  }

  @Get('campaigns/my-applications')
  @ApiOperation({
    summary: 'Get my campaign applications',
    description:
      'Get list of all campaign applications submitted by the influencer, optionally filtered by status',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['applied', 'under_review', 'selected', 'rejected', 'withdrawn'],
    description: 'Filter applications by status',
    example: 'applied',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Applications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        applications: {
          type: 'array',
          items: { $ref: '#/components/schemas/MyApplicationResponseDto' },
        },
        total: { type: 'number', example: 25 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 2 },
      },
    },
  })
  async getMyApplications(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.getMyApplications(
      influencerId,
      status,
      page,
      limit,
    );
  }

  @Put('campaigns/applications/:applicationId/withdraw')
  @ApiOperation({
    summary: 'Withdraw campaign application',
    description:
      'Withdraw a campaign application. Can only withdraw applications with status: applied or under_review',
  })
  @ApiParam({
    name: 'applicationId',
    type: Number,
    description: 'Application ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Application withdrawn successfully',
    schema: {
      example: {
        message: 'Application withdrawn successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot withdraw selected/rejected applications',
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async withdrawApplication(
    @Param('applicationId', ParseIntPipe) applicationId: number,
    @Req() req: RequestWithUser,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.withdrawApplication(
      applicationId,
      influencerId,
    );
  }

  @Get('campaigns/:campaignId')
  @ApiOperation({
    summary: 'Get campaign details for application',
    description:
      'Get detailed information about a specific campaign for review before applying',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign details retrieved successfully',
    schema: {
      example: {
        id: 1,
        name: 'Summer Fashion Campaign',
        description: 'Promote our new summer collection',
        status: 'active',
        type: 'paid',
        category: 'Fashion',
        deliverableFormat: 'Photo and Video',
        isInviteOnly: false,
        isPanIndia: true,
        minAge: 18,
        maxAge: 35,
        isOpenToAllAges: false,
        genderPreferences: ['female', 'non-binary'],
        isOpenToAllGenders: false,
        nicheIds: [1, 2, 5],
        customInfluencerRequirements: 'Must have fashion portfolio',
        performanceExpectations: 'Minimum 5% engagement rate',
        brandSupport: 'Content review and feedback provided',
        isActive: true,
        brand: {
          id: 1,
          brandName: 'Fashion Brand',
          profileImage: 'brand.jpg',
          websiteUrl: 'https://example.com',
        },
        cities: [
          {
            city: {
              id: 1,
              name: 'Mumbai',
              tier: 1,
            },
          },
        ],
        deliverables: [
          {
            platform: 'instagram',
            type: 'instagram_post',
            budget: 2000,
            quantity: 3,
          },
        ],
        hasApplied: false,
        applicationStatus: null,
        appliedAt: null,
        totalApplications: 25,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getCampaignDetails(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Req() req: RequestWithUser,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.getCampaignDetails(campaignId, influencerId);
  }

  @Post('experiences')
  @ApiOperation({
    summary: 'Add new experience',
    description:
      'Add a new campaign experience to the influencer profile. If campaignId is provided, associates with existing platform campaign. If not provided, creates an external campaign record.',
  })
  @ApiResponse({
    status: 201,
    description: 'Experience added successfully',
    schema: {
      example: {
        id: 1,
        campaignName: 'Festive Glam Essentials',
        brandName: 'Nykaa',
        campaignCategory: 'Skincare + Makeup',
        deliverableFormat: '2 Instagram reels, 3 story posts',
        successfullyCompleted: true,
        roleDescription: 'Content creator for skincare products',
        keyResultAchieved:
          'Reach: 150K, Engagement Rate: 6.1%, Conversions (Dr.Vaid Mkt): 150+ clicks',
        socialLinks: ['https://instagram.com/p/xyz'],
        completedDate: '2024-12-01',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  async createExperience(
    @Req() req: RequestWithUser,
    @Body() createExperienceDto: CreateExperienceDto,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.createExperience(
      influencerId,
      createExperienceDto,
    );
  }

  @Get('experiences')
  @ApiOperation({
    summary: 'Get experiences',
    description:
      'Get experiences for the influencer. If ID is provided, returns specific experience. Otherwise returns paginated list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Experiences retrieved successfully',
    schema: {
      oneOf: [
        {
          description: 'Single experience (when id is provided)',
          example: {
            id: 1,
            campaignName: 'Festive Glam Essentials',
            brandName: 'Nykaa',
            campaignCategory: 'Skincare + Makeup',
            deliverableFormat: '2 Instagram reels, 3 story posts',
            successfullyCompleted: true,
            roleDescription: 'Content creator for skincare products',
            keyResultAchieved:
              'Reach: 150K, Engagement Rate: 6.1%, Conversions (Dr.Vaid Mkt): 150+ clicks',
            socialLinks: [
              {
                id: 1,
                platform: 'instagram',
                contentType: 'reel',
                url: 'https://instagram.com/p/xyz',
              },
            ],
            completedDate: '2024-12-01',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
        {
          description: 'Paginated list (when id is not provided)',
          example: {
            experiences: [
              {
                id: 1,
                campaignName: 'Festive Glam Essentials',
                brandName: 'Nykaa',
                campaignCategory: 'Skincare + Makeup',
                deliverableFormat: '2 Instagram reels, 3 story posts',
                successfullyCompleted: true,
                roleDescription: 'Content creator for skincare products',
                keyResultAchieved:
                  'Reach: 150K, Engagement Rate: 6.1%, Conversions (Dr.Vaid Mkt): 150+ clicks',
                socialLinks: [
                  {
                    id: 1,
                    platform: 'instagram',
                    contentType: 'reel',
                    url: 'https://instagram.com/p/xyz',
                  },
                ],
                completedDate: '2024-12-01',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
            total: 15,
            page: 1,
            limit: 10,
            totalPages: 2,
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Experience not found (when specific ID is requested)',
  })
  async getExperiences(
    @Req() req: RequestWithUser,
    @Query() query: GetExperiencesDto,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.getExperiences(
      influencerId,
      query.id,
      query.page,
      query.limit,
    );
  }

  @Put('experiences/:experienceId')
  @ApiOperation({
    summary: 'Update experience',
    description: 'Update an existing campaign experience',
  })
  @ApiResponse({
    status: 200,
    description: 'Experience updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Experience not found',
  })
  async updateExperience(
    @Req() req: RequestWithUser,
    @Param('experienceId', ParseIntPipe) experienceId: number,
    @Body() updateExperienceDto: UpdateExperienceDto,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.updateExperience(
      experienceId,
      influencerId,
      updateExperienceDto,
    );
  }

  @Delete('experiences/:experienceId')
  @ApiOperation({
    summary: 'Delete experience',
    description: 'Delete a campaign experience from the influencer profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Experience deleted successfully',
    schema: {
      example: {
        message: 'Experience deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Experience not found',
  })
  async deleteExperience(
    @Req() req: RequestWithUser,
    @Param('experienceId', ParseIntPipe) experienceId: number,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.deleteExperience(experienceId, influencerId);
  }

  @Get('top-influencers')
  @Public()
  @ApiOperation({
    summary: 'Get top influencers',
    description:
      'Fetch list of top influencers curated by admin (public endpoint)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Number of items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Top influencers fetched successfully',
  })
  async getTopInfluencers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.influencerService.getTopInfluencers(parsedPage, parsedLimit);
  }

  // Support Ticket endpoints
  @Post('support-ticket')
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiResponse({
    status: 201,
    description: 'Support ticket created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createSupportTicket(
    @Req() req: RequestWithUser,
    @Body() createDto: CreateSupportTicketDto,
  ) {
    const userId = req.user.id;
    return this.supportTicketService.createTicket(
      createDto,
      userId,
      UserType.INFLUENCER,
    );
  }

  @Get('support-tickets')
  @ApiOperation({ summary: 'Get my support tickets' })
  @ApiResponse({
    status: 200,
    description: 'Support tickets fetched successfully',
  })
  async getMySupportTickets(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.supportTicketService.getMyTickets(userId, UserType.INFLUENCER);
  }

  // Pro Subscription Endpoints
  @Post('pro/subscribe')
  @ApiOperation({
    summary: 'Create Pro subscription payment order',
    description: 'Subscribe to Pro Account (Rs 199/month) and get payment order details',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment order created successfully',
    schema: {
      example: {
        subscription: {
          id: 1,
          status: 'payment_pending',
          startDate: '2024-11-25T12:00:00Z',
          endDate: '2024-12-25T12:00:00Z',
          amount: 19900,
        },
        invoice: {
          id: 1,
          invoiceNumber: 'INV-202411-00001',
          amount: 19900,
        },
        payment: {
          orderId: 'order_MNpJx1234567890',
          amount: 19900,
          currency: 'INR',
          keyId: 'rzp_test_...',
        },
      },
    },
  })
  async createProSubscription(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can subscribe to Pro');
    }
    return await this.proSubscriptionService.createSubscriptionOrder(req.user.id);
  }

  @Post('pro/verify-payment')
  @ApiOperation({
    summary: 'Verify Pro subscription payment',
    description: 'Verify Razorpay payment and activate Pro subscription',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and Pro subscription activated',
  })
  async verifyProPayment(
    @Req() req: RequestWithUser,
    @Body() verifyDto: VerifySubscriptionPaymentDto,
  ) {
    return await this.proSubscriptionService.verifyAndActivateSubscription(
      verifyDto.subscriptionId,
      verifyDto.paymentId,
      verifyDto.orderId,
      verifyDto.signature,
    );
  }

  @Get('pro/subscription')
  @ApiOperation({
    summary: 'Get Pro subscription details',
    description: 'Get current Pro subscription status and invoice history',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription details retrieved successfully',
  })
  async getProSubscription(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can access Pro subscription');
    }
    return await this.proSubscriptionService.getSubscriptionDetails(req.user.id);
  }

  @Post('pro/cancel')
  @ApiOperation({
    summary: 'Cancel Pro subscription',
    description: 'Cancel Pro subscription (remains active until end of billing period)',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  async cancelProSubscription(
    @Req() req: RequestWithUser,
    @Body() cancelDto: CancelSubscriptionDto,
  ) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can cancel Pro subscription');
    }
    return await this.proSubscriptionService.cancelSubscription(
      req.user.id,
      cancelDto.reason,
    );
  }

  @Get('pro/invoices/:invoiceId')
  @ApiOperation({
    summary: 'Download Pro subscription invoice',
    description: 'Download PDF invoice for a specific subscription payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details retrieved successfully',
  })
  async downloadInvoice(
    @Req() req: RequestWithUser,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can download invoices');
    }
    return await this.proSubscriptionService.getInvoiceDetails(
      invoiceId,
      req.user.id,
    );
  }

  @Post('pro/invoices/:invoiceId/regenerate-pdf')
  @ApiOperation({
    summary: 'Regenerate PDF for Pro subscription invoice',
    description: 'Regenerate and upload PDF for an existing invoice',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF regenerated successfully',
  })
  async regenerateProInvoicePDF(
    @Req() req: RequestWithUser,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can regenerate invoices');
    }
    return await this.proSubscriptionService.regenerateInvoicePDF(
      invoiceId,
      req.user.id,
    );
  }

  @Post('webhooks/razorpay')
  @Public()
  @ApiOperation({
    summary: 'Razorpay webhook endpoint',
    description:
      'Receives webhook notifications from Razorpay for payment events. This endpoint stores all transaction data for audit purposes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook signature',
  })
  async handleRazorpayWebhook(@Req() req: any, @Body() body: any) {
    try {
      // Get signature from headers
      const signature = req.headers['x-razorpay-signature'];

      if (!signature) {
        throw new BadRequestException('Missing webhook signature');
      }

      // Verify webhook signature
      const rawBody = JSON.stringify(body);
      const isValid = this.razorpayService.verifyWebhookSignature(
        rawBody,
        signature,
      );

      if (!isValid) {
        console.error('Invalid webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }

      // Extract event and payload
      const event = body.event;
      const payload = body.payload;

      // Process webhook
      const result = await this.proSubscriptionService.handleWebhook(
        event,
        payload,
      );

      return result;
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  // Referral Rewards Endpoints
  @Get('referral-rewards')
  @ApiOperation({
    summary: 'Get referral rewards summary and history',
    description:
      'Fetch referral rewards summary (lifetime, redeemed, redeemable) and paginated list of referred influencers with reward details',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of referrals per page (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Referral rewards retrieved successfully',
    schema: {
      example: {
        summary: {
          lifetimeReward: 2300,
          redeemed: 1200,
          redeemable: 1100,
        },
        referralHistory: [
          {
            id: 132,
            name: 'Sneha Sharma',
            username: 'sneha_s09',
            profileImage: 'https://incollabstaging.s3.ap-south-1.amazonaws.com/...',
            isVerified: true,
            joinedAt: '2025-11-10T01:23:00.000Z',
            rewardEarned: 100,
            rewardStatus: 'paid',
            creditTransactionId: 123,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 23,
          totalPages: 3,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Influencer not found' })
  async getReferralRewards(
    @Req() req: RequestWithUser,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can access referral rewards');
    }
    const influencerId = req.user.id;
    return await this.influencerService.getReferralRewards(influencerId, page, limit);
  }

  // ==================== DEPRECATED: Use POST upi-ids/:upiIdRecordId/redeem-rewards instead ====================
  // @Post('redeem-rewards')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Redeem referral rewards',
  //   description:
  //     'Submit a redemption request for pending referral rewards. Optionally update UPI ID. Amount will be transferred within 24-48 hours.',
  // })
  // @ApiBody({ type: RedeemRewardsDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Redemption request submitted successfully',
  //   type: RedeemRewardsResponseDto,
  // })
  // @ApiResponse({ status: 400, description: 'Invalid request or no redeemable amount' })
  // @ApiResponse({ status: 404, description: 'Influencer not found' })
  // async redeemRewards(
  //   @Req() req: RequestWithUser,
  //   @Body() redeemRewardsDto: RedeemRewardsDto,
  // ) {
  //   const influencerId = req.user.id;
  //   return await this.influencerService.redeemRewards(influencerId, redeemRewardsDto.upiIdRecordId);
  // }

  // ==================== UPI Management Endpoints ====================

  @Get('upi-ids')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all UPI IDs',
    description: 'Fetch all UPI IDs for the influencer, ordered by selection status and last used',
  })
  @ApiResponse({ status: 200, description: 'List of UPI IDs', type: GetUpiIdsResponseDto })
  async getUpiIds(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can access UPI IDs');
    }
    const influencerId = req.user.id;
    return await this.influencerService.getInfluencerUpiIds(influencerId);
  }

  @Post('upi-ids')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add new UPI ID',
    description: 'Add a new UPI ID for the influencer. Optionally set it as selected for current transaction',
  })
  @ApiBody({ type: AddUpiIdDto })
  @ApiResponse({ status: 201, description: 'UPI ID added successfully' })
  @ApiResponse({ status: 400, description: 'UPI ID already exists' })
  async addUpiId(@Req() req: RequestWithUser, @Body() addUpiIdDto: AddUpiIdDto) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can add UPI IDs');
    }
    const influencerId = req.user.id;
    return await this.influencerService.addUpiId(
      influencerId,
      addUpiIdDto.upiId,
      addUpiIdDto.setAsSelected,
    );
  }

  // ==================== DEPRECATED: Use POST upi-ids/:upiIdRecordId/redeem-rewards instead ====================
  // @Put('upi-ids/select')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Select UPI ID for transaction',
  //   description: 'Select a UPI ID to use for the current redemption transaction',
  // })
  // @ApiBody({ type: SelectUpiIdDto })
  // @ApiResponse({ status: 200, description: 'UPI ID selected successfully' })
  // @ApiResponse({ status: 404, description: 'UPI ID not found' })
  // async selectUpiId(@Req() req: RequestWithUser, @Body() selectUpiIdDto: SelectUpiIdDto) {
  //   const influencerId = req.user.id;
  //   return await this.influencerService.selectUpiIdForTransaction(
  //     influencerId,
  //     selectUpiIdDto.upiIdRecordId,
  //   );
  // }

  @Delete('upi-ids/:upiIdRecordId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete UPI ID',
    description: 'Delete a UPI ID. Cannot delete if it is the only UPI ID and there are pending transactions',
  })
  @ApiParam({ name: 'upiIdRecordId', type: Number, description: 'UPI ID record ID' })
  @ApiResponse({ status: 200, description: 'UPI ID deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete the only UPI ID with pending transactions' })
  @ApiResponse({ status: 404, description: 'UPI ID not found' })
  async deleteUpiId(
    @Req() req: RequestWithUser,
    @Param('upiIdRecordId', ParseIntPipe) upiIdRecordId: number,
  ) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can delete UPI IDs');
    }
    const influencerId = req.user.id;
    return await this.influencerService.deleteUpiId(influencerId, upiIdRecordId);
  }


  @Post('upi-ids/:upiIdRecordId/redeem-rewards')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Select UPI and redeem rewards (consolidated endpoint)',
    description:
      'Select a UPI ID and submit redemption request in a single atomic operation. This is the optimized endpoint combining UPI selection and reward redemption. Amount will be transferred within 24-48 hours.',
  })
  @ApiParam({
    name: 'upiIdRecordId',
    description: 'The ID of the UPI record to select and use for redemption',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'UPI selected and redemption request submitted successfully',
    type: RedeemRewardsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No pending rewards or invalid UPI ID' })
  @ApiResponse({ status: 404, description: 'Influencer or UPI ID not found' })
  async selectUpiAndRedeem(
    @Req() req: RequestWithUser,
    @Param('upiIdRecordId', ParseIntPipe) upiIdRecordId: number,
  ) {
    if (req.user.userType !== 'influencer') {
      throw new BadRequestException('Only influencers can redeem rewards');
    }
    const influencerId = req.user.id;
    return await this.influencerService.selectUpiAndRedeemRewards(influencerId, upiIdRecordId);
  }
}
