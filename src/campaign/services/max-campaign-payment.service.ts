import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import { MaxCampaignInvoice, InvoiceStatus, PaymentMethod } from '../models/max-campaign-invoice.model';
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

    // Get brand details
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Create invoice
    const invoice = await this.maxCampaignInvoiceModel.create({
      invoiceNumber,
      campaignId,
      brandId,
      amount: this.MAX_CAMPAIGN_AMOUNT,
      tax: 0, // No GST for services under Rs 20 lakh turnover
      totalAmount: this.MAX_CAMPAIGN_AMOUNT,
      paymentStatus: InvoiceStatus.PENDING,
      paymentMethod: PaymentMethod.RAZORPAY,
    });

    // Create Razorpay order
    const razorpayOrder = await this.razorpayService.createOrder(
      299, // Amount in Rs
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

    // Update campaign with order details and set status to DRAFT until payment is completed
    await campaign.update({
      maxCampaignPaymentStatus: 'pending',
      maxCampaignOrderId: razorpayOrder.orderId,
      maxCampaignAmount: this.MAX_CAMPAIGN_AMOUNT,
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

    // Update invoice
    await invoice.update({
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
        { model: Brand, as: 'brand' },
      ],
    });

    if (!invoice) {
      return;
    }

    // Decrypt brand email if encrypted
    const decryptedEmail = invoice.brand.email?.includes(':')
      ? this.encryptionService.decrypt(invoice.brand.email)
      : invoice.brand.email;

    // Store invoice data
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      brand: {
        name: invoice.brand.brandName,
        email: decryptedEmail,
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
   * Format: MAXXINV-YYYYMM-SEQ
   * Example: MAXXINV-202601-1 (1st invoice in Jan 2026)
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `MAXXINV-${year}${month}-`;

    // Get the latest invoice number for this month
    const latestInvoice = await this.maxCampaignInvoiceModel.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: `${prefix}%`,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    let nextNumber = 1;
    if (latestInvoice) {
      // Extract the sequence number (e.g., "MAXXINV-202601-1" -> 1)
      const parts = latestInvoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[2], 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber}`;
  }
}
