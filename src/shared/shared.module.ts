import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ScheduleModule } from '@nestjs/schedule';
import { SmsService } from './sms.service';
import { S3Service } from './s3.service';
import { EmailService } from './email.service';
import { WhatsAppService } from './whatsapp.service';
import { FirebaseService } from './firebase.service';
import { NotificationService } from './notification.service';
import { OtpService } from './services/otp.service';
import { OtpRepository } from './repositories/otp.repository';
import { LoggerService } from './services/logger.service';
import { CustomNicheService } from './services/custom-niche.service';
import { EncryptionService } from './services/encryption.service';
import { SearchService } from './services/search.service';
import { SupportTicketService } from './support-ticket.service';
import { ChatService } from './chat.service';
import { GroupChatService } from './group-chat.service';
import { ChatGateway } from './chat.gateway';
import { InstagramSyncGateway } from './instagram-sync.gateway';
import { SearchController } from './controllers/search.controller';
import { ChatController } from './chat.controller';
import { InstagramController } from './controllers/instagram.controller';
import { ConfigController } from './controllers/config.controller';
import { InstagramService } from './services/instagram.service';
import { InstagramTokenRefreshCronService } from './services/instagram-token-refresh.cron';
import { CredibilityScoreCronService } from './services/credibility-score.cron';
import { InfluencerCredibilityScoringService } from './services/influencer-credibility-scoring.service';
import { InfluencerProfileScoringService } from './services/influencer-profile-scoring.service';
import { GeminiAIService } from './services/gemini-ai.service';
// import { AIBatchProcessorService } from './services/ai-batch-processor.service';
import { AppReviewController } from './controllers/app-review.controller';
import { AppReviewService } from './services/app-review.service';
import { InfluencerProfileScoringController } from './controllers/influencer-profile-scoring.controller';
import { CampusAmbassadorController } from './controllers/campus-ambassador.controller';
import { CampusAmbassadorService } from './services/campus-ambassador.service';
import { IsValidUsernameConstraint } from './validators/is-valid-username.validator';
import { RazorpayService } from './razorpay.service';
import { Otp } from '../auth/model/otp.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { SupportTicket } from './models/support-ticket.model';
import { SupportTicketReply } from './models/support-ticket-reply.model';
import { Conversation } from './models/conversation.model';
import { Message } from './models/message.model';
import { KeyBackup } from './models/key-backup.model';
import { InstagramMedia } from './models/instagram-media.model';
import { InstagramMediaInsight } from './models/instagram-media-insight.model';
import { InstagramProfileGrowth } from './models/instagram-profile-growth.model';
import { InstagramProfileAnalysis } from './models/instagram-profile-analysis.model';
import { InstagramOnlineFollowers } from './models/instagram-online-followers.model';
import { InfluencerCredibilityScore } from './models/influencer-credibility-score.model';
import { InfluencerProfileScore } from './models/influencer-profile-score.model';
import { CampusAmbassador } from './models/campus-ambassador.model';
import { AppReviewRequest } from './models/app-review-request.model';
import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { CreditTransaction } from '../admin/models/credit-transaction.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { Admin } from '../admin/models/admin.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { CampaignInvitation } from '../campaign/models/campaign-invitation.model';
import { KeyBackupService } from './services/key-backup.service';
import { ChatDecryptionService } from './services/chat-decryption.service';
import { KeyBackupController } from './key-backup.controller';
import { JwtAuthModule } from './jwt.module';
import { DeviceToken } from './models/device-token.model';
import { DeviceTokenService } from './device-token.service';
import { AppVersion } from './models/app-version.model';
import { AppVersionService } from './services/app-version.service';
import { AIScoringService } from './services/ai-scoring.service';
import { CampaignReview } from './models/campaign-review.model';
import { GroupChat } from './models/group-chat.model';
import { GroupMember } from './models/group-member.model';
import { InAppNotification } from './models/in-app-notification.model';
import { InAppNotificationService } from './in-app-notification.service';
import { InAppNotificationController } from './in-app-notification.controller';
import { Post } from '../post/models/post.model';
import { PostView } from '../post/models/post-view.model';
import { Like } from '../post/models/like.model';
import { Share } from '../post/models/share.model';
import { ProfileView } from './models/profile-view.model';
import { ProfileViewService } from './services/profile-view.service';
import { CreatorStudioService } from './creator-studio.service';
import { CreatorStudioController } from './creator-studio.controller';
import { FiamCampaign } from './models/fiam-campaign.model';
import { FiamCampaignEvent } from './models/fiam-campaign-event.model';
import { FiamEventService } from './services/fiam-event.service';
import { FiamTriggerService } from './services/fiam-trigger.service';
import { FiamCampaignMobileService } from './services/fiam-campaign-mobile.service';
import { FiamCampaignMobileController } from './fiam-campaign-mobile.controller';
import { ApiActivityLog } from './models/api-activity-log.model';
import { ApiLoggerMiddleware } from '../middleware/api-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtAuthModule,
    SequelizeModule.forFeature([
      Otp,
      CustomNiche,
      Influencer,
      Brand,
      Niche,
      SupportTicket,
      SupportTicketReply,
      Conversation,
      Message,
      KeyBackup,
      InstagramMedia,
      InstagramMediaInsight,
      InstagramProfileGrowth,
      InstagramProfileAnalysis,
      InstagramOnlineFollowers,
      InfluencerCredibilityScore,
      InfluencerProfileScore,
      CampusAmbassador,
      AppReviewRequest,
      InfluencerReferralUsage,
      CreditTransaction,
      ProfileReview,
      Admin,
      Campaign,
      CampaignApplication,
      CampaignInvitation,
      DeviceToken,
      AppVersion,
      CampaignReview,
      GroupChat,
      GroupMember,
      InAppNotification,
      Post,
      PostView,
      Like,
      Share,
      ProfileView,
      FiamCampaign,
      FiamCampaignEvent,
      ApiActivityLog,
    ]),
  ],
  controllers: [
    SearchController,
    ChatController,
    KeyBackupController,
    InstagramController,
    AppReviewController,
    InfluencerProfileScoringController,
    CampusAmbassadorController,
    ConfigController,
    InAppNotificationController,
    CreatorStudioController,
    FiamCampaignMobileController,
  ],
  providers: [
    SmsService,
    S3Service,
    EmailService,
    WhatsAppService,
    FirebaseService,
    NotificationService,
    OtpService,
    OtpRepository,
    LoggerService,
    CustomNicheService,
    EncryptionService,
    SearchService,
    SupportTicketService,
    ChatService,
    GroupChatService,
    ChatGateway,
    InstagramSyncGateway,
    IsValidUsernameConstraint,
    RazorpayService,
    KeyBackupService,
    ChatDecryptionService,
    InstagramService,
    InstagramTokenRefreshCronService,
    CredibilityScoreCronService,
    InfluencerCredibilityScoringService,
    InfluencerProfileScoringService,
    GeminiAIService,
    // AIBatchProcessorService,
    AppReviewService,
    CampusAmbassadorService,
    DeviceTokenService,
    AppVersionService,
    AIScoringService,
    InAppNotificationService,
    ProfileViewService,
    CreatorStudioService,
    FiamEventService,
    FiamTriggerService,
    FiamCampaignMobileService,
    ApiLoggerMiddleware,
  ],
  exports: [
    SmsService,
    S3Service,
    EmailService,
    WhatsAppService,
    FirebaseService,
    NotificationService,
    OtpService,
    OtpRepository,
    LoggerService,
    SearchService,
    CustomNicheService,
    EncryptionService,
    SupportTicketService,
    ChatService,
    GroupChatService,
    ChatGateway,
    InstagramSyncGateway,
    IsValidUsernameConstraint,
    RazorpayService,
    InstagramService,
    InfluencerCredibilityScoringService,
    InfluencerProfileScoringService,
    GeminiAIService,
    // AIBatchProcessorService,
    AppReviewService,
    CampusAmbassadorService,
    DeviceTokenService,
    AppVersionService,
    AIScoringService,
    InAppNotificationService,
    ProfileViewService,
    CreatorStudioService,
    FiamEventService,
    FiamTriggerService,
    FiamCampaignMobileService,
    ApiLoggerMiddleware,
  ],
})
export class SharedModule { }
