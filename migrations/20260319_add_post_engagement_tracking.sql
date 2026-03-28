-- ========================================
-- Post Engagement Tracking Migration
-- Adds views and shares tracking to posts
-- ========================================

-- 1. Add viewsCount column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS "viewsCount" INTEGER NOT NULL DEFAULT 0;

-- Add comment to the column
COMMENT ON COLUMN posts."viewsCount" IS 'Number of times this post has been viewed';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_views_count ON posts("viewsCount");

-- 2. Ensure sharesCount column exists with correct name
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS "sharesCount" INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN posts."sharesCount" IS 'Number of times this post has been shared';
CREATE INDEX IF NOT EXISTS idx_posts_shares_count ON posts("sharesCount");

-- 3. Create post_views table to track who viewed each post
CREATE TABLE IF NOT EXISTS post_views (
    id SERIAL PRIMARY KEY,

    -- Post reference
    "postId" INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    -- Viewer information (polymorphic - can be influencer or brand)
    "viewerType" VARCHAR(20) NOT NULL CHECK ("viewerType" IN ('influencer', 'brand')),
    "viewerInfluencerId" INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    "viewerBrandId" INTEGER REFERENCES brands(id) ON DELETE CASCADE,

    -- Timestamps
    "viewedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_viewer_exists CHECK (
        ("viewerType" = 'influencer' AND "viewerInfluencerId" IS NOT NULL AND "viewerBrandId" IS NULL) OR
        ("viewerType" = 'brand' AND "viewerBrandId" IS NOT NULL AND "viewerInfluencerId" IS NULL)
    ),

    -- Prevent duplicate views from same user (unique per user per post)
    CONSTRAINT unique_post_viewer UNIQUE ("postId", "viewerType", "viewerInfluencerId", "viewerBrandId")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views("postId");
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_influencer ON post_views("viewerInfluencerId") WHERE "viewerInfluencerId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_brand ON post_views("viewerBrandId") WHERE "viewerBrandId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_views_viewed_at ON post_views("viewedAt");
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_type ON post_views("viewerType");

-- 4. Create shares table to track who shared each post
CREATE TABLE IF NOT EXISTS shares (
    id SERIAL PRIMARY KEY,

    -- Post reference
    "postId" INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    -- Sharer information (polymorphic - can be influencer or brand)
    "sharerType" VARCHAR(20) NOT NULL CHECK ("sharerType" IN ('influencer', 'brand')),
    "sharerInfluencerId" INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    "sharerBrandId" INTEGER REFERENCES brands(id) ON DELETE CASCADE,

    -- Timestamps
    "sharedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_sharer_exists CHECK (
        ("sharerType" = 'influencer' AND "sharerInfluencerId" IS NOT NULL AND "sharerBrandId" IS NULL) OR
        ("sharerType" = 'brand' AND "sharerBrandId" IS NOT NULL AND "sharerInfluencerId" IS NULL)
    ),

    -- Prevent duplicate shares from same user (unique per user per post)
    CONSTRAINT unique_post_sharer UNIQUE ("postId", "sharerType", "sharerInfluencerId", "sharerBrandId")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shares_post_id ON shares("postId");
CREATE INDEX IF NOT EXISTS idx_shares_sharer_influencer ON shares("sharerInfluencerId") WHERE "sharerInfluencerId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shares_sharer_brand ON shares("sharerBrandId") WHERE "sharerBrandId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shares_shared_at ON shares("sharedAt");
CREATE INDEX IF NOT EXISTS idx_shares_sharer_type ON shares("sharerType");

-- 5. Create trigger function to auto-update viewsCount
CREATE OR REPLACE FUNCTION update_post_views_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE posts SET "viewsCount" = "viewsCount" + 1 WHERE id = NEW."postId";
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE posts SET "viewsCount" = GREATEST("viewsCount" - 1, 0) WHERE id = OLD."postId";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update viewsCount
DROP TRIGGER IF EXISTS trigger_update_post_views_count ON post_views;
CREATE TRIGGER trigger_update_post_views_count
AFTER INSERT OR DELETE ON post_views
FOR EACH ROW
EXECUTE FUNCTION update_post_views_count();

-- 6. Create trigger function to auto-update sharesCount
CREATE OR REPLACE FUNCTION update_post_shares_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE posts SET "sharesCount" = "sharesCount" + 1 WHERE id = NEW."postId";
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE posts SET "sharesCount" = GREATEST("sharesCount" - 1, 0) WHERE id = OLD."postId";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update sharesCount
DROP TRIGGER IF EXISTS trigger_update_post_shares_count ON shares;
CREATE TRIGGER trigger_update_post_shares_count
AFTER INSERT OR DELETE ON shares
FOR EACH ROW
EXECUTE FUNCTION update_post_shares_count();

-- Add comments for documentation
COMMENT ON TABLE post_views IS 'Tracks who viewed each post (unique views only)';
COMMENT ON COLUMN post_views."postId" IS 'Reference to the post that was viewed';
COMMENT ON COLUMN post_views."viewerType" IS 'Type of viewer: influencer or brand';
COMMENT ON COLUMN post_views."viewerInfluencerId" IS 'ID of influencer viewer (if viewerType is influencer)';
COMMENT ON COLUMN post_views."viewerBrandId" IS 'ID of brand viewer (if viewerType is brand)';
COMMENT ON COLUMN post_views."viewedAt" IS 'Timestamp when the post was viewed';

COMMENT ON TABLE shares IS 'Tracks who shared each post';
COMMENT ON COLUMN shares."postId" IS 'Reference to the post that was shared';
COMMENT ON COLUMN shares."sharerType" IS 'Type of sharer: influencer or brand';
COMMENT ON COLUMN shares."sharerInfluencerId" IS 'ID of influencer sharer (if sharerType is influencer)';
COMMENT ON COLUMN shares."sharerBrandId" IS 'ID of brand sharer (if sharerType is brand)';
COMMENT ON COLUMN shares."sharedAt" IS 'Timestamp when the post was shared';
