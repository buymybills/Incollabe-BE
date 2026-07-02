import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ReelCategory } from '../models/reel-category.model';
import { CategoryReel } from '../models/category-reel.model';

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdBy?: number | null;
}
export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}
export interface CreateReelInput {
  categoryId: number;
  reelUrl: string;
  title?: string | null;
  caption?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdBy?: number | null;
}
export interface UpdateReelInput {
  categoryId?: number;
  reelUrl?: string;
  title?: string | null;
  caption?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * CRUD for admin-curated reel categories + their reels, plus the read shape the
 * shopping bot consumes (active categories, each with its active reels).
 */
@Injectable()
export class CategoryReelService {
  constructor(
    @InjectModel(ReelCategory)
    private readonly categoryModel: typeof ReelCategory,
    @InjectModel(CategoryReel)
    private readonly reelModel: typeof CategoryReel,
  ) {}

  // ─────────────────────────── categories ───────────────────────────
  private async uniqueSlug(name: string, excludeId?: number): Promise<string> {
    const base = ReelCategory.toSlug(name) || 'category';
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await this.categoryModel.findOne({ where: { slug } });
      if (!clash || clash.id === excludeId) return slug;
      slug = `${base}-${++n}`;
    }
  }

  async createCategory(input: CreateCategoryInput): Promise<ReelCategory> {
    const slug = await this.uniqueSlug(input.name);
    return this.categoryModel.create({
      name: input.name,
      slug,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdBy: input.createdBy ?? null,
    } as any);
  }

  async listCategories(params: {
    includeReels?: boolean;
    activeOnly?: boolean;
  }): Promise<ReelCategory[]> {
    const where: any = {};
    if (params.activeOnly) where.isActive = true;
    return this.categoryModel.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['created_at', 'ASC'],
      ],
      include: params.includeReels
        ? [
            {
              model: CategoryReel,
              required: false,
              ...(params.activeOnly ? { where: { isActive: true } } : {}),
            },
          ]
        : [],
    });
  }

  async findCategory(id: number): Promise<ReelCategory> {
    const cat = await this.categoryModel.findByPk(id, {
      include: [{ model: CategoryReel, required: false }],
    });
    if (!cat) throw new NotFoundException('Reel category not found');
    return cat;
  }

  async updateCategory(
    id: number,
    input: UpdateCategoryInput,
  ): Promise<ReelCategory> {
    const cat = await this.findCategory(id);
    if (input.name !== undefined) {
      cat.name = input.name;
      cat.slug = await this.uniqueSlug(input.name, id);
    }
    if (input.description !== undefined) cat.description = input.description;
    if (input.isActive !== undefined) cat.isActive = input.isActive;
    if (input.sortOrder !== undefined) cat.sortOrder = input.sortOrder;
    await cat.save();
    return cat;
  }

  async removeCategory(id: number): Promise<void> {
    const cat = await this.findCategory(id);
    await this.reelModel.destroy({ where: { categoryId: id } });
    await cat.destroy();
  }

  // ──────────────────────────── reels ────────────────────────────
  async createReel(input: CreateReelInput): Promise<CategoryReel> {
    await this.findCategory(input.categoryId); // 404s if the category is gone
    return this.reelModel.create({
      categoryId: input.categoryId,
      reelUrl: input.reelUrl,
      mediaShortcode: CategoryReel.parseShortcode(input.reelUrl),
      title: input.title ?? null,
      caption: input.caption ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdBy: input.createdBy ?? null,
    } as any);
  }

  async listReels(categoryId?: number): Promise<CategoryReel[]> {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    return this.reelModel.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['created_at', 'ASC'],
      ],
    });
  }

  async findReel(id: number): Promise<CategoryReel> {
    const reel = await this.reelModel.findByPk(id);
    if (!reel) throw new NotFoundException('Category reel not found');
    return reel;
  }

  async updateReel(id: number, input: UpdateReelInput): Promise<CategoryReel> {
    const reel = await this.findReel(id);
    if (input.categoryId !== undefined) {
      await this.findCategory(input.categoryId);
      reel.categoryId = input.categoryId;
    }
    if (input.reelUrl !== undefined) {
      reel.reelUrl = input.reelUrl;
      reel.mediaShortcode = CategoryReel.parseShortcode(input.reelUrl);
    }
    if (input.title !== undefined) reel.title = input.title;
    if (input.caption !== undefined) reel.caption = input.caption;
    if (input.isActive !== undefined) reel.isActive = input.isActive;
    if (input.sortOrder !== undefined) reel.sortOrder = input.sortOrder;
    await reel.save();
    return reel;
  }

  async removeReel(id: number): Promise<void> {
    const reel = await this.findReel(id);
    await reel.destroy();
  }

  // ───────────────────────────── bot ─────────────────────────────
  /** Active categories, each with its active reels — the bot's look-discovery feed. */
  async botFeed(): Promise<
    {
      name: string;
      slug: string;
      reels: {
        url: string;
        shortcode: string | null;
        title: string | null;
        caption: string | null;
      }[];
    }[]
  > {
    const cats = await this.listCategories({
      includeReels: true,
      activeOnly: true,
    });
    return cats
      .map((c) => ({
        name: c.name,
        slug: c.slug,
        reels: (c.reels ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((r) => ({
            url: r.reelUrl,
            shortcode: r.mediaShortcode,
            title: r.title,
            caption: r.caption,
          })),
      }))
      .filter((c) => c.reels.length > 0);
  }
}
