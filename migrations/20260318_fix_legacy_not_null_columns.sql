-- Migration: Fix legacy NOT NULL columns in hype_store_orders
-- Date: 2026-03-18
-- Description: Make legacy columns (order_id, product_name, product_details) nullable
--              These columns are not used in the current model but have NOT NULL constraints

BEGIN;

-- Make order_id nullable (we use external_order_id now)
ALTER TABLE hype_store_orders
ALTER COLUMN order_id DROP NOT NULL;

-- Make product_name nullable (we use order_title now)
ALTER TABLE hype_store_orders
ALTER COLUMN product_name DROP NOT NULL;

-- Make product_details nullable if it exists and is NOT NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'hype_store_orders'
        AND column_name = 'product_details'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE hype_store_orders ALTER COLUMN product_details DROP NOT NULL;
    END IF;
END $$;

COMMIT;

-- Verification query
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'hype_store_orders'
AND column_name IN ('order_id', 'product_name', 'product_details', 'external_order_id', 'order_title')
ORDER BY column_name;
