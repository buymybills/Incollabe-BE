import {
  Controller,
  Get,
  Put,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
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
  MarkNotificationsReadDto,
  GetNotificationsResponseDto,
  MarkAsReadResponseDto,
  DeleteNotificationResponseDto,
  UnreadCountResponseDto,
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
    summary: 'Get all notifications',
    description:
      'Get paginated list of notifications for the authenticated user.\n\n' +
      '**Features:**\n' +
      '- Pagination support\n' +
      '- Filter by read/unread status\n' +
      '- Filter by notification type(s)\n' +
      '- Unread notifications shown first\n' +
      '- Expired notifications are excluded\n' +
      '- Returns unread count for badge display\n\n' +
      '**Query Parameters:**\n' +
      '- `isRead=false` - Get only unread notifications (DEFAULT behavior for notification center)\n' +
      '- `isRead=true` - Get only read notifications\n' +
      '- (no isRead parameter) - Get all notifications\n' +
      '- `type=campaign_invite` - Filter by specific type\n' +
      '- `types=campaign_invite,new_message` - Filter by multiple types',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read status (true=read only, false=unread only, omit=all)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by single notification type',
  })
  @ApiQuery({
    name: 'types',
    required: false,
    type: [String],
    description: 'Filter by multiple notification types (comma-separated)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: GetNotificationsResponseDto,
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
            imageUrl: 'https://example.com/campaign-image.jpg',
            relatedEntityType: 'campaign',
            relatedEntityId: 225,
            metadata: {
              campaignId: 225,
              brandName: 'FashionBrand',
            },
            isRead: false,
            readAt: null,
            priority: 'high',
            expiresAt: null,
            createdAt: '2026-03-16T10:00:00.000Z',
            updatedAt: '2026-03-16T10:00:00.000Z',
          },
        ],
        unreadCount: 5,
        total: 25,
        page: 1,
        limit: 20,
        totalPages: 2,
      },
    },
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

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notifications count',
    description:
      'Get the total count of unread notifications for badge display.\n\n' +
      'Also includes a breakdown by notification type for more granular UI updates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    type: UnreadCountResponseDto,
    schema: {
      example: {
        unreadCount: 5,
        byType: {
          campaign_invite: 2,
          new_message: 2,
          payment_received: 1,
        },
      },
    },
  })
  async getUnreadCount(
    @Req() req: RequestWithUser,
  ): Promise<UnreadCountResponseDto> {
    return await this.notificationService.getUnreadCount(
      req.user.id,
      req.user.userType,
    );
  }

  @Put('mark-read')
  @ApiOperation({
    summary: 'Mark notification(s) as read',
    description:
      'Mark specific notifications as read, or mark all as read if no IDs provided.\n\n' +
      '**Usage:**\n' +
      '- With `notificationIds`: Marks specific notifications as read\n' +
      '- Without `notificationIds`: Marks ALL unread notifications as read',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read',
    type: MarkAsReadResponseDto,
    schema: {
      example: {
        markedCount: 3,
        message: '3 notification(s) marked as read',
      },
    },
  })
  async markAsRead(
    @Req() req: RequestWithUser,
    @Body() dto: MarkNotificationsReadDto,
  ): Promise<MarkAsReadResponseDto> {
    return await this.notificationService.markAsRead(
      req.user.id,
      req.user.userType,
      dto,
    );
  }

  @Put(':id/mark-read')
  @ApiOperation({
    summary: 'Mark a single notification as read',
    description: 'Mark a specific notification as read by ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markSingleAsRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) notificationId: number,
  ) {
    return await this.notificationService.markSingleAsRead(
      notificationId,
      req.user.id,
      req.user.userType,
    );
  }

  @Put('mark-all-read')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    type: MarkAsReadResponseDto,
    schema: {
      example: {
        markedCount: 10,
        message: 'All 10 notification(s) marked as read',
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

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a notification',
    description: 'Delete a specific notification by ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    type: DeleteNotificationResponseDto,
    schema: {
      example: {
        message: 'Notification deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async deleteNotification(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) notificationId: number,
  ): Promise<DeleteNotificationResponseDto> {
    await this.notificationService.deleteNotification(
      notificationId,
      req.user.id,
      req.user.userType,
    );
    return { message: 'Notification deleted successfully' };
  }

  @Delete()
  @ApiOperation({
    summary: 'Delete all notifications',
    description: 'Delete all notifications for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted successfully',
    schema: {
      example: {
        message: 'All notifications deleted successfully',
        deletedCount: 25,
      },
    },
  })
  async deleteAllNotifications(@Req() req: RequestWithUser) {
    const result = await this.notificationService.deleteAllNotifications(
      req.user.id,
      req.user.userType,
    );
    return {
      message: 'All notifications deleted successfully',
      ...result,
    };
  }
}
