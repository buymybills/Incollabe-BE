-- Create post_comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  "postId" INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  "authorType" VARCHAR(20) NOT NULL CHECK ("authorType" IN ('influencer', 'brand')),
  "authorInfluencerId" INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
  "authorBrandId" INTEGER REFERENCES brands(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments ("postId");
CREATE INDEX IF NOT EXISTS idx_post_comments_author_influencer ON post_comments ("authorInfluencerId") WHERE "authorInfluencerId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_comments_author_brand ON post_comments ("authorBrandId") WHERE "authorBrandId" IS NOT NULL;

-- Add commentsCount to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS "commentsCount" INTEGER NOT NULL DEFAULT 0;
