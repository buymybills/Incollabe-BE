import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { HypeStoreController } from './hype-store.controller';
import { HypeStoreService } from './hype-store.service';
import { HypeStore } from './models/hype-store.model';
import { HypeStoreCashbackConfig } from './models/hype-store-cashback-config.model';
import { HypeStoreWallet } from './models/hype-store-wallet.model';
import { HypeStoreWalletTransaction } from './models/hype-store-wallet-transaction.model';
import { HypeStoreCreatorPreference } from './models/hype-store-creator-preference.model';
import { HypeStoreOrder } from './models/hype-store-order.model';
import { HypeStoreCashbackTransaction } from './models/hype-store-cashback-transaction.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      HypeStore,
      HypeStoreCashbackConfig,
      HypeStoreWallet,
      HypeStoreWalletTransaction,
      HypeStoreCreatorPreference,
      HypeStoreOrder,
      HypeStoreCashbackTransaction,
      Brand,
      Influencer,
    ]),
    SharedModule,
  ],
  controllers: [HypeStoreController],
  providers: [HypeStoreService],
  exports: [HypeStoreService],
})
export class HypeStoreModule {}
