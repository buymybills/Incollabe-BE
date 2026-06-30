import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { JwtService } from '@nestjs/jwt';
import { Consumer } from '../auth/model/consumer.model';
import { Influencer } from '../auth/model/influencer.model';
import { InfluencerInviteCode } from '../auth/model/influencer-invite-code.model';
import { S3Service } from '../shared/s3.service';
import { SaveConsumerProfileDto } from './dto/save-consumer-profile.dto';
import { BecomeInfluencerDto } from './dto/become-influencer.dto';

@Injectable()
export class ConsumerService {
  constructor(
    @InjectModel(Consumer)
    private readonly consumerModel: typeof Consumer,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(InfluencerInviteCode)
    private readonly inviteCodeModel: typeof InfluencerInviteCode,
    private readonly s3Service: S3Service,
    private readonly jwtService: JwtService,
  ) {}

  async getProfile(consumerId: number) {
    const consumer = await this.consumerModel.findByPk(consumerId);
    if (!consumer) throw new NotFoundException('Consumer not found');

    return {
      id: consumer.id,
      phone: consumer.phone ?? null,
      name: consumer.name ?? null,
      profileImage: consumer.profileImage ?? null,
      dateOfBirth: consumer.dateOfBirth ?? null,
    };
  }

  async saveProfile(
    consumerId: number,
    dto: SaveConsumerProfileDto,
    profileImage?: Express.Multer.File,
  ) {
    const consumer = await this.consumerModel.findByPk(consumerId);
    if (!consumer) throw new NotFoundException('Consumer not found');

    const updates: any = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.dateOfBirth !== undefined) updates.dateOfBirth = dto.dateOfBirth;

    if (profileImage) {
      updates.profileImage = await this.s3Service.uploadFileToS3(
        profileImage,
        'consumers',
        `profile-${consumerId}`,
      );
    }

    await consumer.update(updates);

    return {
      message: 'Profile saved successfully',
      id: consumer.id,
      name: consumer.name ?? null,
      profileImage: consumer.profileImage ?? null,
      dateOfBirth: consumer.dateOfBirth ?? null,
    };
  }

  async becomeInfluencer(consumerId: number, dto: BecomeInfluencerDto) {
    const consumer = await this.consumerModel.findByPk(consumerId);
    if (!consumer) throw new NotFoundException('Consumer not found');

    if (!consumer.name) {
      throw new BadRequestException('Please save your profile name before becoming an influencer');
    }

    // Validate invite code
    const inviteCode = await this.inviteCodeModel.findOne({
      where: { code: dto.inviteCode, isActive: true },
    });
    if (!inviteCode) throw new ForbiddenException('Invalid or inactive invite code');

    // Check influencer doesn't already exist for this phone (check both phoneHash and phone)
    const whereClause: any = { phone: consumer.phone };
    if (consumer.phoneHash) whereClause[Op.or] = [{ phone: consumer.phone }, { phoneHash: consumer.phoneHash }];
    const existing = await this.influencerModel.findOne({ where: whereClause });
    if (existing) throw new ConflictException('An influencer account already exists for this phone number');

    const influencer = await this.influencerModel.create({
      phone: consumer.phone,
      phoneHash: consumer.phoneHash,
      name: consumer.name,
      profileImage: consumer.profileImage ?? null,
      dateOfBirth: consumer.dateOfBirth ?? null,
      isPhoneVerified: true,
      isActive: true,
      inviteCode: inviteCode.code,
      isHypeInfluencer: true,
      hypeInfluencerLevel: 1,
      hypeReelsCount: 0,
    });

    await inviteCode.update({ totalUsed: inviteCode.totalUsed + 1 });

    const accessToken = this.jwtService.sign(
      { id: influencer.id, userType: 'influencer', profileCompleted: false },
      { expiresIn: '7d' },
    );

    return {
      message: 'Welcome to HYPE! Complete your profile to get started.',
      accessToken,
      influencerId: influencer.id,
      isHypeInfluencer: true,
    };
  }
}
