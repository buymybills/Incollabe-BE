import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SmsService } from "./sms.service";
import { S3Service } from "./s3.service";

@Module({
  imports: [ConfigModule],
  providers: [SmsService, S3Service],
  exports: [SmsService, S3Service],
})
export class SharedModule {}
