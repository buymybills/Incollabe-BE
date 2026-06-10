-- Add viewsCount column to posts table for tracking post views
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "viewsCount" INTEGER NOT NULL DEFAULT 0;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_views_count ON posts("viewsCount");

-- Add comment to the column
COMMENT ON COLUMN posts."viewsCount" IS 'Number of times this post has been viewed';
