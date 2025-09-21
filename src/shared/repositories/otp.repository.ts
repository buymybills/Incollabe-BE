import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Otp } from '../../auth/model/otp.model';
import { APP_CONSTANTS } from '../constants/app.constants';

@Injectable()
export class OtpRepository {
  constructor(
    @InjectModel(Otp)
    private readonly otpModel: typeof Otp,
  ) {}

  async createOtp(data: {
    identifier: string;
    type: 'phone' | 'email';
    otp: string;
    expiresAt: Date;
  }): Promise<Otp> {
    return this.otpModel.create({
      ...data,
      isUsed: false,
      attempts: 0,
    });
  }

  async findValidOtp(
    identifier: string,
    type: 'phone' | 'email',
    otp: string,
  ): Promise<Otp | null> {
    return this.otpModel.findOne({
      where: {
        identifier,
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
