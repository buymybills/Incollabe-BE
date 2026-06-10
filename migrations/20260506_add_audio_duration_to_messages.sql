-- Add audio_duration column to messages table for voice note support
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER DEFAULT NULL;

COMMENT ON COLUMN messages.audio_duration IS 'Duration of voice note in seconds (only set when message_type = ''audio'')';
