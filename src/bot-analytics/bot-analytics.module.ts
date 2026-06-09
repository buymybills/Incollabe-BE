import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BotEvent } from './models/bot-event.model';
import { BotAnalyticsService } from './bot-analytics.service';
import { BotAnalyticsController } from './bot-analytics.controller';

@Module({
  imports: [SequelizeModule.forFeature([BotEvent])],
  controllers: [BotAnalyticsController],
  providers: [BotAnalyticsService],
  exports: [BotAnalyticsService],
})
export class BotAnalyticsModule {}
