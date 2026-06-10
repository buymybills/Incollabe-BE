-- Quick fix: Add missing notes column to hype_store_orders
-- This is a patch for systems that ran the buggy version of migrate_hype_store_to_coupon_system.sql
-- Date: 2026-03-10

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'notes'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN notes TEXT;
        RAISE NOTICE '✅ Added notes column to hype_store_orders';
    ELSE
        RAISE NOTICE 'ℹ️  notes column already exists';
    END IF;
END $$;
