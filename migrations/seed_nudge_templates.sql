-- Seed nudge message templates
-- Run with: psql -U your_user -d your_database -f migrations/seed_nudge_templates.sql

-- Clear existing templates (optional)
TRUNCATE TABLE nudge_message_templates RESTART IDENTITY CASCADE;

-- Insert rotation messages (generic)
INSERT INTO nudge_message_templates (
  title, body, message_type, rotation_order, priority, is_active, created_at, updated_at
) VALUES
(
  '3x more opportunities with MAX 🚀',
  'MAX members earn 3x more on average. Get unlimited applications, priority in campaigns & exclusive perks for ₹199/month',
  'rotation', 1, 5, true, NOW(), NOW()
),
(
  'Unlock unlimited campaigns 🎯',
  'Stop waiting for credits to reset! MAX subscribers apply to unlimited campaigns and never miss opportunities. Join now for ₹199/month',
  'rotation', 2, 5, true, NOW(), NOW()
),
(
  'Get priority access 👑',
  'MAX members get priority in campaign selections and exclusive high-paying opportunities. Upgrade today and boost your earnings!',
  'rotation', 3, 5, true, NOW(), NOW()
),
(
  'Join 10,000+ MAX members 💫',
  'The most successful creators on Incollab use MAX. Get unlimited applications + priority access for just ₹199/month',
  'rotation', 4, 5, true, NOW(), NOW()
),
(
  'Double your campaign success rate 📈',
  'MAX members get selected 2x more often with unlimited applications and priority matching. Start your MAX journey today!',
  'rotation', 5, 5, true, NOW(), NOW()
);

-- Insert out-of-credits messages (urgent)
INSERT INTO nudge_message_templates (
  title, body, message_type, requires_zero_credits, priority, is_active, created_at, updated_at
) VALUES
(
  'Out of credits? Upgrade to MAX! 🔥',
  'Never run out of applications again! MAX members get UNLIMITED campaign applications for just ₹199/month. Upgrade now!',
  'out_of_credits', true, 10, true, NOW(), NOW()
),
(
  'Don''t let credits stop you! 💪',
  'You''ve used all your weekly credits. MAX subscribers never wait - they apply to unlimited campaigns instantly. Join MAX for ₹199/month',
  'out_of_credits', true, 10, true, NOW(), NOW()
);

-- Insert active user messages
INSERT INTO nudge_message_templates (
  title, body, message_type, min_campaign_applications, priority, is_active, created_at, updated_at
) VALUES
(
  'You''re on fire! 🔥 Take it further with MAX',
  'You''ve applied to {campaignApplications} campaigns! Imagine what you could do with UNLIMITED applications. Join MAX for ₹199/month',
  'active_user', 5, 8, true, NOW(), NOW()
),
(
  'Active creators love MAX 💎',
  'With {campaignApplications} applications, you clearly love campaigns! MAX gives you unlimited access + priority selection. Upgrade now!',
  'active_user', 5, 8, true, NOW(), NOW()
);

-- Verify insertion
SELECT
  message_type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM nudge_message_templates
GROUP BY message_type
ORDER BY message_type;

-- Show all templates
SELECT
  id,
  LEFT(title, 40) as title,
  message_type,
  rotation_order,
  priority,
  is_active,
  times_sent
FROM nudge_message_templates
ORDER BY message_type, rotation_order;
