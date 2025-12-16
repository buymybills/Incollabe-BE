# WhatsApp Referral Templates for Meta

This document describes the two new WhatsApp templates needed for the referral system.

## Template 1: Referral Joined & Verified
**Template Name (in Meta):** `referral_joined_verified`  
**Language:** English (en)  
**Category:** Marketing

### Purpose
Sent to the referrer (original influencer) when someone joins and verifies through their referral code.

### Template Body
```
Hi {{1}},

Great news! Someone signed up using your referral code and has completed verification. 

You've earned {{2}} referral credits! Keep inviting friends to earn more rewards.

Best regards,
Incollabe Team
```

### Parameters
- `{{1}}` - Referrer name
- `{{2}}` - Referral credit amount (e.g., "₹100")

### Example Usage
```typescript
await whatsAppService.sendReferralJoinedAndVerified(
  referrerPhoneNumber,
  "Priya",
  "₹100"
);
```

---

## Template 2: Early Selection Bonus
**Template Name (in Meta):** `early_selection_bonus`  
**Language:** English (en)  
**Category:** Marketing

### Purpose
Sent to someone who joined through a referral code when they get selected for a campaign within the first 36 hours of profile verification (early selection bonus).

### Template Body
```
Hi {{1}},

Congratulations! You've been selected for "{{2}}" campaign just 36 hours after verification!

You've earned an early selection bonus of {{3}}. This reward recognizes your quick start on the platform.

Check your account to view the campaign details.

Best regards,
Incollabe Team
```

### Parameters
- `{{1}}` - Influencer name (who got selected)
- `{{2}}` - Campaign name
- `{{3}}` - Bonus amount (e.g., "₹100")

### Example Usage
```typescript
await whatsAppService.sendEarlySelectionBonus(
  influencerPhoneNumber,
  "Aditya",
  "Tech Product Review Campaign",
  "₹100"
);
```

---

## Meta WhatsApp Business Account Setup

### How to Create These Templates

1. **Go to Meta Business Suite**
   - Navigate to: https://business.facebook.com/
   - Select your Incollabe Business Account

2. **Access WhatsApp Templates**
   - Go to Apps → WhatsApp → Configuration → Message Templates

3. **Create Template 1: referral_joined_verified**
   - Click "Create Template"
   - **Template Name:** `referral_joined_verified`
   - **Category:** Marketing
   - **Language:** English (en)
   - **Header:** (Optional) Add "Referral Reward" or leave empty
   - **Body:** Use the template body from above with {{1}} and {{2}} parameters
   - **Footer:** (Optional) Leave empty
   - **Buttons:** (Optional) Add CTA button linking to referral dashboard

4. **Create Template 2: early_selection_bonus**
   - Click "Create Template"
   - **Template Name:** `early_selection_bonus`
   - **Category:** Marketing
   - **Language:** English (en)
   - **Header:** (Optional) Add "Campaign Selection Bonus" or leave empty
   - **Body:** Use the template body from above with {{1}}, {{2}}, and {{3}} parameters
   - **Footer:** (Optional) Leave empty
   - **Buttons:** (Optional) Add CTA button linking to campaign details

5. **Wait for Approval**
   - Meta will review the templates within 24-48 hours
   - Status will show as "APPROVED" once ready
   - You can check status in the Message Templates section

### Integration in Code

These templates are now integrated and ready to use:

```typescript
// In auth.service.ts - when referral verification is processed
await whatsAppService.sendReferralJoinedAndVerified(
  referrerWhatsappNumber,
  referrerName,
  "₹100"
);

// In campaign.service.ts - when influencer is selected within 36 hours
if (verificationHoursElapsed <= 36) {
  await whatsAppService.sendEarlySelectionBonus(
    influencerWhatsappNumber,
    influencerName,
    campaignName,
    "₹100"
  );
}
```

---

## Template Status Constants
Add these to `app.constants.ts` TEMPLATE_NAMES:
```typescript
REFERRAL_JOINED_VERIFIED: 'referral_joined_verified',
EARLY_SELECTION_BONUS: 'early_selection_bonus',
```

✅ **Already added to the codebase**

---

## Notes

- All parameters are dynamic and filled at runtime
- Templates follow Meta's messaging guidelines
- Ensure currency symbols and amounts match your business model
- Test templates in Meta's sandbox before going live
- Keep referral credit amounts consistent across all communications
- Adjust text as needed but maintain the parameter placeholders ({{1}}, {{2}}, {{3}})
