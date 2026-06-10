-- Migration: Remove Unique Constraint on hype_stores.brand_id
-- Description: Allow multiple hype stores per brand
-- Author: System
-- Date: 2026-03-11

BEGIN;

\echo '=== Removing Unique Constraint on brand_id ==='

-- Check if unique constraint exists and drop it
ALTER TABLE hype_stores
DROP CONSTRAINT IF EXISTS hype_stores_brand_id_key;

-- Keep the index for performance (non-unique so multiple stores per brand are allowed)
-- The index should still exist for queries like WHERE brandId = ?
CREATE INDEX IF NOT EXISTS idx_hype_stores_brand_id ON hype_stores(brand_id);

\echo '✓ Unique constraint removed from brand_id'

-- Verify the constraint is removed
\echo ''
\echo '=== Table Structure After Migration ==='
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'hype_stores'
AND column_name IN ('brand_id');

\echo ''
\echo '=== Constraints on brand_id ==='
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'hype_stores'
AND constraint_type = 'UNIQUE';

\echo ''
\echo '=== Migration Complete! ==='

COMMIT;
