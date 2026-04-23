import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bull';

import { AdminController } from './admin.controller';
import { PushNotificationController } from './push-notification.controller';
import { FiamCampaignController } from './fiam-campaign.controller';
import { ApiActivityLogsController } from './controllers/api-activity-logs.controller';
import { HypeStoreAdminController } from './hype-store-admin.controller';
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
import { AdminCreatorScoreService } from './services/admin-creator-score.service';
import { NudgeTemplateService } from './services/nudge-template.service';
import { FiamCampaignService } from './services/fiam-campaign.service';
import { FiamCampaignBroadcastService } from './services/fiam-campaign-broadcast.service';
import { HypeStoreAdminService } from './services/hype-store-admin.service';
import { TopInfluencerCacheCronService } from './services/top-influencer-cache.cron';
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
import { ProSubscriptionPromotion } from '../influencer/models/pro-subscription-promotion.model';
import { MaxCampaignInvoice } from '../campaign/models/max-campaign-invoice.model';
import { InviteOnlyCampaignInvoice } from '../campaign/models/invite-only-campaign-invoice.model';
import { NudgeMessageTemplate } from '../shared/models/nudge-message-template.model';
import { FiamCampaign } from '../shared/models/fiam-campaign.model';
import { FiamCampaignEvent } from '../shared/models/fiam-campaign-event.model';
import { DeviceToken } from '../shared/models/device-token.model';
import { ApiActivityLog } from '../shared/models/api-activity-log.model';
import { HypeStore } from '../wallet/models/hype-store.model';
import { HypeStoreOrder } from '../wallet/models/hype-store-order.model';
import { Wallet } from '../wallet/models/wallet.model';
import { WalletTransaction } from '../wallet/models/wallet-transaction.model';
import { HypeStoreCashbackConfig } from '../hype-store/models/hype-store-cashback-config.model';
import { HypeStoreCouponCode } from '../wallet/models/hype-store-coupon-code.model';
import { HypeStoreWallet } from '../hype-store/models/hype-store-wallet.model';
import { HypeStoreWalletTransaction } from '../hype-store/models/hype-store-wallet-transaction.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { Conversation } from '../shared/models/conversation.model';
import { TopInfluencerScoreCache } from './models/top-influencer-score-cache.model';

import { SharedModule } from '../shared/shared.module';
import { BrandModule } from '../brand/brand.module';
import { InfluencerModule } from '../influencer/influencer.module';
import { PostModule } from '../post/post.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignModule } from '../campaign/campaign.module';

import { AdminManagementController } from './controllers/admin-management.controller';
import { AdminManagementService } from './services/admin-management.service';
import { AdminRoleController } from './controllers/admin-role.controller';
import { AdminRoleService } from './services/admin-role.service';
import { AdminRoleDefinition } from './models/admin-role-definition.model';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

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
      ProSubscriptionPromotion,
      MaxCampaignInvoice,
      InviteOnlyCampaignInvoice,
      NudgeMessageTemplate,
      FiamCampaign,
      FiamCampaignEvent,
      DeviceToken,
      ApiActivityLog,
      HypeStore,
      HypeStoreOrder,
      Wallet,
      WalletTransaction,
      HypeStoreCashbackConfig,
      HypeStoreCouponCode,
      HypeStoreWallet,
      HypeStoreWalletTransaction,
      BrandNiche,
      Conversation,
      TopInfluencerScoreCache,
      AdminRoleDefinition,
    ]),
    SharedModule,
    NotificationQueueModule,
    forwardRef(() => BrandModule),
    forwardRef(() => InfluencerModule),
    PostModule,
    forwardRef(() => AuthModule),
    forwardRef(() => CampaignModule),
  ],
  controllers: [
    AdminController,
    PushNotificationController,
    FiamCampaignController,
    ApiActivityLogsController,
    HypeStoreAdminController,
    AdminManagementController,
    AdminRoleController,
  ],
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
    AdminCreatorScoreService,
    NudgeTemplateService,
    FiamCampaignService,
    FiamCampaignBroadcastService,
    HypeStoreAdminService,
    TopInfluencerCacheCronService,
    AdminManagementService,
    AdminRoleService,
    AdminAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [AdminAuthService, ProfileReviewService, AuditLogService, InfluencerScoringService],
})
export class AdminModule {}
