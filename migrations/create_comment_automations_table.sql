-- Create comment_automations table
-- Links a specific Instagram post/reel + trigger keyword(s) to an automated
-- public comment reply and an automated private DM. Only comments matching a
-- configured rule trigger anything (no "alert on every post").

CREATE TABLE IF NOT EXISTS comment_automations (
  id SERIAL PRIMARY KEY,

  title             VARCHAR(255) NOT NULL,
  media_url         TEXT NOT NULL,
  media_shortcode   VARCHAR(100),
  media_id          VARCHAR(100),
  keyword           VARCHAR(500) NOT NULL,
  match_type        VARCHAR(20) NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact')),
  comment_reply     TEXT,
  dm_message        TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_count     INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_by        INTEGER,

  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for the webhook's hot lookup path (active rules, by media).
CREATE INDEX IF NOT EXISTS idx_comment_automations_active ON comment_automations(is_active);
CREATE INDEX IF NOT EXISTS idx_comment_automations_media_id ON comment_automations(media_id);
CREATE INDEX IF NOT EXISTS idx_comment_automations_shortcode ON comment_automations(media_shortcode);

COMMENT ON TABLE comment_automations IS 'Admin-configured Instagram comment-to-DM automation rules';
COMMENT ON COLUMN comment_automations.media_url IS 'Raw post/reel link pasted by the admin';
COMMENT ON COLUMN comment_automations.media_shortcode IS 'Shortcode parsed from the link (e.g. Cabc123)';
COMMENT ON COLUMN comment_automations.media_id IS 'Numeric IG media id, resolved + cached from the webhook';
COMMENT ON COLUMN comment_automations.keyword IS 'Comma-separated trigger keyword(s)';
COMMENT ON COLUMN comment_automations.match_type IS 'How keywords match comment text: contains or exact';
COMMENT ON COLUMN comment_automations.comment_reply IS 'Public reply posted under the matching comment';
COMMENT ON COLUMN comment_automations.dm_message IS 'Private DM sent to the commenter';
