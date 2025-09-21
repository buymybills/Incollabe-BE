import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { Brand } from './model/brand.model';
import { BrandNiche } from './model/brand-niche.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { Region } from '../shared/models/region.model';
import { CompanyType } from '../shared/models/company-type.model';
import { RedisService } from '../redis/redis.service';
import { MasterDataService } from '../shared/services/master-data.service';
import { AdminModule } from '../admin/admin.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Brand,
      BrandNiche,
      Niche,
      Country,
      City,
      Region,
      CompanyType,
    ]),
    ConfigModule,
    AdminModule,
    SharedModule,
  ],
  controllers: [BrandController],
  providers: [BrandService, RedisService, MasterDataService],
  exports: [BrandService],
})
export class BrandModule {}
