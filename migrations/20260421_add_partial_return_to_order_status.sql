-- Add 'partial_return' to the order_status CHECK constraint on hype_store_orders
-- Root cause: the TypeScript enum OrderStatus.PARTIAL_RETURN = 'partial_return' was added
-- but the DB CHECK constraint was never updated, causing a constraint violation (and
-- subsequent "current transaction is aborted" / 25P02 errors) on every partial return webhook.

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    -- Find any check constraint on hype_store_orders that references order_status
    SELECT conname INTO v_constraint_name
    FROM pg_constraint
    JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
    WHERE pg_class.relname = 'hype_store_orders'
      AND pg_constraint.contype = 'c'
      AND pg_get_constraintdef(pg_constraint.oid) LIKE '%order_status%'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE hype_store_orders DROP CONSTRAINT ' || quote_ident(v_constraint_name);
        RAISE NOTICE '✅ Dropped old order_status check constraint: %', v_constraint_name;
    ELSE
        RAISE NOTICE 'ℹ️  No existing order_status check constraint found';
    END IF;

    -- Add the updated constraint including 'partial_return'
    ALTER TABLE hype_store_orders
    ADD CONSTRAINT hype_store_orders_order_status_check
    CHECK (order_status IN (
        'pending',
        'confirmed',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
        'returned',
        'partial_return'
    ));

    RAISE NOTICE '✅ Added updated order_status check constraint with partial_return';
END $$;
