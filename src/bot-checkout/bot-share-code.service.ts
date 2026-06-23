import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { BotShareCode } from './models/bot-share-code.model';

@Injectable()
export class BotShareCodeService {
  constructor(
    @InjectModel(BotShareCode)
    private readonly shareCodeModel: typeof BotShareCode,
  ) {}

  /** The shopper's current share code, or null if they haven't claimed one. */
  async getForUser(igsid: string): Promise<string | null> {
    const row = await this.shareCodeModel.findOne({ where: { igsid } });
    return row?.code ?? null;
  }

  /** Resolve a code to its owner's igsid, or null if unknown. */
  async resolve(code: string): Promise<string | null> {
    const row = await this.shareCodeModel.findOne({ where: { code } });
    return row?.igsid ?? null;
  }

  /**
   * Claim a code for a shopper. Idempotent if they already own it. Throws
   * ConflictException (-> HTTP 409) if another shopper owns the code. The DB's
   * UNIQUE(code) index is the race-free backstop behind the pre-check.
   */
  async claim(igsid: string, code: string): Promise<{ code: string }> {
    const owner = await this.shareCodeModel.findOne({ where: { code } });
    if (owner && owner.igsid !== igsid) throw new ConflictException('code_taken');
    try {
      const [row, created] = await this.shareCodeModel.findOrCreate({
        where: { igsid },
        defaults: { igsid, code } as any,
      });
      if (!created && row.code !== code) {
        row.code = code;
        await row.save();
      }
      return { code };
    } catch (e) {
      if (e instanceof UniqueConstraintError) throw new ConflictException('code_taken');
      throw e;
    }
  }
}
