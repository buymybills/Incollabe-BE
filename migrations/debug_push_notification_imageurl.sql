-- Debug: Check if imageUrl column exists and has data in push_notifications table

-- 1. Check if the column exists (both possible naming conventions)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'push_notifications'
  AND (column_name = 'imageUrl' OR column_name = 'image_url' OR column_name LIKE '%image%')
ORDER BY ordinal_position;

-- 2. Check recent notifications with imageUrl
SELECT
  id,
  title,
  "imageUrl",  -- Quoted to match the actual column name
  "internalName",
  status,
  created_at
FROM push_notifications
ORDER BY id DESC
LIMIT 10;

-- 3. Count how many notifications have imageUrl set
SELECT
  COUNT(*) as total_notifications,
  COUNT("imageUrl") as with_image_url,
  COUNT(*) - COUNT("imageUrl") as without_image_url
FROM push_notifications;

-- 4. Show a sample notification with ALL fields to see the structure
SELECT *
FROM push_notifications
ORDER BY id DESC
LIMIT 1;
