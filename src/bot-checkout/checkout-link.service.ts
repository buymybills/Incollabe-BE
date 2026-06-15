import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { CheckoutLink } from './models/checkout-link.model';

/**
 * Mints and resolves short ids for checkout links so the DM'd URL stays tiny.
 */
@Injectable()
export class CheckoutLinkService {
  private readonly logger = new Logger(CheckoutLinkService.name);

  constructor(
    @InjectModel(CheckoutLink)
    private readonly checkoutLinkModel: typeof CheckoutLink,
  ) {}

  private newId(): string {
    // 6 random bytes → 8 URL-safe chars.
    return crypto.randomBytes(6).toString('base64url');
  }

  /**
   * Store a full signed token and return a short id pointing at it.
   * Reuses an existing id if this exact token was already shortened.
   */
  async shorten(token: string): Promise<string> {
    const existing = await this.checkoutLinkModel.findOne({ where: { token } });
    if (existing) return existing.id;

    for (let attempt = 0; attempt < 5; attempt++) {
      const id = this.newId();
      try {
        await this.checkoutLinkModel.create({ id, token } as any);
        return id;
      } catch (e: any) {
        // Primary-key collision — try a fresh id.
        this.logger.warn(`Short id collision (${id}), retrying: ${e.message}`);
      }
    }
    throw new Error('Could not allocate a unique checkout short id');
  }

  /** Resolve a short id back to its full signed token, or null if unknown. */
  async resolve(id: string): Promise<string | null> {
    const row = await this.checkoutLinkModel.findByPk(id);
    return row?.token ?? null;
  }
}
