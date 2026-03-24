-- Add influencer types field to campaigns table
-- This stores selected influencer tiers by follower count ranges

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS influencer_types JSON;

COMMENT ON COLUMN campaigns.influencer_types IS 'Array of influencer types/tiers by follower count (below_1k, nano_1k_10k, micro_10k_100k, mid_tier_100k_500k, macro_500k_1m, mega_celebrity_1m_plus)';
