import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SharedModule } from '../shared/shared.module';
import { ReelScannerModule } from '../reel-scanner/reel-scanner.module';
import { CatalogSearchModule } from '../catalog-search/catalog-search.module';
import { ShoppingAgentService } from './shopping-agent.service';
import { ShoppingAgentController } from './shopping-agent.controller';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

@Module({
  imports: [SharedModule, ReelScannerModule, CatalogSearchModule, SequelizeModule.forFeature([Influencer, Brand])],
  controllers: [ShoppingAgentController],
  providers: [ShoppingAgentService, AuthGuard],
  exports: [ShoppingAgentService],
})
export class ShoppingAgentModule {}
