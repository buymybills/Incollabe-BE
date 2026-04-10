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
} from '@nestjs/swagger';
import { AdminRoleService } from '../services/admin-role.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { SuperAdminOnly, AdminOrSuperAdmin } from '../decorators/permissions.decorator';
import { CreateRoleDto, UpdateRoleDto, GetRolesQueryDto } from '../dto/admin-role.dto';

@ApiTags('Admin Roles')
@ApiBearerAuth()
@Controller('admin/management/roles')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminRoleController {
  constructor(private readonly adminRoleService: AdminRoleService) {}

  @Post()
  @AdminOrSuperAdmin()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new role',
    description:
      'Create a custom role with a name, label, and default tab permissions. System roles (super_admin, admin) cannot be created this way.',
  })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 3,
          name: 'moderator',
          label: 'Moderator',
          description: 'Can review content and manage posts',
          tabPermissions: { dashboard: 'view', posts: 'edit' },
          isSystemRole: false,
          createdBy: 1,
          createdAt: '2026-04-10T10:00:00.000Z',
        },
        message: 'Role created successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error or reserved role name' })
  @ApiResponse({ status: 409, description: 'Role name already exists' })
  async createRole(@Request() req: any, @Body() dto: CreateRoleDto) {
    return this.adminRoleService.createRole(req.admin.id, dto);
  }

  @Get()
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'List all roles',
    description: 'Get paginated list of all roles (system + custom) with admin count per role',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          roles: [
            {
              id: 1,
              name: 'super_admin',
              label: 'Super Admin',
              isSystemRole: true,
              tabPermissions: { dashboard: 'edit' },
              adminCount: 1,
            },
            {
              id: 3,
              name: 'moderator',
              label: 'Moderator',
              isSystemRole: false,
              tabPermissions: { dashboard: 'view', posts: 'edit' },
              adminCount: 4,
            },
          ],
          pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
        },
      },
    },
  })
  async getAllRoles(@Query() query: GetRolesQueryDto) {
    return this.adminRoleService.getAllRoles(query.page, query.limit);
  }

  @Get(':id')
  @AdminOrSuperAdmin()
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async getRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.adminRoleService.getRoleById(id);
  }

  @Put(':id')
  @AdminOrSuperAdmin()
  @ApiOperation({
    summary: 'Update a role',
    description:
      'Update label, description, or tabPermissions of a role. System roles can only have tabPermissions updated, and only by super_admin.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — system role restriction' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async updateRole(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminRoleService.updateRole(req.admin.id, id, dto);
  }

  @Delete(':id')
  @SuperAdminOnly()
  @ApiOperation({
    summary: 'Delete a role (super_admin only)',
    description:
      'Delete a custom role. Cannot delete system roles or roles currently assigned to any admin.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 400, description: 'Role is in use by admins' })
  @ApiResponse({ status: 403, description: 'Cannot delete system role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async deleteRole(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.adminRoleService.deleteRole(req.admin.id, id);
  }
}
