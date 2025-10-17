/**
 * Reserved usernames that cannot be used by users
 * These are typically system keywords, common routes, or admin-related terms
 */
export const RESERVED_USERNAMES = [
  // System and admin
  'admin',
  'administrator',
  'root',
  'system',
  'moderator',
  'mod',
  'support',
  'help',
  'team',
  'staff',
  'superadmin',
  'super_admin',

  // API and technical
  'api',
  'app',
  'www',
  'mail',
  'email',
  'ftp',
  'ssh',
  'http',
  'https',
  'rest',
  'graphql',
  'webhook',

  // Common routes and pages
  'login',
  'logout',
  'signup',
  'register',
  'signin',
  'signout',
  'auth',
  'profile',
  'settings',
  'account',
  'dashboard',
  'home',
  'about',
  'contact',
  'privacy',
  'terms',
  'tos',
  'faq',
  'help',
  'blog',
  'news',
  'feed',
  'search',
  'explore',
  'discover',
  'trending',
  'popular',

  // Brand/Company specific
  'incollabe',
  'incollab',
  'official',
  'verified',
  'brand',
  'influencer',
  'brands',
  'influencers',
  'campaign',
  'campaigns',

  // User related
  'user',
  'users',
  'username',
  'guest',
  'anonymous',
  'deleted',
  'removed',
  'banned',
  'suspended',

  // Common words to prevent confusion
  'test',
  'demo',
  'example',
  'sample',
  'null',
  'undefined',
  'true',
  'false',

  // Offensive/inappropriate (add more as needed)
  'abuse',
  'spam',
  'fake',
  'scam',
  'fraud',
];

/**
 * Check if a username is reserved (case-insensitive)
 * @param username The username to check
 * @returns true if the username is reserved
 */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase());
}
