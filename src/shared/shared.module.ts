import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
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
import { SearchController } from './controllers/search.controller';
import { IsValidUsernameConstraint } from './validators/is-valid-username.validator';
import { Otp } from '../auth/model/otp.model';
import { CustomNiche } from '../auth/model/custom-niche.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { SupportTicket } from './models/support-ticket.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Otp, CustomNiche, Influencer, Brand, Niche, SupportTicket]),
  ],
  controllers: [SearchController],
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
    IsValidUsernameConstraint,
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
    IsValidUsernameConstraint,
  ],
})
export class SharedModule {}
