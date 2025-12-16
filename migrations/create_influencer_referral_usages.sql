CREATE TABLE IF NOT EXISTS influencer_referral_usages (
  id SERIAL PRIMARY KEY,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  "referredUserId" INTEGER NOT NULL,
  "referralCode" VARCHAR(255) NOT NULL,
  "creditAwarded" BOOLEAN DEFAULT FALSE,
  "creditAwardedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_referral_usage_influencer ON influencer_referral_usages("influencerId");
CREATE INDEX IF NOT EXISTS idx_referral_usage_referred ON influencer_referral_usages("referredUserId");
CREATE INDEX IF NOT EXISTS idx_referral_usage_code ON influencer_referral_usages("referralCode");