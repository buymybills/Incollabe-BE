-- Add field to track how many times influencer clicked "Invite Friend for referral" button
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS referral_invite_click_count INTEGER DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_influencers_referral_code
ON influencers(referral_code)
WHERE referral_code IS NOT NULL;

-- Update existing records to have 0 clicks
UPDATE influencers
SET referral_invite_click_count = 0
WHERE referral_invite_click_count IS NULL;

-- Add comment
COMMENT ON COLUMN influencers.referral_invite_click_count IS 'Number of times influencer clicked the Invite Friend for referral button';
