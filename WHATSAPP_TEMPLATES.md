# WhatsApp Message Templates

This document contains all WhatsApp message templates that need to be created in Meta Business Manager.

## Campaign Application Status Templates

### 1. Application Under Review
**Template Name:** `campaign_application_under_review`

**Category:** UTILITY

**Language:** English

**Template Content:**
```
Hi {{1}}! 🔍

Your application for the campaign "{{2}}" by {{3}} is now under review.

We'll notify you once the brand makes a decision.

Good luck! 🤞
```

**Parameters:**
1. `{{1}}` - Influencer Name
2. `{{2}}` - Campaign Name
3. `{{3}}` - Brand Name

---

### 2. Application Selected
**Template Name:** `campaign_application_selected`

**Category:** UTILITY

**Language:** English

**Template Content:**
```
Congratulations {{1}}! 🎉

You've been selected for the campaign "{{2}}" by {{3}}!

Message from brand: {{4}}

The brand will reach out to you soon with next steps.

Great job! 🌟
```

**Parameters:**
1. `{{1}}` - Influencer Name
2. `{{2}}` - Campaign Name
3. `{{3}}` - Brand Name
4. `{{4}}` - Review Notes (optional - defaults to "No additional notes")

---

### 3. Application Rejected
**Template Name:** `campaign_application_rejected`

**Category:** UTILITY

**Language:** English

**Template Content:**
```
Hi {{1}},

Thank you for applying to "{{2}}" by {{3}}.

Unfortunately, your application was not selected this time.

Feedback: {{4}}

Don't worry - keep applying to more campaigns! 💪
```

**Parameters:**
1. `{{1}}` - Influencer Name
2. `{{2}}` - Campaign Name
3. `{{3}}` - Brand Name
4. `{{4}}` - Review Notes/Feedback (optional - defaults to "No specific feedback provided")

---

## How to Create Templates in Meta Business Manager

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**
4. Enter the template name exactly as shown above
5. Select **Category: UTILITY**
6. Select **Language: English**
7. Copy the template content and paste it
8. Add the parameters using the {{number}} format
9. Submit for approval

## Integration Details

- **File:** `src/shared/whatsapp.service.ts`
- **Constants:** `src/shared/constants/app.constants.ts`
- **Usage:** Called from `CampaignService.updateApplicationStatus()`

## Testing

After templates are approved by Meta:
1. Update the template names in `app.constants.ts` if needed
2. Test each status change:
   - Applied → Under Review
   - Applied → Selected
   - Applied → Rejected
3. Verify WhatsApp messages are received correctly

## Notes

- Templates must be approved by Meta before they can be used
- Approval typically takes 24-48 hours
- Emojis are supported in WhatsApp templates
- Parameters cannot be optional in Meta templates (we handle default values in code)
