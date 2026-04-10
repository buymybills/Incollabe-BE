import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Admin, AdminRole, TabAccessLevel, AdminTab } from '../models/admin.model';
import { AdminRoleDefinition } from '../models/admin-role-definition.model';
import { getEffectiveTabPermissions } from '../constants/tab-permissions.constant';

@Injectable()
export class AdminRoleService {
  constructor(
    @InjectModel(AdminRoleDefinition)
    private roleModel: typeof AdminRoleDefinition,
    @InjectModel(Admin)
    private adminModel: typeof Admin,
  ) {}

  async createRole(
    creatorId: number,
    data: {
      name: string;
      label: string;
      description?: string;
      tabPermissions: Record<string, TabAccessLevel>;
    },
  ) {
    this.validateTabPermissions(data.tabPermissions);

    // Block reserved system role names
    if (['super_admin', 'admin'].includes(data.name)) {
      throw new BadRequestException(
        `"${data.name}" is a system role name and cannot be created`,
      );
    }

    const existing = await this.roleModel.findOne({ where: { name: data.name } });
    if (existing) {
      throw new ConflictException(`Role "${data.name}" already exists`);
    }

    const role = await this.roleModel.create({
      name: data.name,
      label: data.label,
      description: data.description || null,
      tabPermissions: this.fillMissingTabs(data.tabPermissions),
      isSystemRole: false,
      createdBy: creatorId,
    } as any);

    return {
      success: true,
      data: role.toJSON(),
      message: 'Role created successfully',
    };
  }

  async getAllRoles(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const { rows: roles, count: total } = await this.roleModel.findAndCountAll({
      order: [
        ['is_system_role', 'DESC'], // system roles first
        ['name', 'ASC'],
      ],
      limit,
      offset,
    });

    // Attach admin count per role
    const roleNames = roles.map((r) => r.name);
    const adminCounts = await this.adminModel.findAll({
      attributes: ['role'],
      where: { role: { [Op.in]: roleNames } },
      raw: true,
    });

    const countMap: Record<string, number> = {};
    adminCounts.forEach((a: any) => {
      countMap[a.role] = (countMap[a.role] || 0) + 1;
    });

    return {
      success: true,
      data: {
        roles: roles.map((r) => ({
          ...r.toJSON(),
          adminCount: countMap[r.name] || 0,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getRoleById(id: number) {
    const role = await this.roleModel.findByPk(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const adminCount = await this.adminModel.count({ where: { role: role.name } });

    return {
      success: true,
      data: {
        ...role.toJSON(),
        adminCount,
      },
    };
  }

  async updateRole(
    updaterId: number,
    id: number,
    data: {
      label?: string;
      description?: string;
      tabPermissions?: Record<string, TabAccessLevel>;
    },
  ) {
    const role = await this.roleModel.findByPk(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // System roles: allow updating tabPermissions only if updater is super_admin
    if (role.isSystemRole) {
      const updater = await this.adminModel.findByPk(updaterId);
      if (!updater || updater.role !== AdminRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only super_admin can update system roles');
      }
      // Never allow renaming system roles
      if (data.label || data.description !== undefined) {
        throw new ForbiddenException('Cannot change label or description of system roles');
      }
    }

    if (data.tabPermissions) {
      this.validateTabPermissions(data.tabPermissions);
    }

    await role.update({
      ...(data.label && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.tabPermissions && {
        tabPermissions: this.fillMissingTabs(data.tabPermissions),
      }),
    });

    return {
      success: true,
      data: role.toJSON(),
      message: 'Role updated successfully',
    };
  }

  async deleteRole(deleterId: number, id: number) {
    const role = await this.roleModel.findByPk(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystemRole) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    // Prevent deleting a role that has active admins
    const usageCount = await this.adminModel.count({ where: { role: role.name } });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.name}" — ${usageCount} admin(s) are using it. Reassign them first.`,
      );
    }

    await role.destroy();

    return {
      success: true,
      message: `Role "${role.name}" deleted successfully`,
    };
  }

  async getRoleByName(name: string) {
    const role = await this.roleModel.findOne({ where: { name } });
    if (!role) {
      throw new NotFoundException(`Role "${name}" not found`);
    }

    const adminCount = await this.adminModel.count({ where: { role: role.name } });

    return {
      success: true,
      data: {
        ...role.toJSON(),
        adminCount,
      },
    };
  }

  // Fill any missing tabs with 'none' so the stored record is always complete
  private fillMissingTabs(
    tabPermissions: Record<string, TabAccessLevel>,
  ): Record<string, TabAccessLevel> {
    const filled = { ...tabPermissions };
    Object.values(AdminTab).forEach((tab) => {
      if (!(tab in filled)) {
        filled[tab] = TabAccessLevel.NONE;
      }
    });
    return filled;
  }

  private validateTabPermissions(tabPermissions: Record<string, TabAccessLevel>) {
    const validTabs = Object.values(AdminTab) as string[];
    const validLevels = Object.values(TabAccessLevel) as string[];

    for (const [tab, level] of Object.entries(tabPermissions)) {
      if (!validTabs.includes(tab)) {
        throw new BadRequestException(`Invalid tab: "${tab}"`);
      }
      if (!validLevels.includes(level)) {
        throw new BadRequestException(
          `Invalid access level "${level}" for tab "${tab}". Must be: none, view, or edit`,
        );
      }
    }
  }
}
