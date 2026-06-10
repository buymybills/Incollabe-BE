-- Test the fixed UNION query with ENUM type casting
-- This tests the query that was failing with ENUM type mismatch

-- Test 1: Simple UNION with type casting (should work now)
SELECT "likerType"::text as user_type, "likerInfluencerId" as influencer_id, "likerBrandId" as brand_id
FROM likes
WHERE "postId" = 78
UNION ALL
SELECT "sharerType"::text as user_type, "sharerInfluencerId" as influencer_id, "sharerBrandId" as brand_id
FROM shares
WHERE "postId" = 78;

-- Test 2: Full query with joins (exact query from the API)
SELECT
    COUNT(CASE WHEN f.id IS NOT NULL THEN 1 END) as follower_interactions,
    COUNT(CASE WHEN f.id IS NULL THEN 1 END) as non_follower_interactions
FROM (
    SELECT "likerType"::text as user_type, "likerInfluencerId" as influencer_id, "likerBrandId" as brand_id
    FROM likes
    WHERE "postId" = 78
    UNION ALL
    SELECT "sharerType"::text as user_type, "sharerInfluencerId" as influencer_id, "sharerBrandId" as brand_id
    FROM shares
    WHERE "postId" = 78
) interactions
LEFT JOIN follows f ON (
    (interactions.user_type = 'influencer' AND f."followerType" = 'influencer' AND f."followerInfluencerId" = interactions.influencer_id) OR
    (interactions.user_type = 'brand' AND f."followerType" = 'brand' AND f."followerBrandId" = interactions.brand_id)
) AND (
    (f."followingType" = 'influencer' AND f."followingInfluencerId" = 7) OR  -- Replace with actual post owner ID
    (f."followingType" = 'brand' AND f."followingBrandId" = 1)
);

-- Expected output: Two numbers showing follower vs non-follower interactions
-- Example: follower_interactions | non_follower_interactions
--                              3 |                         2
