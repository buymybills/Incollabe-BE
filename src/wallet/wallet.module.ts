import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Wallet } from './models/wallet.model';
import { WalletTransaction } from './models/wallet-transaction.model';
import { HypeStore } from './models/hype-store.model';
import { WalletRechargeLimit } from './models/wallet-recharge-limit.model';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { HypeStoreService } from './hype-store.service';
import { HypeStoreController } from './hype-store.controller';
import { RazorpayService } from '../shared/razorpay.service';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Wallet,
      WalletTransaction,
      HypeStore,
      WalletRechargeLimit,
      Influencer,
      Brand,
    ]),
  ],
  controllers: [WalletController, HypeStoreController],
  providers: [WalletService, HypeStoreService, RazorpayService],
  exports: [WalletService, HypeStoreService],
})
export class WalletModule {}
