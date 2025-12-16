-- =====================================================
-- DEBUG REFERRAL CREDITS ISSUE
-- =====================================================
-- This query helps debug why some referrals show ₹0
-- =====================================================

-- 1. Find referral usages vs credit transactions
-- This shows all referral usages and whether they have credits awarded
SELECT
    ru.id as usage_id,
    ru.influencer_id as referrer_id,
    ru.referred_user_id,
    ru.credit_awarded,
    ru.credit_awarded_at,
    ru.created_at as referral_used_at,

    -- Referred user details
    ri.name as referred_user_name,
    ri.is_verified as referred_user_verified,
    ri.verified_at as referred_user_verified_at,

    -- Credit transaction details
    ct.id as credit_transaction_id,
    ct.amount as credit_amount,
    ct.payment_status,
    ct.created_at as credit_created_at,

    -- Status check
    CASE
        WHEN ct.id IS NOT NULL THEN 'Credit Awarded'
        WHEN ru.credit_awarded = true THEN 'Marked as Awarded (but no transaction found!)'
        WHEN ri.is_verified = false THEN 'Pending Verification'
        ELSE 'Issue: Verified but No Credit'
    END as status

FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE ru.influencer_id = :referrerId  -- Replace with actual referrer ID
ORDER BY ru.created_at DESC;

-- =====================================================
-- 2. Find missing credits (Verified but no credit)
-- =====================================================
SELECT
    ru.id as usage_id,
    ru.influencer_id as referrer_id,
    ru.referred_user_id,
    ri.name as referred_user_name,
    ri.is_verified,
    ri.verified_at,
    ru.credit_awarded,
    'MISSING CREDIT!' as issue
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE
    ru.influencer_id = :referrerId
    AND ri.is_verified = true  -- User is verified
    AND ct.id IS NULL          -- But no credit transaction exists
ORDER BY ru.created_at DESC;

-- =====================================================
-- 3. Summary by referrer
-- =====================================================
SELECT
    ru.influencer_id as referrer_id,
    i.name as referrer_name,

    -- Total referrals
    COUNT(DISTINCT ru.id) as total_referrals,

    -- Verified referrals
    COUNT(DISTINCT CASE WHEN ri.is_verified = true THEN ru.id END) as verified_referrals,

    -- Credits awarded
    COUNT(DISTINCT CASE WHEN ct.id IS NOT NULL THEN ru.id END) as credits_awarded,

    -- Pending verification
    COUNT(DISTINCT CASE WHEN ri.is_verified = false THEN ru.id END) as pending_verification,

    -- Missing credits (verified but no credit)
    COUNT(DISTINCT CASE
        WHEN ri.is_verified = true AND ct.id IS NULL
        THEN ru.id
    END) as missing_credits,

    -- Total credits from transactions
    COALESCE(SUM(ct.amount), 0) as total_credit_amount,

    -- Expected credits (verified * 100)
    COUNT(DISTINCT CASE WHEN ri.is_verified = true THEN ru.id END) * 100 as expected_credits

FROM influencer_referral_usages ru
INNER JOIN influencers i ON ru.influencer_id = i.id
LEFT JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE ru.influencer_id = :referrerId
GROUP BY ru.influencer_id, i.name;

-- =====================================================
-- 4. Monthly breakdown
-- =====================================================
SELECT
    DATE_FORMAT(ru.created_at, '%Y-%m') as month,
    COUNT(DISTINCT ru.id) as total_referrals,
    COUNT(DISTINCT CASE WHEN ri.is_verified = true THEN ru.id END) as verified,
    COUNT(DISTINCT CASE WHEN ct.id IS NOT NULL THEN ru.id END) as credits_given,
    COALESCE(SUM(ct.amount), 0) as total_amount
FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE ru.influencer_id = :referrerId
GROUP BY DATE_FORMAT(ru.created_at, '%Y-%m')
ORDER BY month DESC;

-- =====================================================
-- 5. Fix missing credits (if verified but no credit)
-- =====================================================
-- IMPORTANT: Only run this after reviewing the results above!
-- This will create missing credit transactions for verified users

-- First, check what would be fixed:
SELECT
    ru.influencer_id,
    ru.referred_user_id,
    ri.name as referred_user_name,
    ri.verified_at,
    100 as amount_to_award,
    'WILL BE FIXED' as action
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE
    ru.influencer_id = :referrerId
    AND ri.is_verified = true
    AND ct.id IS NULL
    AND ru.credit_awarded = false;

-- Uncomment to actually fix (BE CAREFUL!):
/*
INSERT INTO credit_transactions (
    influencer_id,
    referred_user_id,
    transaction_type,
    amount,
    payment_status,
    description,
    created_at,
    updated_at
)
SELECT
    ru.influencer_id,
    ru.referred_user_id,
    'referral_bonus',
    100,
    'pending',
    CONCAT('Retroactive referral bonus for referring user ID ', ru.referred_user_id),
    NOW(),
    NOW()
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE
    ru.influencer_id = :referrerId
    AND ri.is_verified = true
    AND ct.id IS NULL
    AND ru.credit_awarded = false;

-- Update the referral usage records
UPDATE influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
SET
    ru.credit_awarded = true,
    ru.credit_awarded_at = NOW()
WHERE
    ru.influencer_id = :referrerId
    AND ri.is_verified = true
    AND ru.credit_awarded = false;
*/

-- =====================================================
-- COMMON CAUSES OF ₹0 REFERRALS:
-- =====================================================
-- 1. User used referral code but not verified yet
-- 2. Credit transaction creation failed during verification
-- 3. Duplicate referral prevention (already used another code)
-- 4. System error during profile verification
-- =====================================================
