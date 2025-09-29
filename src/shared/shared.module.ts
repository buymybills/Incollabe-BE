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
import { Otp } from '../auth/model/otp.model';

@Module({
  imports: [ConfigModule, SequelizeModule.forFeature([Otp])],
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
  ],
})
export class SharedModule {}
