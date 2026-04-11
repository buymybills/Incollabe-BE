import { SetMetadata } from '@nestjs/common';
import { AdminTab, TabAccessLevel } from '../models/admin.model';

/**
 * Decorator for requiring superadmin access
 */
export const SuperAdminOnly = () => SetMetadata('superadmin_only', true);

/**
 * Decorator for requiring superadmin OR admin access
 */
export const AdminOrSuperAdmin = () => SetMetadata('admin_or_superadmin', true);

/**
 * Decorator for requiring specific tab access
 * @param tab - The tab to check access for
 * @param level - Minimum access level required (default: VIEW)
 *
 * @example
 * @RequireTabAccess(AdminTab.INFLUENCERS, TabAccessLevel.EDIT)
 * async updateStudent() { ... }
 */
export const RequireTabAccess = (tab: AdminTab, level: TabAccessLevel = TabAccessLevel.VIEW) =>
  SetMetadata('tab_access', { tab, level });

/**
 * Decorator for requiring access to multiple tabs (at least one)
 * @param tabs - Array of { tab, level } objects
 *
 * @example
 * @RequireAnyTabAccess([
 *   { tab: AdminTab.INFLUENCERS, level: TabAccessLevel.VIEW },
 *   { tab: AdminTab.BRANDS, level: TabAccessLevel.VIEW }
 * ])
 * async getOverview() { ... }
 */
export const RequireAnyTabAccess = (
  tabs: Array<{ tab: AdminTab; level?: TabAccessLevel }>,
) =>
  SetMetadata('tab_access_any', tabs);

/**
 * Decorator for requiring access to multiple tabs (all required)
 * @param tabs - Array of { tab, level } objects
 *
 * @example
 * @RequireAllTabAccess([
 *   { tab: AdminTab.INFLUENCERS, level: TabAccessLevel.EDIT },
 *   { tab: AdminTab.CAMPAIGNS, level: TabAccessLevel.EDIT }
 * ])
 * async createCampaignForStudent() { ... }
 */
export const RequireAllTabAccess = (
  tabs: Array<{ tab: AdminTab; level?: TabAccessLevel }>,
) =>
  SetMetadata('tab_access_all', tabs);
