import { Injectable, BadRequestException } from '@nestjs/common';
import { OtpRepository } from '../repositories/otp.repository';
import { APP_CONSTANTS, ERROR_MESSAGES } from '../constants/app.constants';

// Private types for OtpService
type OtpType = 'phone' | 'email';
type CreateOtpData = {
  identifier: string;
  type: OtpType;
};
type VerifyOtpData = {
  identifier: string;
  type: OtpType;
  otp: string;
};

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}

  async generateAndStoreOtp(data: CreateOtpData): Promise<string> {
    const otp = this.generateOtp();
    const expiresAt = this.calculateExpiryTime();

    await this.otpRepository.createOtp({
      identifier: data.identifier,
      type: data.type,
      otp,
      expiresAt,
    });

    return otp;
  }

  async verifyOtp(data: VerifyOtpData): Promise<void> {
    this.validateOtpFormat(data.otp);

    const otpRecord = await this.otpRepository.findValidOtp(
      data.identifier,
      data.type,
      data.otp,
    );

    if (!otpRecord) {
      throw new BadRequestException(ERROR_MESSAGES.OTP.INVALID);
    }

    if (this.isOtpExpired(otpRecord.expiresAt)) {
      throw new BadRequestException(ERROR_MESSAGES.OTP.EXPIRED);
    }

    await this.otpRepository.markOtpAsUsed(otpRecord.id);
  }

  private generateOtp(): string {
    const min = APP_CONSTANTS.OTP.MIN_VALUE;
    const max = APP_CONSTANTS.OTP.MAX_VALUE;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private calculateExpiryTime(): Date {
    const expiryTime = new Date();
    expiryTime.setMinutes(
      expiryTime.getMinutes() + APP_CONSTANTS.OTP.EXPIRY_MINUTES,
    );
    return expiryTime;
  }

  private validateOtpFormat(otp: string): void {
    const otpLength = APP_CONSTANTS.OTP.LENGTH;
    const otpRegex = new RegExp(`^\\d{${otpLength}}$`);

    if (otp.length !== otpLength || !otpRegex.test(otp)) {
      throw new BadRequestException(ERROR_MESSAGES.OTP.INVALID_FORMAT);
    }
  }

  private isOtpExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }
}
