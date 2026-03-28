-- Test query to verify column names in post_views table
-- Run this on your production/staging database first

-- Test 1: Check if table exists and see its structure
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'post_views'
ORDER BY ordinal_position;

-- Test 2: Try querying with camelCase (should work)
SELECT
    "postId",
    "viewerType",
    "viewerInfluencerId",
    "viewerBrandId",
    "viewedAt"
FROM post_views
LIMIT 1;

-- Test 3: Count views for a specific post (replace 78 with actual post ID)
SELECT
    COUNT(*) as total_views,
    COUNT(CASE WHEN "viewerType" = 'influencer' THEN 1 END) as influencer_views,
    COUNT(CASE WHEN "viewerType" = 'brand' THEN 1 END) as brand_views
FROM post_views
WHERE "postId" = 78;

-- Test 4: Full query that matches what the API will run
SELECT
    COUNT(CASE WHEN f.id IS NOT NULL THEN 1 END) as follower_views,
    COUNT(CASE WHEN f.id IS NULL THEN 1 END) as non_follower_views
FROM post_views pv
LEFT JOIN follows f ON (
    (pv."viewerType" = 'influencer' AND f."followerType" = 'influencer' AND f."followerInfluencerId" = pv."viewerInfluencerId") OR
    (pv."viewerType" = 'brand' AND f."followerType" = 'brand' AND f."followerBrandId" = pv."viewerBrandId")
) AND (
    (f."followingType" = 'influencer' AND f."followingInfluencerId" = 7) OR  -- Replace 7 with actual influencer ID
    (f."followingType" = 'brand' AND f."followingBrandId" = 1)               -- Replace 1 with actual brand ID
)
WHERE pv."postId" = 78;  -- Replace 78 with actual post ID
