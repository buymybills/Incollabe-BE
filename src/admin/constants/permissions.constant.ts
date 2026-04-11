/**
 * Admin Permission System
 * Defines granular permissions for each module/feature in the admin panel
 */

export enum AdminPermission {
  // Dashboard
  DASHBOARD_VIEW = 'dashboard:view',

  // Influencers
  INFLUENCERS_VIEW = 'influencers:view',
  INFLUENCERS_EDIT = 'influencers:edit',
  INFLUENCERS_DELETE = 'influencers:delete',
  INFLUENCERS_VERIFY = 'influencers:verify',
  INFLUENCERS_EXPORT = 'influencers:export',

  // Brands
  BRANDS_VIEW = 'brands:view',
  BRANDS_EDIT = 'brands:edit',
  BRANDS_DELETE = 'brands:delete',
  BRANDS_VERIFY = 'brands:verify',
  BRANDS_EXPORT = 'brands:export',

  // Campaigns
  CAMPAIGNS_VIEW = 'campaigns:view',
  CAMPAIGNS_EDIT = 'campaigns:edit',
  CAMPAIGNS_DELETE = 'campaigns:delete',
  CAMPAIGNS_MODERATE = 'campaigns:moderate',
  CAMPAIGNS_EXPORT = 'campaigns:export',

  // Profile Reviews
  PROFILE_REVIEWS_VIEW = 'profile_reviews:view',
  PROFILE_REVIEWS_APPROVE = 'profile_reviews:approve',
  PROFILE_REVIEWS_REJECT = 'profile_reviews:reject',

  // Support Tickets
  SUPPORT_TICKETS_VIEW = 'support_tickets:view',
  SUPPORT_TICKETS_REPLY = 'support_tickets:reply',
  SUPPORT_TICKETS_CLOSE = 'support_tickets:close',
  SUPPORT_TICKETS_DELETE = 'support_tickets:delete',

  // Hype Store
  HYPE_STORE_VIEW = 'hype_store:view',
  HYPE_STORE_EDIT = 'hype_store:edit',
  HYPE_STORE_APPROVE_ORDERS = 'hype_store:approve_orders',
  HYPE_STORE_MANAGE_WALLET = 'hype_store:manage_wallet',
  HYPE_STORE_EXPORT = 'hype_store:export',

  // Push Notifications
  NOTIFICATIONS_VIEW = 'notifications:view',
  NOTIFICATIONS_SEND = 'notifications:send',
  NOTIFICATIONS_DELETE = 'notifications:delete',

  // FIAM Campaigns
  FIAM_CAMPAIGNS_VIEW = 'fiam_campaigns:view',
  FIAM_CAMPAIGNS_CREATE = 'fiam_campaigns:create',
  FIAM_CAMPAIGNS_EDIT = 'fiam_campaigns:edit',
  FIAM_CAMPAIGNS_DELETE = 'fiam_campaigns:delete',
  FIAM_CAMPAIGNS_BROADCAST = 'fiam_campaigns:broadcast',

  // API Logs
  API_LOGS_VIEW = 'api_logs:view',
  API_LOGS_EXPORT = 'api_logs:export',

  // Employees (Admin Management)
  EMPLOYEES_VIEW = 'employees:view',
  EMPLOYEES_CREATE = 'employees:create', // Superadmin only
  EMPLOYEES_EDIT = 'employees:edit', // Superadmin only
  EMPLOYEES_DELETE = 'employees:delete', // Superadmin only
  EMPLOYEES_MANAGE_ROLES = 'employees:manage_roles', // Superadmin only

  // Access Control
  ACCESS_CONTROL_VIEW = 'access_control:view', // Superadmin only
  ACCESS_CONTROL_MANAGE = 'access_control:manage', // Superadmin only

  // Audit Logs
  AUDIT_LOGS_VIEW = 'audit_logs:view',

  // Notification Centre
  NOTIFICATION_CENTRE_VIEW = 'notification_centre:view',
  NOTIFICATION_CENTRE_MANAGE = 'notification_centre:manage',

  // Terms and Conditions
  TERMS_CONDITIONS_VIEW = 'terms_conditions:view',
  TERMS_CONDITIONS_EDIT = 'terms_conditions:edit',

  // Privacy Policies
  PRIVACY_POLICIES_VIEW = 'privacy_policies:view',
  PRIVACY_POLICIES_EDIT = 'privacy_policies:edit',

  // Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_EDIT = 'settings:edit',

  // Daily Tasks
  DAILY_TASKS_VIEW = 'daily_tasks:view',
  DAILY_TASKS_EDIT = 'daily_tasks:edit',
}

/**
 * Role-based permission presets
 * These define default permissions for each role
 */
export const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: Object.values(AdminPermission), // All permissions

  admin: [
    // Dashboard
    AdminPermission.DASHBOARD_VIEW,

    // Students - Full access
    AdminPermission.INFLUENCERS_VIEW,
    AdminPermission.INFLUENCERS_EDIT,
    AdminPermission.INFLUENCERS_VERIFY,
    AdminPermission.INFLUENCERS_EXPORT,

    // Brands - Full access
    AdminPermission.BRANDS_VIEW,
    AdminPermission.BRANDS_EDIT,
    AdminPermission.BRANDS_VERIFY,
    AdminPermission.BRANDS_EXPORT,

    // Campaigns - Full access
    AdminPermission.CAMPAIGNS_VIEW,
    AdminPermission.CAMPAIGNS_EDIT,
    AdminPermission.CAMPAIGNS_MODERATE,
    AdminPermission.CAMPAIGNS_EXPORT,

    // Profile Reviews
    AdminPermission.PROFILE_REVIEWS_VIEW,
    AdminPermission.PROFILE_REVIEWS_APPROVE,
    AdminPermission.PROFILE_REVIEWS_REJECT,

    // Support Tickets
    AdminPermission.SUPPORT_TICKETS_VIEW,
    AdminPermission.SUPPORT_TICKETS_REPLY,
    AdminPermission.SUPPORT_TICKETS_CLOSE,

    // Hype Store
    AdminPermission.HYPE_STORE_VIEW,
    AdminPermission.HYPE_STORE_EDIT,
    AdminPermission.HYPE_STORE_APPROVE_ORDERS,
    AdminPermission.HYPE_STORE_MANAGE_WALLET,
    AdminPermission.HYPE_STORE_EXPORT,

    // Notifications
    AdminPermission.NOTIFICATIONS_VIEW,
    AdminPermission.NOTIFICATIONS_SEND,

    // FIAM Campaigns
    AdminPermission.FIAM_CAMPAIGNS_VIEW,
    AdminPermission.FIAM_CAMPAIGNS_CREATE,
    AdminPermission.FIAM_CAMPAIGNS_EDIT,
    AdminPermission.FIAM_CAMPAIGNS_BROADCAST,

    // API Logs
    AdminPermission.API_LOGS_VIEW,
    AdminPermission.API_LOGS_EXPORT,

    // Audit Logs
    AdminPermission.AUDIT_LOGS_VIEW,

    // Settings
    AdminPermission.SETTINGS_VIEW,

    // Daily Tasks
    AdminPermission.DAILY_TASKS_VIEW,
    AdminPermission.DAILY_TASKS_EDIT,
  ],

  profile_reviewer: [
    // Dashboard
    AdminPermission.DASHBOARD_VIEW,

    // Students - View and review only
    AdminPermission.INFLUENCERS_VIEW,
    AdminPermission.INFLUENCERS_VERIFY,

    // Brands - View only
    AdminPermission.BRANDS_VIEW,

    // Profile Reviews - Full access
    AdminPermission.PROFILE_REVIEWS_VIEW,
    AdminPermission.PROFILE_REVIEWS_APPROVE,
    AdminPermission.PROFILE_REVIEWS_REJECT,

    // Support Tickets - View and reply
    AdminPermission.SUPPORT_TICKETS_VIEW,
    AdminPermission.SUPPORT_TICKETS_REPLY,
  ],

  content_moderator: [
    // Dashboard
    AdminPermission.DASHBOARD_VIEW,

    // Students - View only
    AdminPermission.INFLUENCERS_VIEW,

    // Brands - View only
    AdminPermission.BRANDS_VIEW,

    // Campaigns - Moderate
    AdminPermission.CAMPAIGNS_VIEW,
    AdminPermission.CAMPAIGNS_MODERATE,

    // Support Tickets
    AdminPermission.SUPPORT_TICKETS_VIEW,
    AdminPermission.SUPPORT_TICKETS_REPLY,
    AdminPermission.SUPPORT_TICKETS_CLOSE,

    // Hype Store - View and approve
    AdminPermission.HYPE_STORE_VIEW,
    AdminPermission.HYPE_STORE_APPROVE_ORDERS,
  ],

  support_agent: [
    // Dashboard
    AdminPermission.DASHBOARD_VIEW,

    // Students - View only
    AdminPermission.INFLUENCERS_VIEW,

    // Brands - View only
    AdminPermission.BRANDS_VIEW,

    // Support Tickets - Full access
    AdminPermission.SUPPORT_TICKETS_VIEW,
    AdminPermission.SUPPORT_TICKETS_REPLY,
    AdminPermission.SUPPORT_TICKETS_CLOSE,

    // Hype Store - View only
    AdminPermission.HYPE_STORE_VIEW,
  ],

  analyst: [
    // Dashboard
    AdminPermission.DASHBOARD_VIEW,

    // Students - View and export
    AdminPermission.INFLUENCERS_VIEW,
    AdminPermission.INFLUENCERS_EXPORT,

    // Brands - View and export
    AdminPermission.BRANDS_VIEW,
    AdminPermission.BRANDS_EXPORT,

    // Campaigns - View and export
    AdminPermission.CAMPAIGNS_VIEW,
    AdminPermission.CAMPAIGNS_EXPORT,

    // Hype Store - View and export
    AdminPermission.HYPE_STORE_VIEW,
    AdminPermission.HYPE_STORE_EXPORT,

    // API Logs
    AdminPermission.API_LOGS_VIEW,
    AdminPermission.API_LOGS_EXPORT,

    // Audit Logs
    AdminPermission.AUDIT_LOGS_VIEW,
  ],
};

/**
 * Permission categories for UI grouping
 */
export const PERMISSION_CATEGORIES = {
  analytics: {
    label: 'Analytics',
    permissions: [AdminPermission.DASHBOARD_VIEW],
  },
  influencers: {
    label: 'Students',
    permissions: [
      AdminPermission.INFLUENCERS_VIEW,
      AdminPermission.INFLUENCERS_EDIT,
      AdminPermission.INFLUENCERS_DELETE,
      AdminPermission.INFLUENCERS_VERIFY,
      AdminPermission.INFLUENCERS_EXPORT,
    ],
  },
  brands: {
    label: 'Brands',
    permissions: [
      AdminPermission.BRANDS_VIEW,
      AdminPermission.BRANDS_EDIT,
      AdminPermission.BRANDS_DELETE,
      AdminPermission.BRANDS_VERIFY,
      AdminPermission.BRANDS_EXPORT,
    ],
  },
  campaigns: {
    label: 'Campaigns',
    permissions: [
      AdminPermission.CAMPAIGNS_VIEW,
      AdminPermission.CAMPAIGNS_EDIT,
      AdminPermission.CAMPAIGNS_DELETE,
      AdminPermission.CAMPAIGNS_MODERATE,
      AdminPermission.CAMPAIGNS_EXPORT,
    ],
  },
  profileReviews: {
    label: 'Profile Reviews',
    permissions: [
      AdminPermission.PROFILE_REVIEWS_VIEW,
      AdminPermission.PROFILE_REVIEWS_APPROVE,
      AdminPermission.PROFILE_REVIEWS_REJECT,
    ],
  },
  supportTickets: {
    label: 'Support Tickets',
    permissions: [
      AdminPermission.SUPPORT_TICKETS_VIEW,
      AdminPermission.SUPPORT_TICKETS_REPLY,
      AdminPermission.SUPPORT_TICKETS_CLOSE,
      AdminPermission.SUPPORT_TICKETS_DELETE,
    ],
  },
  hypeStore: {
    label: 'Hype Store',
    permissions: [
      AdminPermission.HYPE_STORE_VIEW,
      AdminPermission.HYPE_STORE_EDIT,
      AdminPermission.HYPE_STORE_APPROVE_ORDERS,
      AdminPermission.HYPE_STORE_MANAGE_WALLET,
      AdminPermission.HYPE_STORE_EXPORT,
    ],
  },
  notifications: {
    label: 'Push Notifications',
    permissions: [
      AdminPermission.NOTIFICATIONS_VIEW,
      AdminPermission.NOTIFICATIONS_SEND,
      AdminPermission.NOTIFICATIONS_DELETE,
    ],
  },
  fiamCampaigns: {
    label: 'FIAM Campaigns',
    permissions: [
      AdminPermission.FIAM_CAMPAIGNS_VIEW,
      AdminPermission.FIAM_CAMPAIGNS_CREATE,
      AdminPermission.FIAM_CAMPAIGNS_EDIT,
      AdminPermission.FIAM_CAMPAIGNS_DELETE,
      AdminPermission.FIAM_CAMPAIGNS_BROADCAST,
    ],
  },
  apiLogs: {
    label: 'API Logs',
    permissions: [AdminPermission.API_LOGS_VIEW, AdminPermission.API_LOGS_EXPORT],
  },
  employees: {
    label: 'Employee Management',
    permissions: [
      AdminPermission.EMPLOYEES_VIEW,
      AdminPermission.EMPLOYEES_CREATE,
      AdminPermission.EMPLOYEES_EDIT,
      AdminPermission.EMPLOYEES_DELETE,
      AdminPermission.EMPLOYEES_MANAGE_ROLES,
    ],
  },
  accessControl: {
    label: 'Access Control',
    permissions: [
      AdminPermission.ACCESS_CONTROL_VIEW,
      AdminPermission.ACCESS_CONTROL_MANAGE,
    ],
  },
  auditLogs: {
    label: 'Audit Logs',
    permissions: [AdminPermission.AUDIT_LOGS_VIEW],
  },
  notificationCentre: {
    label: 'Notification Centre',
    permissions: [
      AdminPermission.NOTIFICATION_CENTRE_VIEW,
      AdminPermission.NOTIFICATION_CENTRE_MANAGE,
    ],
  },
  termsConditions: {
    label: 'Terms and Conditions',
    permissions: [
      AdminPermission.TERMS_CONDITIONS_VIEW,
      AdminPermission.TERMS_CONDITIONS_EDIT,
    ],
  },
  privacyPolicies: {
    label: 'Privacy Policies',
    permissions: [
      AdminPermission.PRIVACY_POLICIES_VIEW,
      AdminPermission.PRIVACY_POLICIES_EDIT,
    ],
  },
  settings: {
    label: 'Settings',
    permissions: [AdminPermission.SETTINGS_VIEW, AdminPermission.SETTINGS_EDIT],
  },
  dailyTasks: {
    label: 'Daily Tasks',
    permissions: [AdminPermission.DAILY_TASKS_VIEW, AdminPermission.DAILY_TASKS_EDIT],
  },
};
