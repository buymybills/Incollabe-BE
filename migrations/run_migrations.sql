-- Combined Migration Script
-- Run this script to apply all pending migrations
-- Date: 2025-09-30

-- Transaction to ensure all migrations run successfully or none at all
BEGIN;

-- Migration 001: Add isTopInfluencer column to influencers table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'influencers' AND column_name = 'isTopInfluencer'
    ) THEN
        ALTER TABLE influencers ADD COLUMN "isTopInfluencer" BOOLEAN NOT NULL DEFAULT false;
        CREATE INDEX idx_influencers_is_top_influencer ON influencers("isTopInfluencer") WHERE "isTopInfluencer" = true;
        RAISE NOTICE 'Added isTopInfluencer column to influencers table';
    ELSE
        RAISE NOTICE 'isTopInfluencer column already exists in influencers table';
    END IF;
END $$;

-- Migration 002: Create custom_niches table
CREATE TABLE IF NOT EXISTS custom_niches (
    id SERIAL PRIMARY KEY,
    "userType" VARCHAR(20) NOT NULL CHECK ("userType" IN ('influencer', 'brand')),
    "userId" INTEGER NOT NULL,
    "influencerId" INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    "brandId" INTEGER REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL CHECK (length(name) >= 2),
    description TEXT CHECK (length(description) <= 500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_custom_niche_per_user UNIQUE ("userType", "userId", name)
);

-- Create indexes for custom_niches if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_custom_niches_user_type_user_id') THEN
        CREATE INDEX idx_custom_niches_user_type_user_id ON custom_niches("userType", "userId");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_custom_niches_influencer_id') THEN
        CREATE INDEX idx_custom_niches_influencer_id ON custom_niches("influencerId") WHERE "influencerId" IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_custom_niches_brand_id') THEN
        CREATE INDEX idx_custom_niches_brand_id ON custom_niches("brandId") WHERE "brandId" IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_custom_niches_is_active') THEN
        CREATE INDEX idx_custom_niches_is_active ON custom_niches("isActive") WHERE "isActive" = true;
    END IF;
END $$;

COMMIT;

-- Success message
SELECT 'All migrations completed successfully!' as status;