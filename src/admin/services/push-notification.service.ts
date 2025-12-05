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
import { City } from '../../shared/models/city.model';
import { NotificationService } from '../../shared/notification.service';
import { AuditLogService } from './audit-log.service';
import { AuditActionType } from '../models/audit-log.model';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  GetNotificationsDto,
  NotificationResponseDto,
  NotificationListResponseDto,
  // BulkNotificationUploadDto,
  // BulkNotificationResponseDto,
  // BulkNotificationRecipient,
} from '../dto/push-notification.dto';
// import * as XLSX from 'xlsx';

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
    @InjectModel(City)
    private readonly cityModel: typeof City,
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
    const commonWhere: any = {};
    let cityIds: number[] = [];

    // Convert city names to city IDs if location filter is specified (unless Pan-India)
    if (
      !notification.isPanIndia &&
      notification.locations &&
      notification.locations.length > 0
    ) {
      const cities = await this.cityModel.findAll({
        where: {
          name: {
            [Op.in]: notification.locations,
          },
        },
        attributes: ['id'],
      });
      cityIds = cities.map((city) => city.id);
    }

    // Add gender filter if specified and not 'all'
    if (
      notification.genderFilter &&
      notification.genderFilter !== GenderFilter.ALL
    ) {
      commonWhere.gender = notification.genderFilter;
    }

    // Note: Age filter disabled - Influencer/Brand models don't have age column
    // if (notification.minAge || notification.maxAge) {
    //   commonWhere.age = {};
    //   if (notification.minAge) {
    //     commonWhere.age[Op.gte] = notification.minAge;
    //   }
    //   if (notification.maxAge) {
    //     commonWhere.age[Op.lte] = notification.maxAge;
    //   }
    // }

    let recipients: Array<{ id: number; fcmToken: string }> = [];

    switch (notification.receiverType) {
      case ReceiverType.ALL_USERS: {
        // Get both influencers and brands
        const influencerWhere: any = {
          ...commonWhere,
          fcmToken: { [Op.ne]: null },
          ...(cityIds.length > 0 ? { cityId: { [Op.in]: cityIds } } : {}),
        };

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

        const brandWhere: any = {
          ...commonWhere,
          fcmToken: { [Op.ne]: null },
          ...(cityIds.length > 0 ? { headquarterCityId: { [Op.in]: cityIds } } : {}),
        };

        const influencers = await this.influencerModel.findAll({
          where: influencerWhere,
          attributes: ['id', 'fcmToken'],
        });
        const brands = await this.brandModel.findAll({
          where: brandWhere,
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
          ...commonWhere,
          fcmToken: { [Op.ne]: null },
          ...(cityIds.length > 0 ? { cityId: { [Op.in]: cityIds } } : {}),
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
            ...commonWhere,
            fcmToken: { [Op.ne]: null },
            ...(cityIds.length > 0 ? { headquarterCityId: { [Op.in]: cityIds } } : {}),
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
            ...commonWhere,
            id: { [Op.in]: notification.specificReceivers || [] },
            fcmToken: { [Op.ne]: null },
            ...(cityIds.length > 0 ? { cityId: { [Op.in]: cityIds } } : {}),
          },
          attributes: ['id', 'fcmToken'],
        });
        const specificBrands = await this.brandModel.findAll({
          where: {
            ...commonWhere,
            id: { [Op.in]: notification.specificReceivers || [] },
            fcmToken: { [Op.ne]: null },
            ...(cityIds.length > 0 ? { headquarterCityId: { [Op.in]: cityIds } } : {}),
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

  /**
   * Parse Excel file and extract recipients
   */
  // parseExcelFile(buffer: Buffer): BulkNotificationRecipient[] {
  //   const workbook = XLSX.read(buffer, { type: 'buffer' });
  //   const sheetName = workbook.SheetNames[0];
  //   const worksheet = workbook.Sheets[sheetName];
  //   const data: any[] = XLSX.utils.sheet_to_json(worksheet);

  //   return data.map((row) => ({
  //     name: row.name || row.Name || row.NAME || '',
  //     email: row.email || row.Email || row.EMAIL || '',
  //     phone: row.phone || row.Phone || row.PHONE || row.mobile || row.Mobile || '',
  //   }));
  // }

  // /**
  //  * Find users by email or phone
  //  */
  // async findUsersByEmailOrPhone(
  //   recipients: BulkNotificationRecipient[],
  //   userType: 'influencer' | 'brand',
  // ): Promise<{
  //   matchedUsers: Array<{ id: number; email: string; phone: string }>;
  //   notFoundUsers: BulkNotificationRecipient[];
  // }> {
  //   const emails = recipients.filter((r) => r.email).map((r) => r.email!.toLowerCase().trim());
  //   const phones = recipients.filter((r) => r.phone).map((r) => r.phone!.trim());

  //   // Find users by email or phone
  //   // Note: Brand model only has email, Influencer only has phone
  //   const users = userType === 'influencer'
  //     ? await this.influencerModel.findAll({
  //         where: {
  //           phone: { [Op.in]: phones },
  //         },
  //         attributes: ['id', 'phone', 'fcmToken'],
  //       })
  //     : await this.brandModel.findAll({
  //         where: {
  //           email: { [Op.in]: emails },
  //         },
  //         attributes: ['id', 'email', 'fcmToken'],
  //       });

  //   // Create a map of found users
  //   const foundEmailsMap = new Map<string, number>();
  //   const foundPhonesMap = new Map<string, number>();

  //   users.forEach((user: any) => {
  //     if (userType === 'brand' && user.email) {
  //       foundEmailsMap.set(user.email.toLowerCase(), user.id);
  //     } else if (userType === 'influencer' && user.phone) {
  //       foundPhonesMap.set(user.phone, user.id);
  //     }
  //   });

  //   // Match recipients to users
  //   const matchedUsers: Array<{ id: number; email: string; phone: string }> = [];
  //   const notFoundUsers: BulkNotificationRecipient[] = [];
  //   const processedIds = new Set<number>();

  //   for (const recipient of recipients) {
  //     let userId: number | null = null;

  //     // Try to find by email first
  //     if (recipient.email) {
  //       userId = foundEmailsMap.get(recipient.email.toLowerCase().trim()) || null;
  //     }

  //     // If not found by email, try phone
  //     if (!userId && recipient.phone) {
  //       userId = foundPhonesMap.get(recipient.phone.trim()) || null;
  //     }

  //     if (userId && !processedIds.has(userId)) {
  //       const user: any = users.find((u) => u.id === userId);
  //       if (user && user.fcmToken) {
  //         matchedUsers.push({
  //           id: userId,
  //           email: userType === 'brand' ? (user.email || '') : '',
  //           phone: userType === 'influencer' ? (user.phone || '') : '',
  //         });
  //         processedIds.add(userId);
  //       }
  //     } else if (!userId) {
  //       notFoundUsers.push(recipient);
  //     }
  //   }

  //   return { matchedUsers, notFoundUsers };
  // }

  // /**
  //  * Create bulk notification from Excel upload
  //  */
  // async createBulkNotification(
  //   file: Express.Multer.File,
  //   uploadDto: BulkNotificationUploadDto,
  //   adminId: number,
  // ): Promise<BulkNotificationResponseDto> {
  //   // Parse Excel file
  //   const recipients = this.parseExcelFile(file.buffer);

  //   if (recipients.length === 0) {
  //     throw new BadRequestException(
  //       'No recipients found in Excel file. Please check the file format.',
  //     );
  //   }

  //   // Find matching users in database
  //   const { matchedUsers, notFoundUsers } = await this.findUsersByEmailOrPhone(
  //     recipients,
  //     uploadDto.userType,
  //   );

  //   if (matchedUsers.length === 0) {
  //     throw new BadRequestException(
  //       'No matching users found in database. Please check email/phone numbers.',
  //     );
  //   }

  //   // Create notification with matched user IDs
  //   const receiverType = uploadDto.userType === 'influencer'
  //     ? ReceiverType.INFLUENCERS
  //     : ReceiverType.BRANDS;

  //   const notification = await this.pushNotificationModel.create({
  //     title: uploadDto.title,
  //     body: uploadDto.body,
  //     internalName: `Bulk Upload - ${uploadDto.userType}s - ${new Date().toISOString()}`,
  //     imageUrl: uploadDto.imageUrl || null,
  //     actionUrl: uploadDto.actionUrl || null,
  //     androidChannelId: uploadDto.androidChannelId || null,
  //     sound: uploadDto.sound || null,
  //     priority: uploadDto.priority || null,
  //     badge: uploadDto.badge || null,
  //     threadId: uploadDto.threadId || null,
  //     interruptionLevel: uploadDto.interruptionLevel || null,
  //     receiverType,
  //     specificReceivers: matchedUsers.map((u) => u.id),
  //     status: NotificationStatus.DRAFT,
  //     createdBy: adminId,
  //   } as any);

  //   // Log audit trail
  //   const admin = await this.adminModel.findByPk(adminId);
  //   if (admin) {
  //     await this.auditLogService.logNotificationAction(
  //       {
  //         id: admin.id,
  //         name: admin.name,
  //         email: admin.email,
  //       },
  //       AuditActionType.NOTIFICATION_CREATED,
  //       notification.id,
  //       `Created bulk notification from Excel upload: "${uploadDto.title}" (${matchedUsers.length} recipients)`,
  //     );
  //   }

  //   // Send immediately if requested
  //   let sendResults: { successCount: number; failureCount: number } | undefined = undefined;
  //   if (uploadDto.sendImmediately) {
  //     const sendResponse = await this.sendNotification(notification.id);
  //     sendResults = {
  //       successCount: sendResponse.notification.successCount || 0,
  //       failureCount: sendResponse.notification.failureCount || 0,
  //     };
  //   }

  //   return {
  //     success: true,
  //     message: `Notification created successfully. Matched ${matchedUsers.length} out of ${recipients.length} recipients.`,
  //     notificationId: notification.id,
  //     totalInFile: recipients.length,
  //     matchedUsers: matchedUsers.length,
  //     notFoundUsers: notFoundUsers.length,
  //     notFoundList: notFoundUsers,
  //     status: uploadDto.sendImmediately ? 'sent' : 'draft',
  //     sendResults,
  //   };
  // }

  // /**
  //  * Generate Excel template for bulk upload
  //  */
  // generateExcelTemplate(userType: 'influencer' | 'brand'): Buffer {
  //   const worksheet = XLSX.utils.aoa_to_sheet([
  //     ['name', 'email', 'phone'],
  //     ['John Doe', 'john@example.com', '+919876543210'],
  //     ['Jane Smith', 'jane@example.com', '+919876543211'],
  //     ['', 'user3@example.com', ''],
  //     ['User Four', '', '+919876543212'],
  //   ]);

  //   // Set column widths
  //   worksheet['!cols'] = [
  //     { wch: 20 },
  //     { wch: 30 },
  //     { wch: 15 },
  //   ];

  //   const workbook = XLSX.utils.book_new();
  //   XLSX.utils.book_append_sheet(workbook, worksheet, `${userType}s`);

  //   return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  // }

  // /**
  //  * Parse Excel and return matched user IDs without creating notification
  //  */
  // async parseExcelAndMatchUsers(
  //   file: Express.Multer.File,
  //   userType: 'influencer' | 'brand',
  // ): Promise<{
  //   success: boolean;
  //   message: string;
  //   totalInFile: number;
  //   matchedUsersCount: number;
  //   matchedUserIds: number[];
  //   notFoundUsersCount: number;
  //   notFoundList: BulkNotificationRecipient[];
  // }> {
  //   // Parse Excel file
  //   const recipients = this.parseExcelFile(file.buffer);

  //   if (recipients.length === 0) {
  //     throw new BadRequestException(
  //       'No recipients found in Excel file. Please check the file format.',
  //     );
  //   }

  //   // Find matching users in database
  //   const { matchedUsers, notFoundUsers } = await this.findUsersByEmailOrPhone(
  //     recipients,
  //     userType,
  //   );

  //   if (matchedUsers.length === 0) {
  //     throw new BadRequestException(
  //       'No matching users found in database. Please check email/phone numbers.',
  //     );
  //   }

  //   return {
  //     success: true,
  //     message: `Matched ${matchedUsers.length} out of ${recipients.length} users.`,
  //     totalInFile: recipients.length,
  //     matchedUsersCount: matchedUsers.length,
  //     matchedUserIds: matchedUsers.map((u) => u.id),
  //     notFoundUsersCount: notFoundUsers.length,
  //     notFoundList: notFoundUsers,
  //   };
  // }
}
