-- Add Pro Account feature to influencers
-- Pro influencers can apply to Max Campaigns

ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS "isPro" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "proActivatedAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "proExpiresAt" TIMESTAMP;

-- Add comments
COMMENT ON COLUMN influencers."isPro" IS 'Whether the influencer has an active Pro account';
COMMENT ON COLUMN influencers."proActivatedAt" IS 'When the Pro account was activated';
COMMENT ON COLUMN influencers."proExpiresAt" IS 'When the Pro account expires (NULL = lifetime)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_influencers_is_pro ON influencers("isPro");
