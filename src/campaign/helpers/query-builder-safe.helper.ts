import { Op, WhereOptions, fn, col, where } from 'sequelize';
import {
  EXPERIENCE_LEVELS,
  SOCIAL_PLATFORMS,
} from '../constants/query-builder.constants';

/**
 * Safe Query Builder Helper using Sequelize methods instead of raw SQL
 * This approach is:
 * - SQL injection safe
 * - Database agnostic
 * - Type-safe
 * - Easier to test
 * - More maintainable
 */
export class QueryBuilderSafeHelper {
  /**
   * Build age filter using Sequelize functions (safer than raw SQL)
   * Uses fn() and col() for database-agnostic queries
   */
  static buildAgeFilter(ageMin?: number, ageMax?: number): WhereOptions {
    if (!ageMin && !ageMax) {
      return {};
    }

    const currentYear = new Date().getFullYear();
    const conditions: WhereOptions[] = [];

    if (ageMin !== undefined && ageMax !== undefined) {
      // Calculate date range for birth years
      const maxBirthYear = currentYear - ageMin;
      const minBirthYear = currentYear - ageMax;

      // Use Sequelize functions instead of raw SQL
      conditions.push(
        where(fn('EXTRACT', fn('YEAR FROM', col('dateOfBirth'))), {
          [Op.between]: [minBirthYear, maxBirthYear],
        }),
      );
    } else if (ageMin !== undefined) {
      const maxBirthYear = currentYear - ageMin;
      conditions.push(
        where(fn('EXTRACT', fn('YEAR FROM', col('dateOfBirth'))), {
          [Op.lte]: maxBirthYear,
        }),
      );
    } else if (ageMax !== undefined) {
      const minBirthYear = currentYear - ageMax;
      conditions.push(
        where(fn('EXTRACT', fn('YEAR FROM', col('dateOfBirth'))), {
          [Op.gte]: minBirthYear,
        }),
      );
    }

    return conditions.length > 0 ? { [Op.and]: conditions } : {};
  }

  /**
   * Build experience filter using proper subquery
   * This is safer than string interpolation
   */
  static buildExperienceFilter(
    experience?: string,
    campaignApplicationModel?: any,
  ): WhereOptions {
    if (!experience || !campaignApplicationModel) {
      return {};
    }

    const experienceValue = parseInt(experience);
    if (isNaN(experienceValue)) {
      return {};
    }

    // For experience, we need to use a different approach
    // Option 1: Filter in memory after fetching (current approach)
    // Option 2: Use raw query with proper parameterization
    // Option 3: Pre-calculate and store experience count in influencer table

    // Returning empty for now - experience should be handled in application layer
    // or by adding a computed column to the database
    return {};
  }

  /**
   * Build platform filter using proper Sequelize operators
   */
  static buildPlatformFilter(platform?: string): WhereOptions {
    if (!platform) {
      return {};
    }

    const platformLower = platform.toLowerCase();

    switch (platformLower) {
      case SOCIAL_PLATFORMS.INSTAGRAM:
        return { instagramUrl: { [Op.ne]: null } };
      case SOCIAL_PLATFORMS.YOUTUBE:
        return { youtubeUrl: { [Op.ne]: null } };
      case SOCIAL_PLATFORMS.FACEBOOK:
        return { facebookUrl: { [Op.ne]: null } };
      case SOCIAL_PLATFORMS.LINKEDIN:
        return { linkedinUrl: { [Op.ne]: null } };
      case SOCIAL_PLATFORMS.TWITTER:
      case SOCIAL_PLATFORMS.X:
        return { twitterUrl: { [Op.ne]: null } };
      default:
        return {};
    }
  }

  /**
   * Build gender filter
   */
  static buildGenderFilter(gender?: string): WhereOptions {
    return gender ? { gender } : {};
  }

  /**
   * Build location filter
   */
  static buildLocationFilter(location?: string): WhereOptions {
    return location ? { cityId: location } : {};
  }

  /**
   * Combine all filters safely
   */
  static combineFilters(...filters: WhereOptions[]): WhereOptions {
    const validFilters = filters.filter(
      (filter) => filter && Object.keys(filter).length > 0,
    );

    if (validFilters.length === 0) {
      return {};
    }

    if (validFilters.length === 1) {
      return validFilters[0];
    }

    return { [Op.and]: validFilters };
  }

  /**
   * Sort applications by follower count in memory
   * This is safer and more maintainable than SQL sorting
   */
  static sortByFollowers<
    T extends { influencer?: { totalFollowers?: number } },
  >(applications: T[], direction: 'asc' | 'desc'): T[] {
    return [...applications].sort((a, b) => {
      const aFollowers = a.influencer?.totalFollowers ?? 0;
      const bFollowers = b.influencer?.totalFollowers ?? 0;
      return direction === 'desc'
        ? bFollowers - aFollowers
        : aFollowers - bFollowers;
    });
  }

  /**
   * Build sort order configuration
   */
  static buildSortOrder(sortBy: string): {
    order: any[];
    sortInMemory: boolean;
    sortDirection: 'asc' | 'desc';
  } {
    switch (sortBy) {
      case 'followers_high_low':
        return {
          order: [['createdAt', 'DESC']],
          sortInMemory: true,
          sortDirection: 'desc',
        };
      case 'followers_low_high':
        return {
          order: [['createdAt', 'DESC']],
          sortInMemory: true,
          sortDirection: 'asc',
        };
      case 'application_new_old':
        return {
          order: [['createdAt', 'DESC']],
          sortInMemory: false,
          sortDirection: 'desc',
        };
      case 'application_old_new':
        return {
          order: [['createdAt', 'ASC']],
          sortInMemory: false,
          sortDirection: 'desc',
        };
      case 'campaign_charges_lowest':
        return {
          order: [['collaborationCosts', 'ASC']],
          sortInMemory: false,
          sortDirection: 'desc',
        };
      default:
        return {
          order: [['createdAt', 'DESC']],
          sortInMemory: false,
          sortDirection: 'desc',
        };
    }
  }
}
