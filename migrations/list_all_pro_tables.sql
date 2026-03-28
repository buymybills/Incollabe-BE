-- List all tables related to Pro subscriptions
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%pro%'
    OR table_name LIKE '%subscription%'
    OR table_name LIKE '%invoice%'
    OR table_name LIKE '%payment%'
  )
ORDER BY table_name;

-- Also check columns in pro_subscriptions table
\echo ''
\echo 'Columns in pro_subscriptions table:'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pro_subscriptions'
ORDER BY ordinal_position;

-- Check if there are any webhook or transaction related tables
\echo ''
\echo 'Webhook/Transaction tables:'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%webhook%'
    OR table_name LIKE '%transaction%'
    OR table_name LIKE '%log%'
    OR table_name LIKE '%event%'
  )
ORDER BY table_name;
