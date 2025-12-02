import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  PushNotification,
  NotificationStatus,
  ReceiverType,
  GenderFilter,
} from '../models/push-notification.model';
import { Admin } from '../models/admin.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { InfluencerNiche } from '../../auth/model/influencer-niche.model';
import { NotificationService } from '../../shared/notification.service';
import { AuditLogService } from './audit-log.service';
import { AuditActionType } from '../models/audit-log.model';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  GetNotificationsDto,
  NotificationResponseDto,
  NotificationListResponseDto,
} from '../dto/push-notification.dto';

@Injectable()
export class PushNotificationService {
  constructor(
    @InjectModel(PushNotification)
    private readonly pushNotificationModel: typeof PushNotification,
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(InfluencerNiche)
    private readonly influencerNicheModel: typeof InfluencerNiche,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createNotification(
    createDto: CreateNotificationDto,
    adminId: number,
  ): Promise<NotificationResponseDto> {
    // Validate specific receivers if needed
    if (
      [
        ReceiverType.SPECIFIC_USERS,
        ReceiverType.BRANDS,
        ReceiverType.INFLUENCERS,
      ].includes(createDto.receiverType)
    ) {
      if (
        !createDto.specificReceivers ||
        createDto.specificReceivers.length === 0
      ) {
        throw new BadRequestException(
          'specificReceivers is required for this receiver type',
        );
      }
    }

    // Determine initial status
    const status = createDto.scheduledAt
      ? NotificationStatus.SCHEDULED
      : NotificationStatus.DRAFT;

    const notification = await this.pushNotificationModel.create({
      title: createDto.title,
      body: createDto.body,
      internalName: createDto.internalName || null,
      imageUrl: createDto.imageUrl || null,
      actionUrl: createDto.actionUrl || null,
      androidChannelId: createDto.androidChannelId || null,
      sound: createDto.sound || null,
      priority: createDto.priority || null,
      expirationHours: createDto.expirationHours || null,
      badge: createDto.badge || null,
      threadId: createDto.threadId || null,
      interruptionLevel: createDto.interruptionLevel || null,
      customData: createDto.customData || null,
      receiverType: createDto.receiverType,
      specificReceivers: createDto.specificReceivers || null,
      locations: createDto.locations || null,
      genderFilter: createDto.genderFilter || null,
      minAge: createDto.minAge || null,
      maxAge: createDto.maxAge || null,
      nicheIds: createDto.nicheIds || null,
      isPanIndia: createDto.isPanIndia || false,
      status,
      scheduledAt: createDto.scheduledAt
        ? new Date(createDto.scheduledAt)
        : null,
      metadata: createDto.metadata || null,
      createdBy: adminId,
    } as any);

    const createdNotification = await this.pushNotificationModel.findByPk(
      notification.id,
      {
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    );

    if (!createdNotification) {
      throw new NotFoundException('Failed to retrieve created notification');
    }

    // Log audit trail
    const admin = await this.adminModel.findByPk(adminId);
    if (admin) {
      await this.auditLogService.logNotificationAction(
        {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
        AuditActionType.NOTIFICATION_CREATED,
        notification.id,
        `Created notification: "${createDto.title}" (${createDto.receiverType})`,
      );
    }

    return this.formatNotificationResponse(createdNotification);
  }

  async updateNotification(
    notificationId: number,
    updateDto: UpdateNotificationDto,
    adminId: number,
  ): Promise<NotificationResponseDto> {
    const notification =
      await this.pushNotificationModel.findByPk(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Only allow updating draft or scheduled notifications
    if (
      ![NotificationStatus.DRAFT, NotificationStatus.SCHEDULED].includes(
        notification.status,
      )
    ) {
      throw new ForbiddenException(
        'Cannot update sent or failed notifications',
      );
    }

    // Validate specific receivers if receiver type is changing
    if (updateDto.receiverType) {
      if (
        [
          ReceiverType.SPECIFIC_USERS,
          ReceiverType.BRANDS,
          ReceiverType.INFLUENCERS,
        ].includes(updateDto.receiverType)
      ) {
        if (
          !updateDto.specificReceivers ||
          updateDto.specificReceivers.length === 0
        ) {
          throw new BadRequestException(
            'specificReceivers is required for this receiver type',
          );
        }
      }
    }

    // Update status if scheduledAt is being set or removed
    let status = notification.status;
    if (updateDto.scheduledAt !== undefined) {
      status = updateDto.scheduledAt
        ? NotificationStatus.SCHEDULED
        : NotificationStatus.DRAFT;
    }

    await notification.update({
      ...updateDto,
      status,
      scheduledAt: updateDto.scheduledAt
        ? new Date(updateDto.scheduledAt)
        : notification.scheduledAt,
    });

    const updatedNotification = await this.pushNotificationModel.findByPk(
      notificationId,
      {
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    );

    if (!updatedNotification) {
      throw new NotFoundException('Failed to retrieve updated notification');
    }

    return this.formatNotificationResponse(updatedNotification);
  }

  async getNotifications(
    filters: GetNotificationsDto,
  ): Promise<NotificationListResponseDto> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.receiverType) {
      where.receiverType = filters.receiverType;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt[Op.gte] = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt[Op.lte] = new Date(filters.endDate);
      }
    }

    const { rows, count } = await this.pushNotificationModel.findAndCountAll({
      where,
      include: [
        {
          model: Admin,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      notifications: rows.map((notification) =>
        this.formatNotificationResponse(notification),
      ),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getNotificationById(
    notificationId: number,
  ): Promise<NotificationResponseDto> {
    const notification = await this.pushNotificationModel.findByPk(
      notificationId,
      {
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.formatNotificationResponse(notification);
  }

  async deleteNotification(notificationId: number): Promise<void> {
    const notification =
      await this.pushNotificationModel.findByPk(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Only allow deleting draft notifications
    if (notification.status !== NotificationStatus.DRAFT) {
      throw new ForbiddenException('Can only delete draft notifications');
    }

    await notification.destroy();
  }

  async sendNotification(
    notificationId: number,
  ): Promise<{ message: string; notification: NotificationResponseDto }> {
    const notification =
      await this.pushNotificationModel.findByPk(notificationId);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Only allow sending draft or scheduled notifications
    if (
      ![NotificationStatus.DRAFT, NotificationStatus.SCHEDULED].includes(
        notification.status,
      )
    ) {
      throw new ForbiddenException('Notification has already been sent');
    }

    // Get recipients based on receiver type
    const recipients = await this.getRecipients(notification);

    if (recipients.length === 0) {
      throw new BadRequestException(
        'No recipients found for this notification',
      );
    }

    // Update notification status to sending
    await notification.update({
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      totalRecipients: recipients.length,
    });

    // Send notifications to all recipients
    let successCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      try {
        if (recipient.fcmToken) {
          await this.notificationService.sendCustomNotification(
            recipient.fcmToken,
            notification.title,
            notification.body,
            {
              ...(notification.metadata || {}),
              ...(notification.customData || {}),
            },
            {
              imageUrl: notification.imageUrl || undefined,
              actionUrl: notification.actionUrl || undefined,
              androidChannelId: notification.androidChannelId || undefined,
              sound: notification.sound || undefined,
              priority: notification.priority || undefined,
              expirationHours: notification.expirationHours || undefined,
              badge: notification.badge || undefined,
              threadId: notification.threadId || undefined,
              interruptionLevel: notification.interruptionLevel || undefined,
            },
          );
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to send notification to ${recipient.id}:`, error);
        failureCount++;
      }
    }

    // Update notification with results
    await notification.update({
      successCount,
      failureCount,
      status:
        failureCount === recipients.length
          ? NotificationStatus.FAILED
          : NotificationStatus.SENT,
    });

    const updatedNotification = await this.pushNotificationModel.findByPk(
      notificationId,
      {
        include: [
          {
            model: Admin,
            as: 'creator',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    );

    if (!updatedNotification) {
      throw new NotFoundException(
        'Failed to retrieve notification after sending',
      );
    }

    return {
      message: `Notification sent successfully to ${successCount} out of ${recipients.length} recipients`,
      notification: this.formatNotificationResponse(updatedNotification),
    };
  }

  private async getRecipients(
    notification: PushNotification,
  ): Promise<Array<{ id: number; fcmToken: string }>> {
    const where: any = {};

    // Add location filter if specified (unless Pan-India)
    if (
      !notification.isPanIndia &&
      notification.locations &&
      notification.locations.length > 0
    ) {
      where.city = {
        [Op.in]: notification.locations,
      };
    }

    // Add gender filter if specified and not 'all'
    if (
      notification.genderFilter &&
      notification.genderFilter !== GenderFilter.ALL
    ) {
      where.gender = notification.genderFilter;
    }

    // Add age filter if specified
    if (notification.minAge || notification.maxAge) {
      where.age = {};
      if (notification.minAge) {
        where.age[Op.gte] = notification.minAge;
      }
      if (notification.maxAge) {
        where.age[Op.lte] = notification.maxAge;
      }
    }

    let recipients: Array<{ id: number; fcmToken: string }> = [];

    switch (notification.receiverType) {
      case ReceiverType.ALL_USERS: {
        // Get both influencers and brands
        const influencerWhere: any = { ...where, fcmToken: { [Op.ne]: null } };

        // Apply niche filter for influencers if specified
        if (notification.nicheIds && notification.nicheIds.length > 0) {
          const influencersWithNiches = await this.influencerNicheModel.findAll(
            {
              where: {
                nicheId: { [Op.in]: notification.nicheIds },
              },
              attributes: ['influencerId'],
              group: ['influencerId'],
            },
          );

          const influencerIds = influencersWithNiches.map(
            (in_) => in_.influencerId,
          );

          if (influencerIds.length > 0) {
            influencerWhere.id = { [Op.in]: influencerIds };
          } else {
            // No influencers match niche filter
            influencerWhere.id = { [Op.in]: [] }; // Empty array to return no results
          }
        }

        const influencers = await this.influencerModel.findAll({
          where: influencerWhere,
          attributes: ['id', 'fcmToken'],
        });
        const brands = await this.brandModel.findAll({
          where: { ...where, fcmToken: { [Op.ne]: null } },
          attributes: ['id', 'fcmToken'],
        });
        recipients = [
          ...influencers.map((i) => ({ id: i.id, fcmToken: i.fcmToken })),
          ...brands.map((b) => ({ id: b.id, fcmToken: b.fcmToken })),
        ];
        break;
      }

      case ReceiverType.ALL_INFLUENCERS:
      case ReceiverType.INFLUENCERS: {
        const influencerWhere: any = {
          ...where,
          fcmToken: { [Op.ne]: null },
          ...(notification.receiverType === ReceiverType.INFLUENCERS &&
          notification.specificReceivers
            ? { id: { [Op.in]: notification.specificReceivers } }
            : {}),
        };

        // Apply niche filter if specified
        if (notification.nicheIds && notification.nicheIds.length > 0) {
          // Get influencer IDs that have any of the specified niches
          const influencersWithNiches = await this.influencerNicheModel.findAll(
            {
              where: {
                nicheId: { [Op.in]: notification.nicheIds },
              },
              attributes: ['influencerId'],
              group: ['influencerId'],
            },
          );

          const influencerIds = influencersWithNiches.map(
            (in_) => in_.influencerId,
          );

          if (influencerIds.length > 0) {
            // If specificReceivers is already set, intersect with niche-filtered IDs
            if (influencerWhere.id) {
              influencerWhere.id = {
                [Op.and]: [influencerWhere.id, { [Op.in]: influencerIds }],
              };
            } else {
              influencerWhere.id = { [Op.in]: influencerIds };
            }
          } else {
            // No influencers match the niche filter, return empty
            recipients = [];
            break;
          }
        }

        const targetInfluencers = await this.influencerModel.findAll({
          where: influencerWhere,
          attributes: ['id', 'fcmToken'],
        });
        recipients = targetInfluencers.map((i) => ({
          id: i.id,
          fcmToken: i.fcmToken,
        }));
        break;
      }

      case ReceiverType.ALL_BRANDS:
      case ReceiverType.BRANDS: {
        const targetBrands = await this.brandModel.findAll({
          where: {
            ...where,
            fcmToken: { [Op.ne]: null },
            ...(notification.receiverType === ReceiverType.BRANDS &&
            notification.specificReceivers
              ? { id: { [Op.in]: notification.specificReceivers } }
              : {}),
          },
          attributes: ['id', 'fcmToken'],
        });
        recipients = targetBrands.map((b) => ({
          id: b.id,
          fcmToken: b.fcmToken,
        }));
        break;
      }

      case ReceiverType.SPECIFIC_USERS: {
        // This would require additional logic to determine if IDs are influencers or brands
        // For now, try both
        const specificInfluencers = await this.influencerModel.findAll({
          where: {
            ...where,
            id: { [Op.in]: notification.specificReceivers || [] },
            fcmToken: { [Op.ne]: null },
          },
          attributes: ['id', 'fcmToken'],
        });
        const specificBrands = await this.brandModel.findAll({
          where: {
            ...where,
            id: { [Op.in]: notification.specificReceivers || [] },
            fcmToken: { [Op.ne]: null },
          },
          attributes: ['id', 'fcmToken'],
        });
        recipients = [
          ...specificInfluencers.map((i) => ({
            id: i.id,
            fcmToken: i.fcmToken,
          })),
          ...specificBrands.map((b) => ({ id: b.id, fcmToken: b.fcmToken })),
        ];
        break;
      }
    }

    return recipients;
  }

  private formatNotificationResponse(
    notification: PushNotification,
  ): NotificationResponseDto {
    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      internalName: notification.internalName,
      imageUrl: notification.imageUrl,
      actionUrl: notification.actionUrl,
      androidChannelId: notification.androidChannelId,
      sound: notification.sound,
      priority: notification.priority,
      expirationHours: notification.expirationHours,
      badge: notification.badge,
      threadId: notification.threadId,
      interruptionLevel: notification.interruptionLevel,
      customData: notification.customData,
      receiverType: notification.receiverType,
      locations: notification.locations || [],
      status: notification.status,
      scheduledAt: notification.scheduledAt,
      sentAt: notification.sentAt,
      totalRecipients: notification.totalRecipients,
      successCount: notification.successCount,
      failureCount: notification.failureCount,
      creator: notification.creator
        ? {
            id: notification.creator.id,
            name: notification.creator.name,
            email: notification.creator.email,
          }
        : {
            id: 0,
            name: 'Unknown',
            email: '',
          },
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}
