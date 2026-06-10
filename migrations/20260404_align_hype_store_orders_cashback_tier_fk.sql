-- Align hype_store_orders.cashback_tier_id with the new cashback_tiers table.
-- The application now calculates tier IDs from cashback_tiers, but older schema
-- versions still point the order FK at hype_store_cashback_tiers.

BEGIN;

-- Clear any legacy references that cannot exist in the new tier table.
UPDATE hype_store_orders o
SET cashback_tier_id = NULL
WHERE cashback_tier_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM cashback_tiers ct
    WHERE ct.id = o.cashback_tier_id
  );

-- Drop the legacy FK if it exists.
ALTER TABLE hype_store_orders
DROP CONSTRAINT IF EXISTS fk_hype_store_orders_cashback_tier;

ALTER TABLE hype_store_orders
DROP CONSTRAINT IF EXISTS hype_store_orders_cashback_tier_id_fkey;

-- Recreate the FK against the new tier table used by the app.
ALTER TABLE hype_store_orders
ADD CONSTRAINT fk_hype_store_orders_cashback_tier
FOREIGN KEY (cashback_tier_id)
REFERENCES cashback_tiers(id)
ON DELETE SET NULL;

COMMIT;

-- Verification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'hype_store_orders'::regclass
  AND conname = 'fk_hype_store_orders_cashback_tier';
