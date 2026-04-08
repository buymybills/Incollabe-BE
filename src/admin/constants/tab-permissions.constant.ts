import { AdminTab, TabAccessLevel } from '../models/admin.model';

/**
 * Default tab permissions for system roles
 *
 * - super_admin: Full access to all tabs
 * - admin: Full edit access to all tabs except admin_management (view only)
 * - Custom roles: No default permissions, must be configured per user
 */

export const DEFAULT_TAB_PERMISSIONS: Record<string, Record<AdminTab, TabAccessLevel>> = {
  // Superadmin has full access to everything
  super_admin: {
    [AdminTab.DASHBOARD]: TabAccessLevel.EDIT,
    [AdminTab.INFLUENCERS]: TabAccessLevel.EDIT,
    [AdminTab.BRANDS]: TabAccessLevel.EDIT,
    [AdminTab.CAMPAIGNS]: TabAccessLevel.EDIT,
    [AdminTab.POSTS]: TabAccessLevel.EDIT,
    [AdminTab.HYPE_STORE]: TabAccessLevel.EDIT,
    [AdminTab.WALLET]: TabAccessLevel.EDIT,
    [AdminTab.PUSH_NOTIFICATIONS]: TabAccessLevel.EDIT,
    [AdminTab.FIAM_CAMPAIGNS]: TabAccessLevel.EDIT,
    [AdminTab.PROFILE_REVIEWS]: TabAccessLevel.EDIT,
    [AdminTab.ANALYTICS]: TabAccessLevel.EDIT,
    [AdminTab.SETTINGS]: TabAccessLevel.EDIT,
    [AdminTab.ADMIN_MANAGEMENT]: TabAccessLevel.EDIT,
  },

  // Admin has edit access to most tabs, view access to admin management
  admin: {
    [AdminTab.DASHBOARD]: TabAccessLevel.EDIT,
    [AdminTab.INFLUENCERS]: TabAccessLevel.EDIT,
    [AdminTab.BRANDS]: TabAccessLevel.EDIT,
    [AdminTab.CAMPAIGNS]: TabAccessLevel.EDIT,
    [AdminTab.POSTS]: TabAccessLevel.EDIT,
    [AdminTab.HYPE_STORE]: TabAccessLevel.EDIT,
    [AdminTab.WALLET]: TabAccessLevel.EDIT,
    [AdminTab.PUSH_NOTIFICATIONS]: TabAccessLevel.EDIT,
    [AdminTab.FIAM_CAMPAIGNS]: TabAccessLevel.EDIT,
    [AdminTab.PROFILE_REVIEWS]: TabAccessLevel.EDIT,
    [AdminTab.ANALYTICS]: TabAccessLevel.EDIT,
    [AdminTab.SETTINGS]: TabAccessLevel.VIEW,
    [AdminTab.ADMIN_MANAGEMENT]: TabAccessLevel.EDIT, // Admins can create accounts
  },
};

/**
 * Get effective tab permissions for an admin
 * - Super admin: Always gets full access
 * - Custom tabPermissions: Use custom if set
 * - Role-based: Use default for 'admin' role
 * - Custom roles: Must have tabPermissions configured
 */
export function getEffectiveTabPermissions(
  role: string,
  tabPermissions: Record<string, TabAccessLevel> | null,
): Record<AdminTab, TabAccessLevel> {
  // Super admin always gets full access
  if (role === 'super_admin') {
    return DEFAULT_TAB_PERMISSIONS.super_admin;
  }

  // If custom tab permissions are set, use those
  if (tabPermissions && Object.keys(tabPermissions).length > 0) {
    // Fill in missing tabs with 'none'
    const permissions = { ...tabPermissions };
    Object.values(AdminTab).forEach((tab) => {
      if (!(tab in permissions)) {
        permissions[tab] = TabAccessLevel.NONE;
      }
    });
    return permissions as Record<AdminTab, TabAccessLevel>;
  }

  // Use default for 'admin' role
  if (role === 'admin') {
    return DEFAULT_TAB_PERMISSIONS.admin;
  }

  // Custom roles without tab permissions have no access
  const noAccess: Record<AdminTab, TabAccessLevel> = {} as any;
  Object.values(AdminTab).forEach((tab) => {
    noAccess[tab] = TabAccessLevel.NONE;
  });
  return noAccess;
}

/**
 * Check if admin has access to a specific tab
 */
export function hasTabAccess(
  role: string,
  tabPermissions: Record<string, TabAccessLevel> | null,
  tab: AdminTab,
  requiredLevel: TabAccessLevel = TabAccessLevel.VIEW,
): boolean {
  const effectivePermissions = getEffectiveTabPermissions(role, tabPermissions);
  const currentLevel = effectivePermissions[tab];

  // None < View < Edit
  const levels = [TabAccessLevel.NONE, TabAccessLevel.VIEW, TabAccessLevel.EDIT];
  const currentIndex = levels.indexOf(currentLevel);
  const requiredIndex = levels.indexOf(requiredLevel);

  return currentIndex >= requiredIndex;
}

/**
 * Common permission templates for quick role setup
 */
export const PERMISSION_TEMPLATES = {
  moderator: {
    [AdminTab.DASHBOARD]: TabAccessLevel.VIEW,
    [AdminTab.INFLUENCERS]: TabAccessLevel.VIEW,
    [AdminTab.BRANDS]: TabAccessLevel.VIEW,
    [AdminTab.CAMPAIGNS]: TabAccessLevel.VIEW,
    [AdminTab.POSTS]: TabAccessLevel.EDIT,
    [AdminTab.HYPE_STORE]: TabAccessLevel.VIEW,
    [AdminTab.WALLET]: TabAccessLevel.VIEW,
    [AdminTab.PUSH_NOTIFICATIONS]: TabAccessLevel.NONE,
    [AdminTab.FIAM_CAMPAIGNS]: TabAccessLevel.NONE,
    [AdminTab.PROFILE_REVIEWS]: TabAccessLevel.EDIT,
    [AdminTab.ANALYTICS]: TabAccessLevel.VIEW,
    [AdminTab.SETTINGS]: TabAccessLevel.NONE,
    [AdminTab.ADMIN_MANAGEMENT]: TabAccessLevel.NONE,
  },

  executive: {
    [AdminTab.DASHBOARD]: TabAccessLevel.VIEW,
    [AdminTab.INFLUENCERS]: TabAccessLevel.EDIT,
    [AdminTab.BRANDS]: TabAccessLevel.EDIT,
    [AdminTab.CAMPAIGNS]: TabAccessLevel.EDIT,
    [AdminTab.POSTS]: TabAccessLevel.VIEW,
    [AdminTab.HYPE_STORE]: TabAccessLevel.EDIT,
    [AdminTab.WALLET]: TabAccessLevel.VIEW,
    [AdminTab.PUSH_NOTIFICATIONS]: TabAccessLevel.EDIT,
    [AdminTab.FIAM_CAMPAIGNS]: TabAccessLevel.EDIT,
    [AdminTab.PROFILE_REVIEWS]: TabAccessLevel.VIEW,
    [AdminTab.ANALYTICS]: TabAccessLevel.EDIT,
    [AdminTab.SETTINGS]: TabAccessLevel.NONE,
    [AdminTab.ADMIN_MANAGEMENT]: TabAccessLevel.NONE,
  },

  intern: {
    [AdminTab.DASHBOARD]: TabAccessLevel.VIEW,
    [AdminTab.INFLUENCERS]: TabAccessLevel.VIEW,
    [AdminTab.BRANDS]: TabAccessLevel.VIEW,
    [AdminTab.CAMPAIGNS]: TabAccessLevel.VIEW,
    [AdminTab.POSTS]: TabAccessLevel.VIEW,
    [AdminTab.HYPE_STORE]: TabAccessLevel.VIEW,
    [AdminTab.WALLET]: TabAccessLevel.NONE,
    [AdminTab.PUSH_NOTIFICATIONS]: TabAccessLevel.NONE,
    [AdminTab.FIAM_CAMPAIGNS]: TabAccessLevel.NONE,
    [AdminTab.PROFILE_REVIEWS]: TabAccessLevel.VIEW,
    [AdminTab.ANALYTICS]: TabAccessLevel.VIEW,
    [AdminTab.SETTINGS]: TabAccessLevel.NONE,
    [AdminTab.ADMIN_MANAGEMENT]: TabAccessLevel.NONE,
  },

  analyst: {
    [AdminTab.DASHBOARD]: TabAccessLevel.VIEW,
    [AdminTab.INFLUENCERS]: TabAccessLevel.VIEW,
    [AdminTab.BRANDS]: TabAccessLevel.VIEW,
    [AdminTab.CAMPAIGNS]: TabAccessLevel.VIEW,
    [AdminTab.POSTS]: TabAccessLevel.VIEW,
    [AdminTab.HYPE_STORE]: TabAccessLevel.VIEW,
    [AdminTab.WALLET]: TabAccessLevel.VIEW,
    [AdminTab.PUSH_NOTIFICATIONS]: TabAccessLevel.NONE,
    [AdminTab.FIAM_CAMPAIGNS]: TabAccessLevel.NONE,
    [AdminTab.PROFILE_REVIEWS]: TabAccessLevel.VIEW,
    [AdminTab.ANALYTICS]: TabAccessLevel.EDIT,
    [AdminTab.SETTINGS]: TabAccessLevel.NONE,
    [AdminTab.ADMIN_MANAGEMENT]: TabAccessLevel.NONE,
  },
};
