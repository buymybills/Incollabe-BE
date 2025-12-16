# 🐛 Referral Showing ₹0 Credit Issue

## 📋 Problem

Referral history shows:
- **4 referrals used** (referral code used 4 times)
- **3 showing ₹100** credit
- **1 showing ₹0** credit

## 🔍 Root Cause

The issue is in how credits are tracked:

### Two Separate Events:

1. **Referral Usage Record** (Created immediately)
   - When: User signs up with referral code
   - Table: `influencer_referral_usages`
   - Status: Always created

2. **Credit Transaction** (Created only after verification)
   - When: Admin verifies the referred user's profile
   - Table: `credit_transactions`
   - Status: Only created if verified

### The Gap:

```
User signs up with referral code
        ↓
✅ influencer_referral_usages.create()  (COUNT = 4)
        ↓
⏳ Waiting for profile verification...
        ↓
Admin verifies profile
        ↓
✅ credit_transactions.create()  (COUNT = 3 only!)
        ↓
One user NOT verified yet = ₹0 shown
```

---

## 💡 Why This Happens

### Code Analysis:

**File:** `src/admin/profile-review.service.ts` (lines 385-416)

```typescript
// Step 1: Check if referral usage exists with credit not awarded
const referralUsage = await this.influencerReferralUsageModel.findOne({
  where: {
    referredUserId: influencer.id,
    creditAwarded: false,  // ⬅️ Not awarded yet
  },
});

if (referralUsage) {
  // Step 2: Create credit transaction ONLY when profile is verified
  await this.creditTransactionModel.create({
    influencerId: referrer.id,
    transactionType: CreditTransactionType.REFERRAL_BONUS,
    amount: 100,
    paymentStatus: PaymentStatus.PENDING,
    description: `Referral bonus for referring user ID ${influencer.id}`,
    referredUserId: influencer.id,
  });
}
```

**File:** `src/influencer/influencer.service.ts` (lines 2203-2218)

```typescript
// When fetching referral history:
const referralHistory = referralUsages.map((usage: any) => {
  const transaction = txMap.get(usage.referredUserId);

  return {
    rewardEarned: transaction?.amount || 0,  // ⬅️ Shows 0 if no transaction!
    rewardStatus: transaction?.paymentStatus || 'pending',
  };
});
```

---

## 🎯 Scenarios Causing ₹0 Credit

### Scenario 1: Not Verified Yet ⏳
```
User signs up → Referral usage created ✅
                     ↓
            Profile pending verification ⏳
                     ↓
            No credit transaction yet ❌
                     ↓
            Shows ₹0 in referral history
```

### Scenario 2: Verification Failed/Rejected ❌
```
User signs up → Referral usage created ✅
                     ↓
            Profile rejected by admin ❌
                     ↓
            No credit awarded (intentional)
                     ↓
            Shows ₹0 in referral history
```

### Scenario 3: System Error During Verification 💥
```
User signs up → Referral usage created ✅
                     ↓
            Profile verified ✅
                     ↓
            Credit transaction creation FAILED 💥
                     ↓
            Shows ₹0 (BUG!)
```

---

## 🔧 How to Debug

### Step 1: Run Diagnostic Query

```bash
# Replace :referrerId with actual referrer ID (e.g., 15)
mysql -u postgres -p incollab_db < DEBUG_REFERRAL_CREDITS.sql
```

Or in your database client:

```sql
SELECT
    ru.id as usage_id,
    ru.referred_user_id,
    ri.name as referred_user_name,
    ri.is_verified,
    ri.verified_at,
    ru.credit_awarded,
    ct.amount as credit_amount,
    CASE
        WHEN ct.id IS NOT NULL THEN '✅ Credit Awarded'
        WHEN ri.is_verified = false THEN '⏳ Pending Verification'
        ELSE '❌ Issue: Verified but No Credit'
    END as status
FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE ru.influencer_id = 15  -- Your referrer ID
ORDER BY ru.created_at DESC;
```

### Step 2: Check the Results

Expected output showing the issue:

| usage_id | referred_user_name | is_verified | credit_awarded | credit_amount | status |
|----------|-------------------|-------------|----------------|---------------|--------|
| 45 | Yashuuu | true | true | 100 | ✅ Credit Awarded |
| 44 | Santa | true | true | 100 | ✅ Credit Awarded |
| 43 | Berlin | true | true | 100 | ✅ Credit Awarded |
| 42 | testing referral | **false** | false | NULL | ⏳ **Pending Verification** |

---

## ✅ Solutions

### Solution 1: Wait for Verification (If user not verified)

If the ₹0 referral is because the user isn't verified yet:
- **Wait** for admin to verify the profile
- Credit will be automatically awarded during verification
- **No action needed**

### Solution 2: Manually Award Missing Credits (If verified but no credit)

If user IS verified but credit wasn't awarded due to a bug:

```sql
-- 1. Check which ones need fixing
SELECT
    ru.influencer_id,
    ru.referred_user_id,
    ri.name as referred_user_name
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE
    ru.influencer_id = 15  -- Your referrer ID
    AND ri.is_verified = true
    AND ct.id IS NULL;

-- 2. If results show missing credits, run this fix:
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
    CONCAT('Retroactive referral bonus for user ID ', ru.referred_user_id),
    NOW(),
    NOW()
FROM influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE
    ru.influencer_id = 15
    AND ri.is_verified = true
    AND ct.id IS NULL;

-- 3. Update referral usage records
UPDATE influencer_referral_usages ru
INNER JOIN influencers ri ON ru.referred_user_id = ri.id
SET
    ru.credit_awarded = true,
    ru.credit_awarded_at = NOW()
WHERE
    ru.influencer_id = 15
    AND ri.is_verified = true
    AND ru.credit_awarded = false;
```

---

## 🛡️ Prevent Future Issues

### Fix 1: Add Better Status Display in UI

Update the frontend to show status instead of just ₹0:

```typescript
// Instead of just showing amount:
rewardEarned: transaction?.amount || 0

// Show status:
{
  rewardEarned: transaction?.amount || 0,
  status: !transaction
    ? (isVerified ? 'processing' : 'pending_verification')
    : transaction.paymentStatus
}
```

**UI Display:**
- ✅ ₹100 - Earned
- ⏳ Pending Verification
- 🔄 Processing
- ❌ Rejected

### Fix 2: Add Error Handling in Verification Flow

In `profile-review.service.ts`, wrap credit creation in try-catch:

```typescript
try {
  await this.creditTransactionModel.create({...});
  console.log('✅ Credit awarded successfully');
} catch (error) {
  console.error('❌ Failed to create credit transaction:', error);
  // Send alert to admin or retry
}
```

### Fix 3: Add Reconciliation Cron Job

Create a daily job to check for missing credits:

```typescript
@Cron('0 3 * * *')  // Daily at 3 AM
async reconcileReferralCredits() {
  // Find verified users with referral usage but no credit transaction
  // Automatically create missing credit transactions
}
```

---

## 📊 Quick Check Command

Run this one-liner to see the issue:

```sql
SELECT
    COUNT(CASE WHEN ct.id IS NOT NULL THEN 1 END) as credits_awarded,
    COUNT(CASE WHEN ri.is_verified = false THEN 1 END) as pending_verification,
    COUNT(CASE WHEN ri.is_verified = true AND ct.id IS NULL THEN 1 END) as missing_credits,
    COUNT(*) as total_referrals
FROM influencer_referral_usages ru
LEFT JOIN influencers ri ON ru.referred_user_id = ri.id
LEFT JOIN credit_transactions ct ON
    ct.influencer_id = ru.influencer_id
    AND ct.referred_user_id = ru.referred_user_id
WHERE ru.influencer_id = 15;
```

**Expected Result:**
```
credits_awarded: 3
pending_verification: 1  ← This is why you see ₹0
missing_credits: 0
total_referrals: 4
```

---

## 🎯 Summary

**The ₹0 showing in referral history is NORMAL if:**
- User signed up but profile not verified yet

**The ₹0 is a BUG if:**
- User is verified but no credit transaction exists

**Fix:**
1. Run `DEBUG_REFERRAL_CREDITS.sql` to identify the issue
2. If pending verification → wait
3. If verified but no credit → run the manual fix SQL
4. Implement better status display in UI

---

Need help running the queries? Let me know! 🚀
