import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminManagementService } from '../services/admin-management.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { SuperAdminOnly, AdminOrSuperAdmin } from '../decorators/permissions.decorator';
import {
  CreateAdminDto,
  UpdateAdminDto,
  ChangePasswordDto,
  GetAdminsQueryDto,
  AssignPermissionsDto,
} from '../dto/admin-management.dto';

@ApiTags('Admin Management')
@ApiBearerAuth()
@Controller('admin/management')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminManagementController {
  constructor(private readonly adminManagementService: AdminManagementService) {}

  @Post('admins')
  @AdminOrSuperAdmin()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new admin account (Superadmin or Admin)',
    description:
      'Create a new admin account. Role must exist in admin_roles table (use GET /admin/management/roles). Status is always set to active on creation. Only 1 superadmin allowed in system.',
  })
  @ApiResponse({
    status: 201,
    description: 'Admin created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john.doe@collabkaroo.com' },
            role: { type: 'string', example: 'moderator' },
            tabPermissions: {
              type: 'object',
              example: { dashboard: 'view', influencers: 'edit' },
              nullable: true,
            },
            effectiveTabPermissions: {
              type: 'object',
              example: { dashboard: 'view', influencers: 'edit', campaigns: 'none' },
              description: 'Computed tab permissions based on role or custom tabPermissions',
            },
            status: { type: 'string', example: 'active' },
            createdBy: { type: 'number', example: 1 },
            createdAt: { type: 'string', example: '2026-04-07T10:00:00.000Z' },
          },
        },
        message: { type: 'string', example: 'Admin account created successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or single superadmin limit' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a superadmin or admin' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  async createAdmin(@Request() req: any, @Body() createAdminDto: CreateAdminDto) {
    return this.adminManagementService.createAdmin(req.admin.id, createAdminDto);
  }

  @Get('admins')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Get all admin accounts',
    description: 'Get paginated list of all admin accounts with filters (Superadmin or Admin)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'role', required: false, type: String, example: 'moderator' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive', 'suspended'] })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'john' })
  @ApiResponse({
    status: 200,
    description: 'Admins retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            admins: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string', example: 'moderator' },
                  tabPermissions: { type: 'object', nullable: true },
                  effectiveTabPermissions: { type: 'object' },
                  status: { type: 'string' },
                  lastLoginAt: { type: 'string', nullable: true },
                  createdBy: { type: 'number', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                total: { type: 'number', example: 45 },
                totalPages: { type: 'number', example: 3 },
              },
            },
          },
        },
      },
    },
  })
  async getAllAdmins(@Query() query: GetAdminsQueryDto) {
    return this.adminManagementService.getAllAdmins(
      query.page,
      query.limit,
      {
        role: query.role,
        status: query.status,
        search: query.search,
      },
    );
  }

  @Get('admins/:id')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Get admin by ID',
    description: 'Get detailed information about a specific admin account (Superadmin or Admin)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 5 },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john.doe@collabkaroo.com' },
            role: { type: 'string', example: 'moderator' },
            status: { type: 'string', example: 'active' },
            tabPermissions: { type: 'object', nullable: true, example: { dashboard: 'view', influencers: 'edit' } },
            effectiveTabPermissions: { type: 'object', example: { dashboard: 'view', influencers: 'edit', campaigns: 'none' } },
            profileImage: { type: 'string', nullable: true },
            lastLoginAt: { type: 'string', nullable: true, example: '2026-04-07T10:00:00.000Z' },
            createdBy: { type: 'number', nullable: true, example: 1 },
            createdAt: { type: 'string', example: '2026-04-01T08:00:00.000Z' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async getAdminById(@Param('id', ParseIntPipe) id: number) {
    return this.adminManagementService.getAdminById(id);
  }

  @Put('admins/:id')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Update admin account',
    description:
      'Update admin details including role, tab permissions, and status (Superadmin or Admin). Only superadmin can modify superadmin.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 5 },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john.doe@collabkaroo.com' },
            role: { type: 'string', example: 'executive' },
            status: { type: 'string', example: 'active' },
            tabPermissions: { type: 'object', nullable: true },
            effectiveTabPermissions: { type: 'object' },
            createdAt: { type: 'string', example: '2026-04-01T08:00:00.000Z' },
          },
        },
        message: { type: 'string', example: 'Admin updated successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or single superadmin limit' })
  @ApiResponse({ status: 403, description: 'Forbidden - cannot modify superadmin or promote without permission' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  async updateAdmin(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    return this.adminManagementService.updateAdmin(req.admin.id, id, updateAdminDto);
  }

  @Delete('admins/:id')
  @SuperAdminOnly()
  @ApiOperation({
    summary: 'Delete admin account (Superadmin only)',
    description:
      'Permanently delete an admin account. Cannot delete superadmin or self.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin ID' })
  @ApiResponse({
    status: 200,
    description: 'Admin deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Admin account deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only, or cannot delete superadmin / self' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async deleteAdmin(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.adminManagementService.deleteAdmin(req.admin.id, id);
  }

  @Put('admins/:id/password')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Change admin password',
    description: 'Change password for any admin account (Superadmin or Admin). Only superadmin can change superadmin password.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin ID' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password changed successfully' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - only superadmin can change superadmin password' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async changeAdminPassword(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.adminManagementService.changeAdminPassword(
      req.admin.id,
      id,
      changePasswordDto.newPassword,
    );
  }

  @Get('system-roles')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Get system roles',
    description: 'Get available system roles (super_admin, admin) with their default tab permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'System roles retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', example: 'admin' },
              label: { type: 'string', example: 'Admin' },
              description: { type: 'string' },
              defaultTabPermissions: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async getSystemRoles() {
    return this.adminManagementService.getSystemRoles();
  }

  @Get('tabs')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Get available tabs',
    description: 'Get all available admin tabs and their access levels',
  })
  @ApiResponse({
    status: 200,
    description: 'Tabs retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            tabs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  value: { type: 'string', example: 'dashboard' },
                  label: { type: 'string', example: 'Dashboard' },
                },
              },
            },
            accessLevels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  value: { type: 'string', example: 'view' },
                  label: { type: 'string', example: 'View' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getAvailableTabs() {
    return this.adminManagementService.getAvailableTabs();
  }

  @Put('admins/:id/permissions')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Assign custom tab permissions to an admin',
    description:
      'Override an admin\'s tab permissions independently of their role. Pass null to reset to role defaults. Not needed for "admin" role (already has full edit access).',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Admin ID' })
  @ApiResponse({
    status: 200,
    description: 'Permissions assigned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'object' },
        message: { type: 'string', example: 'Custom permissions assigned successfully' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  async assignPermissions(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.adminManagementService.assignPermissions(req.admin.id, id, dto.tabPermissions);
  }

  @Get('permission-templates')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Get permission templates',
    description: 'Get pre-configured permission templates for common roles (moderator, executive, intern, analyst)',
  })
  @ApiResponse({
    status: 200,
    description: 'Templates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'moderator' },
              label: { type: 'string', example: 'Moderator' },
              tabPermissions: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async getPermissionTemplates() {
    return this.adminManagementService.getPermissionTemplates();
  }
}
