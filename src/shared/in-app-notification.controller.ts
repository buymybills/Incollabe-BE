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
    summary: 'Get notifications or unread count',
    description:
      'Flexible endpoint to get notifications with different modes:\n\n' +
      '**Mode 1: Get notification list (default)**\n' +
      '- `GET /notifications` → Returns paginated notification list with unread count\n' +
      '- `GET /notifications?isRead=false` → Returns only unread notifications\n' +
      '- `GET /notifications?page=2&limit=10` → Paginated results\n\n' +
      '**Mode 2: Get unread count only (for badge)**\n' +
      '- `GET /notifications?countOnly=true` → Returns only unread count (no notification list)\n\n' +
      '**Features:**\n' +
      '- Pagination support\n' +
      '- Filter by read/unread status\n' +
      '- Filter by notification type(s)\n' +
      '- Unread notifications shown first\n' +
      '- Expired notifications are excluded\n' +
      '- Always includes unread count for badge display\n\n' +
      '💡 **Recommended Usage:**\n' +
      '- Notification center screen → Mode 1 (full list)\n' +
      '- App badge / toolbar badge → Mode 2 (count only)',
  })
  @ApiQuery({
    name: 'countOnly',
    required: false,
    type: Boolean,
    description: 'Return only unread count (no list). Use for badge display.',
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
    description: 'Notifications or count retrieved successfully',
    schema: {
      oneOf: [
        {
          type: 'object',
          description: 'Full notification list response',
          properties: {
            notifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 123 },
                  title: { type: 'string', example: 'New Campaign Invitation' },
                  body: { type: 'string', example: 'FashionBrand has invited you...' },
                  type: { type: 'string', example: 'campaign_invite' },
                  actionUrl: { type: 'string', example: 'app://campaigns/225' },
                  isRead: { type: 'boolean', example: false },
                  priority: { type: 'string', example: 'high' },
                  createdAt: { type: 'string', example: '2026-03-16T10:00:00.000Z' },
                },
              },
            },
            unreadCount: { type: 'number', example: 5 },
            total: { type: 'number', example: 25 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 2 },
          },
        },
        {
          type: 'object',
          description: 'Count only response (when countOnly=true)',
          properties: {
            unreadCount: { type: 'number', example: 5 },
            byType: {
              type: 'object',
              example: {
                campaign_invite: 2,
                new_message: 2,
                payment_received: 1,
              },
            },
          },
        },
      ],
    },
  })
  async getNotifications(
    @Req() req: RequestWithUser,
    @Query() filters: GetNotificationsDto,
  ): Promise<GetNotificationsResponseDto | UnreadCountResponseDto> {
    // Mode 2: Count only
    if (filters.countOnly) {
      return await this.notificationService.getUnreadCount(
        req.user.id,
        req.user.userType,
      );
    }

    // Mode 1: Full notification list
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
    type: MarkAsReadResponseDto,
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
    type: MarkAsReadResponseDto,
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
