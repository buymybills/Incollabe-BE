-- Add poll_data column to messages table for opinion poll feature in group chats
ALTER TABLE messages ADD COLUMN IF NOT EXISTS poll_data JSONB;

-- poll_data shape:
-- {
--   "question": "Which feature first?",
--   "options": [
--     { "id": "opt_1", "text": "Option A", "voterIds": [] },
--     { "id": "opt_2", "text": "Option B", "voterIds": ["42:influencer"] }
--   ],
--   "allowMultiple": false,
--   "expiresAt": "2026-05-20T00:00:00Z"  -- optional
-- }
