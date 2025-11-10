import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  AuditLog,
  AuditSection,
  AuditActionType,
} from '../models/audit-log.model';
import { Admin } from '../models/admin.model';
import {
  GetAuditLogsDto,
  AuditLogListResponseDto,
  AuditLogResponseDto,
  CreateAuditLogDto,
} from '../dto/audit-log.dto';

// Flexible admin interface that accepts either name or firstName/lastName
interface AdminInfo {
  id: number;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog)
    private readonly auditLogModel: typeof AuditLog,
    @InjectModel(Admin)
    private readonly adminModel: typeof Admin,
  ) {}

  /**
   * Get admin name from AdminInfo object
   */
  private getAdminName(admin: AdminInfo): string {
    if (admin.name) {
      return admin.name;
    }
    if (admin.firstName && admin.lastName) {
      return `${admin.firstName} ${admin.lastName}`;
    }
    if (admin.firstName) {
      return admin.firstName;
    }
    return admin.email.split('@')[0]; // Fallback to email username
  }

  /**
   * Create an audit log entry
   */
  async createLog(data: CreateAuditLogDto): Promise<void> {
    try {
      await this.auditLogModel.create({
        adminId: data.adminId,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        section: data.section,
        actionType: data.actionType,
        details: data.details,
        targetType: data.targetType,
        targetId: data.targetId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      } as any);
    } catch (error) {
      // Log error but don't throw - audit logging should not break the main flow
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Get audit logs with filters and pagination
   */
  async getAuditLogs(
    filters: GetAuditLogsDto,
  ): Promise<AuditLogListResponseDto> {
    const {
      section,
      actionType,
      adminId,
      targetType,
      targetId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const whereClause: any = {};

    // Apply filters
    if (section) {
      whereClause.section = section;
    }

    if (actionType) {
      whereClause.actionType = actionType;
    }

    if (adminId) {
      whereClause.adminId = adminId;
    }

    if (targetType) {
      whereClause.targetType = targetType;
    }

    if (targetId) {
      whereClause.targetId = targetId;
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = new Date(endDate);
      }
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { adminName: { [Op.iLike]: `%${search}%` } },
        { adminEmail: { [Op.iLike]: `%${search}%` } },
        { details: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    // Get logs with pagination
    const { rows: logs, count: total } =
      await this.auditLogModel.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        raw: false, // Ensure we get full model instances
        include: [
          {
            model: Admin,
            as: 'admin',
            attributes: ['id', 'name', 'email', 'role'],
          },
        ],
      });

    // Get total admin users count
    const totalAdminUsers = await this.adminModel.count();

    const totalPages = Math.ceil(total / limit);

    return {
      logs: logs.map((log) => this.formatAuditLog(log)),
      page,
      limit,
      total,
      totalPages,
      totalAdminUsers,
    };
  }

  /**
   * Format audit log for response
   */
  private formatAuditLog(log: AuditLog): AuditLogResponseDto {
    // Get plain object to ensure all fields are included
    const logData = log.get({ plain: true }) as any;

    return {
      id: logData.id,
      adminName: logData.adminName || logData.admin_name,
      adminEmail: logData.adminEmail || logData.admin_email,
      section: logData.section,
      actionType: logData.actionType || logData.action_type,
      details: logData.details || undefined,
      targetType: logData.targetType || logData.target_type || undefined,
      targetId: logData.targetId || logData.target_id || undefined,
      ipAddress: logData.ipAddress || logData.ip_address || undefined,
      userAgent: logData.userAgent || logData.user_agent || undefined,
      createdAt: logData.createdAt || logData.created_at,
    };
  }

  /**
   * Helper methods for common audit actions
   */

  async logAuth(
    admin: AdminInfo,
    actionType: AuditActionType,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.AUTH,
      actionType,
      details,
      ipAddress,
      userAgent,
    });
  }

  async logCampaignAction(
    admin: AdminInfo,
    actionType: AuditActionType,
    campaignId: number,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.CAMPAIGNS,
      actionType,
      details,
      targetType: 'campaign',
      targetId: campaignId,
      ipAddress,
      userAgent,
    });
  }

  async logNotificationAction(
    admin: AdminInfo,
    actionType: AuditActionType,
    notificationId: number,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.NOTIFICATION_CENTRE,
      actionType,
      details,
      targetType: 'notification',
      targetId: notificationId,
      ipAddress,
      userAgent,
    });
  }

  async logBrandAction(
    admin: AdminInfo,
    actionType: AuditActionType,
    brandId: number,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.BRAND,
      actionType,
      details,
      targetType: 'brand',
      targetId: brandId,
      ipAddress,
      userAgent,
    });
  }

  async logInfluencerAction(
    admin: AdminInfo,
    actionType: AuditActionType,
    influencerId: number,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.INFLUENCER,
      actionType,
      details,
      targetType: 'influencer',
      targetId: influencerId,
      ipAddress,
      userAgent,
    });
  }

  async logProfileReviewAction(
    admin: AdminInfo,
    actionType: AuditActionType,
    profileId: number,
    profileType: string,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.PROFILE_REVIEW,
      actionType,
      details,
      targetType: profileType,
      targetId: profileId,
      ipAddress,
      userAgent,
    });
  }

  async logAdminManagement(
    admin: AdminInfo,
    actionType: AuditActionType,
    targetAdminId: number,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.ADMIN_MANAGEMENT,
      actionType,
      details,
      targetType: 'admin',
      targetId: targetAdminId,
      ipAddress,
      userAgent,
    });
  }

  async logPostAction(
    admin: AdminInfo,
    actionType: AuditActionType,
    postId: number,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.POSTS,
      actionType,
      details,
      targetType: 'post',
      targetId: postId,
      ipAddress,
      userAgent,
    });
  }

  async logSettingsChange(
    admin: AdminInfo,
    details: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      adminId: admin.id,
      adminName: this.getAdminName(admin),
      adminEmail: admin.email,
      section: AuditSection.SETTINGS,
      actionType: AuditActionType.SETTINGS_UPDATED,
      details,
      ipAddress,
      userAgent,
    });
  }
}
