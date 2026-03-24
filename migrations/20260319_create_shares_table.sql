-- Create shares table to track who shared each post
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
CREATE INDEX idx_shares_post_id ON shares("postId");
CREATE INDEX idx_shares_sharer_influencer ON shares("sharerInfluencerId") WHERE "sharerInfluencerId" IS NOT NULL;
CREATE INDEX idx_shares_sharer_brand ON shares("sharerBrandId") WHERE "sharerBrandId" IS NOT NULL;
CREATE INDEX idx_shares_shared_at ON shares("sharedAt");
CREATE INDEX idx_shares_sharer_type ON shares("sharerType");

-- Create a function to automatically update posts.sharesCount
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
COMMENT ON TABLE shares IS 'Tracks who shared each post';
COMMENT ON COLUMN shares."postId" IS 'Reference to the post that was shared';
COMMENT ON COLUMN shares."sharerType" IS 'Type of sharer: influencer or brand';
COMMENT ON COLUMN shares."sharerInfluencerId" IS 'ID of influencer sharer (if sharerType is influencer)';
COMMENT ON COLUMN shares."sharerBrandId" IS 'ID of brand sharer (if sharerType is brand)';
COMMENT ON COLUMN shares."sharedAt" IS 'Timestamp when the post was shared';
