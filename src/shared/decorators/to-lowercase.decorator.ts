import { Transform } from 'class-transformer';

/**
 * Decorator to transform a string property to lowercase
 * Useful for usernames, emails, etc.
 */
export function ToLowercase() {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  });
}
