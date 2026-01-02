import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import { MaxCampaignInvoice, InvoiceStatus, PaymentMethod } from '../models/max-campaign-invoice.model';
import { RazorpayService } from '../../shared/razorpay.service';
import { S3Service } from '../../shared/s3.service';
import { createDatabaseDate, toIST } from '../../shared/utils/date.utils';
import { Op } from 'sequelize';
import PDFDocument from 'pdfkit';

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

    // Store invoice data
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      brand: {
        name: invoice.brand.brandName,
        email: invoice.brand.email,
      },
      campaign: {
        name: invoice.campaign.name,
      },
      items: [
        {
          description: 'Max Campaign Upgrade - Premium campaign visible to Pro influencers only',
          quantity: 1,
          rate: invoice.amount / 100,
          amount: invoice.amount / 100,
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

    return invoiceData;
  }

  /**
   * Generate PDF from invoice data
   */
  private async generateInvoicePDF(invoiceData: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .text('InCollab', { align: 'center' })
        .fontSize(10)
        .text('Max Campaign Invoice', { align: 'center' })
        .moveDown();

      // Invoice details
      doc
        .fontSize(12)
        .text(`Invoice Number: ${invoiceData.invoiceNumber}`, 50, 150)
        .text(`Date: ${new Date(invoiceData.date).toLocaleDateString('en-IN')}`, 50, 170)
        .moveDown();

      // Brand details
      doc
        .fontSize(14)
        .text('Bill To:', 50, 210)
        .fontSize(10)
        .text(invoiceData.brand.name, 50, 230)
        .moveDown();

      // Campaign details
      doc
        .fontSize(12)
        .text('Campaign Details:', 50, 270)
        .fontSize(10)
        .text(`Campaign: ${invoiceData.campaign.name}`, 50, 290)
        .moveDown();

      // Table header
      const tableTop = 330;
      doc
        .fontSize(10)
        .text('Description', 50, tableTop)
        .text('Quantity', 300, tableTop)
        .text('Rate', 380, tableTop)
        .text('Amount', 450, tableTop);

      // Draw line
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      // Items
      let yPosition = tableTop + 25;
      invoiceData.items.forEach((item) => {
        doc
          .fontSize(9)
          .text(item.description, 50, yPosition, { width: 230 })
          .text(item.quantity.toString(), 300, yPosition)
          .text(`₹${item.rate}`, 380, yPosition)
          .text(`₹${item.amount}`, 450, yPosition);
        yPosition += 30;
      });

      // Draw line
      doc
        .moveTo(50, yPosition)
        .lineTo(550, yPosition)
        .stroke();

      // Totals
      yPosition += 20;
      doc
        .fontSize(10)
        .text('Subtotal:', 380, yPosition)
        .text(`₹${invoiceData.subtotal}`, 450, yPosition);

      yPosition += 20;
      doc
        .text('Tax:', 380, yPosition)
        .text(`₹${invoiceData.tax}`, 450, yPosition);

      yPosition += 20;
      doc
        .fontSize(12)
        .text('Total:', 380, yPosition)
        .text(`₹${invoiceData.total}`, 450, yPosition);

      // Footer
      doc
        .fontSize(8)
        .text(
          'Thank you for your business!',
          50,
          700,
          { align: 'center' }
        )
        .text(
          'This is a computer-generated invoice.',
          50,
          715,
          { align: 'center' }
        );

      doc.end();
    });
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
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `MAXINV-${year}${month}-`;

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
      // Extract the number from the latest invoice (e.g., "MAXINV-202512-00001" -> 1)
      const lastNumber = parseInt(latestInvoice.invoiceNumber.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }
}
