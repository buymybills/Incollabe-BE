-- Migration: Add hype_store_order_id column to wallet_transactions
-- Description: Add foreign key reference to track which hype store order a transaction is related to
-- Author: System
-- Date: 2026-03-11

BEGIN;

\echo '=== Starting Hype Store Order ID Migration ==='

-- Step 1: Add hype_store_order_id column to wallet_transactions table
\echo 'Step 1: Adding hype_store_order_id column to wallet_transactions table...'
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS hype_store_order_id INTEGER NULL;

COMMENT ON COLUMN wallet_transactions.hype_store_order_id IS 'Reference to hype store order for this transaction';

\echo '✓ hype_store_order_id column added to wallet_transactions table'

-- Step 2: Create index on hype_store_order_id for faster queries
\echo 'Step 2: Creating index on wallet_transactions.hype_store_order_id...'
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_hype_store_order_id ON wallet_transactions(hype_store_order_id);

\echo '✓ Index created on hype_store_order_id'

-- Verification queries
\echo ''
\echo '=== Migration Verification ==='

\echo 'Checking wallet_transactions table structure:'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'wallet_transactions'
AND column_name = 'hype_store_order_id';

\echo ''
\echo '=== Migration Complete! ==='

COMMIT;
