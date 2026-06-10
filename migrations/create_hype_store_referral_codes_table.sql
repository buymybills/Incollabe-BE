-- Migration: Create hype_store_referral_codes table
-- Description: Tracks unique referral codes for each influencer per brand
-- Used for brand-specific shared coupons with individual attribution

-- Create the table
CREATE TABLE IF NOT EXISTS hype_store_referral_codes (
  id SERIAL PRIMARY KEY,
  hype_store_id INTEGER NOT NULL,
  influencer_id INTEGER NOT NULL,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_referral_code_hype_store
    FOREIGN KEY (hype_store_id)
    REFERENCES hype_stores(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_referral_code_influencer
    FOREIGN KEY (influencer_id)
    REFERENCES influencers(id)
    ON DELETE CASCADE,

  -- Ensure one referral code per influencer per store
  CONSTRAINT unique_influencer_per_store
    UNIQUE (hype_store_id, influencer_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_hype_store_id ON hype_store_referral_codes(hype_store_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_influencer_id ON hype_store_referral_codes(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON hype_store_referral_codes(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON hype_store_referral_codes(is_active);

-- Add comment to table
COMMENT ON TABLE hype_store_referral_codes IS 'Tracks unique referral codes for each influencer per brand. Used for brand-specific shared coupons (e.g., SNITCHCOLLABKAROO) with individual influencer attribution via referral codes (e.g., INFL15).';

COMMENT ON COLUMN hype_store_referral_codes.referral_code IS 'Unique referral code for this influencer (e.g., INFL15, INFL22)';
COMMENT ON COLUMN hype_store_referral_codes.total_clicks IS 'Total number of clicks on this referral link';
COMMENT ON COLUMN hype_store_referral_codes.total_orders IS 'Total orders attributed to this referral code';
COMMENT ON COLUMN hype_store_referral_codes.total_revenue IS 'Total revenue from orders using this referral code';
