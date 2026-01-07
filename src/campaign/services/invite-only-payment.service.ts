import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import { InviteOnlyCampaignInvoice, InvoiceStatus, PaymentMethod } from '../models/invite-only-campaign-invoice.model';
import { RazorpayService } from '../../shared/razorpay.service';
import { S3Service } from '../../shared/s3.service';
import { EncryptionService } from '../../shared/services/encryption.service';
import { EmailService } from '../../shared/email.service';
import { createDatabaseDate, toIST } from '../../shared/utils/date.utils';
import { Op } from 'sequelize';
import { generateBrandInvoicePDF } from '../../shared/utils/brand-invoice-pdf.util';

@Injectable()
export class InviteOnlyPaymentService {
  private readonly INVITE_ONLY_AMOUNT = 49900; // Rs 499 in paise

  constructor(
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    @InjectModel(InviteOnlyCampaignInvoice)
    private inviteOnlyInvoiceModel: typeof InviteOnlyCampaignInvoice,
    private razorpayService: RazorpayService,
    private s3Service: S3Service,
    private encryptionService: EncryptionService,
    private emailService: EmailService,
  ) {}

  /**
   * Create payment order to unlock invite-only feature for a campaign
   */
  async createInviteOnlyPaymentOrder(campaignId: number, brandId: number) {
    // Get campaign
    const campaign = await this.campaignModel.findByPk(campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check if brand owns this campaign
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You can only unlock features for your own campaigns');
    }

    // Check if campaign is invite-only
    if (!campaign.isInviteOnly) {
      throw new BadRequestException('This feature is only available for invite-only campaigns');
    }

    // Check if already paid for invite-only feature
    if (campaign.inviteOnlyPaid) {
      throw new BadRequestException('Invite-only feature is already unlocked for this campaign');
    }

    // Auto-delete old pending payment and invoice
    if (campaign.inviteOnlyPaymentStatus === 'pending') {
      // Delete old pending invoice if exists
      await this.inviteOnlyInvoiceModel.destroy({
        where: {
          campaignId,
          paymentStatus: InvoiceStatus.PENDING,
        },
      });

      // Clear campaign payment fields
      await campaign.update({
        inviteOnlyPaymentStatus: undefined,
        inviteOnlyOrderId: undefined,
        inviteOnlyPaymentId: undefined,
        inviteOnlyAmount: undefined,
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
    const invoice = await this.inviteOnlyInvoiceModel.create({
      invoiceNumber,
      campaignId,
      brandId,
      amount: this.INVITE_ONLY_AMOUNT,
      tax: 0, // No GST for services under Rs 20 lakh turnover
      totalAmount: this.INVITE_ONLY_AMOUNT,
      paymentStatus: InvoiceStatus.PENDING,
      paymentMethod: PaymentMethod.RAZORPAY,
    });

    // Create Razorpay order
    const razorpayOrder = await this.razorpayService.createOrder(
      499, // Amount in Rs
      'INR',
      `INVITE_ONLY_${campaignId}_INV_${invoice.id}`,
      {
        campaignId,
        invoiceId: invoice.id,
        brandId,
        brandName: brand.brandName,
        campaignName: campaign.name,
        featureType: 'invite_only',
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
      inviteOnlyPaymentStatus: 'pending',
      inviteOnlyOrderId: razorpayOrder.orderId,
      inviteOnlyAmount: this.INVITE_ONLY_AMOUNT,
      status: 'draft' as any, // Campaign will be DRAFT until payment is completed
    });

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        currentStatus: {
          inviteOnlyPaid: false,
          paymentStatus: 'pending',
        },
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount / 100, // Convert to Rs
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
   * Verify payment and unlock invite-only feature
   */
  async verifyAndUnlockInviteOnly(
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
      throw new ForbiddenException('You can only unlock features for your own campaigns');
    }

    // Verify order ID matches
    if (campaign.inviteOnlyOrderId !== orderId) {
      throw new BadRequestException('Order ID mismatch');
    }

    // Get invoice
    const invoice = await this.inviteOnlyInvoiceModel.findOne({
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

    // Update campaign - unlock invite-only feature and set status to ACTIVE
    await campaign.update({
      inviteOnlyPaid: true,
      inviteOnlyPaymentStatus: 'paid',
      inviteOnlyPaymentId: paymentId,
      inviteOnlyPaidAt: now,
      status: 'active' as any, // Activate campaign after payment is completed
    });

    // Generate and store invoice data
    await this.generateInvoiceData(invoice.id);

    return {
      success: true,
      message: 'Invite-only feature unlocked successfully! You can now send invitations to influencers.',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        inviteOnlyPaid: true,
        unlockedAt: toIST(now),
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
   * Get invite-only payment status
   */
  async getInviteOnlyStatus(campaignId: number, brandId: number) {
    const campaign = await this.campaignModel.findByPk(campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Check ownership
    if (campaign.brandId !== brandId) {
      throw new ForbiddenException('You can only view your own campaign status');
    }

    // Get invoice if exists
    const invoice = await this.inviteOnlyInvoiceModel.findOne({
      where: { campaignId },
      order: [['createdAt', 'DESC']],
    });

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      isInviteOnly: campaign.isInviteOnly,
      inviteOnlyPaid: campaign.inviteOnlyPaid,
      inviteOnlyDetails: {
        paymentStatus: campaign.inviteOnlyPaymentStatus,
        amount: campaign.inviteOnlyAmount ? campaign.inviteOnlyAmount / 100 : 499,
        paidAt: toIST(campaign.inviteOnlyPaidAt),
        orderId: campaign.inviteOnlyOrderId,
        paymentId: campaign.inviteOnlyPaymentId,
      },
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.totalAmount / 100,
            status: invoice.paymentStatus,
            paidAt: toIST(invoice.paidAt),
            invoiceUrl: invoice.invoiceUrl,
          }
        : null,
    };
  }

  /**
   * Generate invoice data and PDF, upload to S3
   */
  private async generateInvoiceData(invoiceId: number) {
    const invoice = await this.inviteOnlyInvoiceModel.findByPk(invoiceId, {
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
          description: 'Invite-Only Campaign Feature - Send personalized invitations to influencers',
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
    const s3Key = `invoices/invite-only-campaign/${invoice.invoiceNumber}.pdf`;
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
      await this.emailService.sendInviteCampaignInvoiceEmail(
        decryptedEmail,
        invoice.brand.brandName,
        invoice.invoiceNumber,
        invoice.totalAmount / 100, // Convert paise to rupees
        invoiceUrl,
        invoice.campaign.name,
      );
    } catch (error) {
      console.error('Failed to send Invite Campaign invoice email:', error);
      // Don't throw - email failure shouldn't break the flow
    }

    return invoiceData;
  }

  /**
   * Generate PDF from invoice data
   */
  private async generateInvoicePDF(invoiceData: any): Promise<Buffer> {
    return generateBrandInvoicePDF(invoiceData);
  }

  /**
   * Generate unique invoice number for Invite-Only Campaign
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INVITEINV-${year}${month}-`;

    // Get the latest invoice number for this month
    const latestInvoice = await this.inviteOnlyInvoiceModel.findOne({
      where: {
        invoiceNumber: {
          [Op.like]: `${prefix}%`,
        },
      },
      order: [['createdAt', 'DESC']],
    });

    let nextNumber = 1;
    if (latestInvoice) {
      // Extract the sequence number (e.g., "INVITEINV-202601-1" -> 1)
      const parts = latestInvoice.invoiceNumber.split('-');
      const lastNumber = parseInt(parts[2], 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber}`;
  }
}
