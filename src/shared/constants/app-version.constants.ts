/**
 * Global app version configuration
 * Update these values when releasing a new version that requires users to update
 */
export const APP_VERSION = {
  // Current minimum required version
  MINIMUM_VERSION: '4.0.0',
  MINIMUM_VERSION_CODE: 7,

  // Latest available version (optional, for showing "update available" vs "update required")
  LATEST_VERSION: '4.0.0',
  LATEST_VERSION_CODE: 7,

  // Force update - if true, users with older versions must update
  FORCE_UPDATE: false,

  // Update message to show users
  UPDATE_MESSAGE: 'A new version is available. Please update to get the latest features and improvements.',
  FORCE_UPDATE_MESSAGE: 'This version is no longer supported. Please update to continue using the app.',
};
