-- Migration: Add VIDEO and AUDIO message types to support media sharing
-- This allows messages to have video and audio attachments including voice messages

-- Step 1: Drop the old CHECK constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_messageType_check;

-- Step 2: Add new CHECK constraint with video and audio types
ALTER TABLE messages
  ADD CONSTRAINT messages_messageType_check
    CHECK ("messageType" IN ('text', 'image', 'video', 'audio', 'file'));

-- Step 3: Update comment for documentation
COMMENT ON COLUMN messages."messageType" IS 'Type of message: text, image, video, audio, or file';

-- Note: Existing messages will retain their current types (text, image, file)
-- New messages can now use video and audio types for media attachments
