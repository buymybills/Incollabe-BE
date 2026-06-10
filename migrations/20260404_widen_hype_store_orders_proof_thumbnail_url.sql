-- Widen proof_thumbnail_url to support long Instagram CDN URLs
-- Date: 2026-04-04

BEGIN;

ALTER TABLE hype_store_orders
ALTER COLUMN proof_thumbnail_url TYPE TEXT
USING proof_thumbnail_url::TEXT;

COMMENT ON COLUMN hype_store_orders.proof_thumbnail_url IS
  'Thumbnail URL for the Instagram proof content';

COMMIT;
