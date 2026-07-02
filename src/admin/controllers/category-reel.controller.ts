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
import { CategoryReelService } from '../../shared/services/category-reel.service';
import {
  CreateReelCategoryDto,
  UpdateReelCategoryDto,
  CreateCategoryReelDto,
  UpdateCategoryReelDto,
  ListCategoryReelsDto,
} from '../dto/category-reel.dto';

const ROLES = [AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR] as const;

/**
 * Admin CRUD for reel CATEGORIES (Party Wear, Vacay Wear, …). Each category
 * groups curated reels the shopping bot surfaces as look-discovery chips.
 */
@ApiTags('Admin - Reel Categories')
@ApiBearerAuth()
@Controller('admin/reel-categories')
@UseGuards(AdminAuthGuard, RolesGuard)
export class ReelCategoryController {
  constructor(private readonly service: CategoryReelService) {}

  @Post()
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Create a reel category' })
  async create(@Req() req: RequestWithAdmin, @Body() dto: CreateReelCategoryDto) {
    const category = await this.service.createCategory({
      ...dto,
      createdBy: req.admin.id,
    });
    return { success: true, message: 'Category created', category };
  }

  @Get()
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] List categories (with their reels)' })
  async findAll() {
    const categories = await this.service.listCategories({ includeReels: true });
    return { success: true, categories };
  }

  @Get(':id')
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Get a category (with its reels)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const category = await this.service.findCategory(id);
    return { success: true, category };
  }

  @Patch(':id')
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Update a category' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReelCategoryDto,
  ) {
    const category = await this.service.updateCategory(id, dto);
    return { success: true, message: 'Category updated', category };
  }

  @Delete(':id')
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Delete a category (and its reels)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeCategory(id);
    return { success: true, message: 'Category deleted' };
  }
}

/**
 * Admin CRUD for the reels inside a category.
 */
@ApiTags('Admin - Category Reels')
@ApiBearerAuth()
@Controller('admin/category-reels')
@UseGuards(AdminAuthGuard, RolesGuard)
export class CategoryReelController {
  constructor(private readonly service: CategoryReelService) {}

  @Post()
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Add a reel to a category' })
  async create(@Req() req: RequestWithAdmin, @Body() dto: CreateCategoryReelDto) {
    const reel = await this.service.createReel({
      ...dto,
      createdBy: req.admin.id,
    });
    return { success: true, message: 'Reel added', reel };
  }

  @Get()
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] List reels (optionally by category)' })
  async findAll(@Query() query: ListCategoryReelsDto) {
    const reels = await this.service.listReels(query.categoryId);
    return { success: true, reels };
  }

  @Patch(':id')
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Update a reel' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryReelDto,
  ) {
    const reel = await this.service.updateReel(id, dto);
    return { success: true, message: 'Reel updated', reel };
  }

  @Delete(':id')
  @Roles(...ROLES)
  @ApiOperation({ summary: '[ADMIN] Delete a reel' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.removeReel(id);
    return { success: true, message: 'Reel deleted' };
  }
}
