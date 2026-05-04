import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
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
        isOverruled: false,
      } as any,
    });

    if (reportCount >= AUTO_SUSPEND_THRESHOLD) {
      if (reportedType === 'influencer') {
        await this.influencerModel.update(
          { isActive: false, isSuspended: true },
          { where: { id: reportedId } },
        );
      } else {
        await this.brandModel.update(
          { isActive: false, isSuspended: true },
          { where: { id: reportedId } },
        );
      }
    }
  }

  async getAllReportedUsers(
    page = 1,
    limit = 20,
    reportedType?: 'influencer' | 'brand',
    search?: string,
  ) {
    const offset = (page - 1) * limit;
    const sequelize = this.reportedUserModel.sequelize!;

    // If search is provided, resolve matching IDs from influencers/brands first
    let matchingInfluencerIds: number[] | null = null;
    let matchingBrandIds: number[] | null = null;

    if (search) {
      const searchPattern = { [Op.iLike]: `%${search}%` };

      const shouldSearchInfluencers = !reportedType || reportedType === 'influencer';
      const shouldSearchBrands = !reportedType || reportedType === 'brand';

      const [matchedInfluencers, matchedBrands] = await Promise.all([
        shouldSearchInfluencers
          ? this.influencerModel.findAll({
              where: { [Op.or]: [{ name: searchPattern }, { username: searchPattern }] },
              attributes: ['id'],
            })
          : Promise.resolve([]),
        shouldSearchBrands
          ? this.brandModel.findAll({
              where: { [Op.or]: [{ brandName: searchPattern }, { username: searchPattern }] },
              attributes: ['id'],
            })
          : Promise.resolve([]),
      ]);

      matchingInfluencerIds = matchedInfluencers.map((i) => i.id);
      matchingBrandIds = matchedBrands.map((b) => b.id);
    }

    // Build WHERE clause for the group query
    const whereClause: WhereOptions<any> = {};
    if (reportedType) {
      whereClause['reportedType'] = reportedType;
    }
    if (matchingInfluencerIds !== null || matchingBrandIds !== null) {
      const conditions: any[] = [];
      if (matchingInfluencerIds?.length) {
        conditions.push({ reportedType: 'influencer', reportedInfluencerId: { [Op.in]: matchingInfluencerIds } });
      }
      if (matchingBrandIds?.length) {
        conditions.push({ reportedType: 'brand', reportedBrandId: { [Op.in]: matchingBrandIds } });
      }
      // No matches for the search term — return empty result immediately
      if (!conditions.length) {
        return { reportedUsers: [], total: 0, page, limit, totalPages: 0 };
      }
      whereClause[Op.or as any] = conditions;
      delete whereClause['reportedType']; // already encoded inside each condition
    }

    // Grouped query: one row per reported user with count and last report date
    const groups = (await this.reportedUserModel.findAll({
      attributes: [
        'reportedType',
        'reportedInfluencerId',
        'reportedBrandId',
        [sequelize.fn('COUNT', sequelize.col('ReportedUser.id')), 'reportCount'],
        [sequelize.fn('MAX', sequelize.col('ReportedUser.created_at')), 'lastReportedAt'],
      ],
      where: whereClause,
      group: ['reportedType', 'reportedInfluencerId', 'reportedBrandId'],
      order: [[sequelize.literal('COUNT("ReportedUser"."id")'), 'DESC']],
      raw: true,
    })) as any[];

    const total = groups.length;
    const pageGroups = groups.slice(offset, offset + limit);

    // Batch-fetch profiles to avoid N+1
    const influencerIds = pageGroups
      .filter((g) => g.reportedType === 'influencer' && g.reportedInfluencerId)
      .map((g) => g.reportedInfluencerId);
    const brandIds = pageGroups
      .filter((g) => g.reportedType === 'brand' && g.reportedBrandId)
      .map((g) => g.reportedBrandId);

    const [influencers, brands] = await Promise.all([
      influencerIds.length
        ? this.influencerModel.findAll({
            where: { id: influencerIds },
            attributes: ['id', 'name', 'username', 'profileImage', 'isActive'],
          })
        : Promise.resolve([]),
      brandIds.length
        ? this.brandModel.findAll({
            where: { id: brandIds },
            attributes: ['id', 'brandName', 'username', 'profileImage', 'isActive'],
          })
        : Promise.resolve([]),
    ]);

    const influencerMap = new Map(influencers.map((i) => [i.id, i.toJSON()]));
    const brandMap = new Map(brands.map((b) => [b.id, b.toJSON()]));

    const reportedUsers = pageGroups.map((group) => {
      let reportedUser: any = null;
      if (group.reportedType === 'influencer' && group.reportedInfluencerId) {
        const inf = influencerMap.get(group.reportedInfluencerId);
        if (inf) reportedUser = { ...inf, userType: 'influencer' };
      } else if (group.reportedType === 'brand' && group.reportedBrandId) {
        const brand = brandMap.get(group.reportedBrandId);
        if (brand) reportedUser = { ...brand, userType: 'brand' };
      }
      return {
        reportedUser,
        reportCount: parseInt(group.reportCount, 10),
        lastReportedAt: group.lastReportedAt,
      };
    });

    return {
      reportedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
      order: [['created_at', 'DESC']],
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

  async hasUserReported(
    reporterId: number,
    reporterType: 'influencer' | 'brand',
    reportedId: number,
    reportedType: 'influencer' | 'brand',
  ): Promise<boolean> {
    const existing = await this.findReport(reporterId, reporterType, reportedId, reportedType);
    return !!existing;
  }

  async setUserStatus(
    userId: number,
    userType: 'influencer' | 'brand',
    action: 'activate' | 'suspend',
  ) {
    const isActive = action === 'activate';
    const isSuspended = action === 'suspend';
    const reportedIdField = userType === 'influencer' ? 'reportedInfluencerId' : 'reportedBrandId';

    if (userType === 'influencer') {
      const user = await this.influencerModel.findByPk(userId);
      if (!user) throw new NotFoundException('Influencer not found');
      await user.update({ isActive, isSuspended });
    } else {
      const user = await this.brandModel.findByPk(userId);
      if (!user) throw new NotFoundException('Brand not found');
      await user.update({ isActive, isSuspended });
    }

    // On activate: overrule all existing reports so they don't re-trigger auto-suspend
    if (action === 'activate') {
      await this.reportedUserModel.update(
        { isOverruled: true, overruledAt: new Date() },
        {
          where: {
            reportedType: userType,
            [reportedIdField]: userId,
            isOverruled: false,
          } as any,
        },
      );
    }

    return {
      message: `User ${action === 'activate' ? 'activated' : 'suspended'} successfully`,
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
