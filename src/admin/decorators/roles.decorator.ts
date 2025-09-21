import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../models/admin.model';
import { ROLES_KEY } from '../guards/roles.guard';

export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
