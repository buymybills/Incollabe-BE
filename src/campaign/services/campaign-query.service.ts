import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Campaign, CampaignStatus } from '../models/campaign.model';
import { CampaignApplication } from '../models/campaign-application.model';
import { CampaignInvitation } from '../models/campaign-invitation.model';
import { CampaignCity } from '../models/campaign-city.model';
import { CampaignDeliverable } from '../models/campaign-deliverable.model';
import { Brand } from '../../brand/model/brand.model';
import { City } from '../../shared/models/city.model';
import { MODEL_ATTRIBUTES } from '../constants/query-builder.constants';
import { CampaignWithStats } from '../interfaces/campaign-with-stats.interface';
import { CampaignStatsHelper } from '../helpers/campaign-stats.helper';

/**
 * Service responsible for campaign database queries
 * Follows Single Responsibility Principle
 */
@Injectable()
export class CampaignQueryService {
  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
  ) {}

  /**
   * Get base include options for campaign queries
   */
  private getBaseIncludeOptions() {
    return [
      {
        model: Brand,
        attributes: MODEL_ATTRIBUTES.BRAND,
      },
      {
        model: CampaignCity,
        include: [
          {
            model: City,
            attributes: MODEL_ATTRIBUTES.CITY,
          },
        ],
      },
      {
        model: CampaignDeliverable,
        attributes: MODEL_ATTRIBUTES.CAMPAIGN_DELIVERABLE,
      },
      {
        model: CampaignApplication,
        attributes: MODEL_ATTRIBUTES.CAMPAIGN_APPLICATION,
        required: false,
      },
    ];
  }

  /**
   * Fetch open campaigns for a brand
   * Only returns active campaigns (status: ACTIVE, not invite-only, not finished/cancelled)
   * @param brandId - Brand ID
   * @param campaignType - Optional filter by campaign type (paid, barter, ugc, engagement)
   */
  async fetchOpenCampaigns(brandId: number, campaignType?: string, campaignMode?: string, searchQuery?: string): Promise<Campaign[]> {
    const whereCondition: any = {
      brandId,
      status: CampaignStatus.ACTIVE,
      isInviteOnly: false,
    };

    if (campaignType) {
      whereCondition.type = campaignType;
    }

    this.applyCampaignModeFilter(whereCondition, campaignMode);
    this.applySearchFilter(whereCondition, searchQuery);

    return this.campaignModel.findAll({
      where: whereCondition,
      include: this.getBaseIncludeOptions(),
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Fetch draft campaigns for a brand
   * Only returns campaigns with DRAFT status
   */
  async fetchDraftCampaigns(brandId: number, campaignMode?: string, searchQuery?: string): Promise<Campaign[]> {
    const whereCondition: any = {
      brandId,
      status: CampaignStatus.DRAFT,
    };

    this.applyCampaignModeFilter(whereCondition, campaignMode);
    this.applySearchFilter(whereCondition, searchQuery);

    return this.campaignModel.findAll({
      where: whereCondition,
      include: this.getBaseIncludeOptions(),
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Fetch invite-only campaigns for a brand
   * Only returns active invite campaigns (status: ACTIVE, invite-only, not finished/cancelled)
   */
  async fetchInviteCampaigns(brandId: number, campaignMode?: string, searchQuery?: string): Promise<Campaign[]> {
    const whereCondition: any = {
      brandId,
      status: CampaignStatus.ACTIVE,
      isInviteOnly: true,
    };

    this.applyCampaignModeFilter(whereCondition, campaignMode);
    this.applySearchFilter(whereCondition, searchQuery);

    return this.campaignModel.findAll({
      where: whereCondition,
      include: [
        ...this.getBaseIncludeOptions(),
        {
          model: CampaignInvitation,
          attributes: MODEL_ATTRIBUTES.CAMPAIGN_INVITATION,
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Fetch finished campaigns for a brand
   * A campaign is finished when status is COMPLETED or CANCELLED
   */
  async fetchFinishedCampaigns(brandId: number, campaignMode?: string, searchQuery?: string): Promise<Campaign[]> {
    const whereCondition: any = {
      brandId,
      status: {
        [Op.in]: [CampaignStatus.COMPLETED, CampaignStatus.CANCELLED],
      },
    };

    this.applyCampaignModeFilter(whereCondition, campaignMode);
    this.applySearchFilter(whereCondition, searchQuery);

    return this.campaignModel.findAll({
      where: whereCondition,
      include: this.getBaseIncludeOptions(),
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Fetch all campaigns for a brand (excludes drafts)
   */
  async fetchAllCampaigns(brandId: number, campaignMode?: string, searchQuery?: string): Promise<Campaign[]> {
    const whereCondition: any = {
      brandId,
      status: {
        [Op.ne]: CampaignStatus.DRAFT, // Exclude draft campaigns
      },
    };

    this.applyCampaignModeFilter(whereCondition, campaignMode);
    this.applySearchFilter(whereCondition, searchQuery);

    return this.campaignModel.findAll({
      where: whereCondition,
      include: [
        ...this.getBaseIncludeOptions(),
        {
          model: CampaignInvitation,
          attributes: MODEL_ATTRIBUTES.CAMPAIGN_INVITATION,
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Apply searchQuery filter on campaign name to a where condition object.
   */
  private applySearchFilter(whereCondition: any, searchQuery?: string): void {
    if (searchQuery && searchQuery.trim()) {
      whereCondition.name = { [Op.iLike]: `%${searchQuery.trim()}%` };
    }
  }

  /**
   * Apply campaignMode filter to a where condition object.
   * - openForAll: non-invite-only, non-MAX campaigns
   * - maxCampaign: boosted MAX campaigns (isMaxCampaign: true)
   * - inviteOnly: invite-only campaigns (isInviteOnly: true)
   */
  private applyCampaignModeFilter(whereCondition: any, campaignMode?: string): void {
    if (!campaignMode) return;

    switch (campaignMode) {
      case 'openForAll':
        whereCondition.isInviteOnly = false;
        whereCondition.isMaxCampaign = false;
        break;
      case 'maxCampaign':
        whereCondition.isMaxCampaign = true;
        break;
      case 'inviteOnly':
        whereCondition.isInviteOnly = true;
        break;
    }
  }

  /**
   * Get campaigns by category with stats
   * @param brandId - Brand ID
   * @param type - Category type (open, invite, finished, all)
   * @param campaignType - Optional filter by campaign type (paid, barter, ugc, engagement)
   * @param campaignMode - Optional filter by mode (openForAll, maxCampaign, inviteOnly)
   */
  async getCampaignsByCategory(
    brandId: number,
    type?: string,
    campaignType?: string,
    campaignMode?: string,
    searchQuery?: string,
  ): Promise<CampaignWithStats[]> {
    let campaigns: Campaign[];
    let statsProcessor: (campaign: Campaign) => CampaignWithStats;

    switch (type) {
      case 'open':
        campaigns = await this.fetchOpenCampaigns(brandId, campaignType, campaignMode, searchQuery);
        statsProcessor = (c) => CampaignStatsHelper.addApplicationCount(c);
        break;

      case 'invite':
        campaigns = await this.fetchInviteCampaigns(brandId, campaignMode, searchQuery);
        statsProcessor = (c) => CampaignStatsHelper.addInviteCount(c);
        break;

      case 'draft':
        campaigns = await this.fetchDraftCampaigns(brandId, campaignMode, searchQuery);
        statsProcessor = (c) => c.toJSON();
        break;

      case 'finished':
        campaigns = await this.fetchFinishedCampaigns(brandId, campaignMode, searchQuery);
        statsProcessor = (c) => c.toJSON();
        break;

      default:
        // No type specified - return all campaigns
        campaigns = await this.fetchAllCampaigns(brandId, campaignMode, searchQuery);
        statsProcessor = (c) => CampaignStatsHelper.addStatsBasedOnType(c);
        break;
    }

    return CampaignStatsHelper.addStatsToCampaigns(campaigns, statsProcessor);
  }
}
