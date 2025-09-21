import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InfluencerController } from './influencer.controller';
import { InfluencerService } from './influencer.service';
import { InfluencerRepository } from './repositories/influencer.repository';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Niche,
      Country,
      City,
      ProfileReview,
    ]),
    SharedModule,
  ],
  controllers: [InfluencerController],
  providers: [
    InfluencerService,
    InfluencerRepository,
    {
      provide: 'PROFILE_REVIEW_MODEL',
      useValue: ProfileReview,
    },
  ],
  exports: [InfluencerService, InfluencerRepository],
})
export class InfluencerModule {}
