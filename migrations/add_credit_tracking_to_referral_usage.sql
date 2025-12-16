-- Add credit tracking fields to influencer_referral_usages table
-- This ensures credits are only marked as awarded when referred influencer is verified

ALTER TABLE influencer_referral_usages
ADD COLUMN "creditAwarded" BOOLEAN DEFAULT FALSE,
ADD COLUMN "creditAwardedAt" TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN influencer_referral_usages."creditAwarded" IS 'Tracks whether referral credit has been awarded to the referrer';
COMMENT ON COLUMN influencer_referral_usages."creditAwardedAt" IS 'Timestamp when referral credit was awarded to the referrer';
