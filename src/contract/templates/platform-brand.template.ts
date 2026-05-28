/**
 * Template: Collabkaroo ↔ Brand
 * Triggered when: Admin approves a brand on the platform
 * Version: 1.0
 *
 * NOTE: This template must be reviewed and approved by a qualified lawyer
 * before being used in production. All penalty amounts and legal clauses
 * are placeholders pending legal review.
 */

export interface PlatformBrandContractData {
  brandName: string;
  legalEntityName: string;
  pocName: string;
  pocDesignation: string;
  pocEmail: string;
  pocPhone: string;
  approvalDate: string; // ISO date string
  platformFeePercent: number;
  penaltyAmount: number; // INR
}

export function renderPlatformBrandTemplate(data: PlatformBrandContractData): string {
  return `COLLABKAROO PLATFORM AGREEMENT — BRAND
Version 1.0 | Template Ref: TPL-PB-1.0

This Brand Platform Agreement ("Agreement") is entered into on ${data.approvalDate} between:

PARTY A — PLATFORM OPERATOR
Depshanta Marketing Solutions Pvt. Ltd.
Operating as: Collabkaroo
Address: Plot A-18, Manjeet Farm, Uttam Nagar, West Delhi, Delhi – 110059
GSTIN: 07AACD5691K1ZB
Email: contact.us@collabkaroo.com
(hereinafter referred to as "Collabkaroo" or "Platform")

PARTY B — BRAND
Legal Entity Name: ${data.legalEntityName}
Brand Name: ${data.brandName}
Point of Contact: ${data.pocName} (${data.pocDesignation})
Email: ${data.pocEmail}
Phone: ${data.pocPhone}
(hereinafter referred to as "Brand")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ACCEPTANCE OF TERMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
By signing this Agreement, the Brand unconditionally accepts all terms herein and agrees to conduct all
influencer marketing activities exclusively through the Collabkaroo platform for the duration of any
active campaign.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. PLATFORM FEES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2.1 The Brand agrees to pay a platform service fee of ${data.platformFeePercent}% on the total campaign
    payout amount for each campaign initiated through Collabkaroo.
2.2 All fees are exclusive of applicable GST. GST will be charged separately as per prevailing rates.
2.3 Fees are non-refundable once a campaign has been launched and influencers have been selected.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. WALLET BALANCE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3.1 The Brand must maintain a sufficient wallet balance before launching any campaign.
3.2 Campaign activation will be blocked if the wallet balance is insufficient to cover the full
    projected campaign payout including platform fees.
3.3 Collabkaroo reserves the right to pause an active campaign if the wallet balance falls below the
    required threshold.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. PROHIBITED CONTENT & CONDUCT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.1 The Brand shall not request influencers to create content that:
    (a) is misleading, deceptive, or makes false claims about any product or service;
    (b) promotes tobacco, alcohol, gambling, adult content, or any product banned under Indian law;
    (c) targets minors in an inappropriate manner;
    (d) violates the Advertising Standards Council of India (ASCI) guidelines or any applicable law.
4.2 Any campaign found to violate clause 4.1 will be immediately suspended without refund.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. BRAND OBLIGATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5.1 The Brand agrees to ship barter products to selected influencers within the timeframe specified
    in each campaign's Brand-Influencer Agreement.
5.2 The Brand agrees to release payment to influencers within 7 business days of content approval.
5.3 The Brand shall not approach selected influencers outside of the Collabkaroo platform to avoid
    the platform fee.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. PENALTY FOR BREACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6.1 If the Brand materially breaches this Agreement, including but not limited to:
    — refusing to pay a confirmed influencer without valid cause;
    — bypassing the platform to approach influencers directly;
    — submitting false documents or misrepresenting the brand;
    a penalty of INR ${data.penaltyAmount.toLocaleString('en-IN')} shall be levied, deducted from the
    Brand's wallet, and Collabkaroo reserves the right to permanently suspend the Brand's account.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. INTELLECTUAL PROPERTY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7.1 All content created by influencers under a campaign remains the intellectual property of the
    influencer unless a separate written assignment of rights is executed.
7.2 The Brand is granted a non-exclusive, royalty-free licence to use campaign content for the purpose
    and duration specified in the individual Brand-Influencer Agreement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. DISPUTE RESOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8.1 Any dispute arising from this Agreement shall first be referred to Collabkaroo's internal
    dispute resolution team. If unresolved within 30 days, the matter shall be referred to
    arbitration under the Arbitration and Conciliation Act, 1996.
8.2 The seat and venue of arbitration shall be New Delhi, India.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. GOVERNING LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This Agreement is governed by the laws of the Republic of India.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. ENTIRE AGREEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This Agreement, together with any individual Brand-Influencer Agreements executed on the platform,
constitutes the entire agreement between the parties and supersedes all prior discussions.

[SIGNATURE BLOCK WILL BE APPENDED BY THE SYSTEM]`;
}
