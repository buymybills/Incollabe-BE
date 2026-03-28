-- Quick diagnostic check for nudge notification system
-- Run with: psql -U your_user -d your_database -f migrations/check_nudge_system.sql

\echo '=========================================='
\echo '1. CHECKING NUDGE MESSAGE TEMPLATES'
\echo '=========================================='
SELECT
  COUNT(*) as total_templates,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_templates,
  COUNT(CASE WHEN message_type = 'rotation' THEN 1 END) as rotation_templates,
  COUNT(CASE WHEN message_type = 'out_of_credits' THEN 1 END) as out_of_credits_templates,
  COUNT(CASE WHEN message_type = 'active_user' THEN 1 END) as active_user_templates
FROM nudge_message_templates;

\echo ''
\echo 'Template details:'
SELECT
  id,
  LEFT(title, 50) as title,
  message_type,
  rotation_order,
  priority,
  is_active,
  times_sent
FROM nudge_message_templates
ORDER BY message_type, rotation_order NULLS LAST;

\echo ''
\echo '=========================================='
\echo '2. CHECKING ELIGIBLE USERS FOR NUDGES'
\echo '=========================================='
SELECT
  COUNT(*) as total_non_pro_users,
  COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
  COUNT(CASE WHEN created_at < NOW() - INTERVAL '3 days' THEN 1 END) as past_grace_period,
  COUNT(CASE WHEN
    is_verified = true AND
    is_active = true AND
    created_at < NOW() - INTERVAL '3 days'
  THEN 1 END) as eligible_for_nudge
FROM influencers
WHERE is_pro = false AND deleted_at IS NULL;

\echo ''
\echo 'Sample of eligible users:'
SELECT
  id,
  username,
  LEFT(name, 30) as name,
  DATE(created_at) as joined_date,
  DATE(last_nudge_sent_at) as last_nudge,
  nudge_count,
  weekly_credits,
  is_verified,
  is_active
FROM influencers
WHERE
  is_pro = false AND
  is_verified = true AND
  is_active = true AND
  created_at < NOW() - INTERVAL '3 days' AND
  deleted_at IS NULL
ORDER BY COALESCE(last_nudge_sent_at, '1970-01-01'::timestamp) ASC
LIMIT 10;

\echo ''
\echo '=========================================='
\echo '3. CHECKING FCM DEVICE TOKENS'
\echo '=========================================='
SELECT
  COUNT(DISTINCT user_id) as users_with_tokens,
  COUNT(*) as total_tokens,
  COUNT(CASE WHEN user_type = 'influencer' THEN 1 END) as influencer_tokens,
  COUNT(CASE WHEN user_type = 'brand' THEN 1 END) as brand_tokens
FROM device_tokens
WHERE deleted_at IS NULL;

\echo ''
\echo '=========================================='
\echo '4. RECENT NUDGE ACTIVITY'
\echo '=========================================='
SELECT
  DATE(last_nudge_sent_at) as date,
  COUNT(*) as users_nudged,
  AVG(nudge_count) as avg_nudge_count
FROM influencers
WHERE last_nudge_sent_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(last_nudge_sent_at)
ORDER BY date DESC;

\echo ''
\echo '=========================================='
\echo '5. IN-APP NOTIFICATIONS (Recent nudges)'
\echo '=========================================='
SELECT
  DATE(created_at) as date,
  COUNT(*) as notifications_sent,
  COUNT(CASE WHEN is_read = true THEN 1 END) as read_count
FROM in_app_notifications
WHERE
  user_type = 'influencer' AND
  created_at >= NOW() - INTERVAL '7 days' AND
  (metadata->>'nudgeType')::text = 'daily_subscription_nudge'
GROUP BY DATE(created_at)
ORDER BY date DESC;

\echo ''
\echo '=========================================='
\echo '6. CURRENT SERVER TIME'
\echo '=========================================='
SELECT
  NOW() as server_time,
  NOW() AT TIME ZONE 'UTC' as utc_time,
  EXTRACT(HOUR FROM NOW()) as current_hour;

\echo ''
\echo '=========================================='
\echo 'DIAGNOSIS SUMMARY'
\echo '=========================================='
\echo ''
\echo 'If templates = 0:'
\echo '  → Run: psql -f migrations/seed_nudge_templates.sql'
\echo ''
\echo 'If eligible_for_nudge = 0:'
\echo '  → Users need to be: non-Pro, verified, active, joined >3 days ago'
\echo ''
\echo 'If users_with_tokens = 0:'
\echo '  → Users need to log into mobile app to register FCM tokens'
\echo ''
\echo 'Cron schedule: Daily at 10:00 AM server time'
\echo ''
