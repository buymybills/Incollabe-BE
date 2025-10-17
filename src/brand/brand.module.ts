import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { Brand } from './model/brand.model';
import { BrandNiche } from './model/brand-niche.model';
import { Niche } from '../auth/model/niche.model';
import { Influencer } from '../auth/model/influencer.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { Region } from '../shared/models/region.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Follow } from '../post/models/follow.model';
import { Post } from '../post/models/post.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { Admin } from '../admin/models/admin.model';
import { RedisService } from '../redis/redis.service';
import { MasterDataService } from '../shared/services/master-data.service';
import { AdminModule } from '../admin/admin.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Brand,
      Influencer,
      BrandNiche,
      Niche,
      Country,
      City,
      Region,
      CompanyType,
      Follow,
      Post,
      Campaign,
      CustomNiche,
      ProfileReview,
      Admin,
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
