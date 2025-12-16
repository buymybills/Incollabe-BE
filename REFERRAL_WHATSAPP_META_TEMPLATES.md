# Meta WhatsApp Templates for Referral System

These are the two WhatsApp templates you need to create in Meta Business Suite for the referral system.

---

## Template 1: Referral Joined & Verified

**Template Name in Meta:** `referral_joined_verified`  
**Category:** Marketing  
**Language:** English (en)  

### Template Body Text
```
Hi {{1}},

Congratulations! Someone signed up using your referral code and has completed verification.

You've earned ₹{{2}} through the referral programme. Your total referral credits are now ₹{{3}}.

{{4}}

Best regards,
Incollabe Team
```

**Note:** {{4}} will ALWAYS contain a complete sentence (not optional). Pass one of these two strings based on UPI status:
- With UPI: `"The credited amount will be transferred to your registered UPI ID within 24 to 48 working hours."`
- Without UPI: `"Please update your UPI ID in your profile to receive the amount. It will be transferred within 24 to 48 working hours."`

### Parameters
- **{{1}}** - Referrer name (string, e.g., "Priya")
- **{{2}}** - Amount earned this time (string, always "100")
- **{{3}}** - Total referral credits (string, e.g., "500")
- **{{4}}** - UPI status message (string - ALWAYS a complete sentence, never empty)
  - Pass: `"The credited amount will be transferred to your registered UPI ID within 24 to 48 working hours."` if UPI exists
  - Pass: `"Please update your UPI ID in your profile to receive the amount. It will be transferred within 24 to 48 working hours."` if no UPI

---

## Template 2: Early Selection Bonus

**Template Name in Meta:** `early_selection_bonus`  
**Category:** Marketing  
**Language:** English (en)  

### Template Body Text
```
Hi {{1}},

Congratulations! You've been selected for {{2}} campaign just within 36 hours of joining!

You've earned an early selection bonus of {{3}}. This reward recognizes your quick start on the platform.

Check your account to view the campaign details.

Best regards,
Incollabe Team
```

### Parameters
- **{{1}}** - Influencer name
- **{{2}}** - Campaign name
- **{{3}}** - Bonus amount (always "₹100")

### How it's used in code
```typescript
await whatsAppService.sendTemplateMessage(
  influencerWhatsappNumber,
  'early_selection_bonus',
  [influencerName, campaignName, '₹100']
);
```

---

## Steps to Create Templates in Meta Business Suite

### Step 1: Access Meta Business Suite
1. Go to https://business.facebook.com/
2. Select your Incollabe Business Account
3. Navigate to **Apps** → **WhatsApp** → **Configuration** → **Message Templates**

### Step 2: Create Template 1 - referral_joined_verified
1. Click **Create Template**
2. Fill in:
   - **Template Name:** `referral_joined_verified`
   - **Category:** Select `Marketing`
   - **Language:** Select `English (en)`
3. Click **Next**
4. In the **Body** section, copy-paste:
```
Hi {{1}},

Congratulations! Someone signed up using your referral code and has completed verification.

You've earned ₹{{2}} through the referral programme. Your total referral credits are now ₹{{3}}.

{{4}}

Best regards,
Incollabe Team
```
5. Click **Submit for Review**

### Step 3: Create Template 2 - early_selection_bonus
1. Click **Create Template**
2. Fill in:
   - **Template Name:** `early_selection_bonus`
   - **Category:** Select `Marketing`
   - **Language:** Select `English (en)`
3. Click **Next**
4. In the **Body** section, copy-paste:
```
Hi {{1}},

Congratulations! You've been selected for {{2}} campaign just within 36 hours of joining!

You've earned an early selection bonus of {{3}}. This reward recognizes your quick start on the platform.

Check your account to view the campaign details.

Best regards,
Incollabe Team
```
5. Click **Submit for Review**

---

## Approval Timeline

- **Status:** Templates will appear as `PENDING_REVIEW` after submission
- **Wait Time:** Typically 24-48 hours for Meta's review
- **Status Update:** You'll receive email notification when approved
- **Live Usage:** Once status shows `APPROVED`, templates are ready to use

---

## Integration Points in Code

### 1. When a referral is verified (in AuthService/ProfileReviewService)
```typescript
// After referee verification and credit awarded
// IMPORTANT: {{4}} must ALWAYS be a complete sentence (never empty or null)
let upiMessage = '';

if (referrer.upiId) {
  upiMessage = 'The credited amount will be transferred to your registered UPI ID within 24 to 48 working hours.';
} else {
  upiMessage = 'Please update your UPI ID in your profile to receive the amount. It will be transferred within 24 to 48 working hours.';
}

// {{4}} is always populated with one of the above messages (never empty)
await whatsAppService.sendTemplateMessage(
  referrer.whatsappNumber,
  'referral_joined_verified',
  [
    referrer.name,           // {{1}} - e.g., "Priya"
    '100',                   // {{2}} - amount earned in this transaction
    newCredits.toString(),   // {{3}} - total credits (e.g., "500")
    upiMessage               // {{4}} - ALWAYS a complete sentence based on UPI status
  ]
);
```

**Real example from profile-review.service.ts:**
```typescript
const newCredits = currentCredits + 100; // e.g., 400 + 100 = 500
let upiMessage = '';

if (referrer.upiId) {
  upiMessage = 'The credited amount will be transferred to your registered UPI ID within 24 to 48 working hours.';
} else {
  upiMessage = 'Please update your UPI ID in your profile to receive the amount. It will be transferred within 24 to 48 working hours.';
}

if (referrer.whatsappNumber && referrer.isWhatsappVerified) {
  await whatsAppService.sendTemplateMessage(
    referrer.whatsappNumber,
    'referral_joined_verified',
    [referrer.name, '100', newCredits.toString(), upiMessage]  // upiMessage never empty
  );
}
```

### 2. When early selection happens (in CampaignService)
```typescript
// When influencer selected within 36 hours of verification
const hoursElapsed = (Date.now() - verificationTime) / (1000 * 60 * 60);
if (hoursElapsed <= 36) {
  await whatsAppService.sendTemplateMessage(
    influencerWhatsappNumber,
    'early_selection_bonus',
    [influencerName, campaignName, '₹100']
  );
}
```

---

## Notes

✅ All 4 parameters are **always** populated with complete strings  
✅ {{4}} is NEVER empty or optional - always contains a complete sentence  
✅ Meta WhatsApp accepts only string parameters with actual content  
✅ No floating/variable placeholders - all parameters filled at code level  
✅ Uses existing `sendTemplateMessage()` method  
✅ Template names must match exactly: `referral_joined_verified` and `early_selection_bonus`  
✅ Test templates in Meta's sandbox before production use
