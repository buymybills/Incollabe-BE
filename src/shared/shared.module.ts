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
import { ChatGateway } from './chat.gateway';
import { SearchController } from './controllers/search.controller';
import { ChatController } from './chat.controller';
import { InstagramController } from './controllers/instagram.controller';
import { ConfigController } from './controllers/config.controller';
import { InstagramService } from './services/instagram.service';
import { InstagramSyncCronService } from './services/instagram-sync.cron';
import { InstagramDemographicsCronService } from './services/instagram-demographics.cron';
import { InstagramGrowthCronService } from './services/instagram-growth.cron';
import { CredibilityScoreCronService } from './services/credibility-score.cron';
import { InfluencerCredibilityScoringService } from './services/influencer-credibility-scoring.service';
import { InfluencerProfileScoringService } from './services/influencer-profile-scoring.service';
import { GeminiAIService } from './services/gemini-ai.service';
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
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { CampaignInvitation } from '../campaign/models/campaign-invitation.model';
import { KeyBackupService } from './services/key-backup.service';
import { KeyBackupController } from './key-backup.controller';
import { JwtAuthModule } from './jwt.module';
import { DeviceToken } from './models/device-token.model';
import { DeviceTokenService } from './device-token.service';
import { AppVersion } from './models/app-version.model';
import { AppVersionService } from './services/app-version.service';

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
      Campaign,
      CampaignApplication,
      CampaignInvitation,
      DeviceToken,
      AppVersion,
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
    ChatGateway,
    IsValidUsernameConstraint,
    RazorpayService,
    KeyBackupService,
    InstagramService,
    InstagramSyncCronService,
    InstagramDemographicsCronService,
    InstagramGrowthCronService,
    CredibilityScoreCronService,
    InfluencerCredibilityScoringService,
    InfluencerProfileScoringService,
    GeminiAIService,
    AppReviewService,
    CampusAmbassadorService,
    DeviceTokenService,
    AppVersionService,
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
    IsValidUsernameConstraint,
    RazorpayService,
    InstagramService,
    InfluencerCredibilityScoringService,
    InfluencerProfileScoringService,
    GeminiAIService,
    AppReviewService,
    CampusAmbassadorService,
    DeviceTokenService,
    AppVersionService,
  ],
})
export class SharedModule { }
