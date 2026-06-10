-- Migrate hype_store_orders from old schema to new coupon-based system
-- Date: 2026-03-10

-- =====================================================
-- 1. Add missing coupon_code_id column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'coupon_code_id'
    ) THEN
        -- Add column without NOT NULL first
        ALTER TABLE hype_store_orders
        ADD COLUMN coupon_code_id INTEGER;

        -- Add foreign key reference
        ALTER TABLE hype_store_orders
        ADD CONSTRAINT fk_hype_store_orders_coupon_code
        FOREIGN KEY (coupon_code_id) REFERENCES hype_store_coupon_codes(id) ON DELETE RESTRICT;

        -- Add index
        CREATE INDEX idx_hype_store_orders_coupon_code ON hype_store_orders(coupon_code_id);

        RAISE NOTICE '✅ Added coupon_code_id column to hype_store_orders';
    ELSE
        RAISE NOTICE 'ℹ️  coupon_code_id already exists in hype_store_orders';
    END IF;
END $$;

-- =====================================================
-- 2. Add customer info columns
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN customer_email VARCHAR(255);
        RAISE NOTICE '✅ Added customer_email column';
    ELSE
        RAISE NOTICE 'ℹ️  customer_email already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN customer_phone VARCHAR(50);
        RAISE NOTICE '✅ Added customer_phone column';
    ELSE
        RAISE NOTICE 'ℹ️  customer_phone already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN customer_name VARCHAR(255);
        RAISE NOTICE '✅ Added customer_name column';
    ELSE
        RAISE NOTICE 'ℹ️  customer_name already exists';
    END IF;
END $$;

-- =====================================================
-- 3. Add order_status column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'order_status'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN order_status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (order_status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned'));

        RAISE NOTICE '✅ Added order_status column to hype_store_orders';
    ELSE
        RAISE NOTICE 'ℹ️  order_status already exists';
    END IF;
END $$;

-- =====================================================
-- 4. Update cashback_status to match new enum values
-- =====================================================
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE hype_store_orders DROP CONSTRAINT IF EXISTS hype_store_orders_cashback_status_check;

    -- Add new constraint
    ALTER TABLE hype_store_orders
    ADD CONSTRAINT hype_store_orders_cashback_status_check
    CHECK (cashback_status IN ('pending', 'processing', 'credited', 'failed', 'cancelled'));

    -- Update old values to new ones
    UPDATE hype_store_orders SET cashback_status = 'pending' WHERE UPPER(cashback_status) = 'PENDING';
    UPDATE hype_store_orders SET cashback_status = 'processing' WHERE UPPER(cashback_status) = 'PROCESSING';
    UPDATE hype_store_orders SET cashback_status = 'credited' WHERE UPPER(cashback_status) = 'SUCCESS' OR UPPER(cashback_status) = 'CREDITED';
    UPDATE hype_store_orders SET cashback_status = 'failed' WHERE UPPER(cashback_status) = 'FAILED';

    RAISE NOTICE '✅ Updated cashback_status enum values';
END $$;

-- =====================================================
-- 5. Add order_currency column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'order_currency'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN order_currency VARCHAR(10) DEFAULT 'INR' NOT NULL;

        RAISE NOTICE '✅ Added order_currency column';
    ELSE
        RAISE NOTICE 'ℹ️  order_currency already exists';
    END IF;
END $$;

-- =====================================================
-- 6. Add cashback_tier_id column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'cashback_tier_id'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN cashback_tier_id INTEGER;

        -- Add foreign key if hype_store_cashback_tiers table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hype_store_cashback_tiers') THEN
            ALTER TABLE hype_store_orders
            ADD CONSTRAINT fk_hype_store_orders_cashback_tier
            FOREIGN KEY (cashback_tier_id) REFERENCES hype_store_cashback_tiers(id) ON DELETE SET NULL;
        END IF;

        RAISE NOTICE '✅ Added cashback_tier_id column';
    ELSE
        RAISE NOTICE 'ℹ️  cashback_tier_id already exists';
    END IF;
END $$;

-- =====================================================
-- 7. Add wallet_transaction_id column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'wallet_transaction_id'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN wallet_transaction_id INTEGER;

        -- Add foreign key if wallet_transactions table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
            ALTER TABLE hype_store_orders
            ADD CONSTRAINT fk_hype_store_orders_wallet_txn
            FOREIGN KEY (wallet_transaction_id) REFERENCES wallet_transactions(id) ON DELETE SET NULL;
        END IF;

        RAISE NOTICE '✅ Added wallet_transaction_id column';
    ELSE
        RAISE NOTICE 'ℹ️  wallet_transaction_id already exists';
    END IF;
END $$;

-- =====================================================
-- 8. Add Instagram proof columns
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'instagram_proof_url'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN instagram_proof_url VARCHAR(500);
        RAISE NOTICE '✅ Added instagram_proof_url column';
    ELSE
        RAISE NOTICE 'ℹ️  instagram_proof_url already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'proof_content_type'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN proof_content_type VARCHAR(50);
        RAISE NOTICE '✅ Added proof_content_type column';
    ELSE
        RAISE NOTICE 'ℹ️  proof_content_type already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'proof_submitted_at'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN proof_submitted_at TIMESTAMP;
        RAISE NOTICE '✅ Added proof_submitted_at column';
    ELSE
        RAISE NOTICE 'ℹ️  proof_submitted_at already exists';
    END IF;
END $$;

-- =====================================================
-- 9. Add cashback tracking columns
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'cashback_credited_at'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN cashback_credited_at TIMESTAMP;
        RAISE NOTICE '✅ Added cashback_credited_at column';
    ELSE
        RAISE NOTICE 'ℹ️  cashback_credited_at already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'minimum_cashback_claimed'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN minimum_cashback_claimed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Added minimum_cashback_claimed column';
    ELSE
        RAISE NOTICE 'ℹ️  minimum_cashback_claimed already exists';
    END IF;
END $$;

-- =====================================================
-- 10. Add return period tracking columns
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'return_period_days'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN return_period_days INTEGER NOT NULL DEFAULT 30;
        RAISE NOTICE '✅ Added return_period_days column';
    ELSE
        RAISE NOTICE 'ℹ️  return_period_days already exists';
    END IF;

    -- Note: return_period_end_date will be renamed to return_period_ends_at in step 14
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'return_period_end_date'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'return_period_ends_at'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN return_period_end_date TIMESTAMP;

        -- Calculate return_period_end_date for existing orders
        UPDATE hype_store_orders
        SET return_period_end_date = order_date + INTERVAL '30 days'
        WHERE return_period_end_date IS NULL;

        RAISE NOTICE '✅ Added return_period_end_date column';
    ELSE
        RAISE NOTICE 'ℹ️  return_period_end_date or return_period_ends_at already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'visible_to_influencer'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN visible_to_influencer BOOLEAN NOT NULL DEFAULT FALSE;

        -- Mark orders as visible if return period has passed
        UPDATE hype_store_orders
        SET visible_to_influencer = TRUE
        WHERE order_date + (return_period_days || ' days')::INTERVAL < NOW();

        RAISE NOTICE '✅ Added visible_to_influencer column';
    ELSE
        RAISE NOTICE 'ℹ️  visible_to_influencer already exists';
    END IF;
END $$;

-- =====================================================
-- 11. Add metadata column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN metadata JSONB;

        RAISE NOTICE '✅ Added metadata column';
    ELSE
        RAISE NOTICE 'ℹ️  metadata already exists';
    END IF;
END $$;

-- =====================================================
-- 11b. Add notes column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'notes'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN notes TEXT;

        RAISE NOTICE '✅ Added notes column';
    ELSE
        RAISE NOTICE 'ℹ️  notes already exists';
    END IF;
END $$;

-- =====================================================
-- 12. Add webhook tracking columns
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'webhook_received_at'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN webhook_received_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE '✅ Added webhook_received_at column';
    ELSE
        RAISE NOTICE 'ℹ️  webhook_received_at already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'webhook_signature'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN webhook_signature VARCHAR(500);
        RAISE NOTICE '✅ Added webhook_signature column';
    ELSE
        RAISE NOTICE 'ℹ️  webhook_signature already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'webhook_ip_address'
    ) THEN
        ALTER TABLE hype_store_orders ADD COLUMN webhook_ip_address VARCHAR(255);
        RAISE NOTICE '✅ Added webhook_ip_address column';
    ELSE
        RAISE NOTICE 'ℹ️  webhook_ip_address already exists';
    END IF;
END $$;

-- =====================================================
-- 13. Add processed_by column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'processed_by'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN processed_by INTEGER;

        RAISE NOTICE '✅ Added processed_by column';
    ELSE
        RAISE NOTICE 'ℹ️  processed_by already exists';
    END IF;
END $$;

-- =====================================================
-- 14. Fix return period column name (returnPeriodEndsAt vs return_period_end_date)
-- =====================================================
DO $$
BEGIN
    -- Check if we have old name
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'return_period_end_date'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'return_period_ends_at'
    ) THEN
        ALTER TABLE hype_store_orders
        RENAME COLUMN return_period_end_date TO return_period_ends_at;
        RAISE NOTICE '✅ Renamed return_period_end_date to return_period_ends_at';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'return_period_ends_at'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN return_period_ends_at TIMESTAMP;

        -- Calculate for existing orders
        UPDATE hype_store_orders
        SET return_period_ends_at = order_date + (return_period_days || ' days')::INTERVAL
        WHERE return_period_ends_at IS NULL;

        RAISE NOTICE '✅ Added return_period_ends_at column';
    ELSE
        RAISE NOTICE 'ℹ️  return_period_ends_at already exists';
    END IF;
END $$;

-- =====================================================
-- 15. Add visibility_checked_at column
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hype_store_orders' AND column_name = 'visibility_checked_at'
    ) THEN
        ALTER TABLE hype_store_orders
        ADD COLUMN visibility_checked_at TIMESTAMP;

        RAISE NOTICE '✅ Added visibility_checked_at column';
    ELSE
        RAISE NOTICE 'ℹ️  visibility_checked_at already exists';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'hype_store_orders table updated for coupon-based affiliate system';
END $$;
