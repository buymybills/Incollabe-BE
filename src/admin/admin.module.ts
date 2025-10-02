import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { AdminController } from './admin.controller';
import { AdminAuthService } from './admin-auth.service';
import { ProfileReviewService } from './profile-review.service';

import { Admin } from './models/admin.model';
import { ProfileReview } from './models/profile-review.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';

import { SharedModule } from '../shared/shared.module';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Admin,
      ProfileReview,
      Brand,
      Influencer,
      Niche,
      Country,
      City,
      CompanyType,
    ]),
    SharedModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminAuthService,
    ProfileReviewService,
    AdminAuthGuard,
    RolesGuard,
  ],
  exports: [AdminAuthService, ProfileReviewService],
})
export class AdminModule {}
