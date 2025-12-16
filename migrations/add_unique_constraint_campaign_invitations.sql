-- Add unique constraint to prevent duplicate invitations
-- This ensures one influencer can only receive one invitation per campaign

-- First, remove any existing duplicates (keeping only the most recent one)
DELETE FROM campaign_invitations
WHERE id NOT IN (
    SELECT MAX(id)
    FROM campaign_invitations
    GROUP BY "campaignId", "influencerId"
);

-- Now add the unique constraint
ALTER TABLE campaign_invitations
ADD CONSTRAINT unique_campaign_influencer_invitation 
UNIQUE ("campaignId", "influencerId");

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_invitations_campaign_id 
ON campaign_invitations("campaignId");

CREATE INDEX IF NOT EXISTS idx_campaign_invitations_influencer_id 
ON campaign_invitations("influencerId");

-- Add comment
COMMENT ON CONSTRAINT unique_campaign_influencer_invitation ON campaign_invitations 
IS 'Ensures one influencer can only receive one invitation per campaign';
