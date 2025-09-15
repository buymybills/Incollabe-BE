import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { S3Service } from './s3.service';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [SmsService, S3Service, EmailService],
  exports: [SmsService, S3Service, EmailService],
})
export class SharedModule {}
