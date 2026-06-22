import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SharedModule } from '../shared/shared.module';
import { BotOrder } from '../bot-checkout/models/bot-order.model';
import { BotRefundController } from './bot-refund.controller';
import { BotRefundService } from './bot-refund.service';

// SharedModule provides RazorpayService; forFeature gives the BotOrder model.
@Module({
  imports: [SharedModule, SequelizeModule.forFeature([BotOrder])],
  controllers: [BotRefundController],
  providers: [BotRefundService],
})
export class BotRefundModule {}
