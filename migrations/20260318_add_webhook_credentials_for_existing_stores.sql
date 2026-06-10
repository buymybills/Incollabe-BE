-- Migration: Add webhook credentials for existing stores that don't have them
-- Date: 2026-03-18
-- Description: Generate API keys and webhook secrets for stores created before webhook system was implemented

BEGIN;

-- Insert webhook credentials for stores that don't have them
-- Using PostgreSQL's gen_random_uuid() and md5() for random generation
INSERT INTO hype_store_webhook_secrets (hype_store_id, api_key, webhook_secret, is_active, created_at, updated_at)
SELECT
    hs.id,
    CONCAT('hs_live_', md5(random()::text || clock_timestamp()::text)::text),
    md5(random()::text || random()::text || clock_timestamp()::text)::text || md5(random()::text || clock_timestamp()::text)::text,
    true,
    NOW(),
    NOW()
FROM hype_stores hs
LEFT JOIN hype_store_webhook_secrets ws ON hs.id = ws.hype_store_id
WHERE ws.id IS NULL;

COMMIT;

-- Verification query
SELECT
    hs.id as store_id,
    hs.store_name,
    ws.api_key,
    LEFT(ws.webhook_secret, 16) || '...' as webhook_secret_preview,
    ws.is_active,
    ws.created_at
FROM hype_stores hs
LEFT JOIN hype_store_webhook_secrets ws ON hs.id = ws.hype_store_id
ORDER BY hs.id;
