import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole, AdminTab, TabAccessLevel } from '../models/admin.model';
import { hasTabAccess } from '../constants/tab-permissions.constant';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check decorator metadata
    const isSuperAdminOnly = this.reflector.getAllAndOverride<boolean>('superadmin_only', [
      context.getHandler(),
      context.getClass(),
    ]);

    const isAdminOrSuperAdmin = this.reflector.getAllAndOverride<boolean>('admin_or_superadmin', [
      context.getHandler(),
      context.getClass(),
    ]);

    const tabAccess = this.reflector.getAllAndOverride<{
      tab: AdminTab;
      level: TabAccessLevel;
    }>('tab_access', [context.getHandler(), context.getClass()]);

    const tabAccessAny = this.reflector.getAllAndOverride<
      Array<{ tab: AdminTab; level?: TabAccessLevel }>
    >('tab_access_any', [context.getHandler(), context.getClass()]);

    const tabAccessAll = this.reflector.getAllAndOverride<
      Array<{ tab: AdminTab; level?: TabAccessLevel }>
    >('tab_access_all', [context.getHandler(), context.getClass()]);

    // If no decorators, allow access (endpoint is public or uses other guards)
    if (
      !isSuperAdminOnly &&
      !isAdminOrSuperAdmin &&
      !tabAccess &&
      !tabAccessAny &&
      !tabAccessAll
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.admin;

    if (!admin) {
      throw new ForbiddenException('Admin not authenticated');
    }

    // Superadmin bypasses all permission checks
    if (admin.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    // Check superadmin only
    if (isSuperAdminOnly) {
      throw new ForbiddenException('This action requires superadmin privileges');
    }

    // Check admin or superadmin
    if (isAdminOrSuperAdmin) {
      if (admin.role !== AdminRole.ADMIN && admin.role !== AdminRole.SUPER_ADMIN) {
        throw new ForbiddenException('This action requires admin or superadmin privileges');
      }
      return true;
    }

    // Check single tab access
    if (tabAccess) {
      const hasAccess = hasTabAccess(
        admin.role,
        admin.tabPermissions,
        tabAccess.tab,
        tabAccess.level,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          `You lack required access to ${tabAccess.tab} (need ${tabAccess.level} level)`,
        );
      }
      return true;
    }

    // Check any tab access (at least one)
    if (tabAccessAny && tabAccessAny.length > 0) {
      const hasAnyAccess = tabAccessAny.some((requirement) =>
        hasTabAccess(
          admin.role,
          admin.tabPermissions,
          requirement.tab,
          requirement.level || TabAccessLevel.VIEW,
        ),
      );
      if (!hasAnyAccess) {
        const requiredTabs = tabAccessAny
          .map((r) => `${r.tab}:${r.level || 'view'}`)
          .join(', ');
        throw new ForbiddenException(`You lack access to any of: ${requiredTabs}`);
      }
      return true;
    }

    // Check all tab access (all required)
    if (tabAccessAll && tabAccessAll.length > 0) {
      const missingAccess = tabAccessAll.filter(
        (requirement) =>
          !hasTabAccess(
            admin.role,
            admin.tabPermissions,
            requirement.tab,
            requirement.level || TabAccessLevel.VIEW,
          ),
      );
      if (missingAccess.length > 0) {
        const missing = missingAccess.map((r) => `${r.tab}:${r.level || 'view'}`).join(', ');
        throw new ForbiddenException(`You lack required access to: ${missing}`);
      }
      return true;
    }

    return true;
  }
}
