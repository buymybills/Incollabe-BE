-- Add Max Campaign feature to campaigns
-- Brands pay Rs 299 to upgrade campaign to Max Campaign
-- Only Pro influencers can apply to Max Campaigns

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS "isMaxCampaign" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "maxCampaignPaymentStatus" VARCHAR(20) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS "maxCampaignPaymentId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "maxCampaignOrderId" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "maxCampaignPaidAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "maxCampaignAmount" INTEGER DEFAULT 29900;

-- Add comments
COMMENT ON COLUMN campaigns."isMaxCampaign" IS 'Whether this is a Max Campaign (exclusive to Pro influencers)';
COMMENT ON COLUMN campaigns."maxCampaignPaymentStatus" IS 'Payment status: unpaid, pending, paid, failed';
COMMENT ON COLUMN campaigns."maxCampaignPaymentId" IS 'Razorpay payment ID for Max Campaign upgrade';
COMMENT ON COLUMN campaigns."maxCampaignOrderId" IS 'Razorpay order ID for Max Campaign upgrade';
COMMENT ON COLUMN campaigns."maxCampaignPaidAt" IS 'When the Max Campaign payment was completed';
COMMENT ON COLUMN campaigns."maxCampaignAmount" IS 'Amount paid for Max Campaign upgrade (in paise, 29900 = Rs 299)';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_is_max_campaign ON campaigns("isMaxCampaign");
