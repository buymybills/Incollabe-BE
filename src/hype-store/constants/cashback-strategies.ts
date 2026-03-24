export enum CashbackClaimStrategy {
  PILOT_RUN = 'PILOT_RUN',
  VALIDATE_ROI = 'VALIDATE_ROI',
  OPTIMIZED_SPEND = 'OPTIMIZED_SPEND',
  MARKET_CAPTURE = 'MARKET_CAPTURE',
  AGGRESSIVE_SCALE = 'AGGRESSIVE_SCALE',
  CATEGORY_LEADER = 'CATEGORY_LEADER',
}

export interface CashbackStrategyOption {
  strategy: CashbackClaimStrategy;
  claimCount: number;
  title: string;
  description: string;
}

export const CASHBACK_CLAIM_STRATEGIES: CashbackStrategyOption[] = [
  {
    strategy: CashbackClaimStrategy.PILOT_RUN,
    claimCount: 1,
    title: 'Pilot run',
    description: 'Perfect for testing new creators',
  },
  {
    strategy: CashbackClaimStrategy.VALIDATE_ROI,
    claimCount: 2,
    title: 'Validate ROI',
    description: 'Perfect for testing new creators',
  },
  {
    strategy: CashbackClaimStrategy.OPTIMIZED_SPEND,
    claimCount: 3,
    title: 'Optimized spend',
    description: 'Best choice for consistent real campaigns',
  },
  {
    strategy: CashbackClaimStrategy.MARKET_CAPTURE,
    claimCount: 4,
    title: 'Market capture',
    description: 'Best choice for consistent real campaigns',
  },
  {
    strategy: CashbackClaimStrategy.AGGRESSIVE_SCALE,
    claimCount: 5,
    title: 'Aggressive scale',
    description: 'Recommended for viral drops',
  },
  {
    strategy: CashbackClaimStrategy.CATEGORY_LEADER,
    claimCount: 6,
    title: 'Category leader',
    description: 'Recommended for viral drops',
  },
];

/**
 * Get claim count for a strategy
 */
export function getClaimCountForStrategy(strategy: CashbackClaimStrategy): number {
  const option = CASHBACK_CLAIM_STRATEGIES.find((s) => s.strategy === strategy);
  return option?.claimCount || 3; // Default to OPTIMIZED_SPEND
}

/**
 * Get strategy for claim count
 */
export function getStrategyForClaimCount(claimCount: number): CashbackClaimStrategy {
  const option = CASHBACK_CLAIM_STRATEGIES.find((s) => s.claimCount === claimCount);
  return option?.strategy || CashbackClaimStrategy.OPTIMIZED_SPEND;
}
