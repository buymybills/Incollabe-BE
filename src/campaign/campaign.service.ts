import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, literal } from 'sequelize';
import { Campaign, CampaignStatus, CampaignType } from './models/campaign.model';
import { CampaignCity } from './models/campaign-city.model';
import { CampaignDeliverable } from './models/campaign-deliverable.model';
import { CampaignInvitation } from './models/campaign-invitation.model';
import {
  CampaignApplication,
  ApplicationStatus,
} from './models/campaign-application.model';
import { City } from '../shared/models/city.model';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { GetCampaignApplicationsDto } from './dto/get-campaign-applications.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { SearchInfluencersDto } from './dto/search-influencers.dto';
import { InviteInfluencersDto } from './dto/invite-influencers.dto';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { InvoiceStatus } from '../influencer/models/payment-enums';
// REMOVED: Imports only needed for early selection bonus feature (now disabled)
// import { CreditTransactionType, PaymentStatus } from '../admin/models/credit-transaction.model';
// import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { InvitationStatus } from './models/campaign-invitation.model';
import { Gender } from '../auth/types/gender.enum';
import { WhatsAppService } from '../shared/whatsapp.service';
import { NotificationService } from '../shared/notification.service';
import { DeviceTokenService } from '../shared/device-token.service';
import { UserType } from '../shared/models/device-token.model';
import { Follow } from '../post/models/follow.model';
import { Experience } from '../influencer/models/experience.model';
import { CampaignQueryService } from './services/campaign-query.service';
import { QueryBuilderHelper } from './helpers/query-builder.helper';
import {
  CampaignsByCategoryResponse,
  CampaignCategoryType,
} from './interfaces/campaign-with-stats.interface';

@Injectable()
export class CampaignService {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(CampaignCity)
    private readonly campaignCityModel: typeof CampaignCity,
    @InjectModel(CampaignDeliverable)
    private readonly campaignDeliverableModel: typeof CampaignDeliverable,
    @InjectModel(CampaignInvitation)
    private readonly campaignInvitationModel: typeof CampaignInvitation,
    @InjectModel(CampaignApplication)
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Follow)
    private readonly followModel: typeof Follow,
    @InjectModel(Experience)
    private readonly experienceModel: typeof Experience,
    // REMOVED: Models only needed for early selection bonus feature (now disabled)
    // @InjectModel(CreditTransaction)
    // private readonly creditTransactionModel: typeof CreditTransaction,
    // @InjectModel(InfluencerReferralUsage)
    // private readonly influencerReferralUsageModel: typeof InfluencerReferralUsage,
    private readonly whatsAppService: WhatsAppService,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly campaignQueryService: CampaignQueryService,
  ) {}

  /**
   * Transform campaign data for API response
   * @param campaignData - Raw campaign data
   * @returns Transformed campaign data with proper field names
   */
  /**
   * Maps deliverable type value to its human-readable label
   */
  private getDeliverableLabel(value: string): string {
    const deliverableLabels: Record<string, string> = {
      // Social media deliverables
      instagram_reel: 'Insta Reel / Post',
      instagram_story: 'Insta Story',
      youtube_short: 'YT Shorts',
      youtube_long_video: 'YT Video',
      facebook_story: 'FB Story',
      facebook_post: 'FB Post',
      twitter_post: 'X Post',
      linkedin_post: 'LinkedIn Post',
      // Engagement deliverables
      like_comment: 'Like/Comment',
      playstore_review: 'Playstore Review',
      appstore_review: 'App Store Review',
      google_review: 'Google Review',
      app_download: 'App Download',
    };

    return deliverableLabels[value] || value;
  }

  private transformCampaignResponse(campaignData: any): any {
    // Extract deliverableFormat as array of human-readable labels from deliverables
    const deliverableFormat = campaignData.deliverables
      ? campaignData.deliverables.map((d: any) => this.getDeliverableLabel(d.type))
      : [];

    // Calculate promotionType based on boolean flags
    let promotionType: 'organic' | 'max' | 'invite_only' | 'invite_only_unpaid' = 'organic';
    if (campaignData.isMaxCampaign) {
      promotionType = 'max';
    } else if (campaignData.isInviteOnly && campaignData.inviteOnlyPaid) {
      promotionType = 'invite_only';
    } else if (campaignData.isInviteOnly && !campaignData.inviteOnlyPaid) {
      promotionType = 'invite_only_unpaid';
    }

    const response: any = {
      ...campaignData,
      deliverableFormat, // Array of label strings: ["Insta Reel / Post", "YT Shorts"]
      promotionType, // Computed field: "organic" | "max" | "invite_only" | "invite_only_unpaid"
    };

    // Remove deliverables from response (we only need deliverableFormat labels)
    delete response.deliverables;

    return response;
  }

  async createCampaign(
    createCampaignDto: CreateCampaignDto,
    brandId: number,
  ): Promise<CampaignResponseDto> {
    const { deliverableFormat, cityIds, ...campaignData } = createCampaignDto;

    // Validate budget fields based on campaign type
    const campaignType = createCampaignDto.type || CampaignType.PAID;

    if (campaignType === CampaignType.BARTER) {
      // BARTER campaigns require barterProductWorth
      if (!createCampaignDto.barterProductWorth) {
        throw new BadRequestException(
          'Barter Product Worth is required for BARTER campaigns',
        );
      }
    } else {
      // PAID, UGC, ENGAGEMENT campaigns require campaignBudget
      if (!createCampaignDto.campaignBudget) {
        throw new BadRequestException(
          'Campaign Budget is required for PAID, UGC, and ENGAGEMENT campaigns',
        );
      }
    }

    // Validate cities if not pan India
    if (!createCampaignDto.isPanIndia && (!cityIds || cityIds.length === 0)) {
      throw new BadRequestException(
        'At least one city must be selected for non-pan-India campaigns',
      );
    }

    if (cityIds && cityIds.length > 0) {
      const existingCities = await this.cityModel.findAll({
        where: { id: { [Op.in]: cityIds } },
      });

      if (existingCities.length !== cityIds.length) {
        throw new BadRequestException('One or more cities are invalid');
      }
    }

    // Create campaign
    const campaign = await this.campaignModel.create({
      ...campaignData,
      brandId,
    } as any);

    // Add cities if specified
    if (cityIds && cityIds.length > 0) {
      const campaignCities = cityIds.map((cityId) => ({
        campaignId: campaign.id,
        cityId,
      }));
      await this.campaignCityModel.bulkCreate(campaignCities as any);
    }

    // Transform deliverableFormat array (strings) into deliverable objects
    const campaignDeliverables = deliverableFormat.map((type) => ({
      campaignId: campaign.id,
      platform: this.extractPlatformFromType(type),
      type: type,
      quantity: 1, // Default quantity
    }));
    await this.campaignDeliverableModel.bulkCreate(campaignDeliverables as any);

    return this.getCampaignById(campaign.id);
  }

  /**
   * Helper method to extract platform from deliverable type
   * E.g., "instagram_story" -> "instagram"
   */
  private extractPlatformFromType(type: string): string {
    if (type.startsWith('instagram_')) return 'instagram';
    if (type.startsWith('youtube_')) return 'youtube';
    if (type.startsWith('facebook_')) return 'facebook';
    if (type.startsWith('linkedin_')) return 'linkedin';
    if (type.startsWith('twitter_')) return 'twitter';
    if (
      [
        'like_comment',
        'playstore_review',
        'appstore_review',
        'google_review',
        'app_download',
      ].includes(type)
    ) {
      return 'engagement';
    }
    throw new BadRequestException(`Unknown deliverable type: ${type}`);
  }

  async getCampaigns(
    getCampaignsDto: GetCampaignsDto,
    brandId?: number,
    influencerId?: number,
  ): Promise<{
    campaigns: Campaign[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, status, type, search } = getCampaignsDto;
    const offset = (page - 1) * limit;

    const whereCondition: any = { isActive: true };

    if (brandId) {
      whereCondition.brandId = brandId;
    }

    // For influencers: exclude invite-only campaigns they haven't been invited to
    let inviteOnlyFilter: any = null;
    if (influencerId && !brandId) {
      // Get campaign IDs where influencer has been invited
      const invitations = await this.campaignInvitationModel.findAll({
        where: { influencerId },
        attributes: ['campaignId'],
      });
      const invitedCampaignIds = invitations.map(inv => inv.campaignId);

      // Show only:
      // 1. Non-invite-only campaigns (isInviteOnly: false)
      // 2. Invite-only campaigns where they have an invitation
      inviteOnlyFilter = {
        [Op.or]: [
          { isInviteOnly: false },
          { id: { [Op.in]: invitedCampaignIds.length > 0 ? invitedCampaignIds : [-1] } }
        ]
      };
    }

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    if (search) {
      const searchCondition = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ]
      };

      // Combine search with invite-only filter if both exist
      if (inviteOnlyFilter) {
        whereCondition[Op.and] = [inviteOnlyFilter, searchCondition];
      } else {
        Object.assign(whereCondition, searchCondition);
      }
    } else if (inviteOnlyFilter) {
      // Apply invite-only filter without search
      Object.assign(whereCondition, inviteOnlyFilter);
    }

    const { count, rows: campaigns } = await this.campaignModel.findAndCountAll(
      {
        where: whereCondition,
        include: [
          {
            model: Brand,
            attributes: ['id', 'brandName', 'profileImage'],
          },
          {
            model: CampaignCity,
            attributes: ['id'], // Keep id to allow nested city data
            include: [
              {
                model: City,
                attributes: ['id', 'name', 'tier'],
              },
            ],
          },
          {
            model: CampaignDeliverable,
            attributes: ['platform', 'type', 'budget', 'quantity'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      },
    );

    const totalPages = Math.ceil(count / limit);

    // Transform each campaign in the list
    const transformedCampaigns = campaigns.map((campaign) => {
      const campaignData = campaign.toJSON();

      // Transform cities to array of objects
      if (campaignData.cities && campaignData.cities.length > 0) {
        const citiesArray = campaignData.cities.map((cityRelation: any) => {
          // Handle nested city structure from CampaignCity relation
          const cityData = cityRelation.city || cityRelation;
          return {
            id: cityData.id,
            name: cityData.name,
            tier: cityData.tier,
          };
        });
        (campaignData as any).cities = citiesArray;
      } else {
        (campaignData as any).cities = [];
      }

      return this.transformCampaignResponse(campaignData);
    });

    return {
      campaigns: transformedCampaigns,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get campaigns by category with proper type safety and separation of concerns
   * @param brandId - The brand ID to fetch campaigns for
   * @param type - Optional campaign category filter (open, invite, finished)
   * @param campaignType - Optional campaign type filter (paid, barter, ugc, engagement)
   * @returns Campaigns with appropriate statistics
   */
  async getCampaignsByCategory(
    brandId: number,
    type?: string,
    campaignType?: string,
  ): Promise<CampaignsByCategoryResponse> {
    const campaigns = await this.campaignQueryService.getCampaignsByCategory(
      brandId,
      type,
      campaignType,
    );

    // Transform field names and cities for all campaigns
    const transformedCampaigns = campaigns.map((campaign) => {
      const campaignData =
        typeof campaign.toJSON === 'function' ? campaign.toJSON() : campaign;

      // Transform cities to array of objects
      if (campaignData.cities && campaignData.cities.length > 0) {
        const citiesArray = campaignData.cities.map((cityRelation: any) => {
          // Handle nested city structure from CampaignCity relation
          const cityData = cityRelation.city || cityRelation;
          return {
            id: cityData.id,
            name: cityData.name,
            tier: cityData.tier,
          };
        });
        (campaignData as any).cities = citiesArray;
      } else {
        (campaignData as any).cities = [];
      }

      return this.transformCampaignResponse(campaignData);
    });

    return { campaigns: transformedCampaigns };
  }

  async getCampaignById(campaignId: number): Promise<CampaignResponseDto> {
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId },
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName', 'profileImage', 'websiteUrl'],
        },
        {
          model: CampaignCity,
          attributes: ['id'], // Keep id to allow nested city data
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'tier'],
            },
          ],
        },
        {
          model: CampaignDeliverable,
        },
        {
          model: CampaignInvitation,
          include: [
            {
              model: Influencer,
              attributes: ['id', 'name', 'username', 'profileImage'],
            },
          ],
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Transform the response to clean up city structure
    const campaignData = campaign.toJSON();

    // Transform cities to array of objects
    if (campaignData.cities && campaignData.cities.length > 0) {
      const citiesArray = campaignData.cities.map((cityRelation: any) => {
        // Handle nested city structure from CampaignCity relation
        const cityData = cityRelation.city || cityRelation;
        return {
          id: cityData.id,
          name: cityData.name,
          tier: cityData.tier,
        };
      });
      (campaignData as any).cities = citiesArray;
    } else {
      (campaignData as any).cities = [];
    }

    // Apply field renaming transformation
    return this.transformCampaignResponse(campaignData) as CampaignResponseDto;
  }

  async updateCampaign(
    campaignId: number,
    updateCampaignDto: UpdateCampaignDto,
    brandId: number,
  ): Promise<CampaignResponseDto> {
    const { deliverables, cityIds, ...campaignData } = updateCampaignDto;

    // Find campaign
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Validate cities if provided and not pan India
    if (cityIds !== undefined) {
      if (
        updateCampaignDto.isPanIndia === false &&
        (!cityIds || cityIds.length === 0)
      ) {
        throw new BadRequestException(
          'At least one city must be selected for non-pan-India campaigns',
        );
      }

      if (cityIds && cityIds.length > 0) {
        const existingCities = await this.cityModel.findAll({
          where: { id: { [Op.in]: cityIds } },
        });

        if (existingCities.length !== cityIds.length) {
          throw new BadRequestException('One or more cities are invalid');
        }
      }

      // Delete existing cities and add new ones
      await this.campaignCityModel.destroy({
        where: { campaignId },
      });

      if (cityIds && cityIds.length > 0) {
        const campaignCities = cityIds.map((cityId) => ({
          campaignId: campaign.id,
          cityId,
        }));
        await this.campaignCityModel.bulkCreate(campaignCities as any);
      }
    }

    // Update deliverables if provided
    if (deliverables !== undefined) {
      // Delete existing deliverables and add new ones
      await this.campaignDeliverableModel.destroy({
        where: { campaignId },
      });

      if (deliverables && deliverables.length > 0) {
        const campaignDeliverables = deliverables.map((deliverable) => ({
          ...deliverable,
          campaignId: campaign.id,
        }));
        await this.campaignDeliverableModel.bulkCreate(
          campaignDeliverables as any,
        );
      }
    }

    // Update campaign fields
    await campaign.update(campaignData);

    return this.getCampaignById(campaign.id);
  }

  async closeCampaign(
    campaignId: number,
    brandId: number,
  ): Promise<{ message: string }> {
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // When closing a campaign, mark it as completed
    await campaign.update({
      isActive: false,
      status: CampaignStatus.COMPLETED,
    });

    return { message: 'Campaign closed successfully' };
  }

  async updateCampaignStatus(
    campaignId: number,
    status: CampaignStatus,
    brandId: number,
  ): Promise<CampaignResponseDto> {
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
      include: [
        {
          model: Brand,
          attributes: ['brandName'],
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const oldStatus = campaign.status;
    await campaign.update({ status });

    // If campaign is marked as completed, notify all selected influencers
    if (
      status === CampaignStatus.COMPLETED &&
      oldStatus !== CampaignStatus.COMPLETED
    ) {
      try {
        // Find all selected influencers for this campaign
        const selectedApplications =
          await this.campaignApplicationModel.findAll({
            where: {
              campaignId,
              status: ApplicationStatus.SELECTED,
            },
            include: [
              {
                model: Influencer,
                attributes: ['id', 'name'],
              },
            ],
          });

        // Send push notifications to all selected influencers
        const brandName = campaign.brand?.brandName || 'Brand';
        for (const application of selectedApplications) {
          if (application.influencer?.id) {
            try {
              // Get all device tokens for this influencer
              const deviceTokens = await this.deviceTokenService.getAllUserTokens(
                application.influencer.id,
                UserType.INFLUENCER,
              );

              if (deviceTokens.length > 0) {
                await this.notificationService.sendCampaignStatusUpdate(
                  deviceTokens,
                  campaign.name,
                  'completed',
                  brandName,
                );
              }
            } catch (error) {
              console.error(
                `Failed to send completion notification to influencer ${application.influencer.id}:`,
                error,
              );
              // Continue with other influencers
            }
          }
        }
        console.log(
          `Sent campaign completion notifications to ${selectedApplications.length} influencers`,
        );
      } catch (error) {
        console.error(
          'Failed to send campaign completion notifications:',
          error,
        );
        // Don't fail the status update if notifications fail
      }
    }

    // Return updated campaign data
    const updatedCampaign = await this.campaignModel.findOne({
      where: { id: campaignId, isActive: true },
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName', 'profileImage', 'websiteUrl'],
        },
        {
          model: CampaignCity,
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'tier'],
            },
          ],
        },
        {
          model: CampaignDeliverable,
        },
        {
          model: CampaignInvitation,
          include: [
            {
              model: Influencer,
              attributes: ['id', 'name', 'username', 'profileImage'],
            },
          ],
        },
      ],
    });

    if (!updatedCampaign) {
      throw new NotFoundException('Campaign not found after update');
    }

    // Transform the response to clean up city structure
    const campaignData = updatedCampaign.toJSON();

    // Transform cities to remove intermediate table data
    if (campaignData.cities && campaignData.cities.length > 0) {
      (campaignData as any).cities = campaignData.cities.map(
        (cityRelation: any) => ({
          id: cityRelation.city.id,
          name: cityRelation.city.name,
          tier: cityRelation.city.tier,
        }),
      );
    }

    return campaignData as unknown as CampaignResponseDto;
  }

  async deleteCampaign(campaignId: number, brandId: number): Promise<void> {
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new BadRequestException('Cannot delete an active campaign');
    }

    await campaign.update({ isActive: false });
  }

  async getPopularCities(
    userId?: number,
    userType?: 'brand' | 'influencer',
  ): Promise<City[]> {
    // Default: Indian tier 1 cities
    let whereCondition: any = {
      countryId: 1, // India
      tier: 1, // Tier 1 cities only
    };

    // If user is provided, check if they're from India
    if (userId && userType) {
      let isFromIndia = false;

      if (userType === 'brand') {
        const brand = await this.brandModel.findByPk(userId, {
          attributes: ['headquarterCountryId'],
        });
        isFromIndia = brand?.headquarterCountryId === 1;
      } else if (userType === 'influencer') {
        const influencer = await this.influencerModel.findByPk(userId, {
          attributes: ['countryId'],
        });
        isFromIndia = influencer?.countryId === 1;
      }

      // If user is from India (countryId = 1), show Indian tier 1 and tier 2 cities
      if (isFromIndia) {
        whereCondition = {
          countryId: 1, // India
          tier: {
            [Op.in]: [1, 2], // Tier 1 and Tier 2 cities
          },
        };
      }
    }

    return this.cityModel.findAll({
      where: whereCondition,
      order: [
        ['tier', 'ASC'], // Sort by tier first (1, then 2)
        ['name', 'ASC'], // Then alphabetically
      ],
      limit: 20,
    });
  }

  async searchCities(query: string): Promise<City[]> {
    if (!query || query.length < 2) {
      return this.getPopularCities();
    }

    return this.cityModel.findAll({
      where: {
        name: {
          [Op.iLike]: `%${query}%`,
        },
      },
      order: [
        ['tier', 'ASC'],
        ['name', 'ASC'],
      ],
      limit: 50,
    });
  }

  async getBrandCampaigns(
    brandId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    campaigns: Campaign[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Debug logging
    console.log('getBrandCampaigns called with:', {
      brandId,
      page,
      limit,
      offset,
      pageType: typeof page,
      limitType: typeof limit,
    });

    const { rows: campaigns, count: total } =
      await this.campaignModel.findAndCountAll({
        where: { brandId, isActive: true },
        include: [
          {
            model: CampaignDeliverable,
            attributes: ['platform', 'type', 'budget'],
          },
          {
            model: CampaignInvitation,
            attributes: ['status'],
          },
          {
            model: CampaignApplication,
            attributes: ['id'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

    console.log('Query result:', {
      campaignsReturned: campaigns.length,
      total,
      page,
      limit,
      offset,
    });

    // Add application count to each campaign and transform field names
    const campaignsWithStats = campaigns.map((campaign) => {
      const campaignData: Campaign & { totalApplications: number } =
        campaign.toJSON();
      campaignData.totalApplications = campaign.applications?.length ?? 0;
      return this.transformCampaignResponse(campaignData);
    });

    return {
      campaigns: campaignsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchInfluencers(searchDto: SearchInfluencersDto): Promise<{
    influencers: Influencer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      search,
      minFollowers,
      maxFollowers,
      cityIds,
      nicheIds,
      gender,
      minAge,
      maxAge,
      page = 1,
      limit = 20,
    } = searchDto;

    const offset = (page - 1) * limit;
    const whereCondition: any = {
      isProfileCompleted: true,
      isWhatsappVerified: true,
    };

    // Search by name or username
    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Gender filter
    if (gender) {
      whereCondition.gender = gender;
    }

    // Age filter
    if (minAge || maxAge) {
      const ageConditions: any = {};
      const currentDate = new Date();

      if (maxAge) {
        const minBirthDate = new Date(
          currentDate.getFullYear() - maxAge,
          currentDate.getMonth(),
          currentDate.getDate(),
        );
        ageConditions[Op.gte] = minBirthDate;
      }

      if (minAge) {
        const maxBirthDate = new Date(
          currentDate.getFullYear() - minAge,
          currentDate.getMonth(),
          currentDate.getDate(),
        );
        ageConditions[Op.lte] = maxBirthDate;
      }

      if (Object.keys(ageConditions).length > 0) {
        whereCondition.dateOfBirth = ageConditions;
      }
    }

    // City filter
    if (cityIds && cityIds.length > 0) {
      whereCondition.cityId = { [Op.in]: cityIds };
    }

    const includeOptions: any[] = [
      {
        model: City,
        attributes: ['id', 'name', 'state', 'tier'],
      },
    ];

    // Niche filter
    if (nicheIds && nicheIds.length > 0) {
      includeOptions.push({
        model: Niche,
        attributes: ['id', 'name', 'logoNormal', 'logoDark'],
        through: { attributes: [] },
        where: { id: { [Op.in]: nicheIds } },
        required: true,
      });
    } else {
      includeOptions.push({
        model: Niche,
        attributes: ['id', 'name', 'logoNormal', 'logoDark'],
        through: { attributes: [] },
        required: false,
      });
    }

    const { count, rows: influencers } =
      await this.influencerModel.findAndCountAll({
        where: whereCondition,
        include: includeOptions,
        attributes: [
          'id',
          'name',
          'username',
          'profileImage',
          'profileHeadline',
          'bio',
          'gender',
          'collaborationCosts',
          'instagramUrl',
          'youtubeUrl',
          'facebookUrl',
          'linkedinUrl',
          'twitterUrl',
          'createdAt',
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      });

    const totalPages = Math.ceil(count / limit);

    return {
      influencers,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  async inviteInfluencers(
    inviteDto: InviteInfluencersDto,
    brandId: number,
  ): Promise<{
    success: boolean;
    invitationsSent: number;
    message: string;
  }> {
    const { campaignId, influencerIds, personalMessage } = inviteDto;

    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName'],
          required: false,
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    // Check if invite-only campaign has been paid for
    if (campaign.isInviteOnly && !campaign.inviteOnlyPaid) {
      throw new BadRequestException(
        'Please complete the payment of Rs 499 to unlock the invite-only feature before sending invitations',
      );
    }

    // Check if campaign is in correct status for invitations
    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Cannot send invitations for campaigns in this status',
      );
    }

    // Verify all influencers exist and are eligible
    const influencers = await this.influencerModel.findAll({
      where: {
        id: { [Op.in]: influencerIds },
        isProfileCompleted: true,
        isWhatsappVerified: true,
      },
      attributes: ['id', 'name', 'whatsappNumber'],
    });

    if (influencers.length !== influencerIds.length) {
      throw new BadRequestException(
        'Some influencers are not found or not eligible for invitations',
      );
    }

    // Check for existing invitations
    const existingInvitations = await this.campaignInvitationModel.findAll({
      where: {
        campaignId,
        influencerId: { [Op.in]: influencerIds },
      },
    });

    const existingInfluencerIds = existingInvitations.map(
      (inv) => inv.influencerId,
    );

    // Remove duplicates from influencerIds array and filter out existing invitations
    const uniqueInfluencerIds = [...new Set(influencerIds)];
    const newInfluencerIds = uniqueInfluencerIds.filter(
      (id) => !existingInfluencerIds.includes(id),
    );

    if (newInfluencerIds.length === 0) {
      throw new BadRequestException(
        'All selected influencers have already been invited to this campaign',
      );
    }

    // Set expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitations
    const invitationsToCreate = newInfluencerIds.map((influencerId) => ({
      campaignId,
      influencerId,
      status: InvitationStatus.PENDING,
      message: personalMessage || null,
      expiresAt,
    }));

    // Use bulkCreate with ignoreDuplicates to handle race conditions
    const createdInvitations = await this.campaignInvitationModel.bulkCreate(
      invitationsToCreate as any,
      {
        ignoreDuplicates: true, // This will skip duplicates instead of throwing error
      },
    );

    // Send WhatsApp and push notifications
    const brandName = campaign.brand?.brandName || 'Brand';

    // Create a Set of newInfluencerIds for faster lookup and to ensure uniqueness
    const newInfluencerIdsSet = new Set(newInfluencerIds);

    // Filter influencers to only those who are newly invited (no duplicates)
    const influencersToNotify = influencers.filter((inf) =>
      newInfluencerIdsSet.has(inf.id),
    );

    for (const influencer of influencersToNotify) {
      // COMMENTED: WhatsApp notification for campaign invitation (using push notifications instead)
      // this.whatsAppService.sendCampaignInvitation(
      //   influencer.whatsappNumber,
      //   influencer.name,
      //   campaign.name,
      //   brandName,
      //   personalMessage,
      // );

      // Send push notification to all devices
      try {
        const deviceTokens = await this.deviceTokenService.getAllUserTokens(
          influencer.id,
          UserType.INFLUENCER,
        );

        if (deviceTokens.length > 0) {
          await this.notificationService.sendCampaignInviteNotification(
            deviceTokens,
            campaign.name,
            brandName,
          );
        }
      } catch (error) {
        console.error(
          `Failed to send push notification to influencer ${influencer.id}:`,
          error,
        );
        // Continue with other influencers even if one fails
      }
    }

    return {
      success: true,
      invitationsSent: newInfluencerIds.length,
      message: `Successfully sent ${newInfluencerIds.length} campaign invitations with WhatsApp and push notifications.`,
    };
  }

  async getCampaignApplications(
    campaignId: number,
    getApplicationsDto: GetCampaignApplicationsDto,
    brandId: number,
  ): Promise<{
    applications: CampaignApplication[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Verify campaign exists and belongs to the brand
    // Note: We allow viewing applications even for inactive/completed campaigns
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    const {
      status,
      gender,
      niches,
      cities,
      minAge,
      maxAge,
      platforms,
      experience,
      sortBy = 'application_new_old',
      page = 1,
      limit = 10,
    } = getApplicationsDto;
    const offset = (page - 1) * limit;

    // Parse comma-separated strings into arrays
    const nicheIds = niches
      ? niches
          .split(',')
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id))
      : [];
    const cityIds = cities
      ? cities
          .split(',')
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id))
      : [];
    const platformList = platforms
      ? platforms
          .split(',')
          .map((p) => p.trim().toLowerCase())
          .filter((p) => p.length > 0)
      : [];
    // Parse and validate gender values against Gender enum
    const genderList: string[] = [];
    if (gender) {
      const validGenders = Object.values(Gender);
      const inputGenders = gender
        .split(',')
        .map((g) => g.trim())
        .filter((g) => g.length > 0);

      for (const inputGender of inputGenders) {
        // Find matching enum value (case-insensitive)
        const matchedGender = validGenders.find(
          (validGender) =>
            validGender.toLowerCase() === inputGender.toLowerCase(),
        );

        if (!matchedGender) {
          throw new BadRequestException(
            `Invalid gender value: "${inputGender}". Valid values are: ${validGenders.join(', ')}`,
          );
        }

        genderList.push(matchedGender);
      }
    }

    console.log('Platform filter - platformList:', platformList);
    console.log('Gender filter - genderList:', genderList);

    const whereCondition: any = { campaignId };
    let filteredInfluencerIds: number[] | undefined = undefined;

    // Apply status filter to campaign applications
    if (status) {
      whereCondition.status = status;
    }

    // Build influencer filter for age, gender, and location
    const influencerFilter: any = {};

    // Gender filter - support multiple genders
    if (genderList.length > 0) {
      if (genderList.length === 1) {
        influencerFilter.gender = genderList[0];
      } else {
        influencerFilter.gender = { [Op.in]: genderList };
      }
    }

    if (cityIds.length > 0) {
      influencerFilter.cityId = { [Op.in]: cityIds };
    }

    // Platform filter - support multiple platforms
    if (platformList.length > 0) {
      const platformConditions: any[] = [];

      platformList.forEach((platformLower) => {
        switch (platformLower) {
          case 'instagram':
            platformConditions.push({
              instagramUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            });
            break;
          case 'youtube':
            platformConditions.push({
              youtubeUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            });
            break;
          case 'facebook':
            platformConditions.push({
              facebookUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            });
            break;
          case 'linkedin':
            platformConditions.push({
              linkedinUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            });
            break;
          case 'x':
          case 'twitter':
            platformConditions.push({
              twitterUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
            });
            break;
        }
      });

      // If only one platform, add directly; if multiple, use Op.or
      if (platformConditions.length === 1) {
        Object.assign(influencerFilter, platformConditions[0]);
      } else if (platformConditions.length > 1) {
        influencerFilter[Op.or] = platformConditions;
      }
    }

    // Age filter
    if (minAge !== undefined || maxAge !== undefined) {
      const currentDate = new Date();
      const ageConditions: any = {};
      if (minAge !== undefined) {
        const maxBirthDate = new Date(
          currentDate.getFullYear() - minAge,
          currentDate.getMonth(),
          currentDate.getDate(),
        );
        ageConditions[Op.lte] = maxBirthDate;
      }
      if (maxAge !== undefined) {
        const minBirthDate = new Date(
          currentDate.getFullYear() - maxAge,
          currentDate.getMonth(),
          currentDate.getDate(),
        );
        ageConditions[Op.gte] = minBirthDate;
      }
      influencerFilter.dateOfBirth = ageConditions;
    }

    // Niche filter
    if (nicheIds.length > 0) {
      // Find influencer IDs with any of the required niches
      const nicheInfluencers = await this.influencerModel.findAll({
        include: [
          {
            model: Niche,
            where: { id: { [Op.in]: nicheIds } },
            attributes: [],
            through: { attributes: [] },
            required: true,
          },
        ],
        attributes: ['id'],
        where: influencerFilter,
      });
      filteredInfluencerIds = nicheInfluencers.map((i) => i.id);
    } else if (Object.keys(influencerFilter).length > 0) {
      // If only age/location/platform/gender filter
      const filteredInfluencers = await this.influencerModel.findAll({
        where: influencerFilter,
        attributes: ['id'],
      });
      filteredInfluencerIds = filteredInfluencers.map((i) => i.id);
    }

    if (filteredInfluencerIds) {
      whereCondition.influencerId = { [Op.in]: filteredInfluencerIds };
    }

    // Determine sort order (followers sorting will be done in-memory)
    let order: any[] = [];
    let sortInMemory = false;
    let sortDirection: 'asc' | 'desc' = 'desc';

    switch (sortBy) {
      case 'application_new_old':
        order = [['createdAt', 'DESC']];
        break;
      case 'application_old_new':
        order = [['createdAt', 'ASC']];
        break;
      case 'followers_high_low':
        sortInMemory = true;
        sortDirection = 'desc';
        order = [['createdAt', 'DESC']]; // Default order for fetching
        break;
      case 'followers_low_high':
        sortInMemory = true;
        sortDirection = 'asc';
        order = [['createdAt', 'DESC']]; // Default order for fetching
        break;
      case 'campaign_charges_lowest':
        order = [[Influencer, 'collaborationCosts', 'ASC']];
        break;
      default:
        order = [['createdAt', 'DESC']];
    }

    const includeOptions: any = [
      {
        model: Influencer,
        // Note: influencerFilter AND niche already applied via filteredInfluencerIds above
        // No need to apply where clause again here
        include: [
          {
            model: City,
            attributes: ['id', 'name', 'state', 'tier'],
          },
          {
            model: Niche,
            // Don't filter here - already filtered above via influencer IDs
            attributes: ['id', 'name', 'logoNormal', 'logoDark'],
            through: { attributes: [] },
            required: false, // Changed from !!niche to false
          },
        ],
      },
    ];

    // When filtering by experience, we need to fetch all applications first
    // because experience count is calculated in-memory
    const useInMemoryPagination = !!experience || sortInMemory;

    const { count, rows: applications } =
      await this.campaignApplicationModel.findAndCountAll({
        where: whereCondition,
        attributes: [
          'id',
          'status',
          'coverLetter',
          'proposalMessage',
          'createdAt',
          'updatedAt',
          'reviewedAt',
          'reviewNotes',
        ],
        include: includeOptions,
        order,
        // Skip pagination if we need to filter/sort in-memory
        limit: useInMemoryPagination ? undefined : limit,
        offset: useInMemoryPagination ? undefined : offset,
        distinct: true,
      });

    // Calculate completedCampaigns and totalFollowers in-memory
    const applicationsWithStats = await Promise.all(
      applications.map(async (app) => {
        const appJson: any = app.toJSON();

        if (appJson.influencer) {
          // Count followers (using Follow model)
          const totalFollowers = await this.followModel.count({
            where: {
              followingType: 'influencer',
              followingInfluencerId: appJson.influencer.id,
            },
          });

          // Count completed experiences (only those with completionDate before today)
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Start of today
          const completedCampaigns = await this.experienceModel.count({
            where: {
              influencerId: appJson.influencer.id,
              successfullyCompleted: true,
              completionDate: {
                [Op.ne]: null,
                [Op.lt]: today, // Only count experiences completed before today
              },
            },
          });

          appJson.influencer.completedCampaigns = completedCampaigns;
          appJson.influencer.totalFollowers = totalFollowers;
        }

        return appJson;
      }),
    );

    // Filter by experience if specified (experience is calculated in-memory)
    let filteredApplications = applicationsWithStats;
    if (experience !== undefined) {
      const experienceValue = parseInt(experience);
      if (!isNaN(experienceValue)) {
        filteredApplications = applicationsWithStats.filter((app) => {
          const completedCount = app.influencer?.completedCampaigns || 0;

          switch (experienceValue) {
            case 0:
              return completedCount === 0;
            case 1:
              return completedCount >= 1;
            case 2:
              return completedCount >= 2;
            case 3:
              return completedCount >= 3;
            case 4:
              return completedCount >= 4;
            case 5:
              return completedCount >= 5;
            default:
              return true;
          }
        });
      }
    }

    // Sort in-memory if needed (for follower-based sorting)
    let finalApplications = filteredApplications;
    if (sortInMemory) {
      finalApplications = filteredApplications.sort((a, b) => {
        const aFollowers = a.influencer?.totalFollowers || 0;
        const bFollowers = b.influencer?.totalFollowers || 0;
        return sortDirection === 'desc'
          ? bFollowers - aFollowers
          : aFollowers - bFollowers;
      });
    }

    // Apply pagination if we did in-memory filtering/sorting
    let paginatedApplications = finalApplications;
    let totalCount = count;

    if (useInMemoryPagination) {
      totalCount = finalApplications.length;
      const startIndex = offset;
      const endIndex = offset + limit;
      paginatedApplications = finalApplications.slice(startIndex, endIndex);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return {
      applications: paginatedApplications,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async getInfluencerApplicationForCampaign(
    campaignId: number,
    influencerId: number,
    brandId: number | null,
  ) {
    // Build where condition for campaign based on user type
    const campaignWhere: any = { id: campaignId };

    // If brandId is provided (brand is viewing), verify campaign belongs to them
    if (brandId !== null) {
      campaignWhere.brandId = brandId;
    }

    // Verify campaign exists (and belongs to brand if applicable)
    const campaign = await this.campaignModel.findOne({
      where: campaignWhere,
    });

    if (!campaign) {
      throw new NotFoundException(
        brandId !== null
          ? 'Campaign not found or access denied'
          : 'Campaign not found',
      );
    }

    // Find the application for this influencer on this campaign
    const application = await this.campaignApplicationModel.findOne({
      where: { campaignId, influencerId },
      attributes: [
        'id',
        'status',
        'coverLetter',
        'proposalMessage',
        'reviewNotes',
        'reviewedAt',
        'createdAt',
        'updatedAt',
      ],
      include: [
        {
          model: Influencer,
          attributes: [
            'id',
            'name',
            'username',
            'profileImage',
            'isVerified',
            'profileHeadline',
            'bio',
            'gender',
            'dateOfBirth',
            'whatsappNumber',
            'collaborationCosts',
          ],
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'state', 'tier'],
            },
            {
              model: Niche,
              attributes: ['id', 'name', 'logoNormal', 'logoDark'],
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!application) {
      throw new NotFoundException(
        'No application found for this influencer on this campaign',
      );
    }

    return application;
  }

  async updateApplicationStatus(
    campaignId: number,
    applicationId: number,
    updateStatusDto: UpdateApplicationStatusDto,
    brandId: number,
  ): Promise<CampaignApplication> {
    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId },
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName'],
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    // Find the application with influencer details
    const application = await this.campaignApplicationModel.findOne({
      where: { id: applicationId, campaignId },
      include: [
        {
          model: Influencer,
          attributes: [
            'id',
            'name',
            'username',
            'profileImage',
            'profileHeadline',
            'bio',
            'gender',
            'collaborationCosts',
            'whatsappNumber',
          ],
        },
      ],
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Validate status transition: if under_review, can only move to selected or rejected
    if (application.status === ApplicationStatus.UNDER_REVIEW) {
      if (
        updateStatusDto.status !== ApplicationStatus.SELECTED &&
        updateStatusDto.status !== ApplicationStatus.REJECTED
      ) {
        throw new BadRequestException(
          'Applications under review can only be moved to selected or rejected status',
        );
      }
    }

    console.log('Application loaded:', {
      applicationId: application.id,
      hasInfluencer: !!application.influencer,
      influencerData: application.influencer
        ? {
            id: application.influencer.id,
            name: application.influencer.name,
            whatsappNumber: application.influencer.whatsappNumber,
          }
        : null,
    });

    // Store influencer data before update (as update may clear associations)
    const influencer = application.influencer;
    const brandName = campaign.brand?.brandName || 'Brand';

    // Update application status
    await application.update({
      status: updateStatusDto.status,
      reviewNotes: updateStatusDto.reviewNotes,
      reviewedAt: new Date(),
    });

    // COMMENTED OUT: Early selection bonus feature temporarily disabled
    // Award early selection bonus if influencer gets selected within 36 hours of verification
    // IMPORTANT: Only award to influencers who joined through referral
    // if (updateStatusDto.status === ApplicationStatus.SELECTED && influencer) {
    //   const fullInfluencer = await this.influencerModel.findByPk(influencer.id);
    //   if (fullInfluencer && fullInfluencer.verifiedAt) {
    //     // Check if influencer joined through referral (regardless of credit status)
    //     const referralUsage = await this.influencerReferralUsageModel.findOne({
    //       where: {
    //         referredUserId: fullInfluencer.id,
    //       },
    //     });

    //     // Only proceed if influencer joined through referral
    //     if (referralUsage) {
    //       const verificationTime = new Date(fullInfluencer.verifiedAt).getTime();
    //       const currentTime = new Date().getTime();
    //       const hoursSinceVerification =
    //         (currentTime - verificationTime) / (1000 * 60 * 60);

    //       // Check if within 36 hours of verification
    //       if (hoursSinceVerification <= 36) {
    //         // Check if bonus already awarded for this campaign
    //         const existingBonus = await this.creditTransactionModel.findOne({
    //           where: {
    //             influencerId: fullInfluencer.id,
    //             campaignId: campaign.id,
    //             transactionType: CreditTransactionType.EARLY_SELECTION_BONUS,
    //           },
    //         });

    //         if (!existingBonus) {
    //           const currentCredits = fullInfluencer.referralCredits || 0;
    //           const newCredits = currentCredits + 100;

    //           // Award Rs 100 credit
    //           await this.influencerModel.update(
    //             { referralCredits: newCredits },
    //             { where: { id: fullInfluencer.id } },
    //           );

    //           // Log credit transaction for admin records
    //           await this.creditTransactionModel.create({
    //             influencerId: fullInfluencer.id,
    //             transactionType: CreditTransactionType.EARLY_SELECTION_BONUS,
    //             amount: 100,
    //             paymentStatus: PaymentStatus.PENDING,
    //             description: `Early selection bonus for campaign "${campaign.name}" (referred influencer selected within 36 hours of verification)`,
    //             campaignId: campaign.id,
    //             upiId: fullInfluencer.upiId || null,
    //           });

    //           // Send notification about the early selection bonus
    //           if (fullInfluencer.whatsappNumber) {
    //             const bonusMessage = `🎉 Congratulations ${fullInfluencer.name}! You've been selected for the campaign "${campaign.name}" within 36 hours of your profile verification. You've earned an early bird bonus of Rs 100! Your total credits are now Rs ${newCredits}. Keep up the great work!`;
    //             await this.whatsAppService.sendReferralCreditNotification(
    //               fullInfluencer.whatsappNumber,
    //               bonusMessage,
    //             );
    //           }

    //           console.log('✅ Early selection bonus awarded:', {
    //             influencerId: fullInfluencer.id,
    //             influencerName: fullInfluencer.name,
    //             campaignId: campaign.id,
    //             campaignName: campaign.name,
    //             hoursSinceVerification: hoursSinceVerification.toFixed(2),
    //             bonusAmount: 100,
    //             newCredits,
    //             referralCode: referralUsage.referralCode,
    //           });
    //         } else {
    //           console.log('⚠️ Early selection bonus already awarded for this campaign:', {
    //             influencerId: fullInfluencer.id,
    //             campaignId: campaign.id,
    //           });
    //         }
    //       } else {
    //         console.log('⏰ Influencer not eligible for early selection bonus - beyond 36 hours:', {
    //           influencerId: fullInfluencer.id,
    //           hoursSinceVerification: hoursSinceVerification.toFixed(2),
    //         });
    //       }
    //     } else {
    //       console.log('ℹ️ Influencer not eligible for early selection bonus - did not join through referral:', {
    //         influencerId: fullInfluencer.id,
    //       });
    //     }
    //   }
    // }

    // COMMENTED OUT: Duplicate early selection bonus code (same as above)
    // Award early selection bonus if influencer gets selected within 36 hours of verification
    // IMPORTANT: Only award to influencers who joined through referral
    // if (updateStatusDto.status === ApplicationStatus.SELECTED && influencer) {
    //   const fullInfluencer = await this.influencerModel.findByPk(influencer.id);
    //   if (fullInfluencer && fullInfluencer.verifiedAt) {
    //     // Check if influencer joined through referral (regardless of credit status)
    //     const referralUsage = await this.influencerReferralUsageModel.findOne({
    //       where: {
    //         referredUserId: fullInfluencer.id,
    //       },
    //     });

    //     // Only proceed if influencer joined through referral
    //     if (referralUsage) {
    //       const verificationTime = new Date(fullInfluencer.verifiedAt).getTime();
    //       const currentTime = new Date().getTime();
    //       const hoursSinceVerification =
    //         (currentTime - verificationTime) / (1000 * 60 * 60);

    //       // Check if within 36 hours of verification
    //       if (hoursSinceVerification <= 36) {
    //         // Check if bonus already awarded for this campaign
    //         const existingBonus = await this.creditTransactionModel.findOne({
    //           where: {
    //             influencerId: fullInfluencer.id,
    //             campaignId: campaign.id,
    //             transactionType: CreditTransactionType.EARLY_SELECTION_BONUS,
    //           },
    //         });

    //         if (!existingBonus) {
    //           const currentCredits = fullInfluencer.referralCredits || 0;
    //           const newCredits = currentCredits + 100;

    //           // Award Rs 100 credit
    //           await this.influencerModel.update(
    //             { referralCredits: newCredits },
    //             { where: { id: fullInfluencer.id } },
    //           );

    //           // Log credit transaction for admin records
    //           await this.creditTransactionModel.create({
    //             influencerId: fullInfluencer.id,
    //             transactionType: CreditTransactionType.EARLY_SELECTION_BONUS,
    //             amount: 100,
    //             paymentStatus: PaymentStatus.PENDING,
    //             description: `Early selection bonus for campaign "${campaign.name}" (referred influencer selected within 36 hours of verification)`,
    //             campaignId: campaign.id,
    //             upiId: fullInfluencer.upiId || null,
    //           });

    //           // Send notification about the early selection bonus
    //           if (fullInfluencer.whatsappNumber) {
    //             const bonusMessage = `🎉 Congratulations ${fullInfluencer.name}! You've been selected for the campaign "${campaign.name}" within 36 hours of your profile verification. You've earned an early bird bonus of Rs 100! Your total credits are now Rs ${newCredits}. Keep up the great work!`;
    //             await this.whatsAppService.sendReferralCreditNotification(
    //               fullInfluencer.whatsappNumber,
    //               bonusMessage,
    //             );
    //           }

    //           console.log('✅ Early selection bonus awarded:', {
    //             influencerId: fullInfluencer.id,
    //             influencerName: fullInfluencer.name,
    //             campaignId: campaign.id,
    //             campaignName: campaign.name,
    //             hoursSinceVerification: hoursSinceVerification.toFixed(2),
    //             bonusAmount: 100,
    //             newCredits,
    //             referralCode: referralUsage.referralCode,
    //           });
    //         } else {
    //           console.log('⚠️ Early selection bonus already awarded for this campaign:', {
    //             influencerId: fullInfluencer.id,
    //             campaignId: campaign.id,
    //           });
    //         }
    //       } else {
    //         console.log('⏰ Influencer not eligible for early selection bonus - beyond 36 hours:', {
    //           influencerId: fullInfluencer.id,
    //           hoursSinceVerification: hoursSinceVerification.toFixed(2),
    //         });
    //       }
    //     } else {
    //       console.log('ℹ️ Influencer not eligible for early selection bonus - did not join through referral:', {
    //         influencerId: fullInfluencer.id,
    //       });
    //     }
    //   }
    // }

    // WhatsApp notification only for SELECTED status
    if (
      influencer &&
      influencer.whatsappNumber &&
      updateStatusDto.status === ApplicationStatus.SELECTED
    ) {
      this.whatsAppService
        .sendCampaignApplicationSelected(
          influencer.whatsappNumber,
          influencer.name,
          campaign.name,
          brandName,
          updateStatusDto.reviewNotes,
        )
        .catch((error) => {
          console.error('Failed to send WhatsApp notification:', error);
        });
    }

    // Persistent push notification for SELECTED status
    if (
      influencer &&
      influencer.id &&
      updateStatusDto.status === ApplicationStatus.SELECTED
    ) {
      // Get all device tokens and send persistent notification
      this.deviceTokenService
        .getAllUserTokens(influencer.id, UserType.INFLUENCER)
        .then((deviceTokens: string[]) => {
          if (deviceTokens.length > 0) {
            return this.notificationService.sendCampaignSelectionNotification(
              deviceTokens,
              campaign.name,
              brandName,
              campaign.id,
              updateStatusDto.reviewNotes,
            );
          }
        })
        .catch((error: any) => {
          console.error('Failed to send persistent push notification to influencer:', error);
        });
    }

    // Push notifications for UNDER_REVIEW and REJECTED statuses
    if (
      influencer &&
      influencer.id &&
      (updateStatusDto.status === ApplicationStatus.UNDER_REVIEW ||
        updateStatusDto.status === ApplicationStatus.REJECTED)
    ) {
      let pushStatus: string;
      if (updateStatusDto.status === ApplicationStatus.UNDER_REVIEW) {
        pushStatus = 'pending';
      } else {
        pushStatus = 'rejected';
      }

      // Get all device tokens and send to all devices
      this.deviceTokenService
        .getAllUserTokens(influencer.id, UserType.INFLUENCER)
        .then((deviceTokens: string[]) => {
          if (deviceTokens.length > 0) {
            return this.notificationService.sendCampaignStatusUpdate(
              deviceTokens,
              campaign.name,
              pushStatus,
              brandName,
            );
          }
        })
        .catch((error: any) => {
          console.error('Failed to send push notification to influencer:', error);
        });
    }

    // Return updated application with influencer details
    const updatedApplication = await this.campaignApplicationModel.findOne({
      where: { id: applicationId },
      include: [
        {
          model: Influencer,
          attributes: [
            'id',
            'name',
            'username',
            'profileImage',
            'profileHeadline',
            'bio',
            'gender',
            'collaborationCosts',
          ],
          include: [
            {
              model: City,
              attributes: ['id', 'name', 'state', 'tier'],
            },
            {
              model: Niche,
              attributes: ['id', 'name', 'logoNormal', 'logoDark'],
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!updatedApplication) {
      throw new NotFoundException('Application not found after update');
    }

    return updatedApplication;
  }

  async rejectAllAppliedApplications(
    campaignId: number,
    brandId: number,
  ): Promise<{
    success: boolean;
    rejectedCount: number;
    message: string;
  }> {
    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId },
      include: [
        {
          model: Brand,
          attributes: ['id', 'brandName'],
        },
      ],
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    // Find all applications with status 'applied'
    const appliedApplications = await this.campaignApplicationModel.findAll({
      where: {
        campaignId,
        status: ApplicationStatus.APPLIED,
      },
      include: [
        {
          model: Influencer,
          attributes: ['id', 'name', 'whatsappNumber'],
        },
      ],
    });

    if (appliedApplications.length === 0) {
      return {
        success: true,
        rejectedCount: 0,
        message: 'No applications in "applied" status found for this campaign',
      };
    }

    const rejectionNote = 'This campaign has been closed. Thank you for your interest.';

    // Update all applications to rejected status
    await this.campaignApplicationModel.update(
      {
        status: ApplicationStatus.REJECTED,
        reviewNotes: rejectionNote,
        reviewedAt: new Date(),
      },
      {
        where: {
          campaignId,
          status: ApplicationStatus.APPLIED,
        },
      },
    );

    return {
      success: true,
      rejectedCount: appliedApplications.length,
      message: `Successfully rejected ${appliedApplications.length} application(s) that were in "applied" status`,
    };
  }

  /**
   * Handle Razorpay webhook for campaign payments
   */
  async handleCampaignPaymentWebhook(event: string, payload: any) {
    try {
      const paymentEntity = payload.payment?.entity;
      if (!paymentEntity) {
        return { success: false, message: 'Invalid webhook payload' };
      }

      // Find campaign by payment ID or order ID
      const campaign = await this.campaignModel.findOne({
        where: {
          [Op.or]: [
            { maxCampaignPaymentId: paymentEntity.id },
            { maxCampaignOrderId: paymentEntity.order_id },
            { inviteOnlyPaymentId: paymentEntity.id },
            { inviteOnlyOrderId: paymentEntity.order_id },
          ],
        },
      });

      if (!campaign) {
        return { success: false, message: 'Campaign not found for this payment' };
      }

      // Determine which payment type this is
      const isMaxCampaign = campaign.maxCampaignPaymentId === paymentEntity.id ||
                            campaign.maxCampaignOrderId === paymentEntity.order_id;
      const statusField = isMaxCampaign ? 'maxCampaignPaymentStatus' : 'inviteOnlyPaymentStatus';

      // Handle different payment events
      switch (event) {
        case 'payment.captured':
        case 'order.paid':
          // Payment successful - set status to ACTIVE
          await campaign.update({
            [statusField]: InvoiceStatus.PAID,
            status: 'active' as any,
            paymentStatusUpdatedAt: new Date(),
            razorpayLastWebhookAt: new Date(),
          });
          console.log(`✅ Campaign ${campaign.id} activated after payment captured`);
          break;

        case 'payment.failed':
          // Payment failed - keep as DRAFT
          await campaign.update({
            [statusField]: InvoiceStatus.FAILED,
            paymentStatusUpdatedAt: new Date(),
            razorpayLastWebhookAt: new Date(),
          });
          console.log(`❌ Campaign ${campaign.id} payment failed`);
          break;

        default:
          console.log(`ℹ️ Unhandled payment event: ${event}`);
      }

      return { success: true, message: `Campaign payment webhook handled: ${event}` };
    } catch (error) {
      console.error('Error handling campaign payment webhook:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get available deliverable formats based on campaign type
   */
  async getDeliverableFormats(
    campaignType?: string,
  ): Promise<{
    campaignType: string;
    deliverableFormats: Array<{ value: string; label: string; platform: string }>;
  }> {
    const type = campaignType || 'paid'; // Default to 'paid'

    let deliverableFormats: Array<{ value: string; label: string; platform: string }>;

    if (type === 'engagement') {
      // Engagement campaign deliverables
      deliverableFormats = [
        {
          value: 'like_comment',
          label: 'Like/Comment',
          platform: 'engagement',
        },
        {
          value: 'playstore_review',
          label: 'Playstore Review',
          platform: 'engagement',
        },
        {
          value: 'appstore_review',
          label: 'App Store Review',
          platform: 'engagement',
        },
        {
          value: 'google_review',
          label: 'Google Review',
          platform: 'engagement',
        },
        {
          value: 'app_download',
          label: 'App Download',
          platform: 'engagement',
        },
      ];
    } else {
      // Social media deliverables for UGC, PAID, BARTER
      deliverableFormats = [
        {
          value: 'instagram_reel',
          label: 'Insta Reel / Post',
          platform: 'instagram',
        },
        {
          value: 'instagram_story',
          label: 'Insta Story',
          platform: 'instagram',
        },
        {
          value: 'youtube_short',
          label: 'YT Shorts',
          platform: 'youtube',
        },
        {
          value: 'youtube_long_video',
          label: 'YT Video',
          platform: 'youtube',
        },
        {
          value: 'facebook_story',
          label: 'FB Story',
          platform: 'facebook',
        },
        {
          value: 'facebook_post',
          label: 'FB Post',
          platform: 'facebook',
        },
        {
          value: 'twitter_post',
          label: 'X Post',
          platform: 'twitter',
        },
        {
          value: 'linkedin_post',
          label: 'LinkedIn Post',
          platform: 'linkedin',
        },
      ];
    }

    return {
      campaignType: type,
      deliverableFormats,
    };
  }
}
