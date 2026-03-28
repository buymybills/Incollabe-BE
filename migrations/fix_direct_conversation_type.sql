-- ============================================================
-- Migration: Fix old 'direct' conversation types
-- Updates legacy 'direct' conversations to 'personal'
-- ============================================================

-- Update all 'direct' conversations to 'personal'
-- This handles conversations created before the conversation_type field was standardized
UPDATE conversations
SET conversation_type = 'personal'
WHERE conversation_type = 'direct';

-- Verify the update
SELECT
  conversation_type,
  COUNT(*) as count
FROM conversations
GROUP BY conversation_type;
