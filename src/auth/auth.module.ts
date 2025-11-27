import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountCleanupService } from './account-cleanup.service';
import { Influencer } from './model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { InfluencerNiche } from './model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { NicheSeeder } from '../database/seeders/niche.seeder';
import { CountrySeeder } from '../database/seeders/country.seeder';
import { CitySeeder } from '../database/seeders/city.seeder';
import { CompanyTypeSeeder } from '../database/seeders/company-type.seeder';
import { AdminSeeder } from '../database/seeders/admin.seeder';
import { SeedController } from '../database/seed.controller';
import { SharedModule } from '../shared/shared.module';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Admin } from '../admin/models/admin.model';
import { CustomNiche } from './model/custom-niche.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { InfluencerReferralUsage } from './model/influencer-referral-usage.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Brand,
      Niche,
      Otp,
      InfluencerNiche,
      BrandNiche,
      Country,
      City,
      CompanyType,
      Admin,
      CustomNiche,
      ProfileReview,
      InfluencerReferralUsage,
    ]),
    ScheduleModule.forRoot(),
    SharedModule,
  ],
  controllers: [AuthController, SeedController],
  providers: [
    AuthService,
    AccountCleanupService,
    NicheSeeder,
    CountrySeeder,
    CitySeeder,
    CompanyTypeSeeder,
    AdminSeeder,
  ],
  exports: [
    AuthService,
    NicheSeeder,
    CountrySeeder,
    CitySeeder,
    CompanyTypeSeeder,
    AdminSeeder,
  ],
})
export class AuthModule {}
