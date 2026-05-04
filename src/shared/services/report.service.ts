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
      isOverruled: false,
    } as any);

    // Check if threshold reached and auto-suspend
    await this.checkAndSuspendIfThresholdReached(reportedId, reportedType);

    return { message: 'User reported successfully' };
  }

  async hasUserReported(
    reporterId: number,
    reporterType: 'influencer' | 'brand',
    reportedId: number,
    reportedType: 'influencer' | 'brand',
  ): Promise<boolean> {
    const report = await this.findReport(reporterId, reporterType, reportedId, reportedType);
    return report !== null;
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
          { isSuspended: true, isActive: false },
          { where: { id: reportedId } },
        );
      } else {
        await this.brandModel.update(
          { isSuspended: true, isActive: false },
          { where: { id: reportedId } },
        );
      }
    }
  }

  async setUserStatus(
    userId: number,
    userType: 'influencer' | 'brand',
    action: 'activate' | 'suspend',
  ) {
    if (userType === 'influencer') {
      const user = await this.influencerModel.findByPk(userId);
      if (!user) throw new NotFoundException('User not found');

      if (action === 'activate') {
        await user.update({ isActive: true, isSuspended: false });
        // Mark all prior reports as overruled so they don't re-trigger auto-suspend
        const reportedIdField = 'reportedInfluencerId';
        await this.reportedUserModel.update(
          { isOverruled: true, overruledAt: new Date() },
          {
            where: {
              reportedType: 'influencer',
              [reportedIdField]: userId,
              isOverruled: false,
            } as any,
          },
        );
      } else {
        await user.update({ isActive: false, isSuspended: true });
      }
    } else {
      const user = await this.brandModel.findByPk(userId);
      if (!user) throw new NotFoundException('User not found');

      if (action === 'activate') {
        await user.update({ isActive: true, isSuspended: false });
        const reportedIdField = 'reportedBrandId';
        await this.reportedUserModel.update(
          { isOverruled: true, overruledAt: new Date() },
          {
            where: {
              reportedType: 'brand',
              [reportedIdField]: userId,
              isOverruled: false,
            } as any,
          },
        );
      } else {
        await user.update({ isActive: false, isSuspended: true });
      }
    }

    return { message: `User ${action}d successfully` };
  }

  async getAllReportedUsers(
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const offset = (page - 1) * limit;

    // If search provided, find matching IDs first
    let matchingInfluencerIds: number[] | null = null;
    let matchingBrandIds: number[] | null = null;

    if (search) {
      const searchWhere = {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { username: { [Op.iLike]: `%${search}%` } },
        ],
      };
      const [influencers, brands] = await Promise.all([
        this.influencerModel.findAll({ where: searchWhere as any, attributes: ['id'] }),
        this.brandModel.findAll({
          where: {
            [Op.or]: [
              { brandName: { [Op.iLike]: `%${search}%` } },
              { username: { [Op.iLike]: `%${search}%` } },
            ],
          } as any,
          attributes: ['id'],
        }),
      ]);
      matchingInfluencerIds = influencers.map((i) => i.id);
      matchingBrandIds = brands.map((b) => b.id);

      if (matchingInfluencerIds.length === 0 && matchingBrandIds.length === 0) {
        return { users: [], total: 0, page, limit, totalPages: 0 };
      }
    }

    // Build WHERE clause for the report count subquery
    const buildWhere = (type: 'influencer' | 'brand', ids: number[] | null) => {
      const base: any = { reportedType: type, isOverruled: false };
      if (ids !== null) {
        base[type === 'influencer' ? 'reportedInfluencerId' : 'reportedBrandId'] = { [Op.in]: ids };
      }
      return base;
    };

    const { Sequelize } = await import('sequelize');

    // Get reported influencers
    const [influencerRows, brandRows] = await Promise.all([
      this.reportedUserModel.findAll({
        attributes: [
          'reportedInfluencerId',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'reportCount'],
        ],
        where: buildWhere('influencer', matchingInfluencerIds) as any,
        group: ['reportedInfluencerId'],
        raw: true,
      }),
      this.reportedUserModel.findAll({
        attributes: [
          'reportedBrandId',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'reportCount'],
        ],
        where: buildWhere('brand', matchingBrandIds) as any,
        group: ['reportedBrandId'],
        raw: true,
      }),
    ]);

    const influencerIds = influencerRows.map((r: any) => r.reportedInfluencerId);
    const brandIds = brandRows.map((r: any) => r.reportedBrandId);

    const [influencers, brands] = await Promise.all([
      influencerIds.length
        ? this.influencerModel.findAll({
            where: { id: { [Op.in]: influencerIds } },
            attributes: ['id', 'name', 'username', 'profileImage', 'isActive', 'isSuspended'],
          })
        : Promise.resolve([]),
      brandIds.length
        ? this.brandModel.findAll({
            where: { id: { [Op.in]: brandIds } },
            attributes: ['id', 'brandName', 'username', 'profileImage', 'isActive', 'isSuspended'],
          })
        : Promise.resolve([]),
    ]);

    const influencerMap = new Map(influencers.map((i) => [i.id, i]));
    const brandMap = new Map(brands.map((b) => [b.id, b]));

    const users: any[] = [
      ...influencerRows.map((r: any) => {
        const inf = influencerMap.get(r.reportedInfluencerId);
        return {
          id: r.reportedInfluencerId,
          userType: 'influencer',
          name: inf?.name,
          username: inf?.username,
          profileImage: inf?.profileImage,
          isActive: inf?.isActive,
          isSuspended: (inf as any)?.isSuspended,
          reportCount: parseInt(r.reportCount, 10),
        };
      }),
      ...brandRows.map((r: any) => {
        const brand = brandMap.get(r.reportedBrandId);
        return {
          id: r.reportedBrandId,
          userType: 'brand',
          name: (brand as any)?.brandName,
          username: brand?.username,
          profileImage: brand?.profileImage,
          isActive: brand?.isActive,
          isSuspended: (brand as any)?.isSuspended,
          reportCount: parseInt(r.reportCount, 10),
        };
      }),
    ].sort((a, b) => b.reportCount - a.reportCount);

    const total = users.length;
    const paginated = users.slice(offset, offset + limit);

    return {
      users: paginated,
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
        isOverruled: data.isOverruled,
        overruledAt: data.overruledAt,
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
