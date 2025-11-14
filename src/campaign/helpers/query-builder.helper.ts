import { Op, WhereOptions, literal } from 'sequelize';
import {
  SUBQUERIES,
  EXPERIENCE_LEVELS,
  SOCIAL_PLATFORMS,
} from '../constants/query-builder.constants';

/**
 * Helper class for building complex database queries
 */
export class QueryBuilderHelper {
  /**
   * Build age filter conditions based on min/max age
   */
  static buildAgeFilter(minAge?: number, maxAge?: number): any[] {
    if (!minAge && !maxAge) {
      return [];
    }

    const currentYear = new Date().getFullYear();
    const conditions: any[] = [];

    if (minAge !== undefined && maxAge !== undefined) {
      const maxBirthYear = currentYear - minAge;
      const minBirthYear = currentYear - maxAge;
      conditions.push(
        literal(SUBQUERIES.AGE_FROM_DOB.BETWEEN(minBirthYear, maxBirthYear)),
      );
    } else if (minAge !== undefined) {
      const maxBirthYear = currentYear - minAge;
      conditions.push(literal(SUBQUERIES.AGE_FROM_DOB.MIN_AGE(maxBirthYear)));
    } else if (maxAge !== undefined) {
      const minBirthYear = currentYear - maxAge;
      conditions.push(literal(SUBQUERIES.AGE_FROM_DOB.MAX_AGE(minBirthYear)));
    }

    return conditions;
  }

  /**
   * Build experience filter based on campaign count
   */
  static buildExperienceFilter(experience?: string): any[] {
    if (!experience) {
      return [];
    }

    const experienceValue = parseInt(experience);
    if (isNaN(experienceValue)) {
      return [];
    }

    const subquery = SUBQUERIES.COMPLETED_CAMPAIGNS();

    switch (experienceValue) {
      case EXPERIENCE_LEVELS.NO_EXPERIENCE:
        return [literal(`${subquery} = 0`)];
      case EXPERIENCE_LEVELS.ONE_PLUS:
        return [literal(`${subquery} >= 1`)];
      case EXPERIENCE_LEVELS.TWO_PLUS:
        return [literal(`${subquery} >= 2`)];
      case EXPERIENCE_LEVELS.THREE_PLUS:
        return [literal(`${subquery} >= 3`)];
      case EXPERIENCE_LEVELS.FOUR_PLUS:
        return [literal(`${subquery} >= 4`)];
      case EXPERIENCE_LEVELS.FIVE_PLUS:
        return [literal(`${subquery} >= 5`)];
      default:
        return [];
    }
  }

  /**
   * Build platform filter for social media URLs
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
   * Combine all literal conditions for Op.and
   */
  static combineLiteralConditions(
    minAge?: number,
    maxAge?: number,
    experience?: string,
  ): WhereOptions {
    const literalConditions = [
      ...this.buildAgeFilter(minAge, maxAge),
      ...this.buildExperienceFilter(experience),
    ];

    return literalConditions.length > 0 ? { [Op.and]: literalConditions } : {};
  }

  /**
   * Build sort order for follower-based sorting
   */
  static buildFollowerSortOrder(sortBy: string): {
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
          order: [[literal('"Influencer"'), 'collaborationCosts', 'ASC']],
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

  /**
   * Sort applications by follower count in memory
   */
  static sortByFollowers<
    T extends { influencer?: { totalFollowers?: number } },
  >(applications: T[], direction: 'asc' | 'desc'): T[] {
    return applications.sort((a, b) => {
      const aFollowers = a.influencer?.totalFollowers || 0;
      const bFollowers = b.influencer?.totalFollowers || 0;
      return direction === 'desc'
        ? bFollowers - aFollowers
        : aFollowers - bFollowers;
    });
  }
}
