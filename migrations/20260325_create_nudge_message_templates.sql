-- Create Nudge Message Templates Table
-- Allows admins to configure subscription nudge messages from admin panel

CREATE TABLE IF NOT EXISTS nudge_message_templates (
  id SERIAL PRIMARY KEY,

  -- Message content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,

  -- Message type/category
  message_type VARCHAR(50) NOT NULL,
  -- Values: 'rotation', 'out_of_credits', 'active_user'

  -- Targeting conditions (for behavior-based messages)
  min_campaign_applications INTEGER,  -- Minimum applications needed
  requires_zero_credits BOOLEAN DEFAULT false,  -- Show only when credits = 0

  -- Status and ordering
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,  -- Higher priority = shown first
  rotation_order INTEGER,  -- Order in rotation sequence (for 'rotation' type)

  -- A/B Testing & Analytics
  times_sent INTEGER DEFAULT 0,  -- How many times this message was sent
  conversion_count INTEGER DEFAULT 0,  -- How many users subscribed after this message

  -- Scheduling (optional)
  valid_from TIMESTAMP WITH TIME ZONE,  -- Show only after this date
  valid_until TIMESTAMP WITH TIME ZONE,  -- Stop showing after this date

  -- Metadata
  created_by INTEGER,  -- Admin ID who created this
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Notes for admins
  internal_notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_nudge_templates_type_active ON nudge_message_templates(message_type, is_active);
CREATE INDEX idx_nudge_templates_rotation_order ON nudge_message_templates(rotation_order) WHERE message_type = 'rotation';
CREATE INDEX idx_nudge_templates_priority ON nudge_message_templates(priority DESC);
CREATE INDEX idx_nudge_templates_validity ON nudge_message_templates(valid_from, valid_until);

-- Comments
COMMENT ON TABLE nudge_message_templates IS 'Admin-configurable templates for subscription nudge notifications';
COMMENT ON COLUMN nudge_message_templates.message_type IS 'Type: rotation (generic), out_of_credits (urgent), active_user (behavior-based)';
COMMENT ON COLUMN nudge_message_templates.times_sent IS 'Tracks how many times this template was used (for analytics)';
COMMENT ON COLUMN nudge_message_templates.conversion_count IS 'How many users subscribed after receiving this message';

-- Seed default messages
INSERT INTO nudge_message_templates
  (title, body, message_type, rotation_order, priority, internal_notes)
VALUES
  -- Rotation messages (generic)
  ('Unlock your potential 💫',
   'MAX members earn 3x more on average. Get unlimited applications, priority in campaigns & exclusive perks for ₹199/month',
   'rotation', 0, 0, 'Generic message - earnings focus'),

  ('Unlock unlimited applications 🚀',
   'Stop worrying about weekly credits. Join MAX and apply to as many campaigns as you want for just ₹199/month',
   'rotation', 1, 0, 'Generic message - credit removal focus'),

  ('MAX members earn 3x more 💰',
   'Get priority in brand searches, unlimited applications, and exclusive high-paying campaigns. Join for ₹199/month',
   'rotation', 2, 0, 'Generic message - social proof'),

  ('Join 10,000+ Pro influencers ⭐',
   'Be part of our elite MAX community. Get early access to campaigns, higher selection rates & premium support for ₹199/month',
   'rotation', 3, 0, 'Generic message - community focus'),

  ('Get priority in brand searches 🔍',
   'MAX members appear first when brands search for influencers. Increase your chances of getting selected by 3x for ₹199/month',
   'rotation', 4, 0, 'Generic message - visibility focus'),

  ('Never run out of credits again ♾️',
   'Free users get 5 applications/week. MAX members get UNLIMITED applications + ₹100 bonus on signup. Only ₹199/month',
   'rotation', 5, 0, 'Generic message - freedom focus'),

  -- Behavior-based: Out of credits (urgent)
  ('Out of credits? 😔',
   'Upgrade to MAX for unlimited campaign applications + ₹100 joining bonus! Only ₹199/month',
   'out_of_credits', NULL, 100, 'High priority - shown when user has 0 credits'),

  -- Behavior-based: Active user
  ('You''re active! 🚀',
   'You''ve been applying to lots of campaigns! MAX members get unlimited applications + higher priority. Join for ₹199/month',
   'active_user', NULL, 90, 'Shown to users with 5+ applications');

-- Update the out_of_credits template to require zero credits
UPDATE nudge_message_templates
SET requires_zero_credits = true
WHERE message_type = 'out_of_credits';

-- Update the active_user template to require minimum applications
UPDATE nudge_message_templates
SET min_campaign_applications = 5
WHERE message_type = 'active_user';
