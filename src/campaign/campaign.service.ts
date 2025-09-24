import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Campaign, CampaignStatus } from './models/campaign.model';
import { CampaignCity } from './models/campaign-city.model';
import { CampaignDeliverable } from './models/campaign-deliverable.model';
import { CampaignInvitation } from './models/campaign-invitation.model';
import { City } from '../shared/models/city.model';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { SearchInfluencersDto } from './dto/search-influencers.dto';
import { InviteInfluencersDto } from './dto/invite-influencers.dto';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { InvitationStatus } from './models/campaign-invitation.model';
import { WhatsAppService } from '../shared/whatsapp.service';

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
    @InjectModel(City)
    private readonly cityModel: typeof City,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async createCampaign(
    createCampaignDto: CreateCampaignDto,
    brandId: number,
  ): Promise<Campaign> {
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

  async getCampaignById(campaignId: number): Promise<Campaign> {
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

    return campaign;
  }

  async updateCampaignStatus(
    campaignId: number,
    status: CampaignStatus,
    brandId: number,
  ): Promise<Campaign> {
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await campaign.update({ status });
    return this.getCampaignById(campaignId);
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
    let whereCondition: any = {
      tier: {
        [Op.in]: [1, 2, 3], // Default: all tiers
      },
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

      // If user is from India (countryId = 1), show only Indian tier 1 cities
      if (isFromIndia) {
        whereCondition = {
          countryId: 1, // India
          name: {
            [Op.in]: [
              'Mumbai',
              'Delhi',
              'Bangalore',
              'Chennai',
              'Kolkata',
              'Hyderabad',
              'Pune',
              'Ahmedabad',
              'Jaipur',
              'Surat',
              'Lucknow',
              'Kanpur',
              'Nagpur',
              'Indore',
              'Thane',
              'Bhopal',
              'Visakhapatnam',
              'Pimpri-Chinchwad',
              'Patna',
              'Vadodara',
            ],
          },
        };
      }
    }

    return this.cityModel.findAll({
      where: whereCondition,
      order: [['name', 'ASC']],
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

  async getBrandCampaigns(brandId: number): Promise<Campaign[]> {
    return this.campaignModel.findAll({
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
      ],
      order: [['createdAt', 'DESC']],
    });
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
        attributes: ['id', 'name'],
        through: { attributes: [] },
        where: { id: { [Op.in]: nicheIds } },
        required: true,
      });
    } else {
      includeOptions.push({
        model: Niche,
        attributes: ['id', 'name'],
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
          'cityId',
          'collaborationCosts',
          'instagramUrl',
          'youtubeUrl',
          'facebookUrl',
          'linkedinUrl',
          'twitterUrl',
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
    failedInvitations: any[];
    message: string;
  }> {
    const { campaignId, influencerIds, personalMessage } = inviteDto;

    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId, isActive: true },
      include: [{ model: Brand, attributes: ['brandName'] }],
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
    const newInfluencerIds = influencerIds.filter(
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

    const createdInvitations = await this.campaignInvitationModel.bulkCreate(
      invitationsToCreate as any,
    );

    // Send WhatsApp notifications
    const failedNotifications: any[] = [];
    let successfulNotifications = 0;

    for (const influencer of influencers.filter((inf) =>
      newInfluencerIds.includes(inf.id),
    )) {
      try {
        await this.whatsAppService.sendCampaignInvitation(
          influencer.whatsappNumber,
          influencer.name,
          campaign.name,
          campaign.brand?.brandName || 'Brand',
          personalMessage,
        );
        successfulNotifications++;
      } catch (error) {
        failedNotifications.push({
          influencerId: influencer.id,
          influencerName: influencer.name,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      invitationsSent: newInfluencerIds.length,
      failedInvitations: failedNotifications,
      message: `Successfully sent ${newInfluencerIds.length} campaign invitations. ${successfulNotifications} WhatsApp notifications sent successfully.`,
    };
  }
}
