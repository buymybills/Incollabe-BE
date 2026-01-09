/**
 * Utility for comparing semantic version strings (e.g., "4.0.0", "5.1.2")
 */

/**
 * Compare two semantic version strings
 * Returns:
 *  -1 if version1 < version2
 *   0 if version1 = version2
 *   1 if version1 > version2
 *
 * Handles formats like:
 * - "4.0.0"
 * - "5.1.2"
 * - "10.0.0-beta"
 * - "3.2"
 *
 * @param version1 - First version string
 * @param version2 - Second version string
 * @returns -1, 0, or 1
 */
export function compareVersions(version1: string, version2: string): number {
  // Remove any non-numeric suffixes like "-beta", "-rc1", etc.
  const cleanVersion1 = version1.split('-')[0];
  const cleanVersion2 = version2.split('-')[0];

  // Split into parts [major, minor, patch]
  const parts1 = cleanVersion1.split('.').map(Number);
  const parts2 = cleanVersion2.split('.').map(Number);

  // Compare each part
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0; // Default to 0 if part doesn't exist
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0; // Versions are equal
}

/**
 * Check if version1 is less than version2
 * @param version1 - First version string
 * @param version2 - Second version string
 * @returns true if version1 < version2
 */
export function isVersionLessThan(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) === -1;
}

/**
 * Check if version1 is greater than version2
 * @param version1 - First version string
 * @param version2 - Second version string
 * @returns true if version1 > version2
 */
export function isVersionGreaterThan(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) === 1;
}

/**
 * Check if version1 equals version2
 * @param version1 - First version string
 * @param version2 - Second version string
 * @returns true if version1 = version2
 */
export function isVersionEqual(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) === 0;
}
