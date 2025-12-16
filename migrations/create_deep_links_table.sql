-- Create deep_links table
CREATE TABLE IF NOT EXISTS deep_links (
  id SERIAL PRIMARY KEY,
  url VARCHAR(500) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  "userType" VARCHAR(20) NOT NULL DEFAULT 'both',
  category VARCHAR(100) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create enum type for userType
DO $$ BEGIN
  CREATE TYPE enum_deep_links_userType AS ENUM ('influencer', 'brand', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Alter column to use enum
ALTER TABLE deep_links
  ALTER COLUMN "userType" TYPE enum_deep_links_userType
  USING "userType"::enum_deep_links_userType;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_deep_links_user_type ON deep_links("userType");
CREATE INDEX IF NOT EXISTS idx_deep_links_category ON deep_links(category);
CREATE INDEX IF NOT EXISTS idx_deep_links_is_active ON deep_links("isActive");

-- Add comments
COMMENT ON TABLE deep_links IS 'Deep link URLs for push notification actionUrl field';
COMMENT ON COLUMN deep_links.url IS 'Deep link URL (e.g., app://influencers/me)';
COMMENT ON COLUMN deep_links.description IS 'Description of what this deep link does';
COMMENT ON COLUMN deep_links."userType" IS 'Target user type: influencer, brand, or both';
COMMENT ON COLUMN deep_links.category IS 'Category for grouping (e.g., Home, Profile, Campaigns)';
COMMENT ON COLUMN deep_links."isActive" IS 'Whether this deep link is active and should be shown';
