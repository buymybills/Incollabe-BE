-- =====================================================
-- CORRECTED REFERRAL CREDITS DEBUG QUERY
-- =====================================================
-- Column names use camelCase with quotes
-- =====================================================

-- 1. Main diagnostic query - Shows all referrals and their credit status
SELECT
    ru.id as usage_id,
    ru."influencerId" as referrer_id,
    ru."referredUserId",
    ru."creditAwarded",
    ru."creditAwardedAt",
    ru."createdAt" as referral_used_at,

    -- Referred user details
    ri.name as referred_user_name,
    ri."isVerified" as referred_user_verified,
    ri."verifiedAt" as referred_user_verified_at,

    -- Credit transaction details
    ct.id as credit_transaction_id,
    ct.amount as credit_amount,
    ct."paymentStatus",
    ct."createdAt" as credit_created_at,

    -- Status check
    CASE
        WHEN ct.id IS NOT NULL THEN '✅ Credit Awarded'
        WHEN ru."creditAwarded" = true THEN '⚠️ Marked as Awarded (but no transaction found!)'
        WHEN ri."isVerified" = false THEN '⏳ Pending Verification'
        ELSE '❌ Issue: Verified but No Credit'
    END as status

FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE ru."influencerId" = 7  -- Replace with actual referrer ID
ORDER BY ru."createdAt" DESC;

-- =====================================================
-- 2. Quick Summary
-- =====================================================
SELECT
    COUNT(*) as total_referrals,
    COUNT(CASE WHEN ct.id IS NOT NULL THEN 1 END) as credits_awarded,
    COUNT(CASE WHEN ri."isVerified" = false THEN 1 END) as pending_verification,
    COUNT(CASE WHEN ri."isVerified" = true AND ct.id IS NULL THEN 1 END) as missing_credits_bug,
    COALESCE(SUM(ct.amount), 0) as total_credits_amount
FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE ru."influencerId" = 7;

-- =====================================================
-- 3. Find MISSING credits (Verified but no credit transaction)
-- =====================================================
SELECT
    ru.id as usage_id,
    ru."referredUserId",
    ri.name as referred_user_name,
    ri."isVerified",
    ri."verifiedAt",
    ru."creditAwarded",
    '🐛 MISSING CREDIT - Need to fix!' as issue
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE
    ru."influencerId" = 7
    AND ri."isVerified" = true  -- User IS verified
    AND ct.id IS NULL           -- But NO credit transaction
ORDER BY ru."createdAt" DESC;

-- =====================================================
-- 4. Monthly Breakdown
-- =====================================================
SELECT
    TO_CHAR(ru."createdAt", 'YYYY-MM') as month,
    COUNT(DISTINCT ru.id) as total_referrals,
    COUNT(DISTINCT CASE WHEN ri."isVerified" = true THEN ru.id END) as verified,
    COUNT(DISTINCT CASE WHEN ct.id IS NOT NULL THEN ru.id END) as credits_given,
    COALESCE(SUM(ct.amount), 0) as total_amount
FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE ru."influencerId" = 7
GROUP BY TO_CHAR(ru."createdAt", 'YYYY-MM')
ORDER BY month DESC;

-- =====================================================
-- 5. FIX MISSING CREDITS (Run only if query #3 shows results)
-- =====================================================
-- ⚠️ IMPORTANT: Review query #3 results first before running this!

-- Step 1: Preview what will be fixed
SELECT
    ru."influencerId",
    ru."referredUserId",
    ri.name as referred_user_name,
    ri."verifiedAt",
    100 as amount_to_award,
    'WILL CREATE CREDIT' as action
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE
    ru."influencerId" = 7
    AND ri."isVerified" = true
    AND ct.id IS NULL
    AND ru."creditAwarded" = false;

-- Step 2: Uncomment to actually fix
/*
-- Create missing credit transactions
INSERT INTO credit_transactions (
    "influencerId",
    "referredUserId",
    "transactionType",
    amount,
    "paymentStatus",
    description,
    "createdAt",
    "updatedAt"
)
SELECT
    ru."influencerId",
    ru."referredUserId",
    'referral_bonus',
    100,
    'pending',
    CONCAT('Retroactive referral bonus for user ID ', ru."referredUserId"),
    NOW(),
    NOW()
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE
    ru."influencerId" = 7
    AND ri."isVerified" = true
    AND ct.id IS NULL
    AND ru."creditAwarded" = false;

-- Update referral usage records to mark as awarded
UPDATE influencer_referral_usages ru
SET
    "creditAwarded" = true,
    "creditAwardedAt" = NOW(),
    "updatedAt" = NOW()
FROM influencers ri
WHERE
    ru."referredUserId" = ri.id
    AND ru."influencerId" = 7
    AND ri."isVerified" = true
    AND ru."creditAwarded" = false;

-- Update influencer's total referral credits
UPDATE influencers
SET "referralCredits" = "referralCredits" + (
    SELECT COUNT(*) * 100
    FROM influencer_referral_usages ru
    INNER JOIN influencers ri ON ru."referredUserId" = ri.id
    LEFT JOIN credit_transactions ct ON
        ct."influencerId" = ru."influencerId"
        AND ct."referredUserId" = ru."referredUserId"
    WHERE
        ru."influencerId" = 7
        AND ri."isVerified" = true
        AND ct.id IS NULL
)
WHERE id = 7;
*/

-- =====================================================
-- 6. Verification - Run this after fix to confirm
-- =====================================================
/*
SELECT
    'After Fix Results' as status,
    COUNT(*) as total_referrals,
    COUNT(CASE WHEN ct.id IS NOT NULL THEN 1 END) as credits_awarded,
    COUNT(CASE WHEN ri."isVerified" = false THEN 1 END) as pending_verification,
    COUNT(CASE WHEN ri."isVerified" = true AND ct.id IS NULL THEN 1 END) as should_be_zero
FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru."referredUserId" = ri.id
LEFT JOIN credit_transactions ct ON
    ct."influencerId" = ru."influencerId"
    AND ct."referredUserId" = ru."referredUserId"
WHERE ru."influencerId" = 7;
*/
