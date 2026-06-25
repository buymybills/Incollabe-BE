import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AffiliateEarning } from '../models/affiliate-earning.model';
import { Wallet } from '../../wallet/models/wallet.model';
import { InfluencerWithdrawalAccount } from '../models/influencer-withdrawal-account.model';
import {
  AffiliateEarningsQueryDto,
  WithdrawAffiliateEarningsDto,
} from '../dto/affiliate-earnings.dto';

@Injectable()
export class AffiliateEarningsService {
  constructor(
    @InjectModel(AffiliateEarning)
    private readonly earningModel: typeof AffiliateEarning,
    @InjectModel(Wallet)
    private readonly walletModel: typeof Wallet,
    @InjectModel(InfluencerWithdrawalAccount)
    private readonly withdrawalAccountModel: typeof InfluencerWithdrawalAccount,
  ) {}

  async getEarnings(influencerId: number, query: AffiliateEarningsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const where: any = { influencerId };
    if (query.brand) where.brandName = { [Op.iLike]: `%${query.brand}%` };
    if (query.search) {
      where[Op.or] = [
        { brandName: { [Op.iLike]: `%${query.search}%` } },
        { productName: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const { rows, count } = await this.earningModel.findAndCountAll({
      where,
      order: [['earnedAt', 'DESC']],
      limit,
      offset,
    });

    const wallet = await this.walletModel.findOne({ where: { userId: influencerId, userType: 'influencer' } as any });
    const currentEarning = wallet ? (wallet as any).totalAffiliateEarned ?? 0 : 0;
    const availableBalance = wallet ? (wallet as any).affiliateEarningsBalance ?? 0 : 0;

    return {
      currentEarning,
      availableBalance,
      transactions: rows,
      meta: { total: count, page, limit },
    };
  }

  async getTransaction(influencerId: number, id: number) {
    const record = await this.earningModel.findOne({
      where: { id, influencerId },
    });
    if (!record) throw new NotFoundException('Transaction not found');
    return record;
  }

  async withdraw(influencerId: number, dto: WithdrawAffiliateEarningsDto) {
    const wallet = await this.walletModel.findOne({ where: { userId: influencerId, userType: 'influencer' } as any });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const availableBalance = (wallet as any).affiliateEarningsBalance ?? 0;
    if (dto.amount > availableBalance) {
      throw new BadRequestException('Insufficient balance');
    }

    const account = await this.withdrawalAccountModel.findOne({
      where: { id: dto.withdrawalAccountId, influencerId },
    });
    if (!account) throw new NotFoundException('Withdrawal account not found');

    await wallet.update({
      affiliateEarningsBalance: availableBalance - dto.amount,
      totalAffiliateWithdrawn: ((wallet as any).totalAffiliateWithdrawn ?? 0) + dto.amount,
    } as any);

    return { message: 'Withdrawal initiated', amount: dto.amount };
  }
}
