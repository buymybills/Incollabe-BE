import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotCustomer } from './models/bot-customer.model';
import { BotAddress } from './models/bot-address.model';
import { BotOrder } from './models/bot-order.model';
import { BotCheckoutService } from './bot-checkout.service';
import { BotCheckoutController } from './bot-checkout.controller';
import { CheckoutPageController } from './checkout-page.controller';
import { BotAnalyticsModule } from '../bot-analytics/bot-analytics.module';

@Module({
  imports: [
    SequelizeModule.forFeature([BotCustomer, BotAddress, BotOrder]),
    BotAnalyticsModule,
  ],
  controllers: [BotCheckoutController, CheckoutPageController],
  providers: [BotCheckoutService],
  exports: [BotCheckoutService],
})
export class BotCheckoutModule {}
