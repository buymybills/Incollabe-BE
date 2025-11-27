/**
 * Converts a Date object to IST (Indian Standard Time) format
 * IST is UTC+5:30
 */
export function toIST(date: Date | string): string | null {
  if (!date) return null;

  // Ensure we have a Date object
  const dateObj = date instanceof Date ? date : new Date(date);

  // Get UTC time and add IST offset (5 hours 30 minutes = 330 minutes)
  const utcTime = dateObj.getTime();
  const istTime = new Date(utcTime + (5.5 * 60 * 60 * 1000));

  // Format as ISO string but replace Z with +05:30
  const isoString = istTime.toISOString();
  return isoString.replace('Z', '+05:30');
}

/**
 * Creates a new Date object adjusted for database storage
 * Use this instead of `new Date()` when saving to database
 *
 * This compensates for server timezone offset to ensure dates are stored correctly in UTC
 *
 * @example
 * // Instead of: const createdAt = new Date();
 * // Use: const createdAt = createDatabaseDate();
 */
export function createDatabaseDate(): Date {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs);
}

/**
 * Adds days to a date, adjusting for database storage
 */
export function addDaysForDatabase(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Formats multiple date fields to IST in an object
 */
export function formatDatesToIST<T extends Record<string, any>>(
  obj: T,
  dateFields: (keyof T)[],
): T {
  const result = { ...obj };

  dateFields.forEach((field) => {
    if (result[field]) {
      result[field] = toIST(result[field]) as any;
    }
  });

  return result;
}
