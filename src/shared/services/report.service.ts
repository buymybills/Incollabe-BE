import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  ReportedUser,
  ReportUserType,
  ReportReason,
  AUTO_SUSPEND_THRESHOLD,
} from '../models/reported-user.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(ReportedUser)
    private reportedUserModel: typeof ReportedUser,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
  ) {}

  async reportUser(
    reporterId: number,
    reporterType: 'influencer' | 'brand',
    reportedId: number,
    reportedType: 'influencer' | 'brand',
    reason: ReportReason,
    description?: string,
  ) {
    if (reporterId === reportedId && reporterType === reportedType) {
      throw new BadRequestException('Cannot report yourself');
    }

    // Verify reported user exists
    if (reportedType === 'influencer') {
      const user = await this.influencerModel.findByPk(reportedId);
      if (!user) throw new NotFoundException('User not found');
    } else {
      const user = await this.brandModel.findByPk(reportedId);
      if (!user) throw new NotFoundException('User not found');
    }

    const existing = await this.findReport(reporterId, reporterType, reportedId, reportedType);
    if (existing) {
      return { message: 'You have already reported this user' };
    }

    await this.reportedUserModel.create({
      reporterType,
      reporterInfluencerId: reporterType === 'influencer' ? reporterId : null,
      reporterBrandId: reporterType === 'brand' ? reporterId : null,
      reportedType,
      reportedInfluencerId: reportedType === 'influencer' ? reportedId : null,
      reportedBrandId: reportedType === 'brand' ? reportedId : null,
      reason,
      description: description || null,
    } as any);

    // Check if threshold reached and auto-suspend
    await this.checkAndSuspendIfThresholdReached(reportedId, reportedType);

    return { message: 'User reported successfully' };
  }

  private async checkAndSuspendIfThresholdReached(
    reportedId: number,
    reportedType: 'influencer' | 'brand',
  ) {
    const reportedIdField =
      reportedType === 'influencer' ? 'reportedInfluencerId' : 'reportedBrandId';

    const reportCount = await this.reportedUserModel.count({
      where: {
        reportedType,
        [reportedIdField]: reportedId,
      } as any,
    });

    if (reportCount >= AUTO_SUSPEND_THRESHOLD) {
      if (reportedType === 'influencer') {
        await this.influencerModel.update(
          { isActive: false },
          { where: { id: reportedId } },
        );
      } else {
        await this.brandModel.update(
          { isActive: false },
          { where: { id: reportedId } },
        );
      }
    }
  }

  async getReportsAgainstUser(
    reportedId: number,
    reportedType: 'influencer' | 'brand',
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;
    const reportedIdField =
      reportedType === 'influencer' ? 'reportedInfluencerId' : 'reportedBrandId';

    const { count, rows } = await this.reportedUserModel.findAndCountAll({
      where: {
        reportedType,
        [reportedIdField]: reportedId,
      } as any,
      include: [
        {
          model: Influencer,
          as: 'reporterInfluencer',
          attributes: ['id', 'name', 'username', 'profileImage'],
          required: false,
        },
        {
          model: Brand,
          as: 'reporterBrand',
          attributes: ['id', 'brandName', 'username', 'profileImage'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const reports = rows.map((row) => {
      const data = row.toJSON() as any;
      const reporter =
        data.reporterType === 'influencer'
          ? { ...data.reporterInfluencer, userType: 'influencer' }
          : { ...data.reporterBrand, userType: 'brand' };
      return {
        reportId: data.id,
        reason: data.reason,
        description: data.description,
        reportedAt: data.createdAt,
        reporter,
      };
    });

    return {
      reports,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  private async findReport(
    reporterId: number,
    reporterType: 'influencer' | 'brand',
    reportedId: number,
    reportedType: 'influencer' | 'brand',
  ): Promise<ReportedUser | null> {
    const reporterIdField =
      reporterType === 'influencer' ? 'reporterInfluencerId' : 'reporterBrandId';
    const reportedIdField =
      reportedType === 'influencer' ? 'reportedInfluencerId' : 'reportedBrandId';

    return this.reportedUserModel.findOne({
      where: {
        reporterType,
        [reporterIdField]: reporterId,
        reportedType,
        [reportedIdField]: reportedId,
      } as any,
    });
  }
}
