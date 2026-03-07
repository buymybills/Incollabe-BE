import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { HypeStore } from './models/hype-store.model';
import { Brand } from '../brand/model/brand.model';
import {
  CreateHypeStoreDto,
  UpdateHypeStoreDto,
} from './dto/hype-store.dto';

@Injectable()
export class HypeStoreService {
  constructor(
    @InjectModel(HypeStore)
    private hypeStoreModel: typeof HypeStore,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
  ) {}

  /**
   * Generate slug from store name
   */
  private generateSlug(storeName: string): string {
    return storeName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Ensure slug is unique
   */
  private async ensureUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const where: any = { storeSlug: slug };
      if (excludeId) {
        where.id = { [Symbol.for('ne')]: excludeId };
      }

      const existing = await this.hypeStoreModel.findOne({ where });
      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Create a new Hype Store
   */
  async createStore(brandId: number, dto: CreateHypeStoreDto) {
    // Check if brand exists
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Check if brand already has a store
    const existingStore = await this.hypeStoreModel.findOne({
      where: { brandId },
    });

    if (existingStore) {
      throw new ConflictException('Brand already has a store');
    }

    // Generate unique slug
    const baseSlug = this.generateSlug(dto.storeName);
    const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

    // Create store
    const store = await this.hypeStoreModel.create({
      brandId,
      storeName: dto.storeName,
      storeSlug: uniqueSlug,
      storeDescription: dto.storeDescription,
      storeLogo: dto.storeLogo,
      storeBanner: dto.storeBanner,
      minOrderValue: dto.minOrderValue || 0,
      maxOrderValue: dto.maxOrderValue,
      isActive: true,
      isVerified: false, // Requires admin verification
      totalOrders: 0,
      totalRevenue: 0,
      totalCashbackGiven: 0,
    } as any);

    return store;
  }

  /**
   * Get store by brand ID
   */
  async getStoreByBrandId(brandId: number) {
    const store = await this.hypeStoreModel.findOne({
      where: { brandId },
      include: [{ model: this.brandModel, as: 'brand' }],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  /**
   * Get store by ID
   */
  async getStoreById(storeId: number) {
    const store = await this.hypeStoreModel.findByPk(storeId, {
      include: [{ model: this.brandModel, as: 'brand' }],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  /**
   * Get store by slug
   */
  async getStoreBySlug(slug: string) {
    const store = await this.hypeStoreModel.findOne({
      where: { storeSlug: slug },
      include: [{ model: this.brandModel, as: 'brand' }],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  /**
   * Update store
   */
  async updateStore(brandId: number, dto: UpdateHypeStoreDto) {
    const store = await this.hypeStoreModel.findOne({
      where: { brandId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // If updating store name, regenerate slug
    if (dto.storeName && dto.storeName !== store.storeName) {
      const baseSlug = this.generateSlug(dto.storeName);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug, store.id);
      await store.update({
        ...dto,
        storeSlug: uniqueSlug,
      });
    } else {
      await store.update(dto);
    }

    return store;
  }

  /**
   * Get all active stores (public listing)
   */
  async getAllStores(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { count, rows } = await this.hypeStoreModel.findAndCountAll({
      where: { isActive: true, isVerified: true },
      include: [
        {
          model: this.brandModel,
          as: 'brand',
          attributes: ['id', 'brandName', 'profileImage'],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      stores: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Update store statistics (called after orders)
   */
  async updateStoreStats(
    storeId: number,
    orderAmount: number,
    cashbackGiven: number,
  ) {
    const store = await this.hypeStoreModel.findByPk(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    await store.update({
      totalOrders: store.totalOrders + 1,
      totalRevenue: parseFloat(store.totalRevenue.toString()) + orderAmount,
      totalCashbackGiven:
        parseFloat(store.totalCashbackGiven.toString()) + cashbackGiven,
    });

    return store;
  }

  /**
   * Verify store (admin only)
   */
  async verifyStore(storeId: number, isVerified: boolean) {
    const store = await this.hypeStoreModel.findByPk(storeId);
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    await store.update({ isVerified });
    return store;
  }

  /**
   * Delete store
   */
  async deleteStore(brandId: number) {
    const store = await this.hypeStoreModel.findOne({
      where: { brandId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    await store.destroy();

    return {
      success: true,
      message: 'Store deleted successfully',
    };
  }
}
