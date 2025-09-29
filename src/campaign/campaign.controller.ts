import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CampaignService } from './campaign.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { SearchInfluencersDto } from './dto/search-influencers.dto';
import { InviteInfluencersDto } from './dto/invite-influencers.dto';
import { CampaignStatus } from './models/campaign.model';
import type { RequestWithUser } from '../types/request.types';

@ApiTags('Campaign')
@ApiBearerAuth()
@Controller('campaign')
@UseGuards(AuthGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new campaign',
    description:
      'Creates a new marketing campaign with deliverables and targeting preferences',
  })
  @ApiBody({
    type: CreateCampaignDto,
    description: 'Campaign creation data',
    examples: {
      allDeliverableTypes: {
        summary: 'All Available Deliverable Types',
        description:
          'Example showing all supported platform and deliverable type combinations',
        value: {
          name: 'Complete Multi-Platform Campaign',
          description:
            'Campaign showcasing all available deliverable types across platforms',
          category: 'Fashion',
          deliverableFormat: 'Mixed content across all platforms',
          isPanIndia: false,
          cityIds: [1, 2, 3],
          minAge: 18,
          maxAge: 35,
          isOpenToAllAges: false,
          genderPreferences: ['Female', 'Male'],
          isOpenToAllGenders: false,
          nicheIds: [1, 2],
          customInfluencerRequirements:
            'Active on multiple platforms with good engagement',
          performanceExpectations: 'Meet platform-specific engagement targets',
          brandSupport: 'Product samples and creative guidelines provided',
          deliverables: [
            {
              platform: 'instagram',
              type: 'instagram_post',
              budget: 2000,
              quantity: 2,
              specifications: 'High-quality feed posts with product placement',
            },
            {
              platform: 'instagram',
              type: 'instagram_story',
              budget: 1000,
              quantity: 3,
              specifications: 'Stories with interactive elements',
            },
            {
              platform: 'instagram',
              type: 'instagram_reel',
              budget: 3000,
              quantity: 2,
              specifications: 'Trending reels with product showcase',
            },
            {
              platform: 'youtube',
              type: 'youtube_short',
              budget: 2500,
              quantity: 2,
              specifications: 'Vertical short-form videos under 60 seconds',
            },
            {
              platform: 'youtube',
              type: 'youtube_long_video',
              budget: 15000,
              quantity: 1,
              specifications: 'Detailed review or tutorial video',
            },
            {
              platform: 'facebook',
              type: 'facebook_post',
              budget: 1500,
              quantity: 1,
              specifications: 'Engaging Facebook post with brand integration',
            },
            {
              platform: 'linkedin',
              type: 'linkedin_post',
              budget: 2000,
              quantity: 1,
              specifications:
                'Professional LinkedIn post with industry insights',
            },
            {
              platform: 'twitter',
              type: 'twitter_post',
              budget: 800,
              quantity: 2,
              specifications: 'Twitter posts or threads with brand mentions',
            },
          ],
        },
      },
      simpleExample: {
        summary: 'Simple Instagram Campaign',
        description: 'Basic campaign example matching typical UI flow',
        value: {
          name: 'Summer Collection Launch',
          description: 'Promote new summer fashion collection',
          category: 'Fashion',
          deliverableFormat: 'Instagram posts and stories',
          isPanIndia: true,
          isOpenToAllAges: false,
          minAge: 18,
          maxAge: 30,
          genderPreferences: ['Female'],
          isOpenToAllGenders: false,
          nicheIds: [1],
          customInfluencerRequirements:
            'Fashion influencers with style-focused content',
          performanceExpectations:
            'High engagement and authentic brand integration',
          brandSupport: 'Product samples and styling guidelines',
          deliverables: [
            {
              platform: 'instagram',
              type: 'instagram_post',
              budget: 5000,
              quantity: 2,
              specifications: 'Styled outfit posts featuring collection pieces',
            },
            {
              platform: 'instagram',
              type: 'instagram_story',
              budget: 2000,
              quantity: 3,
              specifications: 'Behind-the-scenes styling and try-on content',
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Campaign created successfully',
    schema: {
      example: {
        id: 1,
        name: 'Summer Fashion Campaign',
        status: 'draft',
        brandId: 1,
        createdAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid campaign data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only brands can create campaigns',
  })
  async createCampaign(
    @Body() createCampaignDto: CreateCampaignDto,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.userType !== 'brand') {
      throw new ForbiddenException('Only brands can create campaigns');
    }

    return this.campaignService.createCampaign(createCampaignDto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get campaigns with pagination and filters',
    description:
      'Retrieves campaigns with optional filtering by status, type, and search term',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of campaigns per page',
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CampaignStatus,
    description: 'Filter by campaign status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by campaign type',
    example: 'paid',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search campaigns by name or description',
    example: 'summer',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaigns retrieved successfully',
    schema: {
      example: {
        campaigns: [
          {
            id: 1,
            name: 'Summer Fashion Campaign',
            status: 'active',
            brandId: 1,
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
          },
        ],
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      },
    },
  })
  async getCampaigns(
    @Query() getCampaignsDto: GetCampaignsDto,
    @Req() req?: RequestWithUser,
  ) {
    const brandId = req?.user?.userType === 'brand' ? req.user.id : undefined;
    return this.campaignService.getCampaigns(getCampaignsDto, brandId);
  }

  @Get('my-campaigns')
  @ApiOperation({
    summary: 'Get campaigns for the authenticated brand',
    description: 'Retrieves all campaigns created by the authenticated brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand campaigns retrieved successfully',
    schema: {
      example: [
        {
          id: 1,
          name: 'Summer Fashion Campaign',
          status: 'active',
          deliverables: [
            {
              platform: 'instagram',
              type: 'instagram_post',
              budget: 2000,
            },
          ],
          invitations: [{ status: 'pending' }, { status: 'accepted' }],
        },
      ],
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only brands can access this endpoint',
  })
  async getMyBrandCampaigns(@Req() req: RequestWithUser) {
    if (req.user.userType !== 'brand') {
      throw new ForbiddenException('Only brands can access this endpoint');
    }

    return this.campaignService.getBrandCampaigns(req.user.id);
  }

  @Get('cities/popular')
  @ApiOperation({
    summary: 'Get popular cities for campaign targeting',
    description:
      'Retrieves tier 1 and tier 2 cities that are commonly used for campaign targeting',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular cities retrieved successfully',
    schema: {
      example: [
        {
          id: 1,
          name: 'Mumbai',
          state: 'Maharashtra',
          tier: 1,
        },
        {
          id: 2,
          name: 'Delhi',
          state: 'Delhi',
          tier: 1,
        },
        {
          id: 3,
          name: 'Pune',
          state: 'Maharashtra',
          tier: 2,
        },
      ],
    },
  })
  async getPopularCities(@Req() req?: RequestWithUser) {
    const userId = req?.user?.id;
    const userType = req?.user?.userType;
    return this.campaignService.getPopularCities(userId, userType);
  }

  @Get('cities/search')
  @ApiOperation({
    summary: 'Search cities for campaign targeting',
    description:
      'Searches cities by name. Returns popular cities if query is less than 2 characters',
  })
  @ApiQuery({
    name: 'q',
    type: String,
    description: 'Search query for city name',
    example: 'mum',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Cities matching search query',
    schema: {
      example: [
        {
          id: 1,
          name: 'Mumbai',
          state: 'Maharashtra',
          tier: 1,
        },
        {
          id: 15,
          name: 'Mumbai Suburban',
          state: 'Maharashtra',
          tier: 2,
        },
      ],
    },
  })
  async searchCities(@Query('q') query: string) {
    return this.campaignService.searchCities(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get campaign by ID',
    description: 'Retrieves detailed information about a specific campaign',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Campaign ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign details retrieved successfully',
    schema: {
      example: {
        id: 1,
        name: 'Glow Like Never Before',
        description:
          "L'Oreal Paris skincare campaign focusing on natural glow and authentic beauty routines",
        category: 'Skincare + Makeup',
        deliverableFormat:
          'Instagram Reel - 1 iPhone reel, 1 story posts\n\nDuration: 30 seconds\nVertical format: 9:16 ratio\nMusic: Trending audio with clear voice-over\nHashtags: Include brand hashtags and trending beauty tags\nTags: @lorealparis\nContent: Product review with before/after, authentic testimonial',
        status: 'active',
        type: 'paid',
        startDate: '2024-06-01T00:00:00Z',
        endDate: '2024-07-31T00:00:00Z',
        isPanIndia: false,
        minAge: 18,
        maxAge: 24,
        genderPreferences: ['Female'],
        isOpenToAllGenders: false,
        niches: [
          {
            id: 1,
            name: 'Beauty',
            description: 'Beauty and cosmetics content',
          },
          {
            id: 5,
            name: 'Skincare',
            description: 'Skincare routines and product reviews',
          },
          {
            id: 8,
            name: 'Lifestyle',
            description: 'Lifestyle and daily routine content',
          },
        ],
        customInfluencerRequirements:
          'Beauty, Skincare, Lifestyle\n• Looking for content creators with authentic engagement\n• Minimum 10K followers with good engagement rate\n• Previous brand collaboration experience preferred\n• Professional content creation skills required',
        performanceExpectations:
          'Target: 50K+ total video views - 10K+\n• Engagement rate: minimum 5%\n• Authentic comments and saves\n• Story completion rate above 70%\n• Tracking via UTM links + promo codes provided',
        brandSupport:
          'Content brief + brand guidelines provided\n• Professional product images + key messaging\n• Dedicated brand contact for creative support\n• Fast approval process for content (24-48h)\n• Cross-promotion on brand social channels',
        brand: {
          id: 1,
          brandName: "L'Oreal Paris",
          profileImage: 'loreal-logo.jpg',
          websiteUrl: 'https://loreal.com',
        },
        cities: [
          {
            city: {
              id: 1,
              name: 'Mumbai',
              tier: 1,
            },
          },
          {
            city: {
              id: 2,
              name: 'Delhi',
              tier: 1,
            },
          },
        ],
        deliverables: [
          {
            platform: 'instagram',
            type: 'instagram_reel',
            budget: 15000,
            quantity: 1,
            specifications: '30-second vertical video with product demo',
          },
          {
            platform: 'instagram',
            type: 'instagram_story',
            budget: 5000,
            quantity: 1,
            specifications: 'Behind-the-scenes story posts',
          },
        ],
        invitations: [
          {
            status: 'pending',
            influencer: {
              id: 1,
              name: 'Sarah Beauty',
              username: 'sarahbeauty',
              profileImage: 'sarah.jpg',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getCampaignById(@Param('id', ParseIntPipe) campaignId: number) {
    return this.campaignService.getCampaignById(campaignId);
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'Update campaign status',
    description:
      'Updates the status of a campaign (only by the brand that owns it)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Campaign ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(CampaignStatus),
          example: 'active',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign status updated successfully',
    schema: {
      example: {
        id: 1,
        name: 'Summer Fashion Campaign',
        status: 'active',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only brands can update campaign status',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async updateCampaignStatus(
    @Param('id', ParseIntPipe) campaignId: number,
    @Body('status') status: CampaignStatus,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.userType !== 'brand') {
      throw new ForbiddenException('Only brands can update campaign status');
    }

    return this.campaignService.updateCampaignStatus(
      campaignId,
      status,
      req.user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete campaign',
    description:
      'Soft deletes a campaign (only by the brand that owns it). Active campaigns cannot be deleted.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Campaign ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot delete an active campaign',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only brands can delete campaigns',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async deleteCampaign(
    @Param('id', ParseIntPipe) campaignId: number,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.userType !== 'brand') {
      throw new ForbiddenException('Only brands can delete campaigns');
    }

    return this.campaignService.deleteCampaign(campaignId, req.user.id);
  }

  @Get('influencers/search')
  @ApiOperation({
    summary: 'Search influencers for campaign invitations',
    description:
      'Search and filter influencers based on various criteria for campaign targeting',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by influencer name or username',
    example: 'john',
  })
  @ApiQuery({
    name: 'minFollowers',
    required: false,
    type: Number,
    description: 'Minimum follower count',
    example: 1000,
  })
  @ApiQuery({
    name: 'maxFollowers',
    required: false,
    type: Number,
    description: 'Maximum follower count',
    example: 100000,
  })
  @ApiQuery({
    name: 'cityIds',
    required: false,
    type: [Number],
    description: 'Filter by city IDs',
    example: [1, 2, 3],
  })
  @ApiQuery({
    name: 'nicheIds',
    required: false,
    type: [Number],
    description: 'Filter by niche IDs',
    example: [1, 2],
  })
  @ApiQuery({
    name: 'gender',
    required: false,
    type: String,
    description: 'Filter by gender',
    example: 'Female',
  })
  @ApiQuery({
    name: 'minAge',
    required: false,
    type: Number,
    description: 'Minimum age',
    example: 18,
  })
  @ApiQuery({
    name: 'maxAge',
    required: false,
    type: Number,
    description: 'Maximum age',
    example: 35,
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
    status: 200,
    description: 'Influencers found successfully',
    schema: {
      example: {
        influencers: [
          {
            id: 1,
            name: 'John Doe',
            username: 'johndoe',
            profileImage: 'profile.jpg',
            profileHeadline: 'Fashion & Lifestyle Influencer',
            bio: 'Creating content that inspires',
            gender: 'Male',
            city: {
              id: 1,
              name: 'Mumbai',
              state: 'Maharashtra',
              tier: 1,
            },
            niches: [
              {
                id: 1,
                name: 'Fashion',
              },
            ],
            collaborationCosts: {
              instagram_post: 5000,
              instagram_story: 2000,
            },
            socialLinks: {
              instagram: 'https://instagram.com/johndoe',
              youtube: 'https://youtube.com/johndoe',
            },
          },
        ],
        total: 150,
        page: 1,
        limit: 20,
        totalPages: 8,
      },
    },
  })
  async searchInfluencers(@Query() searchDto: SearchInfluencersDto) {
    return this.campaignService.searchInfluencers(searchDto);
  }

  @Post('invite-influencers')
  @ApiOperation({
    summary: 'Send campaign invitations to selected influencers',
    description:
      'Invites multiple influencers to participate in a campaign and sends WhatsApp notifications',
  })
  @ApiBody({
    type: InviteInfluencersDto,
    description: 'Campaign invitation data',
    examples: {
      example1: {
        summary: 'Bulk Invitation Example',
        value: {
          campaignId: 1,
          influencerIds: [1, 2, 3, 4, 5],
          personalMessage:
            'We love your content and would like to collaborate with you on our summer campaign!',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Invitations sent successfully',
    schema: {
      example: {
        success: true,
        invitationsSent: 5,
        failedInvitations: [],
        message:
          'Successfully sent 5 campaign invitations. 5 WhatsApp notifications sent successfully.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or campaign status',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only brands can send invitations',
  })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async inviteInfluencers(
    @Body() inviteDto: InviteInfluencersDto,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.userType !== 'brand') {
      throw new ForbiddenException('Only brands can send campaign invitations');
    }

    return this.campaignService.inviteInfluencers(inviteDto, req.user.id);
  }
}
