import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  InfluencerWithdrawalAccount,
  WithdrawalAccountType,
} from '../models/influencer-withdrawal-account.model';
import { Wallet } from '../../wallet/models/wallet.model';
import {
  CreateWithdrawalAccountDto,
  RedeemWithdrawalDto,
} from '../dto/withdrawal-account.dto';

@Injectable()
export class WithdrawalAccountService {
  constructor(
    @InjectModel(InfluencerWithdrawalAccount)
    private readonly accountModel: typeof InfluencerWithdrawalAccount,
    @InjectModel(Wallet)
    private readonly walletModel: typeof Wallet,
  ) {}

  async findAll(influencerId: number) {
    return this.accountModel.findAll({ where: { influencerId } });
  }

  async create(influencerId: number, dto: CreateWithdrawalAccountDto) {
    return this.accountModel.create({
      influencerId,
      accountType: dto.accountType as WithdrawalAccountType,
      upiId: dto.upiId ?? null,
      accountHolderName: dto.accountHolderName ?? null,
      accountNumber: dto.accountNumber ?? null,
      bankName: dto.bankName ?? null,
      ifscCode: dto.ifscCode ?? null,
      isDefault: false,
      isVerified: false,
    } as any);
  }

  async remove(influencerId: number, id: number) {
    const record = await this.accountModel.findOne({ where: { id, influencerId } });
    if (!record) throw new NotFoundException('Account not found');
    await record.destroy();
    return { message: 'Account removed' };
  }

  async setDefault(influencerId: number, id: number) {
    const record = await this.accountModel.findOne({ where: { id, influencerId } });
    if (!record) throw new NotFoundException('Account not found');
    await this.accountModel.update({ isDefault: false } as any, { where: { influencerId } });
    await record.update({ isDefault: true } as any);
    return record;
  }

  async redeem(influencerId: number, id: number, dto: RedeemWithdrawalDto) {
    const account = await this.accountModel.findOne({ where: { id, influencerId } });
    if (!account) throw new NotFoundException('Account not found');

    const wallet = await this.walletModel.findOne({ where: { influencerId } as any });
    if (!wallet) throw new BadRequestException('Wallet not found');

    const availableBalance = (wallet as any).affiliateEarningsBalance ?? 0;
    if (dto.amount > availableBalance) {
      throw new BadRequestException('Insufficient balance');
    }

    await wallet.update({
      affiliateEarningsBalance: availableBalance - dto.amount,
      totalAffiliateWithdrawn: ((wallet as any).totalAffiliateWithdrawn ?? 0) + dto.amount,
    } as any);

    await account.update({ lastUsedAt: new Date() } as any);

    return { message: 'Withdrawal initiated', amount: dto.amount };
  }
}
