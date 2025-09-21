import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
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
import { SeedController } from '../database/seed.controller';
import { SharedModule } from '../shared/shared.module';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';

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
    ]),
    SharedModule,
  ],
  controllers: [AuthController, SeedController],
  providers: [
    AuthService,
    NicheSeeder,
    CountrySeeder,
    CitySeeder,
    CompanyTypeSeeder,
  ],
  exports: [
    AuthService,
    NicheSeeder,
    CountrySeeder,
    CitySeeder,
    CompanyTypeSeeder,
  ],
})
export class AuthModule {}
