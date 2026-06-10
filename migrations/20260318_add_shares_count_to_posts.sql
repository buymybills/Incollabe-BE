-- Add sharesCount column to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS "sharesCount" INTEGER NOT NULL DEFAULT 0;

-- Add comment to the column
COMMENT ON COLUMN posts."sharesCount" IS 'Number of times this post has been shared';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_shares_count ON posts("sharesCount");
