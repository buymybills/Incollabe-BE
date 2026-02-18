import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { MaxCampaignInvoice } from './models/max-campaign-invoice.model';
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
import { AIScoringService } from '../shared/services/ai-scoring.service';
import { Post } from '../post/models/post.model';
import { InstagramProfileAnalysis } from '../shared/models/instagram-profile-analysis.model';
import { InstagramMediaInsight } from '../shared/models/instagram-media-insight.model';
import { InfluencerProfileScore } from '../shared/models/influencer-profile-score.model';
import { MaxCampaignScoringQueueService } from './services/max-campaign-scoring-queue.service';

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
    @InjectModel(MaxCampaignInvoice)
    private readonly maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
    @InjectModel(Post)
    private readonly postModel: typeof Post,
    @InjectModel(InstagramProfileAnalysis)
    private readonly instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    @InjectModel(InstagramMediaInsight)
    private readonly instagramMediaInsightModel: typeof InstagramMediaInsight,
    @InjectModel(InfluencerProfileScore)
    private readonly influencerProfileScoreModel: typeof InfluencerProfileScore,
    // REMOVED: Models only needed for early selection bonus feature (now disabled)
    // @InjectModel(CreditTransaction)
    // private readonly creditTransactionModel: typeof CreditTransaction,
    // @InjectModel(InfluencerReferralUsage)
    // private readonly influencerReferralUsageModel: typeof InfluencerReferralUsage,
    private readonly whatsAppService: WhatsAppService,
    private readonly notificationService: NotificationService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly campaignQueryService: CampaignQueryService,
    private readonly aiScoringService: AIScoringService,
    private readonly maxCampaignScoringQueueService: MaxCampaignScoringQueueService,
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

    // Exclude draft campaigns by default (unless explicitly filtered by status)
    if (!status) {
      whereCondition.status = { [Op.ne]: CampaignStatus.DRAFT };
    }

    if (brandId) {
      whereCondition.brandId = brandId;
    }

    // For influencers: exclude invite-only campaigns they haven't been invited to
    let inviteOnlyFilter: any = null;
    let earlyAccessFilter: any = null;

    if (influencerId && !brandId) {
      // Check if influencer is Pro
      const influencer = await this.influencerModel.findByPk(influencerId, {
        attributes: ['isPro'],
      });

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

      // 24-hour early access filter for ORGANIC campaigns only
      // MAX campaigns are always visible, but ORGANIC campaigns are hidden from non-Pro for first 24 hours
      // ORGANIC = NOT MAX + NOT invite-only (consistent with promotionType logic)
      if (!influencer?.isPro) {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        console.log('⏰ Early Access Filter - Non-Pro User:', {
          currentTime: new Date().toISOString(),
          twentyFourHoursAgo: twentyFourHoursAgo.toISOString(),
          influencerId,
        });

        // Show only:
        // 1. MAX campaigns (regardless of age)
        // 2. Invite-only campaigns (handled by inviteOnlyFilter above, shown if invited)
        // 3. ORGANIC campaigns (NOT MAX AND NOT invite-only) older than 24 hours
        earlyAccessFilter = {
          [Op.or]: [
            { isMaxCampaign: true }, // Always show MAX campaigns
            { isInviteOnly: true }, // Always show invite-only campaigns (inviteOnlyFilter handles access)
            {
              // Show organic campaigns older than 24 hours
              // ORGANIC = NOT MAX AND NOT invite-only
              [Op.and]: [
                { isMaxCampaign: { [Op.ne]: true } }, // Not MAX
                { isInviteOnly: { [Op.ne]: true } }, // Not invite-only
                { createdAt: { [Op.lte]: twentyFourHoursAgo } }, // Older than 24 hours
              ],
            },
          ],
        };

        console.log('✅ Early Access Filter Created:', JSON.stringify(earlyAccessFilter, null, 2));
      }
    }

    if (status) {
      whereCondition.status = status;
    }

    if (type) {
      whereCondition.type = type;
    }

    // Build combined filters array
    const filtersToApply: any[] = [];

    if (inviteOnlyFilter) {
      filtersToApply.push(inviteOnlyFilter);
    }

    if (earlyAccessFilter) {
      filtersToApply.push(earlyAccessFilter);
    }

    if (search && search.trim()) {
      const searchCondition = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search.trim()}%` } },
          { description: { [Op.iLike]: `%${search.trim()}%` } },
        ]
      };
      filtersToApply.push(searchCondition);
    }

    // Apply all filters using AND logic
    if (filtersToApply.length > 0) {
      if (filtersToApply.length === 1) {
        Object.assign(whereCondition, filtersToApply[0]);
      } else {
        whereCondition[Op.and] = filtersToApply;
      }
    }

    // Debug logging for campaign filtering
    if (influencerId && !brandId) {
      const influencer = await this.influencerModel.findByPk(influencerId, {
        attributes: ['isPro'],
      });
      console.log('🔍 Campaign Filter Debug:', {
        influencerId,
        isPro: influencer?.isPro,
        hasInviteOnlyFilter: !!inviteOnlyFilter,
        hasEarlyAccessFilter: !!earlyAccessFilter,
        filtersCount: filtersToApply.length,
      });
      console.log('📋 Final WHERE Condition:', JSON.stringify(whereCondition, null, 2));
    }

    // Fetch all campaigns without pagination first (to apply search priority sorting)
    const { rows: allCampaigns } = await this.campaignModel.findAndCountAll(
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
        distinct: true,
      },
    );

    // Calculate search priority for each campaign
    const calculateCampaignSearchPriority = (
      name: string,
      description: string,
      searchTerm: string,
    ): number => {
      if (!searchTerm || !searchTerm.trim()) return 0;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const lowerName = (name || '').toLowerCase();
      const lowerDescription = (description || '').toLowerCase();

      // Check position in name
      const nameIndex = lowerName.indexOf(lowerSearchTerm);
      // Check position in description
      const descriptionIndex = lowerDescription.indexOf(lowerSearchTerm);

      // Priority tiers:
      // 1000-1999: Match in name (1000 = starts with, 1001 = position 1, etc.)
      // 2000-2999: Match in description (2000 = starts with, 2001 = position 1, etc.)
      // 9999: No match (shouldn't happen due to filtering)

      if (nameIndex >= 0) {
        // Match found in name - highest priority tier
        return 1000 + nameIndex;
      } else if (descriptionIndex >= 0) {
        // Match found in description - lower priority tier
        return 2000 + descriptionIndex;
      }

      return 9999; // No match found
    };

    // Transform campaigns and add search priority
    const campaignsWithPriority = allCampaigns.map((campaign) => {
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

      const transformedCampaign = this.transformCampaignResponse(campaignData);

      return {
        ...transformedCampaign,
        searchPriority: calculateCampaignSearchPriority(
          campaign.name || '',
          campaign.description || '',
          search?.trim() || '',
        ),
      };
    });

    // Sort by search priority when search query is present
    if (search && search.trim()) {
      campaignsWithPriority.sort((a, b) => a.searchPriority - b.searchPriority);
    }

    // Apply pagination after sorting
    const total = campaignsWithPriority.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedCampaigns = campaignsWithPriority
      .slice(offset, offset + limit)
      .map(({ searchPriority, ...campaign }) => campaign); // Remove searchPriority from response

    return {
      campaigns: paginatedCampaigns,
      total,
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
    campaignMode?: string,
    searchQuery?: string,
  ): Promise<CampaignsByCategoryResponse> {
    const campaigns = await this.campaignQueryService.getCampaignsByCategory(
      brandId,
      type,
      campaignType,
      campaignMode,
      searchQuery,
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

    // Check if campaign is being marked as organic
    // If so, cancel any pending Max Campaign payment and set status to active
    if (updateCampaignDto.isOrganic === true && !campaign.isOrganic) {
      console.log(`🌿 Campaign ${campaignId} marked as organic - checking for pending Max Campaign payment to cancel`);

      // Cancel pending Max Campaign payment if exists
      if (campaign.maxCampaignPaymentStatus === 'pending') {
        console.log(`  ❌ Cancelling pending Max Campaign payment (orderId: ${campaign.maxCampaignOrderId})`);

        // Delete pending Max Campaign invoice
        await this.maxCampaignInvoiceModel.destroy({
          where: {
            campaignId,
            paymentStatus: 'pending',
          },
        });

        // Clear Max Campaign payment fields using campaign.update() instead of campaignData
        await campaign.update({
          maxCampaignPaymentStatus: null,
          maxCampaignOrderId: null,
          maxCampaignPaymentId: null,
          maxCampaignAmount: null,
        } as any);
      }

      // Ensure campaign status is active (not draft)
      if (campaign.status === 'draft') {
        console.log(`  ✅ Setting campaign status to active`);
        await campaign.update({ status: CampaignStatus.ACTIVE });
      }

      console.log(`✅ Campaign ${campaignId} is now organic and active`);
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
    _userId?: number,
    _userType?: 'brand' | 'influencer',
  ): Promise<City[]> {
    return this.cityModel.findAll({
      where: { countryId: 1, tier: 1 },
      order: [
        ['tier', 'ASC'],
        ['name', 'ASC'],
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
        where: {
          brandId,
          isActive: true,
          status: CampaignStatus.ACTIVE, // Only return active campaigns, exclude drafts
        },
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

    const whereCondition: any = {
      isProfileCompleted: true,
    };

    // Search by name or username
    if (search && search.trim()) {
      whereCondition[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { username: { [Op.iLike]: `%${search.trim()}%` } },
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

    // Fetch all matching influencers without pagination first
    const { rows: allInfluencers } =
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
        distinct: true,
      });

    // Calculate search priority for each influencer
    const calculateSearchPriority = (
      name: string,
      username: string,
      searchTerm: string,
    ): number => {
      if (!searchTerm || !searchTerm.trim()) return 0;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const lowerName = (name || '').toLowerCase();
      const lowerUsername = (username || '').toLowerCase();

      // Check position in name
      const nameIndex = lowerName.indexOf(lowerSearchTerm);
      // Check position in username
      const usernameIndex = lowerUsername.indexOf(lowerSearchTerm);

      // Priority tiers:
      // 1000-1999: Match in name (1000 = starts with, 1001 = position 1, etc.)
      // 2000-2999: Match in username (2000 = starts with, 2001 = position 1, etc.)
      // 9999: No match (shouldn't happen due to filtering)

      if (nameIndex >= 0) {
        // Match found in name - highest priority tier
        return 1000 + nameIndex;
      } else if (usernameIndex >= 0) {
        // Match found in username - lower priority tier
        return 2000 + usernameIndex;
      }

      return 9999; // No match found
    };

    // Map influencers with search priority
    const influencersWithPriority = allInfluencers.map((influencer) => ({
      ...influencer.toJSON(),
      searchPriority: calculateSearchPriority(
        influencer.name || '',
        influencer.username || '',
        search?.trim() || '',
      ),
    }));

    // Sort by search priority when search query is present
    if (search && search.trim()) {
      influencersWithPriority.sort((a, b) => a.searchPriority - b.searchPriority);
    }

    // Apply pagination after sorting
    const total = influencersWithPriority.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedInfluencers = influencersWithPriority
      .slice(offset, offset + limit)
      .map(({ searchPriority, ...influencer }) => influencer); // Remove searchPriority from response

    return {
      influencers: paginatedInfluencers as any,
      total,
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
    brandId?: number,
  ): Promise<{
    applications: CampaignApplication[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    aiScoreEnabled: boolean;
    aiCreditsRemaining: number | null;
    isMaxCampaign: boolean;
  }> {
    // Verify campaign exists and belongs to the brand (if brandId provided)
    // Note: We allow viewing applications even for inactive/completed campaigns
    const campaignWhere: any = { id: campaignId };
    if (brandId !== undefined) {
      campaignWhere.brandId = brandId;
    }

    const campaign = await this.campaignModel.findOne({
      where: campaignWhere,
    });

    if (!campaign) {
      throw new NotFoundException(
        brandId !== undefined
          ? 'Campaign not found or access denied'
          : 'Campaign not found',
      );
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
      case 'ai_score':
        sortInMemory = true;
        sortDirection = 'desc';
        order = [['createdAt', 'DESC']]; // Default order for fetching
        break;
      default:
        order = [['createdAt', 'DESC']];
    }

    const includeOptions: any = [
      {
        model: Influencer,
        // Note: influencerFilter AND niche already applied via filteredInfluencerIds above
        // No need to apply where clause again here
        attributes: [
          'id',
          'name',
          'username',
          'profileImage',
          'profileBanner',
          'profileHeadline',
          'bio',
          'gender',
          'dateOfBirth',
          'isVerified',
          'isProfileCompleted',
          'isPro',
          'instagramFollowersCount',
          'instagramUsername',
          'instagramUrl',
          'instagramAccountType',
          'youtubeUrl',
          'facebookUrl',
          'collaborationCosts',
          'createdAt',
          'updatedAt',
        ],
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
          'aiScore',
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

        // AI score is only available after brand activates it via enable-ai-score endpoint
        // The stored aiScore field is already included in the attributes query above
        // On-the-fly scoring is intentionally disabled to enforce the credit system

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

    // Sort in-memory if needed (for follower-based sorting or AI scoring)
    let finalApplications = filteredApplications;
    if (sortInMemory) {
      finalApplications = filteredApplications.sort((a, b) => {
        if (sortBy === 'ai_score') {
          const aScore = (a as any).aiScore || a.aiMatchability?.overallScore || 0;
          const bScore = (b as any).aiScore || b.aiMatchability?.overallScore || 0;
          return bScore - aScore; // Descending order (highest score first)
        }
        // Follower-based sorting
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

    // Fetch brand's remaining AI credits when a brand is viewing
    let aiCreditsRemaining: number | null = null;
    if (brandId !== undefined) {
      const brand = await this.brandModel.findByPk(brandId, {
        attributes: ['aiCreditsRemaining'],
      });
      if (brand) {
        aiCreditsRemaining = brand.aiCreditsRemaining;
      }
    }

    // If AI scoring is enabled, ensure all visible applications have a score.
    if (campaign.aiScoreEnabled) {
      const unscoredInPage = paginatedApplications.filter(
        (app: any) => app.aiScore === null || app.aiScore === undefined,
      );
      const unscoredInPageIds = new Set(unscoredInPage.map((a: any) => a.id));

      if (unscoredInPage.length > 0) {
        // Calculate and save scores synchronously for the current page only.
        // This ensures the first fetch always returns a populated aiScore instead
        // of null — the caller does not need to refresh to see the score.
        await this.bulkCalculateAndStoreScores(campaignId, [...unscoredInPageIds]);

        // Re-read the saved scores from DB and patch them into paginatedApplications
        // (the array entries are plain JSON objects so we mutate them directly).
        const freshScores = await this.campaignApplicationModel.findAll({
          where: { id: [...unscoredInPageIds] },
          attributes: ['id', 'aiScore'],
        });
        const scoreMap = new Map(freshScores.map((a) => [a.id, a.aiScore]));
        for (const app of paginatedApplications as any[]) {
          if (scoreMap.has(app.id)) {
            app.aiScore = scoreMap.get(app.id);
          }
        }
      }

      // Fire-and-forget for any unscored applications outside the current page
      // so they are ready by the time the user navigates to the next page.
      const hasUnscoredOutsidePage = (applicationsWithStats as any[]).some(
        (app) =>
          !unscoredInPageIds.has(app.id) &&
          (app.aiScore === null || app.aiScore === undefined),
      );
      if (hasUnscoredOutsidePage) {
        this.bulkCalculateAndStoreScores(campaignId).catch((err) => {
          console.error(`[AI Score] Background scoring failed for campaign ${campaignId}:`, err);
        });
      }
    }

    return {
      applications: paginatedApplications,
      total: totalCount,
      page,
      limit,
      totalPages,
      aiScoreEnabled: campaign.aiScoreEnabled,
      aiCreditsRemaining,
      isMaxCampaign: campaign.isMaxCampaign,
    };
  }

  /**
   * Calculate AI matchability score for an application
   */
  private async calculateAIScore(
    application: any,
    campaign: Campaign,
  ): Promise<any> {
    const influencer = application.influencer;

    // Get follower count - prioritize Instagram followers from profile
    let followerCount = influencer.instagramFollowersCount || 0;
    if (followerCount === 0) {
      followerCount = await this.getFollowerCount(influencer.id);
    }

    // Get post performance data - pass followerCount to avoid duplicate lookups
    const postPerformance = await this.getPostPerformance(influencer.id, followerCount);

    // Get past campaign performance
    const pastCampaigns = await this.getPastCampaignStats(influencer.id);

    // Get multiple Instagram profile analyses for robust niche calculation
    // Each snapshot covers 15 days (or 30 days for initial 2 snapshots)
    // We need multiple snapshots to get enough data
    // Fetch and filter following profile-score API pattern
    const allAnalyses = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId: influencer.id },
      order: [['syncNumber', 'DESC']],
      attributes: ['aiNicheAnalysis', 'postsAnalyzed', 'syncNumber', 'syncDate', 'totalFollowers', 'avgEngagementRate', 'audienceAgeGender'],
    });
    // Filter out incomplete snapshots and take last 5
    const instagramAnalyses = allAnalyses.filter(s => s.syncNumber != null).slice(0, 5);

    // Aggregate niches across multiple snapshots for accurate analysis
    let influencerNiches: string[] = [];
    let totalPostsAnalyzed = 0;

    if (instagramAnalyses && instagramAnalyses.length > 0) {
      const nicheAggregation = this.aggregateNichesFromAI(instagramAnalyses);
      influencerNiches = nicheAggregation.niches;
      totalPostsAnalyzed = nicheAggregation.totalPosts;
    }

    // Fallback to profile niches if no Instagram analysis
    if (influencerNiches.length === 0 && influencer.niches) {
      influencerNiches = (influencer.niches || []).map((n: any) => n.name);
    }

    // Get campaign niches
    const campaignNiches = await this.getCampaignNiches(campaign.nicheIds);

    // Get campaign cities
    const campaignCities = campaign.isPanIndia ? ['All India'] : await this.getCampaignCities(campaign.id);

    // Build profile snapshots for growth & consistency scoring
    const profileSnapshots = instagramAnalyses
      .filter(s => s.syncNumber != null)
      .map(s => ({
        syncNumber: s.syncNumber,
        totalFollowers: s.totalFollowers || 0,
        avgEngagementRate: Number(s.avgEngagementRate) || 0,
      }));

    // Fetch content quality score from latest profile score
    const profileScoreRecord = await this.influencerProfileScoreModel.findOne({
      where: { influencerId: influencer.id },
      attributes: ['contentQualityScore'],
      order: [['calculatedAt', 'DESC']],
    });
    const contentQualityScore = profileScoreRecord?.contentQualityScore
      ? Number(profileScoreRecord.contentQualityScore)
      : 0;

    // Extract audience demographics from latest valid snapshot
    const latestAnalysis = instagramAnalyses[0] || null;
    const audienceAgeGender = latestAnalysis?.audienceAgeGender ?? undefined;

    // Prepare data for AI scoring
    const influencerData = {
      id: influencer.id,
      name: influencer.name,
      username: influencer.username,
      followers: followerCount,
      niches: influencerNiches, // Use data-driven niches aggregated from multiple snapshots
      location: influencer.city?.name || 'N/A',
      isVerified: influencer.isVerified || false,
      bio: influencer.bio || '',
      pastCampaigns,
      postPerformance: postPerformance || undefined,
      postsAnalyzed: totalPostsAnalyzed, // Total posts across all analyzed snapshots
      snapshotsAnalyzed: instagramAnalyses?.length || 0,
      // New fields for audience quality & growth scoring
      instagramFollowsCount: influencer.instagramFollowsCount || 0,
      instagramMediaCount: influencer.instagramMediaCount || 0,
      profileSnapshots,
      contentQualityScore,
      audienceAgeGender,
    };

    const campaignData = {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      niches: campaignNiches,
      targetCities: campaignCities,
      isPanIndia: campaign.isPanIndia,
      campaignType: campaign.type,
      // Demographic targeting
      genderPreferences: campaign.genderPreferences ?? [],
      isOpenToAllGenders: campaign.isOpenToAllGenders ?? true,
      minAge: campaign.minAge ?? undefined,
      maxAge: campaign.maxAge ?? undefined,
      isOpenToAllAges: campaign.isOpenToAllAges ?? true,
    };

    // Use AI to score the match
    const aiResult = await this.aiScoringService.scoreInfluencerForCampaign(
      influencerData,
      campaignData,
    );

    return {
      overallScore: aiResult.overall,
      matchPercentage: `${aiResult.overall}%`,
      recommendation: aiResult.recommendation,
      scoreBreakdown: {
        nicheMatch: aiResult.nicheMatch,
        audienceRelevance: aiResult.audienceRelevance,
        audienceQuality: aiResult.audienceQuality,
        engagementRate: aiResult.engagementRate,
        growthConsistency: aiResult.growthConsistency,
        locationMatch: aiResult.locationMatch,
        contentQuality: aiResult.contentQuality,
      },
      strengths: aiResult.strengths,
      concerns: aiResult.concerns,
    };
  }

  /**
   * Aggregate niches from multiple Instagram profile snapshots
   * Each snapshot covers 15 days (or 30 days for initial 2 snapshots)
   * This gives us a comprehensive view of influencer's content over time
   */
  /**
   * Aggregate niches from AI analysis (aiNicheAnalysis JSON column)
   * Extracts primaryNiche and secondaryNiches from each snapshot
   */
  private aggregateNichesFromAI(snapshots: any[]): {
    niches: string[];
    totalPosts: number;
  } {
    if (!snapshots || snapshots.length === 0) {
      return { niches: [], totalPosts: 0 };
    }

    // Map to track niche frequency across snapshots
    const nicheMap = new Map<string, number>();
    let totalPostsAnalyzed = 0;

    snapshots.forEach((snapshot, index) => {
      // Weight: recent snapshots are more important (1.0, 0.8, 0.6, 0.4, 0.2)
      const weight = 1.0 - index * 0.2;

      if (snapshot.aiNicheAnalysis) {
        const analysis = snapshot.aiNicheAnalysis;

        // Add primary niche with higher weight (×2)
        if (analysis.primaryNiche) {
          const niche = analysis.primaryNiche.toLowerCase();
          nicheMap.set(niche, (nicheMap.get(niche) || 0) + (2 * weight));
        }

        // Add secondary niches with normal weight
        if (analysis.secondaryNiches && Array.isArray(analysis.secondaryNiches)) {
          analysis.secondaryNiches.forEach((niche: string) => {
            const nicheLower = niche.toLowerCase();
            nicheMap.set(nicheLower, (nicheMap.get(nicheLower) || 0) + weight);
          });
        }
      }

      totalPostsAnalyzed += snapshot.postsAnalyzed || 0;
    });

    // Sort by weighted frequency (higher = more common and recent)
    const sortedNiches = Array.from(nicheMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([niche]) => niche);

    return {
      niches: sortedNiches,
      totalPosts: totalPostsAnalyzed,
    };
  }

  /**
   * Get follower count for an influencer
   */
  private async getFollowerCount(influencerId: number): Promise<number> {
    return await this.followModel.count({
      where: {
        followingType: 'influencer',
        followingInfluencerId: influencerId,
      },
    });
  }

  /**
   * Get post performance statistics from Instagram insights
   * Uses same formula as Instagram service: (likes + comments + shares + saves) / posts / followers * 100
   */
  private async getPostPerformance(influencerId: number, followerCountOverride?: number): Promise<any> {
    // Get recent Instagram media insights (last 10 posts)
    const recentInsights = await this.instagramMediaInsightModel.findAll({
      where: { influencerId },
      limit: 10,
      order: [['fetchedAt', 'DESC']],
    });

    if (recentInsights.length === 0) return null;

    // Get follower count for engagement rate calculation
    // Prefer passed-in follower count (from Instagram profile) over Follow table
    let followerCount = followerCountOverride || 0;
    if (followerCount === 0) {
      followerCount = await this.getFollowerCount(influencerId);
    }
    // If still no followers, try getting from influencer profile
    if (followerCount === 0) {
      const influencer = await this.influencerModel.findByPk(influencerId, {
        attributes: ['instagramFollowersCount'],
      });
      followerCount = influencer?.instagramFollowersCount || 0;
    }
    if (followerCount === 0) return null;

    // Calculate totals
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalReach = 0;

    const totalEngagement = recentInsights.reduce((sum, insight) => {
      const likes = Number(insight.likes) || 0;
      const comments = Number(insight.comments) || 0;
      const shares = Number(insight.shares) || 0;
      const saved = Number(insight.saved) || 0;
      const reach = Number(insight.reach) || 0;

      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;
      totalSaves += saved;
      totalReach += reach;

      return sum + likes + comments + shares + saved;
    }, 0);

    const avgEngagement = totalEngagement / recentInsights.length;
    const avgEngagementRate = Number(((avgEngagement / followerCount) * 100).toFixed(2));
    const avgReach = Math.round(totalReach / recentInsights.length);

    return {
      avgLikes: totalLikes / recentInsights.length,
      avgComments: totalComments / recentInsights.length,
      avgShares: totalShares / recentInsights.length,
      avgSaves: totalSaves / recentInsights.length,
      avgReach,
      engagementRate: avgEngagementRate,
      totalPosts: recentInsights.length,
    };
  }

  /**
   * Get past campaign statistics
   */
  private async getPastCampaignStats(influencerId: number): Promise<any> {
    const completedCampaigns = await this.experienceModel.count({
      where: {
        influencerId,
        successfullyCompleted: true,
      },
    });

    return {
      total: completedCampaigns,
      successful: completedCampaigns,
    };
  }

  /**
   * Get campaign niches
   */
  private async getCampaignNiches(nicheIds: number[]): Promise<string[]> {
    if (!nicheIds || nicheIds.length === 0) return [];

    const niches = await Niche.findAll({
      where: { id: { [Op.in]: nicheIds } },
      attributes: ['name'],
    });

    return niches.map((n) => n.name);
  }

  /**
   * Get campaign cities
   */
  private async getCampaignCities(campaignId: number): Promise<string[]> {
    const campaignCities = await this.campaignCityModel.findAll({
      where: { campaignId },
      include: [
        {
          model: City,
          attributes: ['name'],
        },
      ],
    });

    return campaignCities.map((cc) => cc.city?.name || '');
  }

  /**
   * Fetch relevant profile score fields for ROI calculation
   */
  private async getProfileScoreForROI(influencerId: number): Promise<{
    monetisationScore: number;
    engagementStrengthScore: number;
    growthMomentumScore: number;
  } | null> {
    const profileScore = await this.influencerProfileScoreModel.findOne({
      where: { influencerId },
      attributes: ['monetisationScore', 'engagementStrengthScore', 'growthMomentumScore'],
      order: [['calculatedAt', 'DESC']],
    });
    if (!profileScore) return null;
    return {
      monetisationScore: Number(profileScore.monetisationScore) || 0,
      engagementStrengthScore: Number(profileScore.engagementStrengthScore) || 0,
      growthMomentumScore: Number(profileScore.growthMomentumScore) || 0,
    };
  }

  /**
   * Calculate Expected ROI using Instagram profile score data.
   * Formula: composite = monetisation(40%) + engagementStrength(40%) + growthMomentum(20%)
   * Falls back to engagement-rate lookup when no profile score is available.
   * Applies a follower-count cap to prevent tiny accounts from inflating ROI.
   */
  private calculateExpectedROI(
    followerCount: number,
    postPerformance: any,
    profileScore?: { monetisationScore: number; engagementStrengthScore: number; growthMomentumScore: number } | null,
  ): number {
    // Follower cap — tiny accounts have negligible reach/ROI
    if (followerCount < 50) return 1.0;
    if (followerCount < 100) return Math.min(1.2, this._engagementROI(postPerformance));

    if (profileScore) {
      const composite =
        profileScore.monetisationScore * 0.4 +
        profileScore.engagementStrengthScore * 0.4 +
        profileScore.growthMomentumScore * 0.2;

      let roi: number;
      if (composite >= 80) roi = 3.0;
      else if (composite >= 65) roi = 2.5;
      else if (composite >= 50) roi = 2.0;
      else if (composite >= 35) roi = 1.5;
      else if (composite >= 20) roi = 1.2;
      else roi = 1.0;

      // Cap for small accounts even with decent profile scores
      if (followerCount < 500) return Math.min(1.5, roi);

      return roi;
    }

    // Fallback: engagement-rate lookup
    return this._engagementROI(postPerformance);
  }

  /** Engagement-rate only ROI lookup (fallback) */
  private _engagementROI(postPerformance: any): number {
    if (!postPerformance) return 1.0;
    const engagementRate = Number(postPerformance.engagementRate) || 0;
    if (engagementRate >= 8.0) return 2.5;
    if (engagementRate >= 6.0) return 2.0;
    if (engagementRate >= 4.0) return 1.5;
    if (engagementRate >= 2.0) return 1.4;
    return 1.0;
  }

  /**
   * Calculate Estimated Engagement
   */
  private calculateEstimatedEngagement(followerCount: number, postPerformance: any): number {
    if (!postPerformance) {
      // Estimate 5% engagement rate if no post data
      return Math.round(followerCount * 0.05);
    }

    // engagementRate is a percentage (e.g., 6.96)
    // Calculate total estimated engagement: followers * (rate / 100)
    const engagementRate = Number(postPerformance.engagementRate) || 0;
    if (engagementRate > 0) {
      return Math.round(followerCount * (engagementRate / 100));
    }

    // Fallback: 5% engagement rate
    return Math.round(followerCount * 0.05);
  }

  /**
   * Calculate Estimated Reach
   */
  private calculateEstimatedReach(followerCount: number, postPerformance?: any): number {
    // If we have avgReach from post performance, use it
    if (postPerformance?.avgReach) {
      return Number(postPerformance.avgReach);
    }

    // Otherwise estimate reach as 30-60% of followers for organic posts
    return Math.round(followerCount * 0.5);
  }

  /**
   * Get metric tier label based on value
   */
  private getMetricTier(value: number, metricType: 'roi' | 'engagement' | 'reach'): string {
    switch (metricType) {
      case 'roi':
        if (value >= 2.0) return 'Elite';
        if (value >= 1.5) return 'Great';
        if (value >= 1.2) return 'Good';
        return 'Average';

      case 'engagement':
        if (value >= 10000) return 'Elite';
        if (value >= 5000) return 'Great';
        if (value >= 1000) return 'Good';
        return 'Average';

      case 'reach':
        if (value >= 100000) return 'Elite';
        if (value >= 50000) return 'Great';
        if (value >= 10000) return 'Good';
        return 'Average';

      default:
        return 'Average';
    }
  }

  /**
   * Get campaign experience details with full information
   */
  private async getCampaignExperienceDetails(influencerId: number): Promise<any[]> {
    const experiences = await this.experienceModel.findAll({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    // For each experience, try to get campaign details if campaignId exists
    const experienceDetails = await Promise.all(
      experiences.map(async (exp) => {
        const expJson = exp.toJSON();
        let campaignData: any = null;
        let brandData: any = null;

        // If experience is linked to a campaign, fetch campaign and brand details
        if (expJson.campaignId) {
          const campaign = await this.campaignModel.findOne({
            where: { id: expJson.campaignId },
            include: [
              {
                model: Brand,
                attributes: ['id', 'brandName'],
              },
              {
                model: CampaignDeliverable,
                attributes: ['platform', 'type', 'quantity'],
              },
            ],
          });

          if (campaign) {
            const campaignJson: any = campaign.toJSON();
            campaignData = {
              id: campaignJson.id,
              name: campaignJson.name,
              description: campaignJson.description,
              type: campaignJson.type,
            };

            brandData = {
              id: campaignJson.brand?.id,
              name: campaignJson.brand?.brandName,
              logo: null, // Brand model doesn't have logo field
            };

            // Format deliverables from campaign
            const deliverables = campaignJson.deliverables || [];
            expJson.deliverableFormat = deliverables
              .map((d: any) => `${d.platform} ${d.type}`)
              .join(' + ') || expJson.deliverableFormat;
          }
        }

        // If no campaign found, use stored brand name
        if (!brandData) {
          brandData = {
            id: null,
            name: expJson.brandName,
            logo: null,
          };
        }

        // Determine status
        let status = 'Ongoing';
        if (expJson.successfullyCompleted) {
          status = 'Completed';
        } else if (expJson.completionDate && new Date(expJson.completionDate) < new Date()) {
          status = 'Completed';
        }

        // Payment type - default to "Paid" (can be enhanced based on campaign type if available)
        let paymentType = 'Paid';
        if (campaignData?.type === 'barter') {
          paymentType = 'Barter';
        }

        return {
          id: expJson.id,
          brand: brandData,
          campaign: campaignData || {
            id: null,
            name: expJson.campaignName,
            description: expJson.roleDescription,
            type: null,
          },
          deliverableFormat: expJson.deliverableFormat,
          paymentType,
          status,
          completionDate: expJson.completionDate,
          createdAt: expJson.createdAt,
        };
      }),
    );

    return experienceDetails;
  }

  /**
   * Get detailed AI matchability insights for influencer application
   */
  async getInfluencerAIDetails(
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
    // Note: niches are stored as nicheIds JSON array on campaign, not via association
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

    // Find the application
    const application = await this.campaignApplicationModel.findOne({
      where: { campaignId, influencerId },
      include: [
        {
          model: Influencer,
          attributes: [
            'id',
            'name',
            'username',
            'profileImage',
            'isVerified',
            'instagramFollowersCount',
            'bio',
          ],
          include: [
            {
              model: Niche,
              attributes: ['id', 'name'],
              through: { attributes: [] },
            },
            {
              model: City,
              attributes: ['id', 'name'],
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

    // Check if influencer data is available
    if (!application.influencer) {
      throw new NotFoundException(
        `Influencer ${influencerId} not found or deleted`,
      );
    }

    // Get campaign experience count
    const campaignExperienceCount = await this.experienceModel.count({
      where: { influencerId },
    });

    // If cached data exists, return it with influencer info
    if (application.aiScoreData) {
      // Get Instagram analysis for profile strength even with cached data
      // Fetch and filter following profile-score API pattern
      const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId },
        order: [['syncNumber', 'DESC']],
        attributes: ['activeFollowersPercentage', 'syncNumber'],
      });
      const validSnapshots = allSnapshots.filter(s => s.syncNumber != null);
      const instagramAnalysis = validSnapshots.length > 0 ? validSnapshots[0] : null;

      // Calculate profile strength using cached data
      const nicheMatchScore = application.aiScoreData.scoreBreakdown?.nicheMatch || null;
      const profileStrength = this.calculateProfileStrength(
        application.aiScore || 0,
        nicheMatchScore,
        instagramAnalysis,
      );

      return {
        influencer: {
          id: application.influencer.id,
          name: application.influencer.name,
          username: application.influencer.username,
          profileImage: application.influencer.profileImage,
          isVerified: application.influencer.isVerified,
          bio: application.influencer.bio,
          location: application.influencer.city
            ? {
                city: application.influencer.city.name,
                state: application.influencer.city.state,
                country: 'India',
              }
            : null,
          niches: application.influencer.niches?.map((niche: any) => ({
            id: niche.id,
            name: niche.name,
          })) || [],
          followersCount: application.influencer.instagramFollowersCount,
        },
        profileStrength,
        campaignExperienceCount,
        ...application.aiScoreData,
      };
    }

    // Not cached — calculate now
    const aiMatchability = await this.calculateAIScore(application, campaign);

    // Get Instagram profile analysis data - use latest snapshot
    // Fetch and filter following profile-score API pattern
    const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId },
      order: [['syncNumber', 'DESC']],
      attributes: [
        'audienceAgeGender',
        'avgEngagementRate',
        'avgReach',
        'activeFollowersPercentage',
        'totalFollowers',
        'syncNumber',
      ],
    });
    const validSnapshots = allSnapshots.filter(s => s.syncNumber != null);
    const instagramAnalysis = validSnapshots.length > 0 ? validSnapshots[0] : null;

    // Get performance metrics - prioritize Instagram profile analysis data
    let followerCount = 0;
    let postPerformance: any = null;

    // Priority 1: Use Instagram profile analysis data if available
    if (instagramAnalysis && instagramAnalysis.totalFollowers) {
      followerCount = Number(instagramAnalysis.totalFollowers) || 0;
      console.log(`[AI Score] Using totalFollowers from Instagram analysis: ${followerCount}`);

      // Create postPerformance object from Instagram analysis
      if (instagramAnalysis.avgReach && instagramAnalysis.avgEngagementRate) {
        postPerformance = {
          avgReach: Number(instagramAnalysis.avgReach) || 0,
          engagementRate: Number(instagramAnalysis.avgEngagementRate) || 0,
          totalPosts: 10, // Estimated
        };
      }
    }

    // Priority 2: Use Instagram followers from influencer profile
    if (followerCount === 0 && application.influencer.instagramFollowersCount) {
      followerCount = application.influencer.instagramFollowersCount;
      console.log(`[AI Score] Using Instagram followers count from profile: ${followerCount}`);
    }

    // Priority 3: Check platform followers (Follow table)
    if (followerCount === 0) {
      followerCount = await this.getFollowerCount(influencerId);
    }

    // Get post performance from media insights if not available from Instagram analysis
    // Pass followerCount so it doesn't need to look it up again
    if (!postPerformance) {
      postPerformance = await this.getPostPerformance(influencerId, followerCount);
    }

    // Log data availability for debugging
    console.log(`[AI Score] Data availability for influencer ${influencerId}:`, {
      hasInstagramAnalysis: !!instagramAnalysis,
      hasPostPerformance: !!postPerformance,
      followerCount,
      avgReach: instagramAnalysis?.avgReach || postPerformance?.avgReach || 0,
      engagementRate: instagramAnalysis?.avgEngagementRate || postPerformance?.engagementRate || 0,
    });

    // Calculate Audience Quality Score
    const audienceQuality = this.calculateAudienceQuality(instagramAnalysis);

    // Calculate Average Reaction metrics (with fallback to postPerformance)
    const avgReaction = this.calculateAverageReaction(
      instagramAnalysis,
      postPerformance,
      followerCount,
    );

    const roiProfileScore = await this.getProfileScoreForROI(influencerId);
    const expectedROI = this.calculateExpectedROI(followerCount, postPerformance, roiProfileScore);
    const estimatedEngagement = this.calculateEstimatedEngagement(followerCount, postPerformance);
    const estimatedReach = this.calculateEstimatedReach(followerCount, postPerformance);

    // Calculate tone matching with campaign
    const toneMatching = this.calculateToneMatching(aiMatchability, estimatedEngagement);

    // Get trust signals
    const trustSignals = await this.getTrustSignals(influencerId, application.influencer);

    // Calculate profile strength
    const profileStrength = this.calculateProfileStrength(
      aiMatchability.overallScore,
      aiMatchability.scoreBreakdown?.nicheMatch || null,
      instagramAnalysis,
    );

    const scoreData = {
      matchabilityScore: aiMatchability.overallScore,
      matchPercentage: aiMatchability.matchPercentage,
      // AI Feedback
      recommendation: aiMatchability.recommendation,
      strengths: aiMatchability.strengths,
      concerns: aiMatchability.concerns,
      scoreBreakdown: aiMatchability.scoreBreakdown,
      // Why This Creator
      whyThisCreator: {
        audienceQuality: {
          score: audienceQuality.score,
          maxScore: 100,
          description: audienceQuality.description,
          tier: audienceQuality.tier,
        },
        avgReach: {
          value: avgReaction.value,
          description: avgReaction.description,
          tier: avgReaction.tier,
        },
        avgEngagement: {
          value: estimatedEngagement,
          description: toneMatching.description,
          tier: toneMatching.tier,
        },
      },
      predictedPerformance: {
        expectedROI: {
          value: expectedROI,
          tier: this.getMetricTier(expectedROI, 'roi'),
        },
        estimatedEngagement: {
          value: estimatedEngagement,
          tier: this.getMetricTier(estimatedEngagement, 'engagement'),
        },
        estimatedReach: {
          value: estimatedReach,
          tier: this.getMetricTier(estimatedReach, 'reach'),
        },
      },
      trustSignals,
    };

    // Persist the score so subsequent calls use the cache
    await application.update({
      aiScore: aiMatchability.overallScore,
      aiScoreData: scoreData,
    });

    // Return comprehensive response with influencer info
    return {
      influencer: {
        id: application.influencer.id,
        name: application.influencer.name,
        username: application.influencer.username,
        profileImage: application.influencer.profileImage,
        isVerified: application.influencer.isVerified,
        bio: application.influencer.bio,
        location: application.influencer.city
          ? {
              city: application.influencer.city.name,
              state: application.influencer.city.state,
              country: 'India',
            }
          : null,
        niches: application.influencer.niches?.map((niche: any) => ({
          id: niche.id,
          name: niche.name,
        })) || [],
        followersCount: application.influencer.instagramFollowersCount,
      },
      profileStrength,
      campaignExperienceCount,
      ...scoreData,
    };
  }

  /**
   * Calculate audience quality score based on demographics
   */
  private calculateAudienceQuality(instagramAnalysis: any): any {
    if (!instagramAnalysis || !instagramAnalysis.audienceAgeGender || instagramAnalysis.audienceAgeGender.length === 0) {
      return {
        score: 50,
        description: 'Audience demographic data not yet analyzed',
        tier: 'Average',
      };
    }

    const audienceData = instagramAnalysis.audienceAgeGender;

    // Find dominant demographic
    let dominantDemo: any = null;
    let maxPercentage = 0;

    for (const demo of audienceData) {
      const percentage = Number(demo.percentage) || 0;
      if (percentage > maxPercentage) {
        maxPercentage = percentage;
        dominantDemo = demo;
      }
    }

    // If no valid data found
    if (maxPercentage === 0 || !dominantDemo) {
      return {
        score: 50,
        description: 'Audience demographic data not yet analyzed',
        tier: 'Average',
      };
    }

    // Calculate score based on concentration
    let score = 50; // Base score

    // Higher concentration = higher quality
    if (maxPercentage >= 50) {
      score = 90;
    } else if (maxPercentage >= 40) {
      score = 80;
    } else if (maxPercentage >= 30) {
      score = 70;
    } else if (maxPercentage >= 20) {
      score = 60;
    }

    // Build description
    const ageRange = dominantDemo.ageRange || 'various ages';
    const gender = dominantDemo.gender || 'followers';
    const description = `${Math.round(maxPercentage)}% of followers are ${gender.toLowerCase()} (${ageRange})`;

    // Determine tier
    let tier = 'Average';
    if (score >= 85) tier = 'Strong';
    else if (score >= 70) tier = 'Good';

    return { score, description, tier };
  }

  /**
   * Calculate average reaction metrics
   */
  private calculateAverageReaction(
    instagramAnalysis: any,
    postPerformance: any,
    followerCount: number,
  ): any {
    let avgReach = Number(instagramAnalysis?.avgReach) || 0;
    let engagementRate = Number(instagramAnalysis?.avgEngagementRate) || 0;
    let activeFollowersPercentage = Number(instagramAnalysis?.activeFollowersPercentage) || 0;

    // Fallback: If Instagram analysis data is missing or has null values, use postPerformance data
    if ((avgReach === 0 || engagementRate === 0) && postPerformance) {
      if (avgReach === 0) {
        avgReach = Number(postPerformance.avgReach) || 0;
      }
      if (engagementRate === 0) {
        engagementRate = Number(postPerformance.engagementRate) || 0;
      }
      // Estimate active followers at 60% if no data
      if (activeFollowersPercentage === 0) {
        activeFollowersPercentage = 60;
      }
    }

    // Further fallback: If still no data, estimate from follower count
    if (avgReach === 0 && followerCount > 0) {
      // Estimate reach as 30-50% of followers for organic posts
      avgReach = Math.round(followerCount * 0.4);
    }

    // If still no engagement rate, provide a default message
    if (engagementRate === 0 && avgReach === 0) {
      return {
        value: 0,
        description: 'No engagement data available',
        tier: 'Average',
      };
    }

    // Format large numbers (e.g., 210K)
    const formattedReach = this.formatLargeNumber(avgReach);

    // Build description
    const description = `Reels average ${formattedReach} views with a ${engagementRate.toFixed(1)}% engagement rate${activeFollowersPercentage > 0 ? ' with active followers' : ''}`;

    // Determine tier based on engagement rate
    let tier = 'Average';
    if (engagementRate >= 6.0 && activeFollowersPercentage >= 70) {
      tier = 'Strong';
    } else if (engagementRate >= 4.0 && activeFollowersPercentage >= 50) {
      tier = 'Good';
    }

    return {
      value: avgReach,
      description,
      tier,
    };
  }

  /**
   * Format large numbers (e.g., 210000 -> "210K")
   */
  private formatLargeNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  /**
   * Calculate tone matching percentage with campaign
   */
  private calculateToneMatching(aiMatchability: any, _engagement: number): any {
    // Use AI niche match and content quality scores to determine tone matching
    const nicheMatch = Number(aiMatchability.scoreBreakdown?.nicheMatch) || 0;
    const contentQuality = Number(aiMatchability.scoreBreakdown?.contentQuality) || 0;

    // Calculate tone matching percentage (weighted average)
    const toneMatchPercentage = Math.round((nicheMatch * 0.6) + (contentQuality * 0.4));

    // Build description
    const description = `Content style and captions show ${toneMatchPercentage}% Tone matches with campaign needs`;

    // Determine tier
    let tier = 'Average';
    if (toneMatchPercentage >= 80) {
      tier = 'Strong';
    } else if (toneMatchPercentage >= 65) {
      tier = 'Good';
    }

    return {
      toneMatchPercentage,
      description,
      tier,
    };
  }

  /**
   * Calculate profile strength based on various factors
   */
  private calculateProfileStrength(
    aiMatchabilityScore: number,
    nicheMatchScore: number | null,
    instagramAnalysis: any,
  ): any {
    const factors: Array<{ factor: string; strength: string }> = [];
    let overallStrength = 'Average';

    // Check niche clarity (based on AI niche match score if available, otherwise estimate from overall score)
    const nicheMatch = nicheMatchScore !== null ? nicheMatchScore : aiMatchabilityScore;
    if (nicheMatch >= 80) {
      factors.push({ factor: 'Strong niche clarity', strength: 'Strong' });
    } else if (nicheMatch >= 60) {
      factors.push({ factor: 'Good niche clarity', strength: 'Good' });
    } else {
      factors.push({ factor: 'Weak niche clarity', strength: 'Weak' });
    }

    // Check growth momentum (based on follower count trends)
    // Simplified: check if they have high active followers percentage
    const activeFollowersPercentage = Number(instagramAnalysis?.activeFollowersPercentage) || 0;
    if (activeFollowersPercentage >= 70) {
      factors.push({ factor: 'Strong growth momentum', strength: 'Strong' });
    } else if (activeFollowersPercentage >= 50) {
      factors.push({ factor: 'Steady growth momentum', strength: 'Good' });
    } else {
      factors.push({ factor: 'Weak growth momentum', strength: 'Weak' });
    }

    // Determine overall strength based on AI match score
    if (aiMatchabilityScore >= 80) {
      overallStrength = 'Strong';
    } else if (aiMatchabilityScore >= 65) {
      overallStrength = 'Good';
    }

    // Build description string
    const description = factors.map((f) => f.factor).join(' • ');

    return {
      strength: overallStrength,
      description: `${overallStrength} Profile - ${description}`,
      factors,
    };
  }

  /**
   * Get trust signals for influencer
   */
  private async getTrustSignals(influencerId: number, influencer: any): Promise<any> {
    // Get past campaign ratings
    const completedExperiences = await this.experienceModel.count({
      where: {
        influencerId,
        successfullyCompleted: true,
      },
    });

    // Calculate fraud probability (simplified - can be enhanced)
    // Lower fraud probability for verified accounts and those with completed campaigns
    let fraudProbability = 0.5; // Base 50%

    if (influencer?.isVerified) {
      fraudProbability -= 0.3; // -30% if verified
    }

    if (completedExperiences >= 5) {
      fraudProbability -= 0.3; // -30% if 5+ completed campaigns
    } else if (completedExperiences >= 2) {
      fraudProbability -= 0.15; // -15% if 2+ completed campaigns
    }

    fraudProbability = Math.max(0, Math.min(1, fraudProbability)); // Clamp between 0 and 1

    // Calculate past sponsor rating (simplified - based on completion rate)
    // TODO: Implement actual brand ratings when that feature is available
    const totalExperiences = await this.experienceModel.count({
      where: { influencerId },
    });

    let pastSponsorRating = 3.5; // Default rating
    if (totalExperiences > 0) {
      const completionRate = completedExperiences / totalExperiences;
      pastSponsorRating = 3.0 + (completionRate * 2.0); // Scale from 3.0 to 5.0
    }

    return {
      verifiedBadge: influencer?.isVerified || false,
      fraudCheck: {
        status: fraudProbability < 0.1 ? 'Passed' : fraudProbability < 0.3 ? 'Low Risk' : 'Medium Risk',
        probability: fraudProbability,
        formattedProbability: `${(fraudProbability * 100).toFixed(2)}% fraud probability`,
      },
      pastSponsorRating: {
        rating: Math.round(pastSponsorRating * 10) / 10,
        maxRating: 5,
        formattedRating: `${pastSponsorRating.toFixed(1)}/5`,
        source: 'avg from platform',
        basedOn: completedExperiences,
      },
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
    // Note: niches are stored as nicheIds JSON array on campaign, not via association
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
            'instagramFollowersCount',
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

    // Check if influencer data is available
    if (!application.influencer) {
      throw new NotFoundException(
        `Influencer ${influencerId} not found or deleted`,
      );
    }

    // Calculate AI matchability score
    const aiMatchability = await this.calculateAIScore(application, campaign);

    // Calculate performance metrics - prioritize Instagram followers from profile
    let followerCount = application.influencer.instagramFollowersCount || 0;
    if (followerCount === 0) {
      followerCount = await this.getFollowerCount(influencerId);
    }
    const postPerformance = await this.getPostPerformance(influencerId, followerCount);

    // Calculate Expected ROI using profile score data for accuracy
    const roiProfileScore = await this.getProfileScoreForROI(influencerId);
    const expectedROI = this.calculateExpectedROI(followerCount, postPerformance, roiProfileScore);

    // Calculate Estimated Engagement
    const estimatedEngagement = this.calculateEstimatedEngagement(followerCount, postPerformance);

    // Calculate Estimated Reach
    const estimatedReach = this.calculateEstimatedReach(followerCount, postPerformance);

    // Get campaign experience with full details
    const campaignExperience = await this.getCampaignExperienceDetails(influencerId);

    // Build enhanced response
    const appJson = application.toJSON();

    return {
      ...appJson,
      aiMatchability,
      metrics: {
        expectedROI: {
          value: expectedROI,
          tier: this.getMetricTier(expectedROI, 'roi'),
        },
        estimatedEngagement: {
          value: estimatedEngagement,
          tier: this.getMetricTier(estimatedEngagement, 'engagement'),
        },
        estimatedReach: {
          value: estimatedReach,
          tier: this.getMetricTier(estimatedReach, 'reach'),
        },
      },
      campaignExperience,
      totalFollowers: followerCount,
    };
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
        case 'payment.authorized':
          // Payment authorized but not yet captured - mark as PROCESSING
          await campaign.update({
            [statusField]: InvoiceStatus.PROCESSING,
            paymentStatusUpdatedAt: new Date(),
            razorpayLastWebhookAt: new Date(),
            paymentStatusMessage: 'Payment authorized, waiting for confirmation',
          });
          console.log(`⏳ Campaign ${campaign.id} payment authorized - status set to PROCESSING`);
          break;

        case 'payment.captured':
        case 'order.paid':
          // Payment successful - set status to ACTIVE
          await campaign.update({
            [statusField]: InvoiceStatus.PAID,
            status: 'active' as any,
            paymentStatusUpdatedAt: new Date(),
            razorpayLastWebhookAt: new Date(),
            paymentStatusMessage: 'Payment successful',
          });
          console.log(`✅ Campaign ${campaign.id} activated after payment captured`);
          break;

        case 'payment.failed':
          // Payment failed - keep as DRAFT
          await campaign.update({
            [statusField]: InvoiceStatus.FAILED,
            paymentStatusUpdatedAt: new Date(),
            razorpayLastWebhookAt: new Date(),
            paymentStatusMessage: paymentEntity.error_description || 'Payment failed',
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

  // ─────────────────────────────────────────────────────────────────────────────
  // AI Score Credits
  // ─────────────────────────────────────────────────────────────────────────────

  async enableAIScoreForCampaign(campaignId: number, brandId: number) {
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId, brandId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or access denied');
    }

    if (campaign.aiScoreEnabled) {
      // Retry scoring for any applicants still missing a score (idempotent)
      this.bulkCalculateAndStoreScores(campaignId).catch((err) => {
        console.error(`[AI Score] Bulk retry scoring failed for campaign ${campaignId}:`, err);
      });
      return { alreadyEnabled: true, message: 'AI scoring already enabled. Rescoring any unscored applicants.' };
    }

    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Campaign-specific paid credit takes priority over free brand credits
    if (campaign.aiScoreCreditPurchased) {
      // Credit was purchased specifically for this campaign – enable without consuming brand balance
      await campaign.update({ aiScoreEnabled: true });
    } else if (brand.aiCreditsRemaining > 0) {
      // Use a free brand-level credit (deducted atomically)
      try {
        await this.campaignModel.sequelize!.transaction(async (t) => {
          await brand.decrement('aiCreditsRemaining', {
            by: 1,
            transaction: t,
          });
          await campaign.update({ aiScoreEnabled: true }, { transaction: t });
        });
      } catch (error) {
        if (error.message?.includes('check_ai_credits_non_negative')) {
          throw new ForbiddenException('No AI score credits remaining');
        }
        throw error;
      }
    } else {
      throw new ForbiddenException(
        'No AI score credits remaining. Please purchase a credit for this campaign.',
      );
    }

    // Fire-and-forget: calculate and store scores for all applicants
    this.bulkCalculateAndStoreScores(campaignId).catch((err) => {
      console.error(`[AI Score] Bulk scoring failed for campaign ${campaignId}:`, err);
    });

    // Reload to get updated credit count
    await brand.reload();

    return { success: true, creditsRemaining: brand.aiCreditsRemaining };
  }

  private async bulkCalculateAndStoreScores(campaignId: number, applicationIds?: number[]): Promise<void> {
    // Fetch campaign only — niches are fetched via getCampaignNiches(campaign.nicheIds)
    // and cities via getCampaignCities(campaign.id) inside calculateAIScore
    const campaign = await this.campaignModel.findOne({
      where: { id: campaignId },
    });

    if (!campaign) return;

    // Only score applicants that haven't been scored yet (idempotent retry).
    // When applicationIds is provided, restrict to those specific applications
    // (used for current-page synchronous scoring).
    const whereClause: any = { campaignId, aiScore: { [Op.is]: null } };
    if (applicationIds && applicationIds.length > 0) {
      whereClause.id = applicationIds;
    }

    const applications = await this.campaignApplicationModel.findAll({
      where: whereClause,
      include: [
        {
          model: Influencer,
          attributes: ['id', 'name', 'username', 'profileImage', 'isVerified', 'instagramFollowersCount', 'bio'],
          include: [
            {
              model: Niche,
              attributes: ['id', 'name'],
              through: { attributes: [] },
            },
            {
              model: City,
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    console.log(`[AI Score] Starting bulk scoring for campaign ${campaignId}: ${applications.length} unscored applicants`);

    for (const application of applications) {
      try {
        const influencerId = application.influencerId;
        console.log(`[AI Score] Scoring application ${application.id} (influencer ${influencerId})`);

        // Skip if influencer data is not available
        if (!application.influencer) {
          console.warn(
            `[AI Score] Skipping application ${application.id}: influencer ${influencerId} not found or deleted`,
          );
          continue;
        }

        const aiMatchability = await this.calculateAIScore(application, campaign);

        // Get Instagram profile analysis data - use latest snapshot
        // Fetch and filter following profile-score API pattern
        const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
          where: { influencerId },
          order: [['syncNumber', 'DESC']],
          attributes: ['audienceAgeGender', 'avgEngagementRate', 'avgReach', 'activeFollowersPercentage', 'totalFollowers', 'syncNumber'],
        });
        const validSnapshots = allSnapshots.filter(s => s.syncNumber != null);
        const instagramAnalysis = validSnapshots.length > 0 ? validSnapshots[0] : null;

        // Get performance metrics - prioritize Instagram profile analysis data
        let followerCount = 0;
        let postPerformance: any = null;

        // First priority: Use Instagram profile analysis data if available
        if (instagramAnalysis && instagramAnalysis.totalFollowers) {
          followerCount = Number(instagramAnalysis.totalFollowers) || 0;

          // Create postPerformance object from Instagram analysis
          if (instagramAnalysis.avgReach && instagramAnalysis.avgEngagementRate) {
            postPerformance = {
              avgReach: Number(instagramAnalysis.avgReach) || 0,
              engagementRate: Number(instagramAnalysis.avgEngagementRate) || 0,
              totalPosts: 10, // Estimated
            };
          }
        }

        // Fallback: Check platform followers
        if (followerCount === 0) {
          followerCount = await this.getFollowerCount(influencerId);
        }

        // Fallback: Use Instagram followers from influencer profile
        if (followerCount === 0 && application.influencer.instagramFollowersCount) {
          followerCount = application.influencer.instagramFollowersCount;
        }

        // Fallback: Get post performance from media insights if not available from analysis
        if (!postPerformance) {
          postPerformance = await this.getPostPerformance(influencerId, followerCount);
        }

        const audienceQuality = this.calculateAudienceQuality(instagramAnalysis);
        const avgReaction = this.calculateAverageReaction(
          instagramAnalysis,
          postPerformance,
          followerCount,
        );

        const roiProfileScore = await this.getProfileScoreForROI(influencerId);
        const expectedROI = this.calculateExpectedROI(followerCount, postPerformance, roiProfileScore);
        const estimatedEngagement = this.calculateEstimatedEngagement(followerCount, postPerformance);
        const estimatedReach = this.calculateEstimatedReach(followerCount, postPerformance);
        const toneMatching = this.calculateToneMatching(aiMatchability, estimatedEngagement);
        const trustSignals = await this.getTrustSignals(influencerId, application.influencer);

        const scoreData = {
          matchabilityScore: aiMatchability.overallScore,
          matchPercentage: aiMatchability.matchPercentage,
          // AI Feedback
          recommendation: aiMatchability.recommendation,
          strengths: aiMatchability.strengths,
          concerns: aiMatchability.concerns,
          scoreBreakdown: aiMatchability.scoreBreakdown,
          // Why This Creator
          whyThisCreator: {
            audienceQuality: {
              score: audienceQuality.score,
              maxScore: 100,
              description: audienceQuality.description,
              tier: audienceQuality.tier,
            },
            avgReach: {
              value: avgReaction.value,
              description: avgReaction.description,
              tier: avgReaction.tier,
            },
            avgEngagement: {
              value: estimatedEngagement,
              description: toneMatching.description,
              tier: toneMatching.tier,
            },
          },
          predictedPerformance: {
            expectedROI: {
              value: expectedROI,
              tier: this.getMetricTier(expectedROI, 'roi'),
            },
            estimatedEngagement: {
              value: estimatedEngagement,
              tier: this.getMetricTier(estimatedEngagement, 'engagement'),
            },
            estimatedReach: {
              value: estimatedReach,
              tier: this.getMetricTier(estimatedReach, 'reach'),
            },
          },
          trustSignals,
        };

        await application.update({
          aiScore: aiMatchability.overallScore,
          aiScoreData: scoreData,
        });
        console.log(`[AI Score] Saved score ${aiMatchability.overallScore} for application ${application.id}`);
      } catch (err) {
        console.error(
          `[AI Score] Failed to score application ${application.id} (influencer ${application.influencerId}):`,
          err instanceof Error ? err.message : err,
        );
        if (err instanceof Error) {
          console.error(`[AI Score] Stack:`, err.stack);
        }
      }
    }
    console.log(`[AI Score] Bulk scoring complete for campaign ${campaignId}`);
  }

  /**
   * Queue MAX campaign scoring job in background
   * This runs Instagram data fetch + profile scoring + AI matchability scoring
   * for all applicants in a MAX campaign
   */
  async queueMaxCampaignScoring(campaignId: number): Promise<void> {
    console.log(`[MAX Campaign Scoring] Queueing background job for campaign ${campaignId}`);

    // Verify campaign exists and is a MAX campaign
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    if (!campaign.isMaxCampaign) {
      console.log(`[MAX Campaign Scoring] Campaign ${campaignId} is not a MAX campaign, skipping`);
      return;
    }

    // Queue the background job
    await this.maxCampaignScoringQueueService.queueCampaignScoring(campaignId);
    console.log(`[MAX Campaign Scoring] Successfully queued job for campaign ${campaignId}`);
  }

  /**
   * Queue scoring for specific influencers in a MAX campaign
   * Useful when new applications come in
   */
  async queueMaxCampaignScoringForInfluencers(
    campaignId: number,
    influencerIds: number[],
  ): Promise<void> {
    console.log(
      `[MAX Campaign Scoring] Queueing background job for ${influencerIds.length} influencers in campaign ${campaignId}`,
    );

    // Verify campaign exists and is a MAX campaign
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    if (!campaign.isMaxCampaign) {
      console.log(`[MAX Campaign Scoring] Campaign ${campaignId} is not a MAX campaign, skipping`);
      return;
    }

    // Queue the background job for specific influencers
    await this.maxCampaignScoringQueueService.queueInfluencerScoring(
      campaignId,
      influencerIds,
    );
    console.log(
      `[MAX Campaign Scoring] Successfully queued job for ${influencerIds.length} influencers`,
    );
  }
}
