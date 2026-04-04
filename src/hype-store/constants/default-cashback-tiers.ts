import { CashbackType } from '../../wallet/models/hype-store-cashback-tier.model';

export interface DefaultCashbackTierConfig {
  tierName: string;
  minFollowers: number;
  maxFollowers: number | null;
  contentType: 'REEL' | 'STORY' | 'NO_CONTENT';
  cashbackType: CashbackType;
  cashbackValue: number; // Percentage value (e.g., 8.0 = 8%)
  priority: number;
}

/**
 * Default cashback tiers for REELS (permanent content - higher cashback %)
 * Max cashback: 30%
 * Min/Max amounts are set by brand at store level
 */
export const DEFAULT_REEL_TIERS: DefaultCashbackTierConfig[] = [
  {
    tierName: 'TIER_1 - Reels (1-499)',
    minFollowers: 1,
    maxFollowers: 499,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 8.0,
    priority: 10,
  },
  {
    tierName: 'TIER_2 - Reels (500-999)',
    minFollowers: 500,
    maxFollowers: 999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 10.0,
    priority: 20,
  },
  {
    tierName: 'TIER_3 - Reels (1K-9.9K)',
    minFollowers: 1000,
    maxFollowers: 9999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 12.0,
    priority: 30,
  },
  {
    tierName: 'TIER_4 - Reels (10K-19.9K)',
    minFollowers: 10000,
    maxFollowers: 19999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 14.0,
    priority: 40,
  },
  {
    tierName: 'TIER_5 - Reels (20K-29.9K)',
    minFollowers: 20000,
    maxFollowers: 29999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 16.0,
    priority: 50,
  },
  {
    tierName: 'TIER_6 - Reels (30K-49.9K)',
    minFollowers: 30000,
    maxFollowers: 49999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 18.0,
    priority: 60,
  },
  {
    tierName: 'TIER_7 - Reels (50K-69.9K)',
    minFollowers: 50000,
    maxFollowers: 69999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 20.0,
    priority: 70,
  },
  {
    tierName: 'TIER_8 - Reels (70K-99.9K)',
    minFollowers: 70000,
    maxFollowers: 99999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 22.0,
    priority: 80,
  },
  {
    tierName: 'TIER_9 - Reels (100K-199.9K)',
    minFollowers: 100000,
    maxFollowers: 199999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 24.0,
    priority: 90,
  },
  {
    tierName: 'TIER_10 - Reels (200K-299.9K)',
    minFollowers: 200000,
    maxFollowers: 299999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 26.0,
    priority: 100,
  },
  {
    tierName: 'TIER_11 - Reels (300K-499.9K)',
    minFollowers: 300000,
    maxFollowers: 499999,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 28.0,
    priority: 110,
  },
  {
    tierName: 'TIER_12 - Reels (500K+)',
    minFollowers: 500000,
    maxFollowers: null,
    contentType: 'REEL',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 30.0,
    priority: 120,
  },
];

/**
 * Default cashback tiers for STORIES (24-hour content - lower cashback %)
 * Max cashback: 25%
 * Min/Max amounts are set by brand at store level
 */
export const DEFAULT_STORY_TIERS: DefaultCashbackTierConfig[] = [
  {
    tierName: 'TIER_1 - Stories (1-499)',
    minFollowers: 1,
    maxFollowers: 499,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 7.0,
    priority: 10,
  },
  {
    tierName: 'TIER_2 - Stories (500-999)',
    minFollowers: 500,
    maxFollowers: 999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 8.0,
    priority: 20,
  },
  {
    tierName: 'TIER_3 - Stories (1K-9.9K)',
    minFollowers: 1000,
    maxFollowers: 9999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 10.0,
    priority: 30,
  },
  {
    tierName: 'TIER_4 - Stories (10K-19.9K)',
    minFollowers: 10000,
    maxFollowers: 19999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 12.0,
    priority: 40,
  },
  {
    tierName: 'TIER_5 - Stories (20K-29.9K)',
    minFollowers: 20000,
    maxFollowers: 29999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 14.0,
    priority: 50,
  },
  {
    tierName: 'TIER_6 - Stories (30K-49.9K)',
    minFollowers: 30000,
    maxFollowers: 49999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 16.0,
    priority: 60,
  },
  {
    tierName: 'TIER_7 - Stories (50K-69.9K)',
    minFollowers: 50000,
    maxFollowers: 69999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 18.0,
    priority: 70,
  },
  {
    tierName: 'TIER_8 - Stories (70K-99.9K)',
    minFollowers: 70000,
    maxFollowers: 99999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 20.0,
    priority: 80,
  },
  {
    tierName: 'TIER_9 - Stories (100K-199.9K)',
    minFollowers: 100000,
    maxFollowers: 199999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 22.0,
    priority: 90,
  },
  {
    tierName: 'TIER_10 - Stories (200K-299.9K)',
    minFollowers: 200000,
    maxFollowers: 299999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 24.0,
    priority: 100,
  },
  {
    tierName: 'TIER_11 - Stories (300K-499.9K)',
    minFollowers: 300000,
    maxFollowers: 499999,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 25.0,
    priority: 110,
  },
  {
    tierName: 'TIER_12 - Stories (500K+)',
    minFollowers: 500000,
    maxFollowers: null,
    contentType: 'STORY',
    cashbackType: CashbackType.PERCENTAGE,
    cashbackValue: 25.0,
    priority: 120,
  },
];

/**
 * Default cashback tier for NO_CONTENT (when influencer doesn't submit proof)
 * Applies to all follower counts - Fixed 7% cashback
 * Min/Max amounts use story limits from brand's store config
 */
export const DEFAULT_NO_CONTENT_TIER: DefaultCashbackTierConfig = {
  tierName: 'NO_CONTENT - No Proof Submitted',
  minFollowers: 0,
  maxFollowers: null,
  contentType: 'NO_CONTENT',
  cashbackType: CashbackType.PERCENTAGE,
  cashbackValue: 7.0,
  priority: 5, // Lower priority, so it's used as fallback
};

/**
 * Combined default tiers for easy creation
 * Total: 25 tiers (12 REEL + 12 STORY + 1 NO_CONTENT)
 */
export const DEFAULT_CASHBACK_TIERS: DefaultCashbackTierConfig[] = [
  DEFAULT_NO_CONTENT_TIER,
  ...DEFAULT_REEL_TIERS,
  ...DEFAULT_STORY_TIERS,
];
