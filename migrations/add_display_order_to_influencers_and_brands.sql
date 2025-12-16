-- Migration: Add displayOrder field for manual sorting of top influencers and brands
-- Date: 2025-10-29

-- Add displayOrder to influencers table
ALTER TABLE influencers 
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NULL;

-- Add displayOrder to brands table
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NULL;

-- Add comments
COMMENT ON COLUMN influencers."displayOrder" IS 'Manual sort order for top influencers (lower number = higher priority). NULL means use automatic scoring.';
COMMENT ON COLUMN brands."displayOrder" IS 'Manual sort order for top brands (lower number = higher priority). NULL means use automatic scoring.';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_influencers_display_order ON influencers("displayOrder") WHERE "displayOrder" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_display_order ON brands("displayOrder") WHERE "displayOrder" IS NOT NULL;
