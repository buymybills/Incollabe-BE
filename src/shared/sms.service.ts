import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly FAST2SMS_API: string;
  private readonly AUTH_KEY: string;
  private readonly SENDER_ID: string;
  private readonly TEMPLATE_ID: string;

  constructor(private readonly configService: ConfigService) {
    this.FAST2SMS_API = this.configService.get<string>('FAST2SMS_API')!;
    this.AUTH_KEY = this.configService.get<string>('AUTH_KEY')!;
    this.SENDER_ID = this.configService.get<string>('SENDER_ID')!;
    this.TEMPLATE_ID = this.configService.get<string>('TEMPLATE_ID')!;
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    try {
      const params = {
        authorization: this.AUTH_KEY,
        route: 'dlt',
        sender_id: this.SENDER_ID,
        message: this.TEMPLATE_ID,
        variables_values: otp,
        numbers: phone,
      };

      const response = await axios.get(this.FAST2SMS_API, { params });

      this.logger.log(
        `SMS sent to ${phone}, response: ${JSON.stringify(response.data)}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phone}`, error.stack);
      throw new NotFoundException('Failed to send OTP via SMS');
    }
  }
}
