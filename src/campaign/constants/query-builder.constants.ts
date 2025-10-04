/**
 * SQL subquery templates for campaign-related calculations
 */
export const SUBQUERIES = {
  COMPLETED_CAMPAIGNS: (tableAlias = 'Influencer') =>
    `(SELECT COUNT(*) FROM campaign_applications WHERE campaign_applications."influencerId" = ${tableAlias}.id AND campaign_applications.status = 'selected')`,

  TOTAL_FOLLOWERS: (tableAlias = 'Influencer') =>
    `(SELECT COUNT(*) FROM follows WHERE follows."followingType" = 'influencer' AND follows."followingInfluencerId" = ${tableAlias}.id)`,

  AGE_FROM_DOB: {
    BETWEEN: (minBirthYear: number, maxBirthYear: number) =>
      `EXTRACT(YEAR FROM "dateOfBirth") BETWEEN ${minBirthYear} AND ${maxBirthYear}`,

    MIN_AGE: (maxBirthYear: number) =>
      `EXTRACT(YEAR FROM "dateOfBirth") <= ${maxBirthYear}`,

    MAX_AGE: (minBirthYear: number) =>
      `EXTRACT(YEAR FROM "dateOfBirth") >= ${minBirthYear}`,
  },
} as const;

/**
 * Default attribute selections for different models
 */
export const MODEL_ATTRIBUTES = {
  INFLUENCER: [
    'id',
    'name',
    'username',
    'profileImage',
    'profileHeadline',
    'bio',
    'gender',
    'collaborationCosts',
    'instagramUrl',
    'youtubeUrl',
    'facebookUrl',
    'linkedinUrl',
    'twitterUrl',
  ],

  CAMPAIGN_APPLICATION: ['id', 'status'],

  BRAND: ['id', 'brandName', 'profileImage'],

  CITY: ['id', 'name', 'state', 'tier'],

  NICHE: ['id', 'name', 'logoNormal', 'logoDark'],

  CAMPAIGN_DELIVERABLE: ['platform', 'type', 'budget', 'quantity'],

  CAMPAIGN_INVITATION: ['id', 'influencerId', 'status'],
};

/**
 * Experience level mappings
 */
export const EXPERIENCE_LEVELS = {
  NO_EXPERIENCE: 0,
  ONE_PLUS: 1,
  TWO_PLUS: 2,
  THREE_PLUS: 3,
  FOUR_PLUS: 4,
  FIVE_PLUS: 5,
} as const;

/**
 * Platform types for filtering
 */
export const SOCIAL_PLATFORMS = {
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  YOUTUBE: 'youtube',
  LINKEDIN: 'linkedin',
  TWITTER: 'twitter',
  X: 'x',
} as const;
