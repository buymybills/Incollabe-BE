import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { AdminController } from './admin.controller';
import { PushNotificationController } from './push-notification.controller';
import { AdminAuthService } from './admin-auth.service';
import { ProfileReviewService } from './profile-review.service';
import { AdminCampaignService } from './services/admin-campaign.service';
import { AdminPostService } from './services/admin-post.service';
import { AIScoringService } from './services/ai-scoring.service';
import { InfluencerScoringService } from './services/influencer-scoring.service';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { PushNotificationService } from './services/push-notification.service';
import { AuditLogService } from './services/audit-log.service';

import { Admin } from './models/admin.model';
import { ProfileReview } from './models/profile-review.model';
import { PushNotification } from './models/push-notification.model';
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
    ]),
    SharedModule,
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
    AIScoringService,
    InfluencerScoringService,
    DashboardStatsService,
    PushNotificationService,
    AuditLogService,
    AdminAuthGuard,
    RolesGuard,
  ],
  exports: [AdminAuthService, ProfileReviewService, AuditLogService],
})
export class AdminModule {}
