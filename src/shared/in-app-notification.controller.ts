import {
  Controller,
  Get,
  Put,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InAppNotificationService } from './in-app-notification.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { RequestWithUser } from '../types/request.types';
import {
  GetNotificationsDto,
  GetNotificationsResponseDto,
  MarkAsReadResponseDto,
} from './dto/in-app-notification.dto';

@ApiTags('In-App Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard)
export class InAppNotificationController {
  constructor(
    private readonly notificationService: InAppNotificationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get latest 30 notifications with unread count',
    description:
      'Returns the latest 30 notifications with unread count for bell icon badge.\n\n' +
      '**Always Returns:**\n' +
      '- Latest 30 notifications (most recent first)\n' +
      '- Unread count (0 if all read)\n' +
      '- Total count matching filters\n\n' +
      '**Features:**\n' +
      '- Unread notifications shown first, then read\n' +
      '- Optional filter by read/unread status\n' +
      '- Optional filter by notification type(s)\n' +
      '- Expired notifications are excluded\n' +
      '- Unread count always included for badge display\n\n' +
      '**Use Cases:**\n' +
      '- Display notification center with latest 30 notifications\n' +
      '- Show unread count on bell icon (unreadCount field)\n' +
      '- Filter to show only unread: `?isRead=false`\n' +
      '- Filter by type: `?type=campaign_invite`',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read status (true=read only, false=unread only, omit=all)',
    example: false,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by single notification type',
    example: 'campaign_invite',
  })
  @ApiQuery({
    name: 'types',
    required: false,
    type: [String],
    description: 'Filter by multiple notification types (comma-separated)',
  })
  @ApiResponse({
    status: 200,
    description: 'Latest 30 notifications with unread count retrieved successfully',
    schema: {
      example: {
        notifications: [
          {
            id: 123,
            title: 'New Campaign Invitation',
            body: 'FashionBrand has invited you to participate in "Summer Campaign 2026"',
            type: 'campaign_invite',
            actionUrl: 'app://campaigns/225',
            actionType: 'view_campaign',
            imageUrl: 'https://example.com/campaign-banner.jpg',
            relatedEntityType: 'campaign',
            relatedEntityId: 225,
            metadata: {
              campaignId: 225,
              brandName: 'FashionBrand',
              campaignName: 'Summer Campaign 2026',
            },
            isRead: false,
            readAt: null,
            priority: 'high',
            expiresAt: null,
            createdAt: '2026-03-16T10:00:00.000Z',
            updatedAt: '2026-03-16T10:00:00.000Z',
          },
          {
            id: 122,
            title: 'Payment Received',
            body: '₹5000 has been credited to your account for "Winter Fashion Campaign"',
            type: 'payment_received',
            actionUrl: 'app://wallet',
            actionType: 'view_wallet',
            imageUrl: null,
            relatedEntityType: 'payment',
            relatedEntityId: 456,
            metadata: {
              amount: 5000,
              currency: 'INR',
              campaignName: 'Winter Fashion Campaign',
            },
            isRead: false,
            readAt: null,
            priority: 'high',
            expiresAt: null,
            createdAt: '2026-03-15T15:30:00.000Z',
            updatedAt: '2026-03-15T15:30:00.000Z',
          },
          {
            id: 121,
            title: 'New Follower',
            body: 'John Doe started following you',
            type: 'new_follower',
            actionUrl: 'app://influencers/42',
            actionType: 'view_profile',
            imageUrl: null,
            relatedEntityType: 'follow',
            relatedEntityId: 789,
            metadata: {
              followerId: 42,
              followerType: 'influencer',
              followerName: 'John Doe',
            },
            isRead: true,
            readAt: '2026-03-15T14:00:00.000Z',
            priority: 'normal',
            expiresAt: null,
            createdAt: '2026-03-15T12:00:00.000Z',
            updatedAt: '2026-03-15T14:00:00.000Z',
          },
        ],
        unreadCount: 2,
        total: 30,
        page: 1,
        limit: 30,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid query parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  async getNotifications(
    @Req() req: RequestWithUser,
    @Query() filters: GetNotificationsDto,
  ): Promise<GetNotificationsResponseDto> {
    return await this.notificationService.getNotifications(
      req.user.id,
      req.user.userType,
      filters,
    );
  }

  @Put('mark-read/all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Mark all unread notifications as read for the current user.\n\n' +
      'Use for "Mark all as read" or "Clear all" button.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      example: {
        markedCount: 15,
        message: 'All 15 notification(s) marked as read',
      },
    },
  })
  async markAllAsRead(
    @Req() req: RequestWithUser,
  ): Promise<MarkAsReadResponseDto> {
    return await this.notificationService.markAllAsRead(
      req.user.id,
      req.user.userType,
    );
  }

  @Put('mark-read/:id')
  @ApiOperation({
    summary: 'Mark single notification as read',
    description:
      'Mark a specific notification as read by ID.\n\n' +
      'Use when user taps on a notification.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID to mark as read',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: {
      example: {
        markedCount: 1,
        message: '1 notification(s) marked as read',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markAsRead(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<MarkAsReadResponseDto> {
    const notificationId = parseInt(id, 10);
    await this.notificationService.markSingleAsRead(
      notificationId,
      req.user.id,
      req.user.userType,
    );
    return {
      markedCount: 1,
      message: '1 notification(s) marked as read',
    };
  }
}
