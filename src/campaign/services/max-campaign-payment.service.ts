import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import { MaxCampaignInvoice, InvoiceStatus, PaymentMethod } from '../models/max-campaign-invoice.model';
import { City } from '../../shared/models/city.model';
import { RazorpayService } from '../../shared/razorpay.service';
import { S3Service } from '../../shared/s3.service';
import { EmailService } from '../../shared/email.service';
import { EncryptionService } from '../../shared/services/encryption.service';
import { createDatabaseDate, toIST } from '../../shared/utils/date.utils';
import { Op } from 'sequelize';
import { generateBrandInvoicePDF } from '../../shared/utils/brand-invoice-pdf.util';

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  hscCode: string;
  taxes: number;
}

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  brand: {
    name: string;
    email: string;
  };
  campaign: {
    name: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
}

@Injectable()
export class MaxCampaignPaymentService {
  private readonly MAX_CAMPAIGN_AMOUNT = 29900; // Rs 299 in paise

  constructor(
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(MaxCampaignInvoice)
    private maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
    @InjectModel(City)
    private cityModel: typeof City,
    private razorpayService: RazorpayService,
    private s3Service: S3Service,
    private emailService: EmailService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create payment order to upgrade campaign to Max Campaign
   */
  async createMaxCampaignOrder(campaignId: number, brandId: number) {
    // Get campaign
    const campaign = await this.campaignModel.findByPk(campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check if brand owns this campaign
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You can only upgrade your own campaigns');
    }

    // Check if already a Max Campaign
    if (campaign.isMaxCampaign) {
      throw new BadRequestException('This campaign is already a Max Campaign');
    }

    // Check if campaign is marked as organic
    if (campaign.isOrganic) {
      throw new BadRequestException('Organic campaigns cannot be upgraded to Max Campaign');
    }

    // Auto-delete old pending payment and invoice (same as Pro subscription logic)
    if (campaign.maxCampaignPaymentStatus === 'pending') {
      // Delete old pending invoice if exists
      await this.maxCampaignInvoiceModel.destroy({
        where: {
          campaignId,
          paymentStatus: InvoiceStatus.PENDING,
        },
      });

      // Clear campaign payment fields
      await campaign.update({
        maxCampaignPaymentStatus: undefined,
        maxCampaignOrderId: undefined,
        maxCampaignPaymentId: undefined,
        maxCampaignAmount: undefined,
      } as any);
    }

    // Get brand details with city information
    const brand = await this.brandModel.findByPk(brandId, {
      include: [
        {
          model: this.cityModel,
          as: 'headquarterCity',
        },
      ],
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Calculate taxes
    // Total = 29900 paise (Rs 299)
    // Base = 253.39 (in paise: 25339)
    // IGST = 45.61 (in paise: 4561)
    // CGST = 45.61/2 = 22.805 (in paise: 2281)
    // SGST = 45.61/2 = 22.805 (in paise: 2280)
    const totalAmount = this.MAX_CAMPAIGN_AMOUNT; // 29900 paise
    const baseAmount = 25339; // Rs 253.39 in paise

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let taxAmount = 0;

    // Check if brand location is Delhi
    const cityName = brand.headquarterCity?.name?.toLowerCase();
    const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

    if (isDelhi) {
      // For Delhi: CGST and SGST (total tax = 4561 paise = Rs 45.61)
      cgst = 2281; // Rs 22.81
      sgst = 2280; // Rs 22.80 (total: 4561 paise)
      taxAmount = cgst + sgst; // 4561
    } else {
      // For other locations: IGST
      igst = 4561; // Rs 45.61
      taxAmount = igst;
    }

    // Create invoice with tax breakdown (invoice number generated after payment)
    const invoice = await this.maxCampaignInvoiceModel.create({
      invoiceNumber: null,
      campaignId,
      brandId,
      amount: baseAmount,
      tax: taxAmount,
      cgst,
      sgst,
      igst,
      totalAmount: totalAmount,
      paymentStatus: InvoiceStatus.PENDING,
      paymentMethod: PaymentMethod.RAZORPAY,
    });

    // Create Razorpay order (totalAmount is in paise, convert to rupees)
    const razorpayOrder = await this.razorpayService.createOrder(
      invoice.totalAmount / 100, // Amount in Rs
      'INR',
      `MAX_CAMPAIGN_${campaignId}_INV_${invoice.id}`,
      {
        campaignId,
        invoiceId: invoice.id,
        brandId,
        brandName: brand.brandName,
        campaignName: campaign.name,
        upgradeType: 'max_campaign',
      },
    );

    if (!razorpayOrder.success) {
      throw new BadRequestException('Failed to create payment order');
    }

    // Update invoice with Razorpay order ID
    await invoice.update({
      razorpayOrderId: razorpayOrder.orderId,
    });

    // Update campaign with order details (keep campaign active while payment is pending)
    await campaign.update({
      maxCampaignPaymentStatus: 'pending',
      maxCampaignOrderId: razorpayOrder.orderId,
      maxCampaignAmount: invoice.totalAmount,
      status: 'draft' as any, // Campaign will be DRAFT until payment is completed
    });

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        currentStatus: {
          isMaxCampaign: false,
          paymentStatus: 'pending',
        },
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
      },
      payment: {
        orderId: razorpayOrder.orderId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    };
  }

  /**
   * Verify payment and activate Max Campaign
   */
  async verifyAndActivateMaxCampaign(
    campaignId: number,
    brandId: number,
    paymentId: string,
    orderId: string,
    signature: string,
  ) {
    // Verify signature
    const isValid = this.razorpayService.verifyPaymentSignature(
      orderId,
      paymentId,
      signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Get campaign
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check ownership
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You can only upgrade your own campaigns');
    }

    // Verify order ID matches
    if (campaign.maxCampaignOrderId !== orderId) {
      throw new BadRequestException('Order ID mismatch');
    }

    // Get invoice
    const invoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        campaignId,
        razorpayOrderId: orderId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const now = createDatabaseDate();

    // Generate invoice number now that payment is confirmed
    const invoiceNumber = await this.generateInvoiceNumber();

    // Update invoice
    await invoice.update({
      invoiceNumber,
      paymentStatus: InvoiceStatus.PAID,
      razorpayPaymentId: paymentId,
      paidAt: now,
    });

    // Update campaign to Max Campaign and set status to ACTIVE
    await campaign.update({
      isMaxCampaign: true,
      maxCampaignPaymentStatus: 'paid',
      maxCampaignPaymentId: paymentId,
      maxCampaignPaidAt: now,
      status: 'active' as any, // Activate campaign after payment is completed
    });

    // Generate and store invoice data
    await this.generateInvoiceData(invoice.id);

    return {
      success: true,
      message: 'Campaign upgraded to Max Campaign successfully! Only Pro influencers can now apply.',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        isMaxCampaign: true,
        upgradedAt: toIST(now),
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount / 100, // Convert paise to rupees
        paidAt: toIST(now),
      },
    };
  }

  /**
   * Get Max Campaign status
   */
  async getMaxCampaignStatus(campaignId: number, brandId: number) {
    const campaign = await this.campaignModel.findByPk(campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check ownership
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You can only view your own campaign status');
    }

    // Get invoice if exists
    const invoice = await this.maxCampaignInvoiceModel.findOne({
      where: { campaignId },
      order: [['createdAt', 'DESC']],
    });

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      isMaxCampaign: campaign.isMaxCampaign,
      maxCampaignDetails: {
        paymentStatus: campaign.maxCampaignPaymentStatus,
        amount: campaign.maxCampaignAmount ? campaign.maxCampaignAmount / 100 : 299,
        paidAt: toIST(campaign.maxCampaignPaidAt),
        orderId: campaign.maxCampaignOrderId,
        paymentId: campaign.maxCampaignPaymentId,
      },
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.totalAmount / 100,
            status: invoice.paymentStatus,
            paidAt: toIST(invoice.paidAt),
          }
        : null,
    };
  }

  /**
   * Get all invoices for a brand (billing history)
   */
  async getBillingHistory(brandId: number) {
    const invoices = await this.maxCampaignInvoiceModel.findAll({
      where: { brandId },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return {
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        campaignId: invoice.campaignId,
        campaignName: invoice.campaign?.name,
        amount: invoice.totalAmount / 100, // Convert paise to rupees
        status: invoice.paymentStatus,
        paymentMethod: invoice.paymentMethod,
        razorpayOrderId: invoice.razorpayOrderId,
        razorpayPaymentId: invoice.razorpayPaymentId,
        paidAt: toIST(invoice.paidAt),
        invoiceUrl: invoice.invoiceUrl,
        createdAt: toIST(invoice.createdAt),
      })),
    };
  }

  /**
   * Get invoice details
   */
  async getInvoiceDetails(invoiceId: number, brandId: number) {
    const invoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        id: invoiceId,
        brandId,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
        },
        {
          model: Brand,
          as: 'brand',
        },
      ],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount / 100,
      tax: invoice.tax / 100,
      totalAmount: invoice.totalAmount / 100,
      campaign: {
        id: invoice.campaign.id,
        name: invoice.campaign.name,
      },
      brand: {
        id: invoice.brand.id,
        brandName: invoice.brand.brandName,
      },
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      razorpayOrderId: invoice.razorpayOrderId,
      razorpayPaymentId: invoice.razorpayPaymentId,
      paidAt: toIST(invoice.paidAt),
      invoiceUrl: invoice.invoiceUrl,
      invoiceData: invoice.invoiceData, // Structured invoice data for PDF generation
      createdAt: toIST(invoice.createdAt),
    };
  }

  /**
   * Generate invoice data and PDF, upload to S3
   */
  private async generateInvoiceData(invoiceId: number) {
    const invoice = await this.maxCampaignInvoiceModel.findByPk(invoiceId, {
      include: [
        { model: Campaign, as: 'campaign' },
        {
          model: Brand,
          as: 'brand',
          include: [
            {
              model: this.cityModel,
              as: 'headquarterCity',
            },
          ],
        },
      ],
    });

    if (!invoice) {
      return;
    }

    // Check if invoice PDF has already been generated (idempotency protection)
    if (invoice.invoiceUrl) {
      console.log(`Invoice ${invoice.invoiceNumber} already generated, skipping duplicate generation`);
      return invoice.invoiceData;
    }

    // Decrypt brand email if encrypted
    const decryptedEmail = invoice.brand.email?.includes(':')
      ? this.encryptionService.decrypt(invoice.brand.email)
      : invoice.brand.email;

    // Format location as "City, State"
    const city = (invoice.brand as any).headquarterCity;
    const cityName = city?.name || '';
    const stateName = city?.state || '';
    const location = cityName && stateName
      ? `${cityName}, ${stateName}`
      : cityName || stateName || 'N/A';

    // Store invoice data with tax breakdown
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      brand: {
        name: invoice.brand.brandName,
        email: decryptedEmail,
        location: location,
      },
      campaign: {
        name: invoice.campaign.name,
      },
      items: [
        {
          description: 'Maxx campaign - Brand',
          quantity: 1,
          rate: invoice.amount / 100,
          amount: invoice.amount / 100,
          hscCode: '998361', // HSC code for marketing services
          taxes: invoice.tax / 100,
        },
      ],
      subtotal: invoice.amount / 100,
      tax: invoice.tax / 100,
      cgst: invoice.cgst / 100,
      sgst: invoice.sgst / 100,
      igst: invoice.igst / 100,
      total: invoice.totalAmount / 100,
    };

    // Generate PDF
    const pdfBuffer = await this.generateInvoicePDF(invoiceData);

    // Upload to S3
    const s3Key = `invoices/max-campaign/${invoice.invoiceNumber}.pdf`;
    const mockFile = {
      buffer: pdfBuffer,
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    await this.s3Service.uploadFile(mockFile, s3Key);
    const invoiceUrl = this.s3Service.getFileUrl(s3Key);

    // Update invoice with data and URL
    await invoice.update({
      invoiceData,
      invoiceUrl,
    });

    // Send invoice email to brand
    try {
      await this.emailService.sendMaxCampaignInvoiceEmail(
        decryptedEmail,
        invoice.brand.brandName,
        invoice.invoiceNumber,
        invoice.totalAmount / 100, // Convert paise to rupees
        invoiceUrl,
        invoice.campaign.name,
      );
    } catch (error) {
      console.error('Failed to send Max Campaign invoice email:', error);
      // Don't throw - email failure shouldn't break the flow
    }

    return invoiceData;
  }

  /**
   * Generate PDF from invoice data
   */
  private async generateInvoicePDF(invoiceData: InvoiceData): Promise<Buffer> {
    return generateBrandInvoicePDF(invoiceData);
  }

  /**
   * Regenerate PDF for existing invoice
   */
  async regenerateInvoicePDF(invoiceId: number, brandId: number) {
    const invoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        id: invoiceId,
        brandId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.paymentStatus !== InvoiceStatus.PAID) {
      throw new BadRequestException('Can only generate PDF for paid invoices');
    }

    // Regenerate invoice data and PDF
    await this.generateInvoiceData(invoiceId);

    // Fetch updated invoice
    const updatedInvoice = await this.maxCampaignInvoiceModel.findByPk(invoiceId);

    if (!updatedInvoice) {
      throw new NotFoundException('Invoice not found after regeneration');
    }

    return {
      success: true,
      message: 'Invoice PDF generated successfully',
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        invoiceUrl: updatedInvoice.invoiceUrl,
      },
    };
  }

  /**
   * Generate unique invoice number for Max Campaign
   * Format: INV-CYYMM-SEQ
   * Example: INV-C2602-1 (1st invoice in Feb 2026)
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = String(new Date().getFullYear()).slice(-2); // Get last 2 digits of year
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    const currentPrefix = `INV-C${yearMonth}-`;

    // Legacy formats for continuity
    const legacyPrefix1 = `MAXXINV-CMGN-20${yearMonth}-`; // MAXXINV-CMGN-202602-
    const legacyPrefix2 = `MAXXINV-20${yearMonth}-`; // MAXXINV-202602-

    // Check current format
    const latestCurrentInvoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: `${currentPrefix}%`,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    // Check legacy format 1 (MAXXINV-CMGN-202602-15)
    const latestLegacy1Invoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: `${legacyPrefix1}%`,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    // Check legacy format 2 (MAXXINV-202602-14)
    const latestLegacy2Invoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: `${legacyPrefix2}%`,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    let nextNumber = 1;

    // Extract sequence from current format (INV-C2602-15)
    if (latestCurrentInvoice) {
      const parts = latestCurrentInvoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[2], 10);
      nextNumber = Math.max(nextNumber, lastNumber + 1);
    }

    // Extract sequence from legacy format 1 (MAXXINV-CMGN-202602-15)
    if (latestLegacy1Invoice) {
      const parts = latestLegacy1Invoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[3], 10);
      nextNumber = Math.max(nextNumber, lastNumber + 1);
    }

    // Extract sequence from legacy format 2 (MAXXINV-202602-14)
    if (latestLegacy2Invoice) {
      const parts = latestLegacy2Invoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[2], 10);
      nextNumber = Math.max(nextNumber, lastNumber + 1);
    }

    return `${currentPrefix}${nextNumber}`;
  }
}
