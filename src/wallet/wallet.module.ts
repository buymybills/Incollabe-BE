import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Wallet } from './models/wallet.model';
import { WalletTransaction } from './models/wallet-transaction.model';
import { WalletRechargeLimit } from './models/wallet-recharge-limit.model';
import { HypeStoreOrder } from './models/hype-store-order.model';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { CashbackLockUnlockService } from './services/cashback-lock-unlock.service';
import { RazorpayService } from '../shared/razorpay.service';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Wallet,
      WalletTransaction,
      WalletRechargeLimit,
      HypeStoreOrder,
      Influencer,
      Brand,
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService, RazorpayService, CashbackLockUnlockService],
  exports: [WalletService, CashbackLockUnlockService],
})
export class WalletModule {}
