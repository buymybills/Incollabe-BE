import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PostCategory } from '../post/models/post-category.model';
import { PostSubcategory } from '../post/models/post-subcategory.model';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubcategoryDto,
  UpdateSubcategoryDto,
} from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(PostCategory)
    private readonly categoryModel: typeof PostCategory,
    @InjectModel(PostSubcategory)
    private readonly subcategoryModel: typeof PostSubcategory,
  ) {}

  async findAllCategories() {
    return this.categoryModel.findAll({
      where: { isActive: true },
      include: [
        {
          model: PostSubcategory,
          where: { isActive: true },
          required: false,
        },
      ],
      order: [
        ['sortOrder', 'ASC'],
        [{ model: PostSubcategory, as: 'subcategories' }, 'sortOrder', 'ASC'],
      ],
    });
  }

  async findSubcategories(categoryId: number) {
    const category = await this.categoryModel.findByPk(categoryId);
    if (!category) throw new NotFoundException('Category not found');
    return this.subcategoryModel.findAll({
      where: { categoryId, isActive: true },
      order: [['sortOrder', 'ASC']],
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.categoryModel.create({ ...dto, isActive: true } as any);
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const record = await this.categoryModel.findByPk(id);
    if (!record) throw new NotFoundException('Category not found');
    await record.update(dto);
    return record;
  }

  async createSubcategory(categoryId: number, dto: CreateSubcategoryDto) {
    const category = await this.categoryModel.findByPk(categoryId);
    if (!category) throw new NotFoundException('Category not found');
    return this.subcategoryModel.create({ ...dto, categoryId, isActive: true } as any);
  }

  async updateSubcategory(id: number, dto: UpdateSubcategoryDto) {
    const record = await this.subcategoryModel.findByPk(id);
    if (!record) throw new NotFoundException('Subcategory not found');
    await record.update(dto);
    return record;
  }
}
