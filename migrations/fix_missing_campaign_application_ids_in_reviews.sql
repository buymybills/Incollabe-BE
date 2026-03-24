-- Migration: Fix missing campaign_application_id in campaign_reviews
-- Description: Updates campaign_reviews records that are missing campaign_application_id
-- Date: 2026-03-20

-- Step 1: Check how many reviews are missing campaign_application_id
SELECT
    COUNT(*) as total_missing,
    COUNT(DISTINCT campaign_id) as affected_campaigns
FROM campaign_reviews
WHERE campaign_application_id IS NULL;

-- Step 2: Preview what will be updated
SELECT
    cr.id as review_id,
    cr.campaign_id,
    cr.reviewee_type,
    cr.reviewee_id,
    cr.reviewer_type,
    cr.reviewer_id,
    ca.id as matching_application_id
FROM campaign_reviews cr
LEFT JOIN campaign_applications ca ON (
    ca."campaignId" = cr.campaign_id
    AND (
        -- If reviewee is influencer, find their application
        (cr.reviewee_type = 'influencer' AND ca."influencerId" = cr.reviewee_id)
        OR
        -- If reviewee is brand, find application where reviewer is the influencer
        (cr.reviewee_type = 'brand' AND cr.reviewer_type = 'influencer' AND ca."influencerId" = cr.reviewer_id)
    )
)
WHERE cr.campaign_application_id IS NULL
ORDER BY cr.id;

-- Step 3: Update missing campaign_application_id values
-- For reviews where reviewee is an influencer
UPDATE campaign_reviews cr
SET campaign_application_id = ca.id
FROM campaign_applications ca
WHERE cr.campaign_application_id IS NULL
AND cr.reviewee_type = 'influencer'
AND ca."campaignId" = cr.campaign_id
AND ca."influencerId" = cr.reviewee_id;

-- For reviews where reviewee is a brand (reverse review)
UPDATE campaign_reviews cr
SET campaign_application_id = ca.id
FROM campaign_applications ca
WHERE cr.campaign_application_id IS NULL
AND cr.reviewee_type = 'brand'
AND cr.reviewer_type = 'influencer'
AND ca."campaignId" = cr.campaign_id
AND ca."influencerId" = cr.reviewer_id;

-- Step 4: Verify the fix
SELECT
    COUNT(*) as total_reviews,
    COUNT(campaign_application_id) as reviews_with_application_id,
    COUNT(*) - COUNT(campaign_application_id) as still_missing
FROM campaign_reviews;

-- Step 5: Show reviews that still have missing campaign_application_id (if any)
SELECT
    cr.id,
    cr.campaign_id,
    cr.reviewee_type,
    cr.reviewee_id,
    cr.reviewer_type,
    cr.reviewer_id,
    c.name as campaign_name
FROM campaign_reviews cr
LEFT JOIN campaigns c ON c.id = cr.campaign_id
WHERE cr.campaign_application_id IS NULL;
