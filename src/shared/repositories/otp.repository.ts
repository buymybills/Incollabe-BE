import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Otp } from '../../auth/model/otp.model';
import { APP_CONSTANTS } from '../constants/app.constants';
import { EncryptionService } from '../services/encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpRepository {
  constructor(
    @InjectModel(Otp)
    private readonly otpModel: typeof Otp,
    private readonly encryptionService: EncryptionService,
  ) {}

  async createOtp(data: {
    identifier: string;
    type: 'phone' | 'email';
    otp: string;
    expiresAt: Date;
  }): Promise<Otp> {
    // Manually encrypt and hash before creating
    const identifierHash = crypto
      .createHash('sha256')
      .update(data.identifier)
      .digest('hex');

    const encryptedIdentifier = this.encryptionService.encrypt(data.identifier);

    console.log('Creating OTP with:');
    console.log('Original identifier:', data.identifier);
    console.log('Encrypted identifier:', encryptedIdentifier);
    console.log('Identifier hash:', identifierHash);

    return this.otpModel.create({
      ...data,
      identifier: encryptedIdentifier,
      identifierHash,
      isUsed: false,
      attempts: 0,
    });
  }

  async findValidOtp(
    identifier: string,
    type: 'phone' | 'email',
    otp: string,
  ): Promise<Otp | null> {
    // Create hash of identifier for searching
    const identifierHash = crypto
      .createHash('sha256')
      .update(identifier)
      .digest('hex');

    return this.otpModel.findOne({
      where: {
        identifierHash,
        type,
        otp,
        isUsed: false,
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async markOtpAsUsed(otpId: number): Promise<void> {
    await this.otpModel.update({ isUsed: true }, { where: { id: otpId } });
  }

  async incrementAttempts(otpId: number): Promise<void> {
    await this.otpModel.increment('attempts', { where: { id: otpId } });
  }

  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.otpModel.destroy({
      where: {
        expiresAt: {
          [require('sequelize').Op.lt]: new Date(),
        },
      },
    });
    return result;
  }
}
