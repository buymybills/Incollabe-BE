import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotCustomer } from './models/bot-customer.model';
import { BotAddress } from './models/bot-address.model';
import { BotOrder } from './models/bot-order.model';
import { CheckoutLink } from './models/checkout-link.model';
import { BotSavedItem } from './models/bot-saved-item.model';
import { BotCartItem } from './models/bot-cart-item.model';
import { BotCheckoutService } from './bot-checkout.service';
import { CheckoutLinkService } from './checkout-link.service';
import { BotSavedItemService } from './bot-saved-item.service';
import { BotCartService } from './bot-cart.service';
import { OrderForwardService } from './order-forward.service';
import { BotCheckoutController } from './bot-checkout.controller';
import { CheckoutPageController } from './checkout-page.controller';
import { BotSavedItemController } from './bot-saved-item.controller';
import { BotCartController } from './bot-cart.controller';
import { BotAnalyticsModule } from '../bot-analytics/bot-analytics.module';
import { BotKeyGuard } from '../bot-analytics/guards/bot-key.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([BotCustomer, BotAddress, BotOrder, CheckoutLink, BotSavedItem, BotCartItem]),
    BotAnalyticsModule,
  ],
  controllers: [BotCheckoutController, CheckoutPageController, BotSavedItemController, BotCartController],
  providers: [BotCheckoutService, CheckoutLinkService, BotSavedItemService, BotCartService, OrderForwardService, BotKeyGuard],
  exports: [BotCheckoutService],
})
export class BotCheckoutModule {}
