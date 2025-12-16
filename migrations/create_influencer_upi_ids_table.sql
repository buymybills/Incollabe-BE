-- Create influencer_upi_ids table to manage multiple UPI IDs per influencer
CREATE TABLE IF NOT EXISTS influencer_upi_ids (
  id SERIAL PRIMARY KEY,
  "influencerId" INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  "upiId" VARCHAR(255) NOT NULL,
  "isSelectedForCurrentTransaction" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on influencerId for faster lookups
CREATE INDEX idx_influencer_upi_ids_influencer_id ON influencer_upi_ids("influencerId");

-- Create unique constraint to prevent duplicate UPI IDs for same influencer
CREATE UNIQUE INDEX idx_influencer_upi_ids_unique ON influencer_upi_ids("influencerId", "upiId");

-- Add comment to table
COMMENT ON TABLE influencer_upi_ids IS 'Stores multiple UPI IDs for each influencer with selection tracking for redemptions';
COMMENT ON COLUMN influencer_upi_ids."isSelectedForCurrentTransaction" IS 'Indicates if this UPI ID is selected for the current redemption transaction';
COMMENT ON COLUMN influencer_upi_ids."lastUsedAt" IS 'Timestamp of when this UPI ID was last used for a redemption';
