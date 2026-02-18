import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bull';

import { AdminController } from './admin.controller';
import { PushNotificationController } from './push-notification.controller';
import { AdminAuthService } from './admin-auth.service';
import { ProfileReviewService } from './profile-review.service';
import { AdminCampaignService } from './services/admin-campaign.service';
import { AdminPostService } from './services/admin-post.service';
import { InfluencerScoringService } from './services/influencer-scoring.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { PushNotificationService } from './services/push-notification.service';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { AuditLogService } from './services/audit-log.service';
import { ReferralProgramService } from './services/referral-program.service';
import { MaxxSubscriptionAdminService } from './services/maxx-subscription-admin.service';
import { MaxSubscriptionBrandService } from './services/max-subscription-brand.service';
import { MaxSubscriptionInvoiceService } from './services/max-subscription-invoice.service';
import { InvoiceExcelExportService } from './services/invoice-excel-export.service';
import { NotificationQueueModule } from './queues/notification.queue.module';

import { Admin } from './models/admin.model';
import { ProfileReview } from './models/profile-review.model';
import { PushNotification } from './models/push-notification.model';
import { DeepLink } from './models/deep-link.model';
import { AuditLog } from './models/audit-log.model';
import { CreditTransaction } from './models/credit-transaction.model';
import { Brand } from '../brand/model/brand.model';
import { Influencer } from '../auth/model/influencer.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { Niche } from '../auth/model/niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { CampaignCity } from '../campaign/models/campaign-city.model';
import { CampaignDeliverable } from '../campaign/models/campaign-deliverable.model';
import { Experience } from '../influencer/models/experience.model';
import { Follow } from '../post/models/follow.model';
import { Post } from '../post/models/post.model';
import { InstagramMediaInsight } from '../shared/models/instagram-media-insight.model';
import { InfluencerProfileScore } from '../shared/models/influencer-profile-score.model';
import { InstagramProfileAnalysis } from '../shared/models/instagram-profile-analysis.model';
import { ProSubscription } from '../influencer/models/pro-subscription.model';
import { ProInvoice } from '../influencer/models/pro-invoice.model';
import { MaxCampaignInvoice } from '../campaign/models/max-campaign-invoice.model';
import { InviteOnlyCampaignInvoice } from '../campaign/models/invite-only-campaign-invoice.model';

import { SharedModule } from '../shared/shared.module';
import { BrandModule } from '../brand/brand.module';
import { InfluencerModule } from '../influencer/influencer.module';
import { PostModule } from '../post/post.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignModule } from '../campaign/campaign.module';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Admin,
      ProfileReview,
      PushNotification,
      DeepLink,
      AuditLog,
      CreditTransaction,
      Brand,
      Influencer,
      InfluencerNiche,
      InfluencerReferralUsage,
      Niche,
      Country,
      City,
      CompanyType,
      Campaign,
      CampaignApplication,
      CampaignCity,
      CampaignDeliverable,
      Experience,
      Follow,
      Post,
      InstagramMediaInsight,
      InfluencerProfileScore,
      InstagramProfileAnalysis,
      ProSubscription,
      ProInvoice,
      MaxCampaignInvoice,
      InviteOnlyCampaignInvoice,
    ]),
    SharedModule,
    NotificationQueueModule,
    forwardRef(() => BrandModule),
    forwardRef(() => InfluencerModule),
    PostModule,
    forwardRef(() => AuthModule),
    forwardRef(() => CampaignModule),
  ],
  controllers: [AdminController, PushNotificationController],
  providers: [
    AdminAuthService,
    ProfileReviewService,
    AdminCampaignService,
    AdminPostService,
    InfluencerScoringService,
    DashboardStatsService,
    PushNotificationService,
    NotificationSchedulerService,
    AuditLogService,
    ReferralProgramService,
    MaxxSubscriptionAdminService,
    MaxSubscriptionBrandService,
    MaxSubscriptionInvoiceService,
    InvoiceExcelExportService,
    AdminAuthGuard,
    RolesGuard,
  ],
  exports: [AdminAuthService, ProfileReviewService, AuditLogService],
})
export class AdminModule {}
