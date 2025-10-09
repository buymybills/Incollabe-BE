import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InfluencerController } from './influencer.controller';
import { InfluencerService } from './influencer.service';
import { InfluencerRepository } from './repositories/influencer.repository';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { Experience } from './models/experience.model';
import { ExperienceSocialLink } from './models/experience-social-link.model';
import { Follow } from '../post/models/follow.model';
import { Post } from '../post/models/post.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { Admin } from '../admin/models/admin.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { CampaignInvitation } from '../campaign/models/campaign-invitation.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Brand,
      Niche,
      InfluencerNiche,
      Experience,
      ExperienceSocialLink,
      Follow,
      Post,
      Country,
      City,
      ProfileReview,
      Admin,
      Campaign,
      CampaignApplication,
      CustomNiche,
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
      provide: 'ADMIN_MODEL',
      useValue: Admin,
    },
    {
      provide: 'CAMPAIGN_MODEL',
      useValue: Campaign,
    },
    {
      provide: 'CAMPAIGN_APPLICATION_MODEL',
      useValue: CampaignApplication,
    },
    {
      provide: 'CAMPAIGN_INVITATION_MODEL',
      useValue: CampaignInvitation,
    },
    {
      provide: 'NICHE_MODEL',
      useValue: Niche,
    },
    {
      provide: 'INFLUENCER_NICHE_MODEL',
      useValue: InfluencerNiche,
    },
    {
      provide: 'EXPERIENCE_MODEL',
      useValue: Experience,
    },
    {
      provide: 'EXPERIENCE_SOCIAL_LINK_MODEL',
      useValue: ExperienceSocialLink,
    },
    {
      provide: 'FOLLOW_MODEL',
      useValue: Follow,
    },
    {
      provide: 'POST_MODEL',
      useValue: Post,
    },
    {
      provide: 'CUSTOM_NICHE_MODEL',
      useValue: CustomNiche,
    },
  ],
  exports: [InfluencerService, InfluencerRepository],
})
export class InfluencerModule {}
