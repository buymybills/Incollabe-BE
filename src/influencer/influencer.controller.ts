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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { InfluencerService } from './influencer.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdateInfluencerProfileDto } from './dto/update-influencer-profile.dto';
import {
  SendWhatsAppOTPDto,
  VerifyWhatsAppOTPDto,
} from './dto/whatsapp-verification.dto';
import { ApplyCampaignDto } from '../campaign/dto/apply-campaign.dto';
import { GetOpenCampaignsDto } from '../campaign/dto/get-open-campaigns.dto';
import type { RequestWithUser } from '../types/request.types';

@ApiTags('Influencer Profile')
@Controller('influencer')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InfluencerController {
  constructor(private readonly influencerService: InfluencerService) {}

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
  async getInfluencerProfile(@Req() req: RequestWithUser) {
    const influencerId = req.user.id;
    return await this.influencerService.getInfluencerProfile(influencerId);
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
        name: {
          type: 'string',
          description: 'Full name - can update existing',
        },
        username: {
          type: 'string',
          description: 'Username - can update existing',
        },
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
        dateOfBirth: {
          type: 'string',
          description: 'Date of birth - can update existing or add if skipped',
        },
        gender: {
          type: 'string',
          description: 'Gender - can update existing or add if skipped',
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
      },
      example: {
        name: 'Bharti Mishra',
        username: 'bharti_mishra',
        bio: 'I am a fashion influencer creating amazing content',
        profileHeadline:
          'Fashion influencer creating amazing lifestyle content',
        dateOfBirth: '1995-01-15',
        gender: 'Female',
        countryId: '1',
        cityId: '3',
        whatsappNumber: '9870541151',
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
    const influencerId = req.user.id;
    return await this.influencerService.updateInfluencerProfile(
      influencerId,
      updateData,
      files,
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
    description: 'Get public influencer profile by ID',
  })
  async getPublicInfluencerProfile(
    @Param('id', ParseIntPipe) influencerId: number,
  ) {
    const profile = await this.influencerService.getInfluencerProfile(
      influencerId,
      true,
    );

    // Return public fields only
    return {
      id: profile.id,
      name: profile.name,
      username: profile.username,
      bio: profile.bio,
      profileImage: profile.profileImage,
      profileBanner: profile.profileBanner,
      profileHeadline: profile.profileHeadline,
      location: profile.location,
      socialLinks: profile.socialLinks,
      niches: profile.niches,
    };
  }

  @Get('campaigns/open')
  @ApiOperation({
    summary: 'Browse open campaigns available for application',
    description:
      'Get list of open campaigns that influencers can apply to, with filtering options',
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

  @Post('campaigns/apply')
  @ApiOperation({
    summary: 'Apply to a campaign',
    description:
      'Submit application for a specific campaign with optional cover letter and proposal',
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
    @Body() applyCampaignDto: ApplyCampaignDto,
    @Req() req: RequestWithUser,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.applyCampaign(applyCampaignDto, influencerId);
  }

  @Get('campaigns/my-applications')
  @ApiOperation({
    summary: 'Get my campaign applications',
    description:
      'Get list of all campaign applications submitted by the influencer with status',
  })
  @ApiResponse({
    status: 200,
    description: 'Applications retrieved successfully',
    schema: {
      example: [
        {
          id: 1,
          status: 'applied',
          coverLetter: 'I am passionate about beauty...',
          proposalMessage: 'I propose creating 3 Instagram posts...',
          createdAt: '2024-01-01T00:00:00Z',
          campaign: {
            id: 1,
            name: 'Summer Fashion Campaign',
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
            endDate: '2024-07-31',
          },
        },
      ],
    },
  })
  async getMyApplications(@Req() req: RequestWithUser) {
    const influencerId = req.user.id;
    return this.influencerService.getMyApplications(influencerId);
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
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getCampaignDetails(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Req() req: RequestWithUser,
  ) {
    const influencerId = req.user.id;
    return this.influencerService.getCampaignDetails(campaignId, influencerId);
  }
}
