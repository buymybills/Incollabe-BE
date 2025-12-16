-- Add verifiedAt timestamp to track when influencer profile was verified
-- This is needed for the 36-hour early selection bonus feature

ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP;

-- Update existing verified influencers to set verifiedAt = updatedAt (best approximation)
-- For future verifications, this will be set when admin approves the profile
UPDATE influencers
SET "verifiedAt" = "updatedAt"
WHERE "isVerified" = true AND "verifiedAt" IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN influencers."verifiedAt" IS 'Timestamp when the influencer profile was verified by admin';
