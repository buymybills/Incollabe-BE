-- Migration: Add Boost Mode feature to posts
-- Description: Allows posts to be boosted for 24 hours to appear at top with maximum visibility
-- Date: 2026-03-19

-- Add boost-related columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "isBoosted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "boostedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "boostExpiresAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "boostPaymentId" VARCHAR(255);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "boostAmount" DECIMAL(10, 2);

-- Create index for efficient querying of boosted posts
CREATE INDEX IF NOT EXISTS idx_posts_boosted ON posts("isBoosted", "boostExpiresAt") WHERE "isBoosted" = true;

-- Create index for sorting boosted posts first
CREATE INDEX IF NOT EXISTS idx_posts_boost_created ON posts("isBoosted" DESC, "boostedAt" DESC, "createdAt" DESC);

-- Add comment to table
COMMENT ON COLUMN posts."isBoosted" IS 'Indicates if the post is currently boosted';
COMMENT ON COLUMN posts."boostedAt" IS 'Timestamp when the boost was activated';
COMMENT ON COLUMN posts."boostExpiresAt" IS 'Timestamp when the boost expires (24 hours after activation)';
COMMENT ON COLUMN posts."boostPaymentId" IS 'Razorpay payment ID for the boost transaction';
COMMENT ON COLUMN posts."boostAmount" IS 'Amount paid for boosting (in INR)';
