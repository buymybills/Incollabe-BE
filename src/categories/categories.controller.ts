import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
} from './dto/create-category.dto';

@ApiTags('Categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List all active categories with subcategories' })
  findAll() {
    return this.categoriesService.findAllCategories();
  }

  @Get('categories/:categoryId/subcategories')
  @ApiOperation({ summary: 'List subcategories for a category' })
  findSubcategories(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return this.categoriesService.findSubcategories(categoryId);
  }

  @Post('admin/categories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(dto);
  }

  @Put('admin/categories/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update a category' })
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(id, dto);
  }

  @Post('admin/categories/:id/subcategories')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a subcategory' })
  createSubcategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSubcategoryDto,
  ) {
    return this.categoriesService.createSubcategory(id, dto);
  }

  @Put('admin/subcategories/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update a subcategory' })
  updateSubcategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.categoriesService.updateSubcategory(id, dto);
  }
}
