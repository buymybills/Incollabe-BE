import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import type { RequestWithAdmin } from '../guards/admin-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AdminRole } from '../models/admin.model';
import { CommentAutomationService } from '../../shared/services/comment-automation.service';
import {
  CreateCommentAutomationDto,
  UpdateCommentAutomationDto,
  GetCommentAutomationsDto,
  UpdateCommentAutomationStatusDto,
} from '../dto/comment-automation.dto';

/**
 * Admin CRUD for Instagram comment automations.
 * An automation links a specific post/reel + keyword to an auto comment reply
 * and an auto DM. Only comments matching a rule trigger anything.
 */
@ApiTags('Admin - Comment Automation')
@ApiBearerAuth()
@Controller('admin/comment-automations')
@UseGuards(AdminAuthGuard, RolesGuard)
export class CommentAutomationController {
  constructor(private readonly commentAutomationService: CommentAutomationService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Create a comment automation rule' })
  async create(@Req() req: RequestWithAdmin, @Body() dto: CreateCommentAutomationDto) {
    const automation = await this.commentAutomationService.create({
      ...dto,
      createdBy: req.admin.id,
    });
    return { success: true, message: 'Comment automation created', automation };
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] List comment automation rules' })
  async findAll(@Query() query: GetCommentAutomationsDto) {
    const result = await this.commentAutomationService.findAll({
      page: query.page,
      limit: query.limit,
      isActive: query.isActive,
      search: query.search,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Get a single comment automation rule' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const automation = await this.commentAutomationService.findById(id);
    return { success: true, automation };
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Update a comment automation rule' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentAutomationDto,
  ) {
    const automation = await this.commentAutomationService.update(id, dto);
    return { success: true, message: 'Comment automation updated', automation };
  }

  @Patch(':id/status')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Activate / deactivate a comment automation rule' })
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentAutomationStatusDto,
  ) {
    const automation = await this.commentAutomationService.setActive(id, dto.isActive);
    return { success: true, message: 'Status updated', automation };
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Delete a comment automation rule' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.commentAutomationService.remove(id);
    return { success: true, message: 'Comment automation deleted' };
  }
}
