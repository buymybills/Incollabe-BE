-- Quick Verification Script for 30-Day Return Period Migration
-- Run this to check if migration is already applied or needs to be run

-- Step 1: Check if new columns exist
SELECT
    'Checking for new columns...' as step;

SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'hype_store_orders'
AND column_name IN (
    'return_period_days',
    'return_period_ends_at',
    'visible_to_influencer',
    'visibility_checked_at'
)
ORDER BY column_name;

-- Expected: 4 rows if migration is applied, 0 rows if not

-- Step 2: Check if trigger exists
SELECT
    'Checking for trigger...' as step;

SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_set_return_period_ends_at';

-- Expected: 1 row if migration is applied

-- Step 3: Check sample of existing orders (if any)
SELECT
    'Checking existing orders...' as step;

SELECT
    id,
    external_order_id,
    order_date,
    return_period_ends_at,
    visible_to_influencer,
    order_status,
    cashback_status
FROM hype_store_orders
ORDER BY created_at DESC
LIMIT 5;

-- Step 4: Count orders by visibility status
SELECT
    'Order visibility summary...' as step;

SELECT
    visible_to_influencer,
    order_status,
    COUNT(*) as order_count,
    SUM(cashback_amount) as total_cashback
FROM hype_store_orders
GROUP BY visible_to_influencer, order_status
ORDER BY visible_to_influencer, order_status;

-- Step 5: Check orders pending visibility
SELECT
    'Orders pending visibility (waiting for 30 days)...' as step;

SELECT
    COUNT(*) as pending_orders,
    MIN(return_period_ends_at) as next_batch_becomes_visible,
    MAX(return_period_ends_at) as last_batch_becomes_visible
FROM hype_store_orders
WHERE visible_to_influencer = false
AND order_status NOT IN ('returned', 'cancelled', 'refunded')
AND return_period_ends_at IS NOT NULL;

-- Step 6: Check if any orders should already be visible
SELECT
    'Orders that should be visible now (return period ended)...' as step;

SELECT
    id,
    external_order_id,
    order_date,
    return_period_ends_at,
    visible_to_influencer,
    CASE
        WHEN visible_to_influencer = true THEN 'OK - Already visible'
        WHEN visible_to_influencer = false THEN 'ACTION NEEDED - Should be made visible'
    END as status
FROM hype_store_orders
WHERE return_period_ends_at IS NOT NULL
AND return_period_ends_at <= NOW()
AND order_status NOT IN ('returned', 'cancelled', 'refunded')
ORDER BY return_period_ends_at DESC
LIMIT 10;
