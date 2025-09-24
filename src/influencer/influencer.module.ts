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
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Niche,
      Country,
      City,
      ProfileReview,
      Campaign,
      CampaignApplication,
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
    {
      provide: 'CAMPAIGN_MODEL',
      useValue: Campaign,
    },
    {
      provide: 'CAMPAIGN_APPLICATION_MODEL',
      useValue: CampaignApplication,
    },
  ],
  exports: [InfluencerService, InfluencerRepository],
})
export class InfluencerModule {}
