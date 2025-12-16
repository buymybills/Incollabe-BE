-- Migration: Allow NULL content in posts table
-- Date: 2025-11-01
-- Description: Allows posts to be created with only media (no text content)

-- Alter the content column to allow NULL values
ALTER TABLE posts
ALTER COLUMN content DROP NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN posts.content IS 'Post text content (optional if media is provided)';
