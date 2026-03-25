import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InfluencerController } from './influencer.controller';
import { InfluencerHypeStoreController } from './influencer-hype-store.controller';
import { InfluencerService } from './influencer.service';
import { InfluencerHypeStoreService } from './services/influencer-hype-store.service';
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
import { ProSubscription } from './models/pro-subscription.model';
import { ProInvoice } from './models/pro-invoice.model';
import { ProPaymentTransaction } from './models/pro-payment-transaction.model';
import { ProSubscriptionService } from './services/pro-subscription.service';
import { SubscriptionSchedulerService } from './services/subscription-scheduler.service';
import { InstagramMetricsSchedulerService } from './services/instagram-metrics-scheduler.service';
import { CreditTransaction } from '../admin/models/credit-transaction.model';
import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { InfluencerUpi } from './models/influencer-upi.model';
import { HomePageHistory } from './models/home-page-history.model';
import { CampaignModule } from '../campaign/campaign.module';
import { InstagramProfileAnalysis } from '../shared/models/instagram-profile-analysis.model';
import { HypeStore } from '../wallet/models/hype-store.model';
import { HypeStoreCashbackConfig } from '../hype-store/models/hype-store-cashback-config.model';
import { HypeStoreCouponCode } from '../wallet/models/hype-store-coupon-code.model';
import { HypeStoreOrder } from '../wallet/models/hype-store-order.model';
import { HypeStoreReferralCode } from '../wallet/models/hype-store-referral-code.model';
import { HypeStoreReferralClick } from '../wallet/models/hype-store-referral-click.model';
import { Wallet } from '../wallet/models/wallet.model';
import { WalletTransaction } from '../wallet/models/wallet-transaction.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { ProSubscriptionPromotion } from './models/pro-subscription-promotion.model';
import { SubscriptionMarketingService } from './services/subscription-marketing.service';
import { PostBoostInvoice } from '../post/models/post-boost-invoice.model';
import { DeviceToken } from '../shared/models/device-token.model';
import { NudgeMessageTemplate } from '../shared/models/nudge-message-template.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Brand,
      BrandNiche,
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
      CampaignInvitation,
      CustomNiche,
      ProSubscription,
      ProInvoice,
      ProPaymentTransaction,
      ProSubscriptionPromotion,
      PostBoostInvoice,
      CreditTransaction,
      InfluencerReferralUsage,
      InfluencerUpi,
      InstagramProfileAnalysis,
      HomePageHistory,
      HypeStore,
      HypeStoreCashbackConfig,
      HypeStoreCouponCode,
      HypeStoreOrder,
      HypeStoreReferralCode,
      HypeStoreReferralClick,
      Wallet,
      WalletTransaction,
      DeviceToken,
      NudgeMessageTemplate,
    ]),
    SharedModule,
    CampaignModule,
  ],
  controllers: [InfluencerController, InfluencerHypeStoreController],
  providers: [
    InfluencerService,
    InfluencerHypeStoreService,
    InfluencerRepository,
    ProSubscriptionService,
    SubscriptionSchedulerService,
    InstagramMetricsSchedulerService,
    SubscriptionMarketingService,
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
    {
      provide: 'CREDIT_TRANSACTION_MODEL',
      useValue: CreditTransaction,
    },
    {
      provide: 'INFLUENCER_REFERRAL_USAGE_MODEL',
      useValue: InfluencerReferralUsage,
    },
    {
      provide: 'INFLUENCER_UPI_MODEL',
      useValue: InfluencerUpi,
    },
    {
      provide: 'PRO_SUBSCRIPTION_MODEL',
      useValue: ProSubscription,
    },
    {
      provide: 'INSTAGRAM_PROFILE_ANALYSIS_MODEL',
      useValue: InstagramProfileAnalysis,
    },
    {
      provide: 'HOME_PAGE_HISTORY_MODEL',
      useValue: HomePageHistory,
    },
    {
      provide: 'BRAND_MODEL',
      useValue: Brand,
    },
  ],
  exports: [InfluencerService, InfluencerRepository, ProSubscriptionService, SubscriptionMarketingService],
})
export class InfluencerModule {}
