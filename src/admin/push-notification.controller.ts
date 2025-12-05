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
  // UseInterceptors,
  // UploadedFile,
  // Res,
  // BadRequestException,
} from '@nestjs/common';
// import { FileInterceptor } from '@nestjs/platform-express';
// import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  // ApiConsumes,
  // ApiBody,
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
  // BulkNotificationUploadDto,
  // BulkNotificationResponseDto,
  // ParseExcelDto,
  // ParseExcelResponseDto,
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

  // @Post('parse-excel')
  // @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  // @UseInterceptors(FileInterceptor('file'))
  // @ApiOperation({
  //   summary: 'Parse Excel and get user IDs',
  //   description: 'Upload Excel file to parse and match users without creating notification. Use returned IDs with create/update notification APIs.',
  // })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     required: ['file', 'userType'],
  //     properties: {
  //       file: {
  //         type: 'string',
  //         format: 'binary',
  //         description: 'Excel file (.xlsx) with columns: name, email, phone',
  //       },
  //       userType: {
  //         type: 'string',
  //         enum: ['influencer', 'brand'],
  //         description: 'Type of users in the Excel file',
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Excel parsed successfully, user IDs returned',
  //   type: ParseExcelResponseDto,
  // })
  // async parseExcel(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body() parseDto: ParseExcelDto,
  // ): Promise<ParseExcelResponseDto> {
  //   if (!file) {
  //     throw new BadRequestException('Excel file is required');
  //   }

  //   if (
  //     !file.originalname.endsWith('.xlsx') &&
  //     !file.originalname.endsWith('.xls')
  //   ) {
  //     throw new BadRequestException(
  //       'Invalid file type. Please upload Excel file (.xlsx or .xls)',
  //     );
  //   }

  //   return await this.pushNotificationService.parseExcelAndMatchUsers(
  //     file,
  //     parseDto.userType,
  //   );
  // }

  // @Post('bulk-upload')
  // @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  // @UseInterceptors(FileInterceptor('file'))
  // @ApiOperation({
  //   summary: 'Bulk notification upload',
  //   description: 'Upload Excel file with user list and create notification',
  // })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     required: ['file', 'title', 'body', 'userType'],
  //     properties: {
  //       file: {
  //         type: 'string',
  //         format: 'binary',
  //         description: 'Excel file (.xlsx) with columns: name, email, phone',
  //       },
  //       title: {
  //         type: 'string',
  //         description: 'Notification title',
  //         example: 'Special Campaign Invitation',
  //       },
  //       body: {
  //         type: 'string',
  //         description: 'Notification body',
  //         example: 'You have been selected for our exclusive campaign',
  //       },
  //       imageUrl: {
  //         type: 'string',
  //         description: 'Image URL for rich notification',
  //       },
  //       actionUrl: {
  //         type: 'string',
  //         description: 'Deep link action URL',
  //       },
  //       androidChannelId: {
  //         type: 'string',
  //         description: 'Android channel ID',
  //       },
  //       sound: {
  //         type: 'string',
  //         description: 'Sound (default/custom/silent)',
  //       },
  //       priority: {
  //         type: 'string',
  //         description: 'Priority (high/normal/low)',
  //       },
  //       badge: {
  //         type: 'number',
  //         description: 'iOS badge count',
  //       },
  //       threadId: {
  //         type: 'string',
  //         description: 'iOS thread ID for grouping',
  //       },
  //       interruptionLevel: {
  //         type: 'string',
  //         enum: ['passive', 'active', 'timeSensitive', 'critical'],
  //         description: 'iOS interruption level',
  //       },
  //       userType: {
  //         type: 'string',
  //         enum: ['influencer', 'brand'],
  //         description: 'Type of users in the Excel file',
  //       },
  //       sendImmediately: {
  //         type: 'boolean',
  //         description: 'Send immediately or save as draft',
  //         default: false,
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({
  //   status: HttpStatus.CREATED,
  //   description: 'Bulk notification created successfully',
  //   type: BulkNotificationResponseDto,
  // })
  // async bulkUploadNotification(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body() uploadDto: BulkNotificationUploadDto,
  //   @Req() req: RequestWithAdmin,
  // ): Promise<BulkNotificationResponseDto> {
  //   if (!file) {
  //     throw new BadRequestException('Excel file is required');
  //   }

  //   // Validate file type
  //   if (
  //     !file.originalname.endsWith('.xlsx') &&
  //     !file.originalname.endsWith('.xls')
  //   ) {
  //     throw new BadRequestException(
  //       'Invalid file type. Please upload Excel file (.xlsx or .xls)',
  //     );
  //   }

  //   return await this.pushNotificationService.createBulkNotification(
  //     file,
  //     uploadDto,
  //     req.admin.id,
  //   );
  // }

  // @Get('template/:userType')
  // @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  // @ApiOperation({
  //   summary: 'Download Excel template',
  //   description: 'Download Excel template for bulk notification upload',
  // })
  // @ApiParam({
  //   name: 'userType',
  //   enum: ['influencer', 'brand'],
  //   description: 'Type of users',
  // })
  // @ApiResponse({
  //   status: HttpStatus.OK,
  //   description: 'Excel template file',
  // })
  // async downloadTemplate(
  //   @Param('userType') userType: 'influencer' | 'brand',
  //   @Res() res: Response,
  // ): Promise<void> {
  //   const buffer =
  //     this.pushNotificationService.generateExcelTemplate(userType);

  //   res.setHeader(
  //     'Content-Type',
  //     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //   );
  //   res.setHeader(
  //     'Content-Disposition',
  //     `attachment; filename=notification-${userType}s-template.xlsx`,
  //   );

  //   res.send(buffer);
  // }
}
