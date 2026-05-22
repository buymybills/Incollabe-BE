import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SharedModule } from '../shared/shared.module';
import { CatalogSearchService } from './catalog-search.service';
import { CatalogSearchController } from './catalog-search.controller';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

@Module({
  imports: [SharedModule, SequelizeModule.forFeature([Influencer, Brand])],
  controllers: [CatalogSearchController],
  providers: [CatalogSearchService, AuthGuard],
  exports: [CatalogSearchService],
})
export class CatalogSearchModule {}
