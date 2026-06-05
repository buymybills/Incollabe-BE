import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Wishlist } from './models/wishlist.model';
import { WishlistItem } from './models/wishlist-item.model';

export interface SaveToWishlistDto {
  igSenderId: string;
  folderName: string;
  productName: string;
  brandName: string;
  productUrl?: string;
  imageUrl?: string;
  priceInr?: number;
  size?: string;
}

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    @InjectModel(Wishlist) private readonly wishlistModel: typeof Wishlist,
    @InjectModel(WishlistItem) private readonly itemModel: typeof WishlistItem,
  ) {}

  /**
   * Save a product to a named folder. Creates the folder if it doesn't exist.
   * Returns the wishlist and item created.
   */
  async saveToFolder(dto: SaveToWishlistDto): Promise<{ wishlist: Wishlist; item: WishlistItem; isNewFolder: boolean }> {
    let isNewFolder = false;

    // Find or create the folder (case-insensitive match per user)
    let wishlist = await this.wishlistModel.findOne({
      where: {
        igSenderId: dto.igSenderId,
        name: { [Op.iLike]: dto.folderName.trim() },
      },
    });

    if (!wishlist) {
      wishlist = await this.wishlistModel.create({
        igSenderId: dto.igSenderId,
        name: dto.folderName.trim(),
        shareToken: uuidv4(),
      } as any);
      isNewFolder = true;
      this.logger.log(`Created new wishlist folder "${dto.folderName}" for ${dto.igSenderId}`);
    }

    const item = await this.itemModel.create({
      wishlistId: wishlist.id,
      productName: dto.productName,
      brandName: dto.brandName,
      productUrl: dto.productUrl ?? null,
      imageUrl: dto.imageUrl ?? null,
      priceInr: dto.priceInr ?? null,
      size: dto.size ?? null,
    } as any);

    return { wishlist, item, isNewFolder };
  }

  /**
   * Get all folders for a user with item counts.
   */
  async getFolders(igSenderId: string): Promise<Wishlist[]> {
    return this.wishlistModel.findAll({
      where: { igSenderId },
      include: [{ model: WishlistItem, attributes: ['id'] }],
      order: [['name', 'ASC']],
    });
  }

  /**
   * Get all items in a named folder for a user.
   */
  async getFolderByName(igSenderId: string, folderName: string): Promise<Wishlist | null> {
    return this.wishlistModel.findOne({
      where: {
        igSenderId,
        name: { [Op.iLike]: folderName.trim() },
      },
      include: [{ model: WishlistItem, order: [['createdAt', 'DESC']] }],
    });
  }

  /**
   * Get a wishlist by share token — used for the public share link.
   */
  async getByShareToken(shareToken: string): Promise<Wishlist | null> {
    return this.wishlistModel.findOne({
      where: { shareToken },
      include: [{ model: WishlistItem, order: [['createdAt', 'DESC']] }],
    });
  }

  /**
   * Remove an item from a wishlist by index (1-based, as shown to user).
   */
  async removeItem(igSenderId: string, folderName: string, itemIndex: number): Promise<boolean> {
    const wishlist = await this.getFolderByName(igSenderId, folderName);
    if (!wishlist || !wishlist.items?.length) return false;

    const item = wishlist.items[itemIndex - 1];
    if (!item) return false;

    await item.destroy();
    return true;
  }

  /**
   * Get a folder by its ID, verifying ownership by igSenderId.
   */
  async getFolderById(id: number, igSenderId: string): Promise<Wishlist | null> {
    return this.wishlistModel.findOne({
      where: { id, igSenderId },
      include: [{ model: WishlistItem, order: [['createdAt', 'DESC']] }],
    });
  }

  /**
   * Rename a wishlist folder.
   * Throws ConflictException if the new name already exists for this user.
   */
  async renameFolder(id: number, igSenderId: string, newName: string): Promise<Wishlist> {
    const wishlist = await this.wishlistModel.findOne({ where: { id, igSenderId } });
    if (!wishlist) throw new NotFoundException('Wishlist folder not found');

    // Check for name collision (case-insensitive)
    const existing = await this.wishlistModel.findOne({
      where: {
        igSenderId,
        name: { [Op.iLike]: newName.trim() },
        id: { [Op.ne]: id },
      },
    });
    if (existing) throw new ConflictException(`A folder named "${newName}" already exists`);

    wishlist.name = newName.trim();
    await wishlist.save();
    return wishlist;
  }

  /**
   * Delete an entire folder and all its items.
   */
  async deleteFolder(igSenderId: string, folderName: string): Promise<boolean> {
    const wishlist = await this.wishlistModel.findOne({
      where: { igSenderId, name: { [Op.iLike]: folderName.trim() } },
    });
    if (!wishlist) return false;

    await this.itemModel.destroy({ where: { wishlistId: wishlist.id } });
    await wishlist.destroy();
    return true;
  }

  /**
   * Delete a folder by ID (used by REST API).
   */
  async deleteFolderById(id: number, igSenderId: string): Promise<boolean> {
    const wishlist = await this.wishlistModel.findOne({ where: { id, igSenderId } });
    if (!wishlist) return false;

    await this.itemModel.destroy({ where: { wishlistId: wishlist.id } });
    await wishlist.destroy();
    return true;
  }

  /**
   * Remove a specific item by its ID.
   */
  async removeItemById(itemId: number, igSenderId: string): Promise<boolean> {
    // Verify ownership via the parent wishlist
    const item = await this.itemModel.findOne({
      where: { id: itemId },
      include: [{ model: Wishlist, where: { igSenderId }, attributes: ['id'] }],
    });
    if (!item) return false;

    await item.destroy();
    return true;
  }
}
