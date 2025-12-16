-- Add referralCredits and upiId columns to influencers table
-- These fields are needed for the referral reward system

ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS "referralCredits" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "upiId" VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN influencers."referralCredits" IS 'Total referral credits earned by the influencer (in Rs)';
COMMENT ON COLUMN influencers."upiId" IS 'UPI ID for transferring referral credits';
