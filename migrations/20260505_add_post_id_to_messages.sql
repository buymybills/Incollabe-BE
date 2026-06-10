-- Add post_id to messages table for post-sharing via chat
ALTER TABLE messages ADD COLUMN IF NOT EXISTS post_id INT REFERENCES posts(id) ON DELETE SET NULL;

-- messageType is a VARCHAR with a CHECK constraint (not an enum)
-- Drop the old constraint and recreate it with 'post' included
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_messagetype_check;

ALTER TABLE messages ADD CONSTRAINT messages_messagetype_check
  CHECK ("messageType"::text = ANY (ARRAY['text','image','video','audio','file','media','post']::text[]));
