import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../models/admin.model';
import { RequestWithAdmin } from './admin-auth.guard';

export const ROLES_KEY = 'roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const adminRole = request.admin?.role;

    if (!adminRole) {
      throw new ForbiddenException('Admin role not found');
    }

    // Super admin has access to everything
    if (adminRole === AdminRole.SUPER_ADMIN) {
      return true;
    }

    const hasRole = requiredRoles.includes(adminRole);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
