-- ===================================================
-- Multi-Device Push Notification Debugging Queries
-- ===================================================

-- 1. Check if device_tokens table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'device_tokens'
) as table_exists;

-- 2. Count total device tokens
SELECT COUNT(*) as total_device_tokens FROM device_tokens;

-- 3. View all device tokens (with user info)
SELECT
    dt.id,
    dt.user_id,
    dt.user_type,
    dt.device_name,
    dt.device_os,
    LEFT(dt.fcm_token, 30) || '...' as token_preview,
    dt.last_used_at,
    dt.created_at,
    CASE dt.user_type
        WHEN 'influencer' THEN i.name
        WHEN 'brand' THEN b.brand_name
        ELSE NULL
    END as user_name
FROM device_tokens dt
LEFT JOIN influencers i ON dt.user_id = i.id AND dt.user_type = 'influencer'
LEFT JOIN brands b ON dt.user_id = b.id AND dt.user_type = 'brand'
ORDER BY dt.created_at DESC
LIMIT 20;

-- 4. Check device count per user
SELECT
    user_id,
    user_type,
    COUNT(*) as device_count,
    MAX(last_used_at) as last_device_used
FROM device_tokens
GROUP BY user_id, user_type
ORDER BY device_count DESC;

-- 5. Find users with multiple devices (these should receive multi-device notifications)
SELECT
    dt.user_id,
    dt.user_type,
    CASE dt.user_type
        WHEN 'influencer' THEN i.name
        WHEN 'brand' THEN b.brand_name
    END as user_name,
    COUNT(*) as device_count,
    string_agg(dt.device_name, ', ') as devices
FROM device_tokens dt
LEFT JOIN influencers i ON dt.user_id = i.id AND dt.user_type = 'influencer'
LEFT JOIN brands b ON dt.user_id = b.id AND dt.user_type = 'brand'
GROUP BY dt.user_id, dt.user_type, user_name
HAVING COUNT(*) > 1
ORDER BY device_count DESC;

-- 6. Check for specific user (REPLACE 1 with actual user ID)
SELECT
    id,
    device_name,
    device_os,
    app_version,
    LEFT(fcm_token, 40) || '...' as token,
    last_used_at,
    created_at
FROM device_tokens
WHERE user_id = 1 AND user_type = 'influencer'
ORDER BY last_used_at DESC;

-- 7. Test if a specific influencer has devices (use actual user ID)
DO $$
DECLARE
    test_user_id INT := 1; -- CHANGE THIS
    device_count INT;
BEGIN
    SELECT COUNT(*) INTO device_count
    FROM device_tokens
    WHERE user_id = test_user_id AND user_type = 'influencer';

    RAISE NOTICE '👤 User % has % device(s) registered', test_user_id, device_count;

    IF device_count = 0 THEN
        RAISE NOTICE '⚠️  No devices found! User needs to update FCM token via /auth/influencer/update-fcm-token';
    ELSIF device_count = 1 THEN
        RAISE NOTICE '📱 User has 1 device - notifications will be sent to 1 device';
    ELSE
        RAISE NOTICE '📱📱 User has % devices - notifications will be sent to ALL devices', device_count;
    END IF;
END $$;

-- 8. Verify recent device token updates (last 24 hours)
SELECT
    user_id,
    user_type,
    device_name,
    device_os,
    created_at,
    last_used_at,
    EXTRACT(EPOCH FROM (NOW() - last_used_at))/3600 as hours_since_last_use
FROM device_tokens
WHERE last_used_at > NOW() - INTERVAL '24 hours'
ORDER BY last_used_at DESC;

-- 9. Find inactive/stale tokens (not used in 90+ days)
SELECT
    user_id,
    user_type,
    device_name,
    EXTRACT(DAY FROM (NOW() - last_used_at)) as days_inactive
FROM device_tokens
WHERE last_used_at < NOW() - INTERVAL '90 days'
ORDER BY days_inactive DESC;

-- ===================================================
-- Expected Results:
-- ===================================================
-- ✅ Query 1 should return: table_exists = true
-- ✅ Query 2 should return: total_device_tokens > 0
-- ✅ Query 5 should show users with multiple devices
-- ✅ Query 6 should show your test user's devices
-- ===================================================
