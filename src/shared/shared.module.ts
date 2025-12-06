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
import { InstagramService } from './services/instagram.service';
import { InstagramSyncCronService } from './services/instagram-sync.cron';
import { IsValidUsernameConstraint } from './validators/is-valid-username.validator';
import { RazorpayService } from './razorpay.service';
import { Otp } from '../auth/model/otp.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { SupportTicket } from './models/support-ticket.model';
import { Conversation } from './models/conversation.model';
import { Message } from './models/message.model';
import { KeyBackup } from './models/key-backup.model';
import { KeyBackupService } from './services/key-backup.service';
import { KeyBackupController } from './key-backup.controller';
import { JwtAuthModule } from './jwt.module';

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
      Conversation,
      Message,
      KeyBackup,
    ]),
  ],
  controllers: [SearchController, ChatController, KeyBackupController, InstagramController],
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
  ],
})
export class SharedModule { }
