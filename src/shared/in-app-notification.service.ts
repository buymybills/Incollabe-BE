import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { InAppNotification, NotificationType, NotificationPriority } from './models/in-app-notification.model';
import {
  CreateInAppNotificationDto,
  GetNotificationsDto,
  MarkNotificationsReadDto,
  GetNotificationsResponseDto,
  MarkAsReadResponseDto,
  UnreadCountResponseDto,
} from './dto/in-app-notification.dto';
import { Op } from 'sequelize';

@Injectable()
export class InAppNotificationService {
  constructor(
    @InjectModel(InAppNotification)
    private inAppNotificationModel: typeof InAppNotification,
  ) {}

  /**
   * Create a new in-app notification
   * This is called internally when you want to save a notification to the database
   */
  async createNotification(
    dto: CreateInAppNotificationDto,
  ): Promise<InAppNotification> {
    console.log('💾 IN-APP NOTIFICATION SERVICE - Received create request:', {
      userId: dto.userId,
      userType: dto.userType,
      type: dto.type,
      metadata: dto.metadata,
      metadataStringified: JSON.stringify(dto.metadata),
    });

    const notification = await this.inAppNotificationModel.create({
      userId: dto.userId,
      userType: dto.userType,
      title: dto.title,
      body: dto.body,
      type: dto.type,
      actionUrl: dto.actionUrl,
      actionType: dto.actionType,
      imageUrl: dto.imageUrl,
      relatedEntityType: dto.relatedEntityType,
      relatedEntityId: dto.relatedEntityId,
      metadata: dto.metadata,
      priority: dto.priority || NotificationPriority.NORMAL,
      expiresAt: dto.expiresAt,
      isRead: false,
    } as any);

    console.log('✅ IN-APP NOTIFICATION SERVICE - Notification created in DB:', {
      id: notification.id,
      userId: notification.userId,
      userType: notification.userType,
      type: notification.type,
      metadata: notification.metadata,
      metadataStringified: JSON.stringify(notification.metadata),
    });

    return notification;
  }

  /**
   * Bulk create notifications (useful for sending to multiple users)
   */
  async createBulkNotifications(
    dtos: CreateInAppNotificationDto[],
  ): Promise<InAppNotification[]> {
    return await this.inAppNotificationModel.bulkCreate(
      dtos.map((dto) => ({
        userId: dto.userId,
        userType: dto.userType,
        title: dto.title,
        body: dto.body,
        type: dto.type,
        actionUrl: dto.actionUrl,
        actionType: dto.actionType,
        imageUrl: dto.imageUrl,
        relatedEntityType: dto.relatedEntityType,
        relatedEntityId: dto.relatedEntityId,
        metadata: dto.metadata,
        priority: dto.priority || NotificationPriority.NORMAL,
        expiresAt: dto.expiresAt,
        isRead: false,
      })) as any,
    );
  }

  /**
   * Get latest 30 notifications for a user with unread count
   * Always returns top 30 most recent notifications
   * Always includes unread count for bell icon badge
   */
  async getNotifications(
    userId: number,
    userType: 'influencer' | 'brand',
    filters: GetNotificationsDto,
  ): Promise<GetNotificationsResponseDto> {
    const { isRead, type, types } = filters;

    // Build where clause for fetching notifications
    const where: any = {
      userId,
      userType,
      // Exclude expired notifications
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } },
      ],
    };

    // Optional filter by read status
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    // Optional filter by notification type(s)
    if (type) {
      where.type = type;
    } else if (types && types.length > 0) {
      where.type = { [Op.in]: types };
    }

    // Get total unread count (always calculated, regardless of filters)
    const unreadCount = await this.inAppNotificationModel.count({
      where: {
        userId,
        userType,
        isRead: false,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
    });

    // Get latest 30 notifications (with filters applied)
    const notifications = await this.inAppNotificationModel.findAll({
      where,
      order: [
        ['isRead', 'ASC'], // Unread first
        ['createdAt', 'DESC'], // Newest first
      ],
      limit: 30,
    });

    // Get total count of notifications matching filters
    const total = await this.inAppNotificationModel.count({ where });

    return {
      notifications: notifications.map((n) => n.toJSON()),
      unreadCount, // Always included (0 if all read)
      total,
      page: 1,
      limit: 30,
      totalPages: Math.ceil(total / 30),
    };
  }

  /**
   * Get unread count only (for badge display)
   */
  async getUnreadCount(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.inAppNotificationModel.count({
      where: {
        userId,
        userType,
        isRead: false,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
    });

    // Get breakdown by type
    const unreadNotifications = await this.inAppNotificationModel.findAll({
      where: {
        userId,
        userType,
        isRead: false,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
      attributes: ['type'],
    });

    const byType: Record<string, number> = {};
    unreadNotifications.forEach((n) => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    return {
      unreadCount,
      byType,
    };
  }

  /**
   * Mark notification(s) as read
   */
  async markAsRead(
    userId: number,
    userType: 'influencer' | 'brand',
    dto: MarkNotificationsReadDto,
  ): Promise<MarkAsReadResponseDto> {
    const where: any = {
      userId,
      userType,
      isRead: false,
    };

    // If specific IDs provided, mark only those
    if (dto.notificationIds && dto.notificationIds.length > 0) {
      where.id = { [Op.in]: dto.notificationIds };
    }

    // Update notifications
    const [markedCount] = await this.inAppNotificationModel.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      { where },
    );

    return {
      markedCount,
      message:
        markedCount === 0
          ? 'No notifications to mark as read'
          : `${markedCount} notification(s) marked as read`,
    };
  }

  /**
   * Mark a single notification as read
   */
  async markSingleAsRead(
    notificationId: number,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<InAppNotification> {
    const notification = await this.inAppNotificationModel.findOne({
      where: {
        id: notificationId,
        userId,
        userType,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return notification; // Already read, no need to update
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<MarkAsReadResponseDto> {
    const [markedCount] = await this.inAppNotificationModel.update(
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        where: {
          userId,
          userType,
          isRead: false,
        },
      },
    );

    return {
      markedCount,
      message:
        markedCount === 0
          ? 'No unread notifications'
          : `All ${markedCount} notification(s) marked as read`,
    };
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: number,
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<void> {
    const notification = await this.inAppNotificationModel.findOne({
      where: {
        id: notificationId,
        userId,
        userType,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await notification.destroy();
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<{ deletedCount: number }> {
    const deletedCount = await this.inAppNotificationModel.destroy({
      where: {
        userId,
        userType,
      },
    });

    return { deletedCount };
  }

  /**
   * Delete old read notifications (cleanup job - can be run via cron)
   */
  async deleteOldReadNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deletedCount = await this.inAppNotificationModel.destroy({
      where: {
        isRead: true,
        readAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    return deletedCount;
  }

  /**
   * Delete expired notifications (cleanup job - can be run via cron)
   */
  async deleteExpiredNotifications(): Promise<number> {
    const deletedCount = await this.inAppNotificationModel.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
    });

    return deletedCount;
  }
}
