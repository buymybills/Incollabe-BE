/**
 * Template: Brand ↔ Influencer (per campaign selection)
 * Triggered when: Brand selects an influencer for a campaign
 * Version: 1.0
 *
 * This is the core operational contract. Both parties must sign before
 * any product is shipped or payment is committed.
 * NOTE: Requires legal review before production use.
 */

export interface BrandInfluencerContractData {
  contractNumber: string;
  selectionDate: string;        // ISO date string
  // Brand details
  brandName: string;
  brandLegalName: string;
  brandPocName: string;
  brandPocEmail: string;
  // Influencer details
  influencerName: string;
  influencerUsername: string;
  influencerPhone: string;
  influencerEmail: string;
  // Campaign details
  campaignName: string;
  campaignType: string;         // e.g. Barter / Paid / UGC
  // Deliverables
  deliverables: Array<{
    contentType: string;        // e.g. "1 Instagram Reel", "2 Instagram Stories"
    platform: string;
    deadline: string;           // ISO date string
    requirements: string;
  }>;
  postingDeadline: string;      // Final deadline for all deliverables (ISO date)
  // Compensation
  paymentAmount: number;        // INR — 0 if barter
  barterProductDescription: string;   // empty if paid
  barterShipmentDeadline: string;     // ISO date — when brand must ship product
  // Penalties
  influencerPenaltyAmount: number;    // INR — if influencer breaches
  brandPenaltyAmount: number;         // INR — if brand breaches
}

export function renderBrandInfluencerTemplate(data: BrandInfluencerContractData): string {
  const isBarterCampaign = data.paymentAmount === 0 && data.barterProductDescription.length > 0;
  const compensationSection = isBarterCampaign
    ? `This is a BARTER campaign. No monetary payment will be made.
    Product: ${data.barterProductDescription}
    The Brand commits to shipping the above product to the Creator no later than ${formatDate(data.barterShipmentDeadline)}.`
    : `This is a PAID campaign.
    Total Payment: INR ${data.paymentAmount.toLocaleString('en-IN')}
    Payment will be released within 7 business days of Collabkaroo approving the submitted content.`;

  const deliverablesList = data.deliverables
    .map(
      (d, i) =>
        `  ${i + 1}. ${d.contentType} on ${d.platform}
       Deadline: ${formatDate(d.deadline)}
       Requirements: ${d.requirements}`,
    )
    .join('\n\n');

  return `BRAND–CREATOR COLLABORATION AGREEMENT
Version 1.0 | Contract No: ${data.contractNumber} | Template Ref: TPL-BI-1.0

This Collaboration Agreement ("Agreement") is entered into on ${formatDate(data.selectionDate)} between:

PARTY A — BRAND
Legal Entity Name: ${data.brandLegalName}
Brand Name: ${data.brandName}
Point of Contact: ${data.brandPocName}
Email: ${data.brandPocEmail}
(hereinafter referred to as "Brand")

PARTY B — CREATOR
Full Name: ${data.influencerName}
Username: @${data.influencerUsername}
Email: ${data.influencerEmail}
Phone: ${data.influencerPhone}
(hereinafter referred to as "Creator")

FACILITATED BY
Depshanta Marketing Solutions Pvt. Ltd. (Collabkaroo)
Plot A-18, Manjeet Farm, Uttam Nagar, West Delhi, Delhi – 110059
(hereinafter referred to as "Platform")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. CAMPAIGN DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Campaign Name: ${data.campaignName}
Campaign Type: ${data.campaignType}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CONTENT DELIVERABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The Creator agrees to create and publish the following content:

${deliverablesList}

Final posting deadline: ${formatDate(data.postingDeadline)}

All content must:
  (a) Clearly disclose the collaboration using #ad, #sponsored, or equivalent disclosure as required
      by ASCI guidelines;
  (b) Remain live on the Creator's profile for a minimum of 30 days after posting;
  (c) Not be deleted or archived without prior written consent from the Brand.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. COMPENSATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${compensationSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. CONTENT APPROVAL PROCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4.1 The Creator may submit a draft for brand approval through the Collabkaroo platform before posting.
4.2 The Brand must provide approval or revision feedback within 48 hours of draft submission.
    Failure to respond within 48 hours will be deemed as approval.
4.3 The Brand may request one round of reasonable revisions. Additional revision requests beyond scope
    must be mutually agreed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. EXCLUSIVITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5.1 During the campaign period, the Creator agrees not to create sponsored content for any direct
    competitor of the Brand in the same product category without prior written approval.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. INTELLECTUAL PROPERTY & USAGE RIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6.1 All campaign content remains the intellectual property of the Creator.
6.2 The Brand is granted a non-exclusive, royalty-free licence to repost, share, and use the content
    for marketing purposes for 12 months from the posting date, unless otherwise agreed in writing.
6.3 The Brand may not modify the content in a way that alters its original meaning without consent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. CREATOR BREACH & PENALTIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the Creator fails to deliver the agreed content by the final posting deadline, or delivers content
that materially does not meet the brief and refuses to revise, the Creator:
  (a) Forfeits all compensation for this campaign;
  (b) Must return any barter product received (or its monetary value);
  (c) Is liable for a penalty of INR ${data.influencerPenaltyAmount.toLocaleString('en-IN')}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. BRAND BREACH & PENALTIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the Brand fails to:
  (a) Ship the barter product by ${isBarterCampaign ? formatDate(data.barterShipmentDeadline) : 'N/A'};
  (b) Release confirmed payment within the agreed window;
  (c) Provide the product/brief as described in the campaign;
the Brand is liable for a penalty of INR ${data.brandPenaltyAmount.toLocaleString('en-IN')} and the
Creator retains all content rights for personal use.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. PLATFORM'S ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9.1 Collabkaroo facilitates this Agreement and is not a party to the commercial transaction between
    Brand and Creator.
9.2 Collabkaroo will act as a neutral mediator in the event of a dispute before referring to
    arbitration. Collabkaroo's decision on platform-level actions (account freezes, payment holds)
    is final.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. DISPUTE RESOLUTION & GOVERNING LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10.1 Any dispute shall first be submitted to Collabkaroo's dispute resolution team. If unresolved within
     30 days, the matter will be referred to arbitration under the Arbitration and Conciliation Act,
     1996, seated at New Delhi, India.
10.2 This Agreement is governed by the laws of the Republic of India.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. ENTIRE AGREEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This Agreement constitutes the entire understanding between Brand and Creator for the above campaign.
No verbal commitments outside this document are binding.

[SIGNATURE BLOCK WILL BE APPENDED BY THE SYSTEM]`;
}

function formatDate(isoString: string): string {
  if (!isoString) return 'TBD';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
