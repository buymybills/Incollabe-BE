import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BotSavedItem } from './models/bot-saved-item.model';

export interface SavedItemInput {
  igsid: string;
  productUrl: string;
  title: string;
  imageUrl?: string | null;
  slug?: string | null;
}

@Injectable()
export class BotSavedItemService {
  constructor(
    @InjectModel(BotSavedItem)
    private readonly savedItemModel: typeof BotSavedItem,
  ) {}

  /** Save a product. Idempotent — a duplicate (igsid, url) is a no-op. */
  async save(input: SavedItemInput): Promise<{ created: boolean; count: number }> {
    const [, created] = await this.savedItemModel.findOrCreate({
      where: { igsid: input.igsid, productUrl: input.productUrl },
      defaults: {
        igsid: input.igsid,
        productUrl: input.productUrl,
        title: input.title,
        imageUrl: input.imageUrl ?? null,
        slug: input.slug ?? null,
      } as any,
    });
    const count = await this.count(input.igsid);
    return { created, count };
  }

  /** Remove a saved product by (igsid, url). */
  async unsave(igsid: string, productUrl: string): Promise<{ removed: boolean; count: number }> {
    const deleted = await this.savedItemModel.destroy({ where: { igsid, productUrl } });
    const count = await this.count(igsid);
    return { removed: deleted > 0, count };
  }

  /** List a shopper's saved items, newest first. */
  async list(igsid: string): Promise<BotSavedItem[]> {
    return this.savedItemModel.findAll({
      where: { igsid },
      order: [['created_at', 'DESC']],
    });
  }

  private async count(igsid: string): Promise<number> {
    return this.savedItemModel.count({ where: { igsid } });
  }
}
