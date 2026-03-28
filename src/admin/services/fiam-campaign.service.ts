import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { FiamCampaign, CampaignStatus } from '../../shared/models/fiam-campaign.model';
import {
  CreateFiamCampaignDto,
  UpdateFiamCampaignDto,
  GetFiamCampaignsDto,
  FiamCampaignResponseDto,
  FiamCampaignListResponseDto,
  CampaignAnalyticsDto,
} from '../dto/fiam-campaign.dto';
import { FiamEventService } from '../../shared/services/fiam-event.service';
import { FiamCampaignBroadcastService } from './fiam-campaign-broadcast.service';
import { TriggerType } from '../../shared/models/fiam-campaign.model';
import { Op } from 'sequelize';

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class FiamCampaignService {
  private readonly logger = new Logger(FiamCampaignService.name);

  constructor(
    @InjectModel(FiamCampaign)
    private fiamCampaignModel: typeof FiamCampaign,
    private fiamEventService: FiamEventService,
    private fiamCampaignBroadcastService: FiamCampaignBroadcastService,
  ) {}

  // ============================================================================
  // CREATE
  // ============================================================================

  /**
   * Create a new FIAM campaign
   */
  async createCampaign(
    dto: CreateFiamCampaignDto,
    adminId: number,
  ): Promise<FiamCampaignResponseDto> {
    try {
      // Validate trigger configuration
      this.validateTriggerConfig(dto.triggerType, dto.triggerEvents, dto.scheduledAt);

      // Create campaign
      const campaign = await this.fiamCampaignModel.create({
        name: dto.name,
        internalName: dto.internalName || null,
        description: dto.description || null,
        status: CampaignStatus.DRAFT, // Always start as draft
        priority: dto.priority || 0,
        uiConfig: dto.uiConfig as any,
        triggerType: dto.triggerType,
        triggerEvents: dto.triggerEvents || null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        targetUserTypes: dto.targetUserTypes || null,
        targetGender: dto.targetGender || null,
        targetMinAge: dto.targetMinAge || null,
        targetMaxAge: dto.targetMaxAge || null,
        targetLocations: dto.targetLocations || null,
        targetIsPanIndia: dto.targetIsPanIndia || false,
        targetNicheIds: dto.targetNicheIds || null,
        targetSpecificUserIds: dto.targetSpecificUserIds || null,
        targetBehaviorFilters: dto.targetBehaviorFilters || null,
        frequencyConfig: dto.frequencyConfig || null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        conversionEvent: dto.conversionEvent || null,
        conversionWindowHours: dto.conversionWindowHours || 24,
        createdBy: adminId,
        internalNotes: dto.internalNotes || null,
      } as any);

      this.logger.log(`Campaign created: ${campaign.id} by admin ${adminId}`);

      return this.mapToResponseDto(campaign);
    } catch (error) {
      this.logger.error('Error creating campaign:', error);
      throw error;
    }
  }

  // ============================================================================
  // READ
  // ============================================================================

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: number): Promise<FiamCampaignResponseDto> {
    const campaign = await this.fiamCampaignModel.findByPk(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return this.mapToResponseDto(campaign);
  }

  /**
   * List campaigns with filtering and pagination
   */
  async getCampaigns(
    query: GetFiamCampaignsDto,
  ): Promise<FiamCampaignListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.triggerType) {
      where.triggerType = query.triggerType;
    }

    // Fetch campaigns
    const { count, rows } = await this.fiamCampaignModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    const campaigns = rows.map((campaign) => this.mapToResponseDto(campaign));

    return {
      campaigns,
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Update campaign
   */
  async updateCampaign(
    id: number,
    dto: UpdateFiamCampaignDto,
  ): Promise<FiamCampaignResponseDto> {
    const campaign = await this.fiamCampaignModel.findByPk(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Validate trigger configuration if being updated
    if (dto.triggerType || dto.triggerEvents || dto.scheduledAt) {
      const triggerType = dto.triggerType || campaign.triggerType;
      const triggerEvents = dto.triggerEvents !== undefined
        ? dto.triggerEvents
        : campaign.triggerEvents;
      const scheduledAt = dto.scheduledAt !== undefined
        ? dto.scheduledAt
        : campaign.scheduledAt?.toISOString();

      this.validateTriggerConfig(triggerType, triggerEvents || undefined, scheduledAt || undefined);
    }

    // Update campaign
    await campaign.update({
      ...(dto.name && { name: dto.name }),
      ...(dto.internalName !== undefined && { internalName: dto.internalName }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.uiConfig && { uiConfig: dto.uiConfig }),
      ...(dto.triggerType && { triggerType: dto.triggerType }),
      ...(dto.triggerEvents !== undefined && { triggerEvents: dto.triggerEvents }),
      ...(dto.scheduledAt !== undefined && {
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      }),
      ...(dto.targetUserTypes !== undefined && { targetUserTypes: dto.targetUserTypes }),
      ...(dto.targetGender !== undefined && { targetGender: dto.targetGender }),
      ...(dto.targetMinAge !== undefined && { targetMinAge: dto.targetMinAge }),
      ...(dto.targetMaxAge !== undefined && { targetMaxAge: dto.targetMaxAge }),
      ...(dto.targetLocations !== undefined && { targetLocations: dto.targetLocations }),
      ...(dto.targetIsPanIndia !== undefined && { targetIsPanIndia: dto.targetIsPanIndia }),
      ...(dto.targetNicheIds !== undefined && { targetNicheIds: dto.targetNicheIds }),
      ...(dto.targetSpecificUserIds !== undefined && {
        targetSpecificUserIds: dto.targetSpecificUserIds,
      }),
      ...(dto.targetBehaviorFilters !== undefined && {
        targetBehaviorFilters: dto.targetBehaviorFilters,
      }),
      ...(dto.frequencyConfig !== undefined && { frequencyConfig: dto.frequencyConfig }),
      ...(dto.startDate !== undefined && {
        startDate: dto.startDate ? new Date(dto.startDate) : null,
      }),
      ...(dto.endDate !== undefined && {
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      }),
      ...(dto.conversionEvent !== undefined && { conversionEvent: dto.conversionEvent }),
      ...(dto.conversionWindowHours !== undefined && {
        conversionWindowHours: dto.conversionWindowHours,
      }),
      ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
    });

    this.logger.log(`Campaign updated: ${campaign.id}`);

    return this.mapToResponseDto(campaign);
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    id: number,
    status: CampaignStatus,
  ): Promise<FiamCampaignResponseDto> {
    const campaign = await this.fiamCampaignModel.findByPk(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Validate status transition
    this.validateStatusTransition(campaign.status, status);

    await campaign.update({ status });

    this.logger.log(`Campaign ${id} status changed to ${status}`);

    // If activating a scheduled campaign for immediate broadcast
    if (status === CampaignStatus.ACTIVE && campaign.triggerType === TriggerType.SCHEDULED) {
      const now = new Date();
      const scheduledTime = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;

      // If scheduled for now or past (immediate broadcast)
      if (!scheduledTime || scheduledTime <= now) {
        this.logger.log(`Triggering immediate broadcast for campaign ${id}...`);

        // Fire-and-forget broadcast (don't block response)
        this.fiamCampaignBroadcastService
          .broadcastCampaign(id)
          .catch((error) => {
            this.logger.error(`Failed to broadcast campaign ${id}:`, error);
          });
      } else {
        this.logger.log(`Campaign ${id} scheduled for broadcast at ${scheduledTime.toISOString()}`);
      }
    }

    return this.mapToResponseDto(campaign);
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  /**
   * Delete campaign (soft delete by marking as completed)
   */
  async deleteCampaign(id: number): Promise<{ success: boolean; message: string }> {
    const campaign = await this.fiamCampaignModel.findByPk(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Soft delete: mark as completed instead of hard delete
    await campaign.update({ status: CampaignStatus.COMPLETED });

    this.logger.log(`Campaign deleted (soft): ${id}`);

    return {
      success: true,
      message: `Campaign ${id} has been deleted`,
    };
  }

  /**
   * Permanently delete campaign (use with caution)
   */
  async permanentlyDeleteCampaign(id: number): Promise<{ success: boolean; message: string }> {
    const campaign = await this.fiamCampaignModel.findByPk(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    await campaign.destroy();

    this.logger.warn(`Campaign permanently deleted: ${id}`);

    return {
      success: true,
      message: `Campaign ${id} has been permanently deleted`,
    };
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(id: number): Promise<CampaignAnalyticsDto> {
    const campaign = await this.fiamCampaignModel.findByPk(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return {
      id: campaign.id,
      name: campaign.name,
      totalImpressions: campaign.totalImpressions,
      totalClicks: campaign.totalClicks,
      totalDismissals: campaign.totalDismissals,
      totalConversions: campaign.totalConversions,
      conversionRate: campaign.getConversionRate(),
      clickThroughRate: campaign.getClickThroughRate(),
      dismissalRate: campaign.getDismissalRate(),
    };
  }

  /**
   * Get all campaigns analytics summary
   */
  async getAllCampaignsAnalytics(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageConversionRate: number;
    averageClickThroughRate: number;
  }> {
    const allCampaigns = await this.fiamCampaignModel.findAll();
    const activeCampaigns = allCampaigns.filter(
      (c) => c.status === CampaignStatus.ACTIVE,
    );

    const totalImpressions = allCampaigns.reduce(
      (sum, c) => sum + c.totalImpressions,
      0,
    );
    const totalClicks = allCampaigns.reduce((sum, c) => sum + c.totalClicks, 0);
    const totalConversions = allCampaigns.reduce(
      (sum, c) => sum + c.totalConversions,
      0,
    );

    const avgConversionRate =
      totalImpressions > 0 ? (totalConversions / totalImpressions) * 100 : 0;
    const avgClickThroughRate =
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      totalCampaigns: allCampaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageConversionRate: parseFloat(avgConversionRate.toFixed(2)),
      averageClickThroughRate: parseFloat(avgClickThroughRate.toFixed(2)),
    };
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Validate trigger configuration
   */
  private validateTriggerConfig(
    triggerType: string,
    triggerEvents?: string[],
    scheduledAt?: string,
  ): void {
    if (triggerType === 'event') {
      if (!triggerEvents || triggerEvents.length === 0) {
        throw new BadRequestException(
          'Event-triggered campaigns must have at least one trigger event',
        );
      }
    }

    if (triggerType === 'scheduled') {
      if (!scheduledAt) {
        throw new BadRequestException(
          'Scheduled campaigns must have a scheduledAt time',
        );
      }
    }
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: CampaignStatus,
    newStatus: CampaignStatus,
  ): void {
    // Define invalid transitions
    const invalidTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      [CampaignStatus.DRAFT]: [],
      [CampaignStatus.ACTIVE]: [],
      [CampaignStatus.PAUSED]: [CampaignStatus.DRAFT],
      [CampaignStatus.COMPLETED]: [
        CampaignStatus.DRAFT,
        CampaignStatus.ACTIVE,
        CampaignStatus.PAUSED,
      ],
      [CampaignStatus.EXPIRED]: [
        CampaignStatus.DRAFT,
        CampaignStatus.ACTIVE,
        CampaignStatus.PAUSED,
      ],
    };

    if (invalidTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  /**
   * Map campaign model to response DTO
   */
  private mapToResponseDto(campaign: FiamCampaign): FiamCampaignResponseDto {
    return {
      id: campaign.id,
      name: campaign.name,
      internalName: campaign.internalName,
      description: campaign.description,
      status: campaign.status,
      priority: campaign.priority,
      uiConfig: campaign.uiConfig,
      triggerType: campaign.triggerType,
      triggerEvents: campaign.triggerEvents,
      scheduledAt: campaign.scheduledAt,
      targetUserTypes: campaign.targetUserTypes,
      targetGender: campaign.targetGender,
      targetMinAge: campaign.targetMinAge,
      targetMaxAge: campaign.targetMaxAge,
      targetLocations: campaign.targetLocations,
      targetIsPanIndia: campaign.targetIsPanIndia,
      targetNicheIds: campaign.targetNicheIds,
      targetSpecificUserIds: campaign.targetSpecificUserIds,
      targetBehaviorFilters: campaign.targetBehaviorFilters,
      frequencyConfig: campaign.frequencyConfig,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      totalImpressions: campaign.totalImpressions,
      totalClicks: campaign.totalClicks,
      totalDismissals: campaign.totalDismissals,
      totalConversions: campaign.totalConversions,
      conversionEvent: campaign.conversionEvent,
      conversionWindowHours: campaign.conversionWindowHours,
      createdBy: campaign.createdBy,
      internalNotes: campaign.internalNotes,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      analytics: {
        id: campaign.id,
        name: campaign.name,
        totalImpressions: campaign.totalImpressions,
        totalClicks: campaign.totalClicks,
        totalDismissals: campaign.totalDismissals,
        totalConversions: campaign.totalConversions,
        conversionRate: campaign.getConversionRate(),
        clickThroughRate: campaign.getClickThroughRate(),
        dismissalRate: campaign.getDismissalRate(),
      },
    };
  }
}
