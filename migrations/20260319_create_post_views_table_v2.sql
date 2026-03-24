-- Create post_views table to track who viewed each post
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
CREATE INDEX idx_post_views_post_id ON post_views("postId");
CREATE INDEX idx_post_views_viewer_influencer ON post_views("viewerInfluencerId") WHERE "viewerInfluencerId" IS NOT NULL;
CREATE INDEX idx_post_views_viewer_brand ON post_views("viewerBrandId") WHERE "viewerBrandId" IS NOT NULL;
CREATE INDEX idx_post_views_viewed_at ON post_views("viewedAt");
CREATE INDEX idx_post_views_viewer_type ON post_views("viewerType");

-- Create a function to automatically update posts.viewsCount
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

-- Add comments for documentation
COMMENT ON TABLE post_views IS 'Tracks who viewed each post (unique views only)';
COMMENT ON COLUMN post_views."postId" IS 'Reference to the post that was viewed';
COMMENT ON COLUMN post_views."viewerType" IS 'Type of viewer: influencer or brand';
COMMENT ON COLUMN post_views."viewerInfluencerId" IS 'ID of influencer viewer (if viewerType is influencer)';
COMMENT ON COLUMN post_views."viewerBrandId" IS 'ID of brand viewer (if viewerType is brand)';
COMMENT ON COLUMN post_views."viewedAt" IS 'Timestamp when the post was viewed';
