import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ContractTemplate } from '../models/contract-template.model';
import { ContractType } from '../models/contract.model';
import {
  PlatformBrandContractData,
  renderPlatformBrandTemplate,
} from '../templates/platform-brand.template';
import {
  PlatformInfluencerContractData,
  renderPlatformInfluencerTemplate,
} from '../templates/platform-influencer.template';
import {
  BrandInfluencerContractData,
  renderBrandInfluencerTemplate,
} from '../templates/brand-influencer.template';

@Injectable()
export class ContractTemplateService implements OnModuleInit {
  private readonly logger = new Logger(ContractTemplateService.name);

  constructor(
    @InjectModel(ContractTemplate) private templateModel: typeof ContractTemplate,
  ) {}

  /**
   * On startup: if no templates exist in DB yet, seed from the hardcoded TypeScript templates.
   * After that, admin manages them exclusively via API.
   */
  async onModuleInit() {
    await this.seedIfEmpty();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN — READ
  // ─────────────────────────────────────────────────────────────────────────

  async getAllTemplates(): Promise<ContractTemplate[]> {
    return this.templateModel.findAll({
      order: [['contractType', 'ASC'], ['createdAt', 'DESC']],
    });
  }

  async getActiveTemplate(contractType: ContractType): Promise<ContractTemplate> {
    const template = await this.templateModel.findOne({
      where: { contractType, isActive: true },
    });
    if (!template) throw new NotFoundException(`No active template found for type: ${contractType}`);
    return template;
  }

  async getTemplateHistory(contractType: ContractType): Promise<ContractTemplate[]> {
    return this.templateModel.findAll({
      where: { contractType },
      order: [['createdAt', 'DESC']],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN — WRITE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update the active template for a contract type.
   * Deactivates the current active template and creates a new version.
   */
  async updateTemplate(
    contractType: ContractType,
    body: string,
    adminId: number,
    notes?: string,
  ): Promise<ContractTemplate> {
    // Deactivate current active version
    await this.templateModel.update(
      { isActive: false },
      { where: { contractType, isActive: true } },
    );

    // Compute next version number
    const latest = await this.templateModel.findOne({
      where: { contractType },
      order: [['createdAt', 'DESC']],
    });
    const nextVersion = this.bumpVersion(latest?.version ?? '1.0');

    const newTemplate = await this.templateModel.create({
      contractType,
      version: nextVersion,
      body,
      isActive: true,
      updatedBy: adminId,
      notes: notes ?? null,
    } as any);

    this.logger.log(`Template updated: ${contractType} → v${nextVersion} by admin #${adminId}`);
    return newTemplate;
  }

  /**
   * Preview: render a template with sample data so admin can see how it looks.
   * Uses the currently active DB template body.
   */
  async previewTemplate(contractType: ContractType): Promise<string> {
    const template = await this.getActiveTemplate(contractType);
    return this.renderWithSampleData(contractType, template.body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERING (called by ContractService when creating contracts)
  // ─────────────────────────────────────────────────────────────────────────

  async renderContract(
    contractType: ContractType,
    data: PlatformBrandContractData | PlatformInfluencerContractData | BrandInfluencerContractData,
  ): Promise<string> {
    const template = await this.getActiveTemplate(contractType);
    return this.replacePlaceholders(template.body, data, contractType);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Replace {{placeholder}} tokens in the template body with actual values.
   * Complex computed sections (like deliverables list and compensation block)
   * are pre-computed here and injected as single placeholders.
   */
  private replacePlaceholders(
    body: string,
    data: any,
    contractType: ContractType,
  ): string {
    let text = body;

    // Inject pre-computed sections for brand_influencer
    if (contractType === ContractType.BRAND_INFLUENCER) {
      const deliverablesList = (data.deliverables ?? [])
        .map(
          (d: any, i: number) =>
            `  ${i + 1}. ${d.contentType} on ${d.platform}\n` +
            `     Deadline: ${formatDate(d.deadline)}\n` +
            `     Requirements: ${d.requirements}`,
        )
        .join('\n\n');

      const isBarterCampaign = data.paymentAmount === 0 && data.barterProductDescription?.length > 0;
      const compensationSection = isBarterCampaign
        ? `This is a BARTER campaign. No monetary payment will be made.\n    Product: ${data.barterProductDescription}\n    The Brand commits to shipping the above product no later than ${formatDate(data.barterShipmentDeadline)}.`
        : `This is a PAID campaign.\n    Total Payment: INR ${Number(data.paymentAmount).toLocaleString('en-IN')}\n    Payment will be released within 7 business days of Collabkaroo approving the submitted content.`;

      text = text.replace('{{deliverablesList}}', deliverablesList);
      text = text.replace('{{compensationSection}}', compensationSection);
    }

    // Replace all remaining {{key}} tokens with values from data
    const flatData = this.flattenData(data);
    for (const [key, value] of Object.entries(flatData)) {
      const token = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      text = text.replace(token, value != null ? String(value) : '');
    }

    return text;
  }

  private flattenData(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        if (key === 'approvalDate' || key === 'verificationDate' || key === 'selectionDate' || key === 'postingDeadline' || key === 'barterShipmentDeadline') {
          result[key] = formatDate(value as string);
        } else if (typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('penalty'))) {
          result[key] = `INR ${value.toLocaleString('en-IN')}`;
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }

  private renderWithSampleData(contractType: ContractType, body: string): string {
    const sampleData: Record<ContractType, any> = {
      [ContractType.PLATFORM_BRAND]: {
        brandName: '[Brand Name]',
        legalEntityName: '[Legal Entity Name]',
        pocName: '[Point of Contact Name]',
        pocDesignation: '[Designation]',
        pocEmail: '[email@brand.com]',
        pocPhone: '[+91-XXXXXXXXXX]',
        approvalDate: new Date().toISOString(),
        platformFeePercent: 10,
        penaltyAmount: 50000,
      },
      [ContractType.PLATFORM_INFLUENCER]: {
        influencerName: '[Influencer Name]',
        username: '[username]',
        phone: '[+91-XXXXXXXXXX]',
        email: '[email@example.com]',
        verificationDate: new Date().toISOString(),
        cashbackReturnWindowDays: 15,
        penaltyAmount: 10000,
      },
      [ContractType.BRAND_INFLUENCER]: {
        contractNumber: 'CTR-2026-XXXX-XXXX',
        selectionDate: new Date().toISOString(),
        brandName: '[Brand Name]',
        brandLegalName: '[Brand Legal Entity]',
        brandPocName: '[Brand POC]',
        brandPocEmail: '[brand@email.com]',
        influencerName: '[Influencer Name]',
        influencerUsername: '[username]',
        influencerPhone: '[+91-XXXXXXXXXX]',
        influencerEmail: '[influencer@email.com]',
        campaignName: '[Campaign Name]',
        campaignType: '[Barter / Paid / UGC]',
        deliverables: [
          {
            contentType: '1 Instagram Reel (60s)',
            platform: 'Instagram',
            deadline: new Date().toISOString(),
            requirements: '[Content requirements here]',
          },
        ],
        postingDeadline: new Date().toISOString(),
        paymentAmount: 0,
        barterProductDescription: '[Product name and worth]',
        barterShipmentDeadline: new Date().toISOString(),
        influencerPenaltyAmount: 5000,
        brandPenaltyAmount: 5000,
      },
    };

    return this.replacePlaceholders(body, sampleData[contractType], contractType);
  }

  /**
   * Seed initial templates from the hardcoded TypeScript templates.
   * Runs only once — if templates already exist in DB, does nothing.
   */
  private async seedIfEmpty() {
    for (const contractType of Object.values(ContractType)) {
      const existing = await this.templateModel.findOne({ where: { contractType } });
      if (existing) continue;

      const body = this.getHardcodedTemplateAsPlaceholderString(contractType as ContractType);
      await this.templateModel.create({
        contractType,
        version: '1.0',
        body,
        isActive: true,
        notes: 'Initial template — seeded automatically on first startup',
      } as any);

      this.logger.log(`Seeded initial template for ${contractType}`);
    }
  }

  /**
   * Converts the hardcoded TypeScript render functions into placeholder-based strings
   * by rendering with placeholder values and then we store the result as the template body.
   * Admin can then edit this in the DB via the API.
   */
  private getHardcodedTemplateAsPlaceholderString(contractType: ContractType): string {
    switch (contractType) {
      case ContractType.PLATFORM_BRAND:
        return renderPlatformBrandTemplate({
          brandName: '{{brandName}}',
          legalEntityName: '{{legalEntityName}}',
          pocName: '{{pocName}}',
          pocDesignation: '{{pocDesignation}}',
          pocEmail: '{{pocEmail}}',
          pocPhone: '{{pocPhone}}',
          approvalDate: '{{approvalDate}}',
          platformFeePercent: '{{platformFeePercent}}' as any,
          penaltyAmount: '{{penaltyAmount}}' as any,
        });

      case ContractType.PLATFORM_INFLUENCER:
        return renderPlatformInfluencerTemplate({
          influencerName: '{{influencerName}}',
          username: '{{username}}',
          phone: '{{phone}}',
          email: '{{email}}',
          verificationDate: '{{verificationDate}}',
          cashbackReturnWindowDays: '{{cashbackReturnWindowDays}}' as any,
          penaltyAmount: '{{penaltyAmount}}' as any,
        });

      case ContractType.BRAND_INFLUENCER:
        // For brand_influencer we store the template with complex computed placeholders
        // The service handles {{deliverablesList}} and {{compensationSection}} specially
        return renderBrandInfluencerTemplate({
          contractNumber: '{{contractNumber}}',
          selectionDate: '{{selectionDate}}',
          brandName: '{{brandName}}',
          brandLegalName: '{{brandLegalName}}',
          brandPocName: '{{brandPocName}}',
          brandPocEmail: '{{brandPocEmail}}',
          influencerName: '{{influencerName}}',
          influencerUsername: '{{influencerUsername}}',
          influencerPhone: '{{influencerPhone}}',
          influencerEmail: '{{influencerEmail}}',
          campaignName: '{{campaignName}}',
          campaignType: '{{campaignType}}',
          deliverables: [{ contentType: '{{deliverablesList}}', platform: '', deadline: '', requirements: '' }],
          postingDeadline: '{{postingDeadline}}',
          paymentAmount: 0,
          barterProductDescription: '{{compensationSection}}',
          barterShipmentDeadline: '{{barterShipmentDeadline}}',
          influencerPenaltyAmount: '{{influencerPenaltyAmount}}' as any,
          brandPenaltyAmount: '{{brandPenaltyAmount}}' as any,
        });
    }
  }

  private bumpVersion(current: string): string {
    const parts = current.split('.');
    const minor = parseInt(parts[1] ?? '0', 10) + 1;
    return `${parts[0]}.${minor}`;
  }
}

function formatDate(isoString: string): string {
  if (!isoString || isoString.startsWith('{{')) return isoString;
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
