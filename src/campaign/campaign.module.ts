import { Module, forwardRef } from '@nestjs/common';
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
// REMOVED: Models only needed for early selection bonus feature (now disabled)
// import { CreditTransaction } from '../admin/models/credit-transaction.model';
// import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { SharedModule } from '../shared/shared.module';
import { Follow } from '../post/models/follow.model';
import { Experience } from '../influencer/models/experience.model';
import { MaxCampaignPaymentService } from './services/max-campaign-payment.service';
import { MaxCampaignInvoice } from './models/max-campaign-invoice.model';
import { InviteOnlyPaymentService } from './services/invite-only-payment.service';
import { InviteOnlyCampaignInvoice } from './models/invite-only-campaign-invoice.model';
import { PaymentStatusCheckerService } from './services/payment-status-checker.service';
import { Post } from '../post/models/post.model';
import { AdminModule } from '../admin/admin.module';
import { InstagramProfileAnalysis } from '../shared/models/instagram-profile-analysis.model';

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
      // REMOVED: Models only needed for early selection bonus feature (now disabled)
      // CreditTransaction,
      // InfluencerReferralUsage,
      Follow,
      Experience,
      MaxCampaignInvoice,
      InviteOnlyCampaignInvoice,
      Post,
      InstagramProfileAnalysis,
    ]),
    SharedModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [CampaignController],
  providers: [
    CampaignService,
    CampaignQueryService,
    MaxCampaignPaymentService,
    InviteOnlyPaymentService,
    PaymentStatusCheckerService,
  ],
  exports: [CampaignService, MaxCampaignPaymentService, InviteOnlyPaymentService],
})
export class CampaignModule {}
