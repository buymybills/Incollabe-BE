import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Brand } from './model/brand.model';
import {
  AiCreditInvoice,
  AiCreditInvoiceStatus,
  AiCreditPaymentMethod,
} from './model/ai-credit-invoice.model';
import { Campaign } from '../campaign/models/campaign.model';
import { City } from '../shared/models/city.model';
import { RazorpayService } from '../shared/razorpay.service';
import { S3Service } from '../shared/s3.service';
import { EmailService } from '../shared/email.service';
import { EncryptionService } from '../shared/services/encryption.service';
import { createDatabaseDate, toIST } from '../shared/utils/date.utils';
import { Op } from 'sequelize';
import { generateBrandInvoicePDF } from '../shared/utils/brand-invoice-pdf.util';

@Injectable()
export class AiCreditPaymentService {
  private readonly AI_CREDIT_AMOUNT = 29900; // Rs 299 in paise
  private readonly AI_CREDIT_BASE = 25339; // Rs 253.39 in paise (pre-tax)
  private readonly CREDITS_PER_PURCHASE = 1;

  constructor(
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(AiCreditInvoice)
    private aiCreditInvoiceModel: typeof AiCreditInvoice,
    @InjectModel(City)
    private cityModel: typeof City,
    private razorpayService: RazorpayService,
    private s3Service: S3Service,
    private emailService: EmailService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create payment order to purchase 1 AI credit (only allowed when credits = 0)
   */
  async createAiCreditOrder(campaignId: number, brandId: number) {
    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(
        'You can only purchase credits for your own campaigns',
      );
    }

    // Get brand with city for tax calculation
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

    // VALIDATION: Only allow purchase when aiCreditsRemaining === 0
    if (brand.aiCreditsRemaining > 0) {
      throw new BadRequestException(
        `You still have ${brand.aiCreditsRemaining} AI credit(s) remaining. Purchase is only allowed when your balance is 0.`,
      );
    }

    // Auto-delete stale pending invoices (mirrors MaxCampaignPaymentService pattern)
    await this.aiCreditInvoiceModel.destroy({
      where: {
        brandId,
        paymentStatus: AiCreditInvoiceStatus.PENDING,
      },
    });

    // Calculate taxes (identical to MaxCampaignPaymentService)
    // Total = 29900 paise (Rs 299)
    // Base = 25339 paise (Rs 253.39)
    // IGST = 4561 paise (Rs 45.61)
    // CGST = 2281 paise (Rs 22.81), SGST = 2280 paise (Rs 22.80)
    const totalAmount = this.AI_CREDIT_AMOUNT; // 29900 paise
    const baseAmount = this.AI_CREDIT_BASE; // 25339 paise

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let taxAmount = 0;

    // Check if brand location is Delhi (intra-state: CGST+SGST, else IGST)
    const cityName = brand.headquarterCity?.name?.toLowerCase();
    const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

    if (isDelhi) {
      cgst = 2281; // Rs 22.81
      sgst = 2280; // Rs 22.80
      taxAmount = cgst + sgst; // 4561
    } else {
      igst = 4561; // Rs 45.61
      taxAmount = igst;
    }

    // Create invoice (invoice number assigned after payment confirmation)
    const invoice = await this.aiCreditInvoiceModel.create({
      invoiceNumber: null,
      brandId,
      creditsPurchased: this.CREDITS_PER_PURCHASE,
      amount: baseAmount,
      tax: taxAmount,
      cgst,
      sgst,
      igst,
      totalAmount,
      paymentStatus: AiCreditInvoiceStatus.PENDING,
      paymentMethod: AiCreditPaymentMethod.RAZORPAY,
    });

    // Create Razorpay order (totalAmount is in paise, convert to rupees)
    const razorpayOrder = await this.razorpayService.createOrder(
      invoice.totalAmount / 100, // Amount in Rs
      'INR',
      `AI_CREDIT_BRAND_${brandId}_INV_${invoice.id}`,
      {
        brandId,
        invoiceId: invoice.id,
        brandName: brand.brandName,
        purchaseType: 'ai_credit',
      },
    );

    if (!razorpayOrder.success) {
      throw new BadRequestException('Failed to create payment order');
    }

    // Update invoice with Razorpay order ID
    await invoice.update({
      razorpayOrderId: razorpayOrder.orderId,
    });

    return {
      brand: {
        id: brand.id,
        brandName: brand.brandName,
        aiCreditsRemaining: brand.aiCreditsRemaining,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount / 100,
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
   * Verify payment and activate AI credit on the brand's balance
   */
  async verifyAndActivateAiCredit(
    campaignId: number,
    brandId: number,
    paymentId: string,
    orderId: string,
    signature: string,
  ) {
    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(
        'You can only verify payments for your own campaigns',
      );
    }

    // Verify Razorpay signature
    const isValid = this.razorpayService.verifyPaymentSignature(
      orderId,
      paymentId,
      signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Get invoice by brand + razorpay order ID
    const invoice = await this.aiCreditInvoiceModel.findOne({
      where: { brandId, razorpayOrderId: orderId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Idempotency: if already paid, return success without double-incrementing
    if (invoice.paymentStatus === AiCreditInvoiceStatus.PAID) {
      return {
        success: true,
        message: 'AI credit already activated',
        alreadyProcessed: true,
      };
    }

    const now = createDatabaseDate();
    const invoiceNumber = await this.generateInvoiceNumber();

    // Update invoice to PAID
    await invoice.update({
      invoiceNumber,
      paymentStatus: AiCreditInvoiceStatus.PAID,
      razorpayPaymentId: paymentId,
      paidAt: now,
    });

    // Atomically increment brand's AI credit balance (prevents race conditions)
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    await brand.increment('aiCreditsRemaining', {
      by: invoice.creditsPurchased,
    });

    // Generate PDF invoice and send email (fire-and-forget, mirrors existing pattern)
    this.generateInvoiceData(invoice.id).catch((err) =>
      console.error('Failed to generate AI credit invoice:', err),
    );

    // Reload brand to get updated credit count
    await brand.reload();

    return {
      success: true,
      message:
        'AI credit purchased successfully! Your AI credit balance has been updated.',
      brand: {
        id: brand.id,
        brandName: brand.brandName,
        aiCreditsRemaining: brand.aiCreditsRemaining,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber,
        amount: invoice.totalAmount / 100,
        paidAt: toIST(now),
      },
    };
  }

  /**
   * Get current AI credit status and purchase eligibility for a brand
   */
  async getAiCreditStatus(campaignId: number, brandId: number) {
    // Verify campaign exists and belongs to the brand
    const campaign = await this.campaignModel.findByPk(campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.brandId !== brandId) {
      throw new ForbiddenException(
        'You can only view credit status for your own campaigns',
      );
    }

    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const latestInvoice = await this.aiCreditInvoiceModel.findOne({
      where: { brandId },
      order: [['createdAt', 'DESC']],
    });

    return {
      brand: {
        id: brand.id,
        brandName: brand.brandName,
        aiCreditsRemaining: brand.aiCreditsRemaining,
        canPurchase: brand.aiCreditsRemaining === 0,
      },
      pricePerCredit: this.AI_CREDIT_AMOUNT / 100, // Rs 299
      latestInvoice: latestInvoice
        ? {
            id: latestInvoice.id,
            invoiceNumber: latestInvoice.invoiceNumber,
            amount: latestInvoice.totalAmount / 100,
            status: latestInvoice.paymentStatus,
            paidAt: toIST(latestInvoice.paidAt),
            invoiceUrl: latestInvoice.invoiceUrl,
          }
        : null,
    };
  }

  /**
   * Get all AI credit purchase invoices for a brand (billing history)
   */
  async getAiCreditBillingHistory(brandId: number) {
    const brand = await this.brandModel.findByPk(brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    const invoices = await this.aiCreditInvoiceModel.findAll({
      where: { brandId },
      order: [['createdAt', 'DESC']],
    });

    return {
      brand: {
        id: brand.id,
        aiCreditsRemaining: brand.aiCreditsRemaining,
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        creditsPurchased: inv.creditsPurchased,
        amount: inv.totalAmount / 100,
        status: inv.paymentStatus,
        paymentMethod: inv.paymentMethod,
        razorpayOrderId: inv.razorpayOrderId,
        razorpayPaymentId: inv.razorpayPaymentId,
        paidAt: toIST(inv.paidAt),
        invoiceUrl: inv.invoiceUrl,
        createdAt: toIST(inv.createdAt),
      })),
    };
  }

  /**
   * Get details for a specific AI credit invoice
   */
  async getAiCreditInvoiceDetails(invoiceId: number, brandId: number) {
    const invoice = await this.aiCreditInvoiceModel.findOne({
      where: { id: invoiceId, brandId },
      include: [{ model: Brand, as: 'brand' }],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      creditsPurchased: invoice.creditsPurchased,
      amount: invoice.amount / 100,
      tax: invoice.tax / 100,
      cgst: invoice.cgst / 100,
      sgst: invoice.sgst / 100,
      igst: invoice.igst / 100,
      totalAmount: invoice.totalAmount / 100,
      paymentStatus: invoice.paymentStatus,
      paymentMethod: invoice.paymentMethod,
      razorpayOrderId: invoice.razorpayOrderId,
      razorpayPaymentId: invoice.razorpayPaymentId,
      paidAt: toIST(invoice.paidAt),
      invoiceUrl: invoice.invoiceUrl,
      invoiceData: invoice.invoiceData,
      createdAt: toIST(invoice.createdAt),
    };
  }

  /**
   * Generate invoice data, PDF, upload to S3, and send email
   */
  private async generateInvoiceData(invoiceId: number) {
    const invoice = await this.aiCreditInvoiceModel.findByPk(invoiceId, {
      include: [
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

    // Idempotency: skip if already generated
    if (invoice.invoiceUrl) {
      console.log(
        `AI Credit Invoice ${invoice.invoiceNumber} already generated, skipping`,
      );
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
    const location =
      cityName && stateName
        ? `${cityName}, ${stateName}`
        : cityName || stateName || 'N/A';

    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      brand: {
        name: invoice.brand.brandName,
        email: decryptedEmail,
        location,
      },
      items: [
        {
          description: 'AI Credit - Brand',
          quantity: invoice.creditsPurchased,
          rate: invoice.amount / 100,
          hscCode: '998361', // Marketing/analytics services HSN code
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
    const pdfBuffer = await generateBrandInvoicePDF(invoiceData);

    // Upload to S3
    const s3Key = `invoices/ai-credit/${invoice.invoiceNumber}.pdf`;
    const mockFile = {
      buffer: pdfBuffer,
      mimetype: 'application/pdf',
    } as Express.Multer.File;

    await this.s3Service.uploadFile(mockFile, s3Key);
    const invoiceUrl = this.s3Service.getFileUrl(s3Key);

    // Persist invoice data and URL
    await invoice.update({ invoiceData, invoiceUrl });

    // Send invoice email (fire-and-forget)
    // try {
    //   await this.emailService.sendAiCreditInvoiceEmail(
    //     decryptedEmail,
    //     invoice.brand.brandName,
    //     invoice.invoiceNumber,
    //     invoice.totalAmount / 100,
    //     invoiceUrl,
    //   );
    // } catch (err) {
    //   console.error('Failed to send AI credit invoice email:', err);
    //   // Intentionally not throwing – email is non-critical
    // }

    return invoiceData;
  }

  /**
   * Generate unique invoice number for AI Credit
   * Format: INV-MYYMM-SEQ  (e.g., INV-M2602-1)
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = String(new Date().getFullYear()).slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    const currentPrefix = `INV-M${yearMonth}-`;

    const allInvoices = await this.aiCreditInvoiceModel.findAll({
      where: { invoiceNumber: { [Op.like]: `${currentPrefix}%` } },
      attributes: ['invoiceNumber'],
    });

    let nextNumber = 1;
    for (const inv of allInvoices) {
      const n = parseInt(inv.invoiceNumber.split('-')[2], 10);
      if (!isNaN(n)) nextNumber = Math.max(nextNumber, n + 1);
    }

    return `${currentPrefix}${nextNumber}`;
  }
}
