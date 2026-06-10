-- Find all Pro subscription related tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%pro%'
ORDER BY table_name;
