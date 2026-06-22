import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SharedModule } from '../shared/shared.module';
import { Influencer } from '../auth/model/influencer.model';
import { StockAlertController } from './stock-alert.controller';
import { StockAlertService } from './stock-alert.service';

// SharedModule provides NotificationService + DeviceTokenService; forFeature gives
// the Influencer model for the igsid → app-user lookup.
@Module({
  imports: [SharedModule, SequelizeModule.forFeature([Influencer])],
  controllers: [StockAlertController],
  providers: [StockAlertService],
})
export class StockAlertModule {}
