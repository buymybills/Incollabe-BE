import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Admin, AdminRole, AdminStatus, AdminTab, TabAccessLevel } from '../models/admin.model';
import { AdminRoleDefinition } from '../models/admin-role-definition.model';
import * as bcrypt from 'bcrypt';
import {
  getEffectiveTabPermissions,
  DEFAULT_TAB_PERMISSIONS,
} from '../constants/tab-permissions.constant';
import { Op } from 'sequelize';

@Injectable()
export class AdminManagementService {
  constructor(
    @InjectModel(Admin)
    private adminModel: typeof Admin,
    @InjectModel(AdminRoleDefinition)
    private roleModel: typeof AdminRoleDefinition,
  ) {}

  /**
   * Create a new admin account (Superadmin or Admin only)
   */
  async createAdmin(
    creatorId: number,
    createData: {
      name: string;
      email: string;
      password: string;
      role: string;
      tabPermissions?: Record<string, TabAccessLevel> | null;
      profileImage?: string;
    },
  ) {
    // Verify the creator is a superadmin or admin
    const creator = await this.adminModel.findByPk(creatorId);
    if (!creator || (creator.role !== AdminRole.SUPER_ADMIN && creator.role !== AdminRole.ADMIN)) {
      throw new ForbiddenException('Only superadmins or admins can create admin accounts');
    }

    // Validate role exists in admin_roles table
    const roleDefinition = await this.roleModel.findOne({ where: { name: createData.role } });
    if (!roleDefinition) {
      throw new BadRequestException(`Role "${createData.role}" does not exist. Use GET /admin/management/roles to see available roles.`);
    }

    // Check if email already exists
    const existingAdmin = await this.adminModel.findOne({
      where: { email: createData.email.toLowerCase() },
    });

    if (existingAdmin) {
      throw new ConflictException('An admin with this email already exists');
    }

    // ENFORCE SINGLE SUPERADMIN RULE
    if (createData.role === AdminRole.SUPER_ADMIN) {
      const superadminCount = await this.adminModel.count({
        where: { role: AdminRole.SUPER_ADMIN },
      });

      if (superadminCount > 0) {
        throw new BadRequestException(
          'Cannot create additional superadmin accounts. Only one superadmin is allowed in the system.',
        );
      }
    }

    // Only superadmin can create other superadmins (if allowed at all)
    if (createData.role === AdminRole.SUPER_ADMIN && creator.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only superadmin can create superadmin accounts');
    }

    // Validate tab permissions if provided
    if (createData.tabPermissions) {
      this.validateTabPermissions(createData.tabPermissions);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createData.password, 10);

    // Create admin — status always starts as active
    const newAdmin = await this.adminModel.create({
      name: createData.name,
      email: createData.email.toLowerCase(),
      password: hashedPassword,
      role: createData.role,
      tabPermissions: createData.tabPermissions || null,
      status: AdminStatus.ACTIVE,
      profileImage: createData.profileImage || null,
      createdBy: creatorId,
      twoFactorEnabled: false,
    } as any);

    // Remove sensitive data from response
    const { password, ...adminData } = newAdmin.toJSON();

    return {
      success: true,
      data: {
        ...adminData,
        effectiveTabPermissions: getEffectiveTabPermissions(
          newAdmin.role,
          newAdmin.tabPermissions,
        ),
      },
      message: 'Admin account created successfully',
    };
  }

  /**
   * Get all admin accounts with pagination
   */
  async getAllAdmins(
    page: number = 1,
    limit: number = 20,
    filters?: {
      role?: string;
      status?: AdminStatus;
      search?: string;
    },
  ) {
    const offset = (page - 1) * limit;
    const whereClause: any = {};

    if (filters?.role) {
      whereClause.role = filters.role;
    }

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (filters?.search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${filters.search}%` } },
        { email: { [Op.iLike]: `%${filters.search}%` } },
        { role: { [Op.iLike]: `%${filters.search}%` } },
      ];
    }

    const { rows: admins, count: total } = await this.adminModel.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] },
    });

    const adminsWithPermissions = admins.map((admin) => ({
      ...admin.toJSON(),
      effectiveTabPermissions: getEffectiveTabPermissions(admin.role, admin.tabPermissions),
    }));

    return {
      success: true,
      data: {
        admins: adminsWithPermissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  /**
   * Get admin by ID
   */
  async getAdminById(adminId: number) {
    const admin = await this.adminModel.findByPk(adminId, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return {
      success: true,
      data: {
        ...admin.toJSON(),
        effectiveTabPermissions: getEffectiveTabPermissions(admin.role, admin.tabPermissions),
      },
    };
  }

  /**
   * Update admin details (Superadmin or Admin only)
   */
  async updateAdmin(
    updaterId: number,
    adminId: number,
    updateData: {
      name?: string;
      email?: string;
      role?: string;
      tabPermissions?: Record<string, TabAccessLevel> | null;
      status?: AdminStatus;
      profileImage?: string;
    },
  ) {
    // Verify the updater is a superadmin or admin
    const updater = await this.adminModel.findByPk(updaterId);
    if (!updater || (updater.role !== AdminRole.SUPER_ADMIN && updater.role !== AdminRole.ADMIN)) {
      throw new ForbiddenException('Only superadmins or admins can update admin accounts');
    }

    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Only superadmin can modify superadmin
    if (admin.role === AdminRole.SUPER_ADMIN && updater.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only superadmin can modify superadmin account');
    }

    // Cannot change role to superadmin unless you're superadmin
    if (
      updateData.role === AdminRole.SUPER_ADMIN &&
      updater.role !== AdminRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only superadmin can promote to superadmin');
    }

    // ENFORCE SINGLE SUPERADMIN RULE
    if (updateData.role === AdminRole.SUPER_ADMIN && admin.role !== AdminRole.SUPER_ADMIN) {
      const superadminCount = await this.adminModel.count({
        where: { role: AdminRole.SUPER_ADMIN },
      });

      if (superadminCount > 0) {
        throw new BadRequestException(
          'Cannot promote to superadmin. Only one superadmin is allowed in the system.',
        );
      }
    }

    // Check email uniqueness if changing email
    if (updateData.email && updateData.email !== admin.email) {
      const existingAdmin = await this.adminModel.findOne({
        where: { email: updateData.email.toLowerCase(), id: { [Op.ne]: adminId } },
      });
      if (existingAdmin) {
        throw new ConflictException('An admin with this email already exists');
      }
    }

    // Validate tab permissions if provided
    if (updateData.tabPermissions) {
      this.validateTabPermissions(updateData.tabPermissions);
    }

    // Update admin
    await admin.update({
      ...(updateData.name && { name: updateData.name }),
      ...(updateData.email && { email: updateData.email.toLowerCase() }),
      ...(updateData.role && { role: updateData.role }),
      ...(updateData.hasOwnProperty('tabPermissions') && {
        tabPermissions: updateData.tabPermissions,
      }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.profileImage && { profileImage: updateData.profileImage }),
    });

    const { password, ...adminData } = admin.toJSON();

    return {
      success: true,
      data: {
        ...adminData,
        effectiveTabPermissions: getEffectiveTabPermissions(admin.role, admin.tabPermissions),
      },
      message: 'Admin updated successfully',
    };
  }

  /**
   * Delete admin account (Superadmin only)
   */
  async deleteAdmin(superadminId: number, adminId: number) {
    // Verify the deleter is a superadmin
    const superadmin = await this.adminModel.findByPk(superadminId);
    if (!superadmin || superadmin.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only superadmins can delete admin accounts');
    }

    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Cannot delete superadmin
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete superadmin account');
    }

    // Cannot delete self
    if (adminId === superadminId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    await admin.destroy();

    return {
      success: true,
      message: 'Admin account deleted successfully',
    };
  }

  /**
   * Change admin password (Superadmin or Admin only)
   */
  async changeAdminPassword(
    updaterId: number,
    adminId: number,
    newPassword: string,
  ) {
    // Verify the updater is a superadmin or admin
    const updater = await this.adminModel.findByPk(updaterId);
    if (!updater || (updater.role !== AdminRole.SUPER_ADMIN && updater.role !== AdminRole.ADMIN)) {
      throw new ForbiddenException('Only superadmins or admins can change admin passwords');
    }

    const admin = await this.adminModel.findByPk(adminId);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Only superadmin can modify superadmin
    if (admin.role === AdminRole.SUPER_ADMIN && updater.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only superadmin can modify superadmin account');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await admin.update({ password: hashedPassword });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Assign custom tab permissions to an admin (separate from role assignment)
   */
  async assignPermissions(
    updaterId: number,
    adminId: number,
    tabPermissions: Record<string, TabAccessLevel> | null,
  ) {
    const updater = await this.adminModel.findByPk(updaterId);
    if (!updater || (updater.role !== AdminRole.SUPER_ADMIN && updater.role !== AdminRole.ADMIN)) {
      throw new ForbiddenException('Only superadmins or admins can assign permissions');
    }

    const admin = await this.adminModel.findByPk(adminId, {
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    // Only superadmin can modify superadmin
    if (admin.role === AdminRole.SUPER_ADMIN && updater.role !== AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only superadmin can modify superadmin account');
    }

    if (tabPermissions) {
      this.validateTabPermissions(tabPermissions);
    }

    await admin.update({ tabPermissions });

    return {
      success: true,
      data: {
        ...admin.toJSON(),
        effectiveTabPermissions: getEffectiveTabPermissions(admin.role, admin.tabPermissions),
      },
      message: tabPermissions ? 'Custom permissions assigned successfully' : 'Permissions reset to role defaults',
    };
  }

  /**
   * Get permission templates — now backed by admin_roles table (dynamic)
   */
  async getPermissionTemplates() {
    const roles = await this.roleModel.findAll({
      order: [['is_system_role', 'DESC'], ['name', 'ASC']],
    });

    return {
      success: true,
      data: roles.map((r) => ({
        name: r.name,
        label: r.label,
        tabPermissions: r.tabPermissions,
      })),
    };
  }

  /**
   * Get all available tabs with their access levels
   */
  async getAvailableTabs() {
    const tabs = Object.values(AdminTab).map((tab) => ({
      value: tab,
      label: tab
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' '),
    }));

    const accessLevels = Object.values(TabAccessLevel).map((level) => ({
      value: level,
      label: level.charAt(0).toUpperCase() + level.slice(1),
    }));

    return {
      success: true,
      data: {
        tabs,
        accessLevels,
      },
    };
  }

  /**
   * Get system roles (super_admin and admin)
   */
  async getSystemRoles() {
    return {
      success: true,
      data: [
        {
          value: AdminRole.SUPER_ADMIN,
          label: 'Super Admin',
          description: 'Full system access (only 1 allowed)',
          defaultTabPermissions: DEFAULT_TAB_PERMISSIONS.super_admin,
        },
        {
          value: AdminRole.ADMIN,
          label: 'Admin',
          description: 'Can create accounts and has edit access to assigned tabs',
          defaultTabPermissions: DEFAULT_TAB_PERMISSIONS.admin,
        },
      ],
    };
  }

  /**
   * Validate tab permissions structure
   */
  private validateTabPermissions(tabPermissions: Record<string, TabAccessLevel>) {
    const validTabs = Object.values(AdminTab);
    const validAccessLevels = Object.values(TabAccessLevel);

    for (const [tab, level] of Object.entries(tabPermissions)) {
      if (!validTabs.includes(tab as AdminTab)) {
        throw new BadRequestException(`Invalid tab: ${tab}`);
      }
      if (!validAccessLevels.includes(level)) {
        throw new BadRequestException(`Invalid access level for ${tab}: ${level}`);
      }
    }
  }
}
