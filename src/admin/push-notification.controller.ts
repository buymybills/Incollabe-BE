import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpStatus,
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
import { PushNotificationService } from './services/push-notification.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import type { RequestWithAdmin } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { AdminRole } from './models/admin.model';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  GetNotificationsDto,
  NotificationResponseDto,
  NotificationListResponseDto,
  SendNotificationResponseDto,
} from './dto/push-notification.dto';
import { NotificationStatus } from './models/push-notification.model';

@ApiTags('Admin - Push Notifications')
@Controller('admin/notifications')
@UseGuards(AdminAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({
    summary: 'Create new notification',
    description: 'Create a new push notification (draft or scheduled)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notification created successfully',
    type: NotificationResponseDto,
  })
  async createNotification(
    @Body() createDto: CreateNotificationDto,
    @Req() req: RequestWithAdmin,
  ): Promise<NotificationResponseDto> {
    return await this.pushNotificationService.createNotification(
      createDto,
      req.admin.id,
    );
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({
    summary: 'Get all notifications',
    description: 'Get list of push notifications with filters and pagination',
  })
  @ApiQuery({ name: 'status', enum: NotificationStatus, required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notifications retrieved successfully',
    type: NotificationListResponseDto,
  })
  async getNotifications(
    @Query() filters: GetNotificationsDto,
  ): Promise<NotificationListResponseDto> {
    return await this.pushNotificationService.getNotifications(filters);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({
    summary: 'Get notification by ID',
    description: 'Get detailed information about a specific notification',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification retrieved successfully',
    type: NotificationResponseDto,
  })
  async getNotificationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificationResponseDto> {
    return await this.pushNotificationService.getNotificationById(id);
  }

  @Put(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({
    summary: 'Update notification',
    description: 'Update a draft or scheduled notification',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification updated successfully',
    type: NotificationResponseDto,
  })
  async updateNotification(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateNotificationDto,
    @Req() req: RequestWithAdmin,
  ): Promise<NotificationResponseDto> {
    return await this.pushNotificationService.updateNotification(
      id,
      updateDto,
      req.admin.id,
    );
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a draft notification',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification deleted successfully',
  })
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.pushNotificationService.deleteNotification(id);
    return { message: 'Notification deleted successfully' };
  }

  @Post(':id/send')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({
    summary: 'Send notification',
    description: 'Send a draft or scheduled notification immediately',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification sent successfully',
    type: SendNotificationResponseDto,
  })
  async sendNotification(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SendNotificationResponseDto> {
    return await this.pushNotificationService.sendNotification(id);
  }
}
