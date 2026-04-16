import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { HypeStoreController } from './hype-store.controller';
import { HypeStoreWebhookController } from './hype-store-webhook.controller';
import { HypeStoreService } from './hype-store.service';
import { OrderVisibilitySchedulerService } from './services/order-visibility-scheduler.service';
import { HypeStore } from '../wallet/models/hype-store.model'; // NEW model
import { HypeStoreCashbackConfig } from './models/hype-store-cashback-config.model';
import { Wallet } from '../wallet/models/wallet.model';
import { WalletTransaction } from '../wallet/models/wallet-transaction.model';
import { HypeStoreCreatorPreference } from './models/hype-store-creator-preference.model';
import { HypeStoreOrder as HypeStoreOrderOld } from './models/hype-store-order.model';
import { HypeStoreOrder } from '../wallet/models/hype-store-order.model';
import { HypeStoreCashbackTransaction } from './models/hype-store-cashback-transaction.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { HypeStoreCouponCode } from '../wallet/models/hype-store-coupon-code.model';
import { HypeStoreCashbackTier } from '../wallet/models/hype-store-cashback-tier.model';
import { HypeStoreWebhookLog } from '../wallet/models/hype-store-webhook-log.model';
import { HypeStoreWebhookSecret } from '../wallet/models/hype-store-webhook-secret.model';
import { HypeStoreReferralCode } from '../wallet/models/hype-store-referral-code.model';
import { HypeStoreReferralClick } from '../wallet/models/hype-store-referral-click.model';
import { InstagramProfileAnalysis } from '../shared/models/instagram-profile-analysis.model';
import { CashbackTier } from './models/cashback-tier.model';
import { CashbackTierService } from './services/cashback-tier.service';
import { ShopifyWebhookNormalizerService } from './services/shopify-webhook-normalizer.service';
import { WooCommerceWebhookNormalizerService } from './services/woocommerce-webhook-normalizer.service';
import { SharedModule } from '../shared/shared.module';
import { WebhookLoggerMiddleware } from './webhook-logger.middleware';

@Module({
  imports: [
    SequelizeModule.forFeature([
      HypeStore,
      HypeStoreCashbackConfig,
      Wallet,
      WalletTransaction,
      HypeStoreCreatorPreference,
      HypeStoreOrderOld,
      HypeStoreOrder,
      HypeStoreCashbackTransaction,
      Brand,
      Influencer,
      HypeStoreCouponCode,
      HypeStoreCashbackTier,
      HypeStoreWebhookLog,
      HypeStoreWebhookSecret,
      HypeStoreReferralCode,
      HypeStoreReferralClick,
      InstagramProfileAnalysis,
      CashbackTier,
    ]),
    SharedModule,
  ],
  controllers: [HypeStoreController, HypeStoreWebhookController],
  providers: [HypeStoreService, OrderVisibilitySchedulerService, CashbackTierService, ShopifyWebhookNormalizerService, WooCommerceWebhookNormalizerService],
  exports: [HypeStoreService, CashbackTierService],
})
export class HypeStoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(WebhookLoggerMiddleware)
      .forRoutes({ path: 'webhooks/hype-store/*', method: RequestMethod.POST });
  }
}
