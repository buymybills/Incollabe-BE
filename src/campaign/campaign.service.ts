import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, literal } from 'sequelize';
import { Campaign, CampaignStatus } from './models/campaign.model';
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
import { InvitationStatus } from './models/campaign-invitation.model';
import { WhatsAppService } from '../shared/whatsapp.service';
import { NotificationService } from '../shared/notification.service';
import { Follow } from '../post/models/follow.model';
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
    private readonly whatsAppService: WhatsAppService,
    private readonly notificationService: NotificationService,
    private readonly campaignQueryService: CampaignQueryService,
  ) {}

  async createCampaign(
    createCampaignDto: CreateCampaignDto,
    brandId: number,
  ): Promise<CampaignResponseDto> {
    const { deliverables, cityIds, ...campaignData } = createCampaignDto;

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

    // Add deliverables
    const campaignDeliverables = deliverables.map((deliverable) => ({
      ...deliverable,
      campaignId: campaign.id,
    }));
    await this.campaignDeliverableModel.bulkCreate(campaignDeliverables as any);

    return this.getCampaignById(campaign.id);
  }

  async getCampaigns(
    getCampaignsDto: GetCampaignsDto,
    brandId?: number,
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

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
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

    return {
      campaigns,
      total: count,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get campaigns by category with proper type safety and separation of concerns
   * @param brandId - The brand ID to fetch campaigns for
   * @param type - Optional campaign type filter (open, invite, finished)
   * @returns Campaigns with appropriate statistics
   */
  async getCampaignsByCategory(
    brandId: number,
    type?: string,
  ): Promise<CampaignsByCategoryResponse> {
    const campaigns = await this.campaignQueryService.getCampaignsByCategory(
      brandId,
      type,
    );

    return { campaigns };
  }

  async getCampaignById(campaignId: number): Promise<CampaignResponseDto> {
    const campaign = await this.campaignModel.findOne({
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

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Transform the response to clean up city structure
    const campaignData = campaign.toJSON();

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

    await campaign.update({ isActive: false });

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
                attributes: ['id', 'name', 'fcmToken'],
              },
            ],
          });

        // Send push notifications to all selected influencers
        const brandName = campaign.brand?.brandName || 'Brand';
        for (const application of selectedApplications) {
          if (application.influencer?.fcmToken) {
            try {
              await this.notificationService.sendCampaignStatusUpdate(
                application.influencer.fcmToken,
                campaign.name,
                'completed',
                brandName,
              );
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

    // Add application count to each campaign
    const campaignsWithStats = campaigns.map((campaign) => {
      const campaignData: Campaign & { totalApplications: number } =
        campaign.toJSON();
      campaignData.totalApplications = campaign.applications?.length ?? 0;
      return campaignData;
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
      attributes: ['id', 'name', 'whatsappNumber', 'fcmToken'],
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
      // Send WhatsApp notification
      try {
        await this.whatsAppService.sendCampaignInvitation(
          influencer.whatsappNumber,
          influencer.name,
          campaign.name,
          brandName,
          personalMessage,
        );
      } catch (error) {
        console.error(
          `Failed to send WhatsApp notification to influencer ${influencer.id}:`,
          error,
        );
        // Continue with other influencers even if one fails
      }

      // Send push notification
      if (influencer.fcmToken) {
        try {
          await this.notificationService.sendCampaignInviteNotification(
            [influencer.fcmToken],
            campaign.name,
            brandName,
          );
        } catch (error) {
          console.error(
            `Failed to send push notification to influencer ${influencer.id}:`,
            error,
          );
          // Continue with other influencers even if one fails
        }
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
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    const {
      status,
      gender,
      niche,
      location,
      ageMin,
      ageMax,
      platform,
      experience,
      sortBy = 'application_new_old',
      page = 1,
      limit = 10,
    } = getApplicationsDto;
    const offset = (page - 1) * limit;

    const whereCondition: any = { campaignId };
    const influencerWhere: any = {};

    if (status) {
      whereCondition.status = status;
    }

    // Filter by gender
    if (gender) {
      influencerWhere.gender = gender;
    }

    // Collect literal conditions for Op.and array
    const literalConditions: any[] = [];

    // Filter by age using dateOfBirth
    if (ageMin !== undefined || ageMax !== undefined) {
      const currentYear = new Date().getFullYear();

      if (ageMin !== undefined && ageMax !== undefined) {
        // Calculate date range for birth years
        const maxBirthYear = currentYear - ageMin;
        const minBirthYear = currentYear - ageMax;
        literalConditions.push(
          literal(
            `EXTRACT(YEAR FROM "dateOfBirth") BETWEEN ${minBirthYear} AND ${maxBirthYear}`,
          ),
        );
      } else if (ageMin !== undefined) {
        // Only minimum age specified
        const maxBirthYear = currentYear - ageMin;
        literalConditions.push(
          literal(`EXTRACT(YEAR FROM "dateOfBirth") <= ${maxBirthYear}`),
        );
      } else if (ageMax !== undefined) {
        // Only maximum age specified
        const minBirthYear = currentYear - ageMax;
        literalConditions.push(
          literal(`EXTRACT(YEAR FROM "dateOfBirth") >= ${minBirthYear}`),
        );
      }
    }

    // Filter by location (city)
    if (location) {
      influencerWhere.cityId = location;
    }

    // Filter by platform
    if (platform) {
      const platformLower = platform.toLowerCase();
      if (platformLower === 'instagram') {
        influencerWhere.instagramUrl = { [Op.ne]: null };
      } else if (platformLower === 'youtube') {
        influencerWhere.youtubeUrl = { [Op.ne]: null };
      } else if (platformLower === 'facebook') {
        influencerWhere.facebookUrl = { [Op.ne]: null };
      } else if (platformLower === 'linkedin') {
        influencerWhere.linkedinUrl = { [Op.ne]: null };
      } else if (platformLower === 'x' || platformLower === 'twitter') {
        influencerWhere.twitterUrl = { [Op.ne]: null };
      }
    }

    // Filter by experience (campaign count: 0, 1+, 2+, 3+, 4+, 5+ Campaigns)
    // Using subquery to count completed campaigns (selected status)
    if (experience) {
      const experienceValue = parseInt(experience);
      if (!isNaN(experienceValue)) {
        const subquery = `(SELECT COUNT(*) FROM campaign_applications WHERE campaign_applications."influencerId" = "id" AND campaign_applications.status = 'selected')`;

        switch (experienceValue) {
          case 0:
            literalConditions.push(literal(`${subquery} = 0`));
            break;
          case 1:
            literalConditions.push(literal(`${subquery} >= 1`));
            break;
          case 2:
            literalConditions.push(literal(`${subquery} >= 2`));
            break;
          case 3:
            literalConditions.push(literal(`${subquery} >= 3`));
            break;
          case 4:
            literalConditions.push(literal(`${subquery} >= 4`));
            break;
          case 5:
            literalConditions.push(literal(`${subquery} >= 5`));
            break;
        }
      }
    }

    // Apply all literal conditions using Op.and array
    if (literalConditions.length > 0) {
      influencerWhere[Op.and] = literalConditions;
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
        where:
          Object.keys(influencerWhere).length > 0 ? influencerWhere : undefined,
        include: [
          {
            model: City,
            attributes: ['id', 'name', 'state', 'tier'],
          },
          {
            model: Niche,
            where: niche ? { id: niche } : undefined,
            attributes: ['id', 'name', 'logoNormal', 'logoDark'],
            through: { attributes: [] },
            required: !!niche,
          },
        ],
      },
    ];

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
        limit,
        offset,
        distinct: true,
      });

    // Calculate completedCampaigns and totalFollowers in-memory
    const applicationsWithStats = await Promise.all(
      applications.map(async (app) => {
        const appJson: any = app.toJSON();

        if (appJson.influencer) {
          // Count completed campaigns
          const completedCampaigns = await this.campaignApplicationModel.count({
            where: {
              influencerId: appJson.influencer.id,
              status: ApplicationStatus.SELECTED,
            },
          });

          // Count followers (using Follow model)
          const totalFollowers = await this.followModel.count({
            where: {
              followingType: 'influencer',
              followingInfluencerId: appJson.influencer.id,
            },
          });

          appJson.influencer.completedCampaigns = completedCampaigns;
          appJson.influencer.totalFollowers = totalFollowers;
        }

        return appJson;
      }),
    );

    // Sort in-memory if needed (for follower-based sorting)
    let finalApplications = applicationsWithStats;
    if (sortInMemory) {
      finalApplications = applicationsWithStats.sort((a, b) => {
        const aFollowers = a.influencer?.totalFollowers || 0;
        const bFollowers = b.influencer?.totalFollowers || 0;
        return sortDirection === 'desc'
          ? bFollowers - aFollowers
          : aFollowers - bFollowers;
      });
    }

    const totalPages = Math.ceil(count / limit);

    return {
      applications: finalApplications,
      total: count,
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
    const campaignWhere: any = { id: campaignId, isActive: true };
    
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
            'verificationStatus',
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
      where: { id: campaignId, brandId, isActive: true },
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

    console.log('Attempting to send WhatsApp notification:', {
      hasInfluencer: !!influencer,
      hasWhatsappNumber: !!influencer?.whatsappNumber,
      status: updateStatusDto.status,
      influencerName: influencer?.name,
      campaignName: campaign.name,
      brandName,
    });

    // Send WhatsApp notifications
    if (influencer && influencer.whatsappNumber) {
      switch (updateStatusDto.status) {
        case ApplicationStatus.UNDER_REVIEW:
          console.log('Sending UNDER_REVIEW notification...');
          await this.whatsAppService.sendCampaignApplicationUnderReview(
            influencer.whatsappNumber,
            influencer.name,
            campaign.name,
            brandName,
          );
          break;

        case ApplicationStatus.SELECTED:
          console.log('Sending SELECTED notification...');
          await this.whatsAppService.sendCampaignApplicationSelected(
            influencer.whatsappNumber,
            influencer.name,
            campaign.name,
            brandName,
            updateStatusDto.reviewNotes,
          );
          break;

        case ApplicationStatus.REJECTED:
          console.log('Sending REJECTED notification...');
          await this.whatsAppService.sendCampaignApplicationRejected(
            influencer.whatsappNumber,
            influencer.name,
            campaign.name,
            brandName,
            updateStatusDto.reviewNotes,
          );
          break;
      }
      console.log('WhatsApp notification sent successfully');
    } else {
      console.log(
        'Skipping WhatsApp notification - missing influencer or phone number',
      );
    }

    // Send push notifications to influencer
    if (influencer && influencer.fcmToken) {
      try {
        let pushStatus: string;
        switch (updateStatusDto.status) {
          case ApplicationStatus.UNDER_REVIEW:
            pushStatus = 'pending';
            break;
          case ApplicationStatus.SELECTED:
            pushStatus = 'approved';
            break;
          case ApplicationStatus.REJECTED:
            pushStatus = 'rejected';
            break;
          default:
            pushStatus = updateStatusDto.status;
        }

        await this.notificationService.sendCampaignStatusUpdate(
          influencer.fcmToken,
          campaign.name,
          pushStatus,
          brandName,
        );
        console.log('Push notification sent successfully to influencer');
      } catch (error) {
        console.error('Failed to send push notification to influencer:', error);
        // Don't fail the status update if notification fails
      }
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
}
