import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotCustomer } from './models/bot-customer.model';
import { BotAddress } from './models/bot-address.model';
import { BotOrder } from './models/bot-order.model';
import { CheckoutLink } from './models/checkout-link.model';
import { BotSavedItem } from './models/bot-saved-item.model';
import { BotShareCode } from './models/bot-share-code.model';
import { BotCartItem } from './models/bot-cart-item.model';
import { BotCoupon } from './models/bot-coupon.model';
import { BotCheckoutService } from './bot-checkout.service';
import { CheckoutLinkService } from './checkout-link.service';
import { BotSavedItemService } from './bot-saved-item.service';
import { BotShareCodeService } from './bot-share-code.service';
import { BotCartService } from './bot-cart.service';
import { BotCouponService } from './bot-coupon.service';
import { OrderForwardService } from './order-forward.service';
import { BotCheckoutController } from './bot-checkout.controller';
import { CheckoutPageController } from './checkout-page.controller';
import { BotSavedItemController } from './bot-saved-item.controller';
import { BotShareCodeController } from './bot-share-code.controller';
import { BotCartController } from './bot-cart.controller';
import { BotAnalyticsModule } from '../bot-analytics/bot-analytics.module';
import { BotKeyGuard } from '../bot-analytics/guards/bot-key.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([BotCustomer, BotAddress, BotOrder, CheckoutLink, BotSavedItem, BotShareCode, BotCartItem, BotCoupon]),
    BotAnalyticsModule,
  ],
  controllers: [BotCheckoutController, CheckoutPageController, BotSavedItemController, BotShareCodeController, BotCartController],
  providers: [BotCheckoutService, CheckoutLinkService, BotSavedItemService, BotShareCodeService, BotCartService, BotCouponService, OrderForwardService, BotKeyGuard],
  exports: [BotCheckoutService, BotCouponService],
})
export class BotCheckoutModule {}
