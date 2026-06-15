import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { BotCartItem } from './models/bot-cart-item.model';

export interface CartItemInput {
  igsid: string;
  productUrl: string;
  title: string;
  size?: string | null;
  priceInr: number;
  imageUrl?: string | null;
  slug?: string | null;
  qty?: number;
}

export interface CartSummary {
  items: Array<{
    url: string;
    title: string;
    size: string | null;
    priceInr: number;
    imageUrl: string | null;
    slug: string | null;
    qty: number;
    lineTotalInr: number;
  }>;
  totalQty: number;
  totalInr: number;
  lineCount: number;
}

@Injectable()
export class BotCartService {
  constructor(
    @InjectModel(BotCartItem)
    private readonly cartModel: typeof BotCartItem,
  ) {}

  /** Add a product (or bump qty if the same product+size is already in the cart). */
  async add(input: CartItemInput): Promise<CartSummary> {
    const size = input.size ?? null;
    const addQty = Math.max(1, input.qty ?? 1);

    const existing = await this.cartModel.findOne({
      where: { igsid: input.igsid, productUrl: input.productUrl, size: size ?? ({ [Op.is]: null } as any) },
    });

    if (existing) {
      existing.qty += addQty;
      // Refresh price/title/image in case they changed since the item was added.
      existing.priceInr = input.priceInr;
      if (input.title) existing.title = input.title;
      if (input.imageUrl !== undefined) existing.imageUrl = input.imageUrl ?? null;
      if (input.slug !== undefined) existing.slug = input.slug ?? null;
      await existing.save();
    } else {
      await this.cartModel.create({
        igsid: input.igsid,
        productUrl: input.productUrl,
        title: input.title,
        size,
        priceInr: input.priceInr,
        imageUrl: input.imageUrl ?? null,
        slug: input.slug ?? null,
        qty: addQty,
      } as any);
    }

    return this.summary(input.igsid);
  }

  /** Remove a line (a specific product+size). If size is omitted, removes all sizes of that product. */
  async remove(igsid: string, productUrl: string, size?: string | null): Promise<CartSummary> {
    const where: any = { igsid, productUrl };
    if (size !== undefined) where.size = size ?? ({ [Op.is]: null } as any);
    await this.cartModel.destroy({ where });
    return this.summary(igsid);
  }

  /** Set an exact qty for a line; qty <= 0 removes it. */
  async setQty(igsid: string, productUrl: string, size: string | null, qty: number): Promise<CartSummary> {
    if (qty <= 0) return this.remove(igsid, productUrl, size);
    const line = await this.cartModel.findOne({
      where: { igsid, productUrl, size: size ?? ({ [Op.is]: null } as any) },
    });
    if (line) {
      line.qty = qty;
      await line.save();
    }
    return this.summary(igsid);
  }

  /** Empty the cart. */
  async clear(igsid: string): Promise<CartSummary> {
    await this.cartModel.destroy({ where: { igsid } });
    return this.summary(igsid);
  }

  /** Current cart contents + totals. */
  async summary(igsid: string): Promise<CartSummary> {
    const rows = await this.cartModel.findAll({
      where: { igsid },
      order: [['created_at', 'ASC']],
    });

    const items = rows.map((r) => {
      const price = Number(r.priceInr);
      return {
        url: r.productUrl,
        title: r.title,
        size: r.size,
        priceInr: price,
        imageUrl: r.imageUrl,
        slug: r.slug,
        qty: r.qty,
        lineTotalInr: price * r.qty,
      };
    });

    return {
      items,
      totalQty: items.reduce((s, i) => s + i.qty, 0),
      totalInr: items.reduce((s, i) => s + i.lineTotalInr, 0),
      lineCount: items.length,
    };
  }
}
