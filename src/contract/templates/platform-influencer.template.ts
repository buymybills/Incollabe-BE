/**
 * Template: Collabkaroo ↔ Influencer
 * Triggered when: Influencer completes their profile and is verified
 * Version: 1.0
 *
 * NOTE: Requires legal review before production use.
 */

export interface PlatformInfluencerContractData {
  influencerName: string;
  username: string;
  phone: string;
  email: string;
  verificationDate: string; // ISO date string
  cashbackReturnWindowDays: number;
  penaltyAmount: number; // INR
}

export function renderPlatformInfluencerTemplate(data: PlatformInfluencerContractData): string {
  return `COLLABKAROO PLATFORM AGREEMENT — CREATOR / INFLUENCER
Version 1.0 | Template Ref: TPL-PI-1.0

This Creator Platform Agreement ("Agreement") is entered into on ${data.verificationDate} between:

PARTY A — PLATFORM OPERATOR
Depshanta Marketing Solutions Pvt. Ltd.
Operating as: Collabkaroo
Address: Plot A-18, Manjeet Farm, Uttam Nagar, West Delhi, Delhi – 110059
GSTIN: 07AACD5691K1ZB
Email: contact.us@collabkaroo.com
(hereinafter referred to as "Collabkaroo" or "Platform")

PARTY B — CREATOR
Full Name: ${data.influencerName}
Username: @${data.username}
Email: ${data.email}
Phone: ${data.phone}
(hereinafter referred to as "Creator" or "Influencer")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ACCEPTANCE OF TERMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
By signing this Agreement, the Creator acknowledges that they have read, understood, and agree to be
bound by these terms for as long as they maintain an active account on the Collabkaroo platform.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. GENUINE ENGAGEMENT POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2.1 The Creator represents and warrants that all followers, views, likes, and engagement metrics on their
    connected social media accounts are organic and genuine.
2.2 The Creator shall not use any third-party service, bot, or automated tool to artificially inflate
    engagement metrics on any campaign content.
2.3 Collabkaroo reserves the right to audit engagement metrics at any time. Any confirmed artificial
    inflation will result in immediate account suspension and recovery of all cashback amounts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CASHBACK AND RETURN WINDOW RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3.1 Cashback earned through the HypeStore programme is subject to a ${data.cashbackReturnWindowDays}-day
    return window. During this period, cashback will remain in a locked state and cannot be withdrawn.
3.2 If a product is returned within the return window, the corresponding locked cashback will be
    forfeited and the Creator waives any claim to it.
3.3 Cashback unlocks automatically after the return window expires, provided no return has been
    initiated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. CONTENT DELIVERY OBLIGATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.1 Once a Creator accepts a campaign and receives a product (for barter campaigns) or confirms
    participation (for paid campaigns), they are obligated to deliver all content by the agreed deadline.
4.2 Failure to deliver content on time, or delivering content that materially fails to meet the brief,
    may result in:
    (a) Withholding of campaign payment;
    (b) Negative impact on the Creator's platform credibility score;
    (c) Temporary suspension from applying to new campaigns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. PROHIBITED CONDUCT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5.1 The Creator shall not:
    (a) Make false or misleading claims about any brand's products;
    (b) Disclose confidential campaign details to third parties;
    (c) Accept payments or products from brands outside of the Collabkaroo platform to circumvent fees;
    (d) Create content that is defamatory, obscene, or in violation of any applicable law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ACCOUNT SUSPENSION POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6.1 Collabkaroo may temporarily or permanently suspend the Creator's account for violations of this
    Agreement, including:
    — Verified fake engagement;
    — Confirmed breach of a Brand-Influencer Agreement;
    — Fraudulent activity or misrepresentation.
6.2 Upon suspension, the Creator will be notified with reasons. Temporary suspensions last a minimum
    of 30 days. Appeals may be submitted to contact.us@collabkaroo.com.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. PENALTY FOR MATERIAL BREACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7.1 For material breaches as determined by Collabkaroo's review process, a penalty of up to
    INR ${data.penaltyAmount.toLocaleString('en-IN')} may be levied and deducted from the Creator's
    wallet balance. Any deficit may be pursued through legal means.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. CONFIDENTIALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8.1 Campaign briefs, brand communications, and pricing information received through the platform are
    confidential. The Creator shall not disclose such information to any third party.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. DISPUTE RESOLUTION & GOVERNING LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9.1 Any dispute shall first be escalated to Collabkaroo's support team. Unresolved disputes will be
    referred to arbitration under the Arbitration and Conciliation Act, 1996, seated at New Delhi.
9.2 This Agreement is governed by the laws of the Republic of India.

[SIGNATURE BLOCK WILL BE APPENDED BY THE SYSTEM]`;
}
