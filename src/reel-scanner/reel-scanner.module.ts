import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SharedModule } from '../shared/shared.module';
import { ReelScannerService } from './reel-scanner.service';
import { ReelScannerController } from './reel-scanner.controller';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

@Module({
  imports: [SharedModule, SequelizeModule.forFeature([Influencer, Brand])],
  controllers: [ReelScannerController],
  providers: [ReelScannerService, AuthGuard],
  exports: [ReelScannerService],
})
export class ReelScannerModule {}
