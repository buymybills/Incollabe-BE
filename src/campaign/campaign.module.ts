import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignQueryService } from './services/campaign-query.service';
import { Campaign } from './models/campaign.model';
import { CampaignCity } from './models/campaign-city.model';
import { CampaignDeliverable } from './models/campaign-deliverable.model';
import { CampaignInvitation } from './models/campaign-invitation.model';
import { CampaignApplication } from './models/campaign-application.model';
import { City } from '../shared/models/city.model';
import { Influencer } from '../auth/model/influencer.model';
import { Niche } from '../auth/model/niche.model';
import { Brand } from '../brand/model/brand.model';
import { SharedModule } from '../shared/shared.module';
import { Follow } from '../post/models/follow.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Campaign,
      CampaignCity,
      CampaignDeliverable,
      CampaignInvitation,
      CampaignApplication,
      City,
      Brand,
      Influencer,
      Niche,
      Follow,
    ]),
    SharedModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignQueryService],
  exports: [CampaignService],
})
export class CampaignModule {}
