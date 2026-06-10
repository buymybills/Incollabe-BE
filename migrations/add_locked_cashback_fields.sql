-- Migration: Add Locked Cashback Fields
-- Description: Add fields to support locked cashback during return window
-- Author: System
-- Date: 2026-03-11

BEGIN;

\echo '=== Starting Locked Cashback Migration ==='

-- Step 1: Add lockedAmount column to wallets table
\echo 'Step 1: Adding lockedAmount column to wallets table...'
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS locked_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL;

COMMENT ON COLUMN wallets.locked_amount IS 'Amount locked from cashback until return window closes';

\echo '✓ lockedAmount column added to wallets table'

-- Step 2: Add isLocked column to wallet_transactions table
\echo 'Step 2: Adding isLocked column to wallet_transactions table...'
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN wallet_transactions.is_locked IS 'Whether this amount is locked (e.g., during return window)';

\echo '✓ isLocked column added to wallet_transactions table'

-- Step 3: Add lockExpiresAt column to wallet_transactions table
\echo 'Step 3: Adding lockExpiresAt column to wallet_transactions table...'
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMP NULL;

COMMENT ON COLUMN wallet_transactions.lock_expires_at IS 'When this locked amount will be unlocked';

\echo '✓ lockExpiresAt column added to wallet_transactions table'

-- Step 4: Create index on isLocked for faster queries
\echo 'Step 4: Creating index on wallet_transactions.is_locked...'
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_is_locked ON wallet_transactions(is_locked);

\echo '✓ Index created on is_locked'

-- Step 5: Create index on lockExpiresAt for queries during unlock process
\echo 'Step 5: Creating index on wallet_transactions.lock_expires_at...'
DROP INDEX IF EXISTS idx_wallet_transactions_lock_expires_at;
CREATE INDEX idx_wallet_transactions_lock_expires_at ON wallet_transactions(lock_expires_at)
WHERE lock_expires_at IS NOT NULL;

\echo '✓ Index created on lock_expires_at'

-- Verification queries
\echo ''
\echo '=== Migration Verification ==='

\echo 'Checking wallets table structure:'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'wallets'
AND column_name IN ('locked_amount');

\echo ''
\echo 'Checking wallet_transactions table structure:'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'wallet_transactions'
AND column_name IN ('is_locked', 'lock_expires_at');

\echo ''
\echo '=== Migration Complete! ==='

COMMIT;
