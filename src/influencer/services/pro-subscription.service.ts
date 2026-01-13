import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { ProSubscription, SubscriptionStatus, PaymentMethod, UpiMandateStatus } from '../models/pro-subscription.model';
import { ProInvoice, InvoiceStatus } from '../models/pro-invoice.model';
import { ProPaymentTransaction, TransactionType, TransactionStatus } from '../models/pro-payment-transaction.model';
import { Influencer } from '../../auth/model/influencer.model';
import { RazorpayService } from '../../shared/razorpay.service';
import { S3Service } from '../../shared/s3.service';
import { EncryptionService } from '../../shared/services/encryption.service';
import { Op } from 'sequelize';
import { toIST, createDatabaseDate, addDaysForDatabase } from '../../shared/utils/date.utils';
import PDFDocument from 'pdfkit';
import * as path from 'path';

@Injectable()
export class ProSubscriptionService {
  private readonly PRO_SUBSCRIPTION_AMOUNT = 19900; // Rs 199 in paise
  private readonly SUBSCRIPTION_DURATION_DAYS = 30;
  // private readonly USE_TEST_MODE = process.env.NODE_ENV !== 'production';
  // private readonly TEST_PLAN_ID = 'plan_test_development'; // Dummy plan for testing

  constructor(
    @InjectModel(ProSubscription)
    private proSubscriptionModel: typeof ProSubscription,
    @InjectModel(ProInvoice)
    private proInvoiceModel: typeof ProInvoice,
    @InjectModel(ProPaymentTransaction)
    private proPaymentTransactionModel: typeof ProPaymentTransaction,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    private razorpayService: RazorpayService,
    private s3Service: S3Service,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a payment order for Pro subscription (supports test mode)
   */
  async createSubscriptionOrder(influencerId: number) {
    // Check if influencer exists
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Check if there's a pending payment to prevent duplicate payment attempts
    const existingPendingSubscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.PAYMENT_PENDING,
      },
    });

    if (existingPendingSubscription) {
      throw new BadRequestException('You already have a pending payment. Please complete or cancel it before creating a new subscription.');
    }

    // Delete any old failed subscriptions to avoid unique constraint violation
    await this.proSubscriptionModel.destroy({
      where: {
        influencerId,
        status: SubscriptionStatus.PAYMENT_FAILED,
      },
    });

    // Create subscription record with timezone-adjusted dates
    // If influencer has active Pro, extend from current expiry date to avoid losing days
    const now = createDatabaseDate();
    let startDate: Date;
    let endDate: Date;

    if (influencer.isPro && influencer.proExpiresAt && influencer.proExpiresAt > now) {
      // Extend from current expiry - Example: If current expiry is Day 30 and they purchase on Day 20,
      // new period will be Day 30 to Day 60 (not Day 20 to Day 50)
      startDate = influencer.proExpiresAt;
      endDate = addDaysForDatabase(startDate, this.SUBSCRIPTION_DURATION_DAYS);
      console.log(`✅ Extending Pro membership from current expiry (${toIST(influencer.proExpiresAt)}) to ${toIST(endDate)}`);
    } else {
      // No active Pro or already expired - start new period from now
      startDate = now;
      endDate = addDaysForDatabase(startDate, this.SUBSCRIPTION_DURATION_DAYS);
      console.log(`📅 Starting new Pro membership from now (ends: ${toIST(endDate)})`);
    }

    const subscription = await this.proSubscriptionModel.create({
      influencerId,
      status: SubscriptionStatus.PAYMENT_PENDING,
      startDate,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      nextBillingDate: endDate,
      subscriptionAmount: this.PRO_SUBSCRIPTION_AMOUNT,
      paymentMethod: PaymentMethod.RAZORPAY,
      autoRenew: false, // Only enable after first payment is successful
    });

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(influencerId);

    // Create invoice
    let invoice;
    try {
      invoice = await this.proInvoiceModel.create({
        invoiceNumber,
        subscriptionId: subscription.id,
        influencerId,
        amount: this.PRO_SUBSCRIPTION_AMOUNT,
        tax: 0, // No GST for services under Rs 20 lakh turnover
        totalAmount: this.PRO_SUBSCRIPTION_AMOUNT,
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        paymentStatus: InvoiceStatus.PENDING,
        paymentMethod: PaymentMethod.RAZORPAY,
      });
    } catch (error) {
      console.error('Invoice creation error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      if (error.errors) {
        console.error('Validation errors:', error.errors);
      }
      throw new BadRequestException(`Failed to create invoice: ${error.message} - ${JSON.stringify(error.errors || error)}`);
    }

    // Create Razorpay order
    const razorpayOrder = await this.razorpayService.createOrder(
      199, // Amount in Rs
      'INR',
      `PRO_SUB_${subscription.id}_INV_${invoice.id}`,
      {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        influencerId,
        influencerName: influencer.name,
      },
    );

    if (!razorpayOrder.success) {
      throw new BadRequestException('Failed to create payment order');
    }

    // Update invoice with Razorpay order ID
    await invoice.update({
      razorpayOrderId: razorpayOrder.orderId,
    });

    // Convert to plain object to avoid Sequelize serialization issues
    const plainSubscription = subscription.toJSON();

    return {
      subscription: {
        id: plainSubscription.id,
        status: plainSubscription.status,
        startDate: toIST(plainSubscription.startDate),
        endDate: toIST(plainSubscription.currentPeriodEnd),
        amount: plainSubscription.subscriptionAmount,
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
   * Verify payment and activate subscription
   */
  async verifyAndActivateSubscription(
    subscriptionId: number,
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

    // Get subscription and invoice
    const subscription = await this.proSubscriptionModel.findByPk(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const invoice = await this.proInvoiceModel.findOne({
      where: {
        subscriptionId,
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

    // Update subscription
    await subscription.update({
      status: SubscriptionStatus.ACTIVE,
    });

    // Update influencer isPro status
    await this.influencerModel.update(
      {
        isPro: true,
        proActivatedAt: now,
        proExpiresAt: subscription.currentPeriodEnd,
      },
      {
        where: { id: subscription.influencerId },
      },
    );

    // Create payment transaction record
    await this.proPaymentTransactionModel.create({
      invoiceId: invoice.id,
      influencerId: subscription.influencerId,
      transactionType: TransactionType.PAYMENT,
      amount: invoice.totalAmount,
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      status: TransactionStatus.SUCCESS,
      paymentMethod: PaymentMethod.RAZORPAY,
      metadata: {
        subscriptionId: subscription.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    // Generate invoice PDF
    await this.generateInvoicePDF(invoice.id);

    return {
      success: true,
      message: 'Pro subscription activated successfully!',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        validUntil: toIST(subscription.currentPeriodEnd),
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    };
  }

  /**
   * Get subscription details for an influencer
   */
  async getSubscriptionDetails(influencerId: number) {
    // Get the latest subscription
    const subscription = await this.proSubscriptionModel.findOne({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        isPro: false,
      };
    }

    // Get ALL invoices for this influencer across all subscriptions
    const allInvoices = await this.proInvoiceModel.findAll({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
    });

    // User has Pro access if:
    // 1. Subscription is ACTIVE, OR
    // 2. Subscription is CANCELLED but current period hasn't ended yet, OR
    // 3. Subscription is PAUSED:
    //    - Before currentPeriodEnd: isPro = true (paid period, pause hasn't started)
    //    - After resumeDate: isPro = true (pause ended)
    //    - Between currentPeriodEnd and resumeDate: isPro = false (pause active)
    const now = createDatabaseDate();
    let isPro = false;

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      isPro = true;
    } else if (subscription.status === SubscriptionStatus.CANCELLED) {
      isPro = subscription.currentPeriodEnd > now;
    } else if (subscription.status === SubscriptionStatus.PAUSED) {
      // If pause period has ended, give Pro access
      if (subscription.resumeDate && subscription.resumeDate <= now) {
        isPro = true;
      }
      // If still in paid period (pause hasn't started yet), give Pro access
      else if (subscription.currentPeriodEnd > now) {
        isPro = true;
      }
      // Otherwise, we're in the pause period - no Pro access
      else {
        isPro = false;
      }
    }

    // Don't count subscriptions in pending/failed states as having a subscription
    const hasSubscription = !(
      subscription.status === SubscriptionStatus.PAYMENT_PENDING ||
      subscription.status === SubscriptionStatus.PAYMENT_FAILED ||
      subscription.status === SubscriptionStatus.INACTIVE
    );

    // Calculate display status dynamically based on current time
    let displayStatus = subscription.status;

    // If cancelled and current period has ended, show as expired
    if (subscription.status === SubscriptionStatus.CANCELLED && subscription.currentPeriodEnd <= now) {
      displayStatus = SubscriptionStatus.EXPIRED;
    }
    // If pause is scheduled but hasn't started yet (before currentPeriodEnd), show as active
    else if (subscription.isPaused && subscription.currentPeriodEnd > now) {
      displayStatus = SubscriptionStatus.ACTIVE;
    }
    // If pause has started (after currentPeriodEnd but before resumeDate), show as paused
    else if (subscription.isPaused && subscription.resumeDate && subscription.currentPeriodEnd <= now && subscription.resumeDate > now) {
      displayStatus = SubscriptionStatus.PAUSED;
    }
    // If pause period has ended (after resumeDate), show as active
    else if (subscription.isPaused && subscription.resumeDate && subscription.resumeDate <= now) {
      displayStatus = SubscriptionStatus.ACTIVE;
    }

    return {
      hasSubscription,
      isPro,
      subscription: {
        id: subscription.id,
        status: displayStatus,
        isCancelled: subscription.status === SubscriptionStatus.CANCELLED || displayStatus === SubscriptionStatus.EXPIRED,
        isPaused: subscription.isPaused,  // True if pause is scheduled OR active
        pausedAt: subscription.pausedAt ? toIST(subscription.pausedAt) : null,
        pauseStartDate: subscription.pauseStartDate
          ? toIST(subscription.pauseStartDate)
          : (subscription.isPaused ? toIST(subscription.currentPeriodEnd) : null),  // Fallback for old data
        pauseEndDate: subscription.resumeDate ? toIST(subscription.resumeDate) : null,
        pauseDurationDays: subscription.pauseDurationDays,
        startDate: toIST(subscription.startDate),
        currentPeriodStart: toIST(subscription.currentPeriodStart),
        currentPeriodEnd: toIST(subscription.currentPeriodEnd),
        nextBillingDate: toIST(subscription.nextBillingDate),
        amount: subscription.subscriptionAmount / 100, // Convert to Rs
        autoRenew: subscription.autoRenew,
        paymentMethod: subscription.paymentMethod,
        isAutopay: subscription.autoRenew && !!subscription.razorpaySubscriptionId, // true if autopay, false if monthly
        subscriptionType: subscription.autoRenew && subscription.razorpaySubscriptionId ? 'autopay' : 'monthly',
      },
      invoices: allInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount / 100,
        status: inv.paymentStatus,
        billingPeriod: {
          start: toIST(inv.billingPeriodStart),
          end: toIST(inv.billingPeriodEnd),
        },
        paidAt: toIST(inv.paidAt),
        invoiceUrl: inv.invoiceUrl,
        paymentMethod: inv.paymentMethod,
        // Check if this invoice was paid via autopay (has razorpayPaymentId starting with subscription-related prefix)
        isAutopay: inv.razorpayPaymentId ? inv.razorpayPaymentId.includes('sub_') : false,
        paymentType: inv.razorpayPaymentId && inv.razorpayPaymentId.includes('sub_') ? 'Autopay' : 'Monthly',
      })),
    };
  }

  /**
   * Get all invoices for an influencer across ALL subscriptions
   */
  async getAllInvoices(influencerId: number) {
    // Fetch ALL invoices for this influencer across all subscriptions
    const allInvoices = await this.proInvoiceModel.findAll({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
    });

    if (!allInvoices || allInvoices.length === 0) {
      return {
        invoices: [],
        totalInvoices: 0,
      };
    }

    return {
      invoices: allInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount / 100, // Convert to Rs
        status: inv.paymentStatus,
        billingPeriod: {
          start: toIST(inv.billingPeriodStart),
          end: toIST(inv.billingPeriodEnd),
        },
        paidAt: toIST(inv.paidAt),
        invoiceUrl: inv.invoiceUrl,
        paymentMethod: inv.paymentMethod,
        isAutopay: inv.razorpayPaymentId ? inv.razorpayPaymentId.includes('sub_') : false,
        paymentType: inv.razorpayPaymentId && inv.razorpayPaymentId.includes('sub_') ? 'Autopay' : 'Monthly',
        createdAt: toIST(inv.createdAt),
      })),
      totalInvoices: allInvoices.length,
    };
  }

  /**
   * Create invoice for existing subscription (for testing/manual creation)
   */
  async createInvoiceForSubscription(influencerId: number) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    // Check if invoice already exists for current period
    const existingInvoice = await this.proInvoiceModel.findOne({
      where: {
        subscriptionId: subscription.id,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
      },
    });

    if (existingInvoice) {
      return {
        success: false,
        message: 'Invoice already exists for current billing period',
        invoice: {
          id: existingInvoice.id,
          invoiceNumber: existingInvoice.invoiceNumber,
        },
      };
    }

    // Create invoice
    const invoiceNumber = await this.generateInvoiceNumber(influencerId);
    const invoice = await this.proInvoiceModel.create({
      invoiceNumber,
      subscriptionId: subscription.id,
      influencerId,
      amount: subscription.subscriptionAmount,
      tax: 0,
      totalAmount: subscription.subscriptionAmount,
      billingPeriodStart: subscription.currentPeriodStart,
      billingPeriodEnd: subscription.currentPeriodEnd,
      paymentStatus: InvoiceStatus.PAID,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayPaymentId: subscription.razorpaySubscriptionId || `manual_${Date.now()}`,
      paidAt: createDatabaseDate(),
    });

    // Generate PDF
    try {
      await this.generateInvoicePDF(invoice.id);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }

    return {
      success: true,
      message: 'Invoice created successfully',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount / 100,
        status: invoice.paymentStatus,
      },
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(influencerId: number, reason?: string) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: {
          [Op.in]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED],
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active or paused subscription found');
    }

    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      autoRenew: false,
      cancelledAt: createDatabaseDate(),
      cancelReason: reason,
      // Clear pause flags since cancellation overrides pause
      isPaused: false,
      pausedAt: null,
      pauseStartDate: null,
      pauseDurationDays: null,
      resumeDate: null,
      pauseReason: null,
    });

    return {
      success: true,
      message: 'Subscription cancelled. Pro access will remain active until the end of current billing period.',
      validUntil: toIST(subscription.currentPeriodEnd),
    };
  }

  /**
   * Generate unique invoice number for Max influencer
   * Format: MAXXINV-YYYYMM-SEQ
   * Example: MAXXINV-202601-1 (1st invoice in Jan 2026)
   */
  private async generateInvoiceNumber(influencerId: number): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `MAXXINV-${year}${month}-`;

    // Get the latest invoice number for this month (across all users)
    const latestInvoice = await this.proInvoiceModel.findOne({
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

  /**
   * Generate invoice PDF and upload to S3
   */
  private async generateInvoicePDF(invoiceId: number) {
    const invoice = await this.proInvoiceModel.findByPk(invoiceId, {
      include: [
        { model: Influencer, as: 'influencer' },
        { model: ProSubscription, as: 'subscription' },
      ],
    });

    if (!invoice) {
      return;
    }

    // Decrypt phone number if encrypted
    const decryptedPhone = invoice.influencer.phone?.includes(':')
      ? this.encryptionService.decrypt(invoice.influencer.phone)
      : invoice.influencer.phone;

    // Store invoice data
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      influencer: {
        name: invoice.influencer.name,
        phone: decryptedPhone || 'N/A',
      },
      items: [
        {
          description: 'Maxx membership- Creator',
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
      billingPeriod: {
        start: invoice.billingPeriodStart,
        end: invoice.billingPeriodEnd,
      },
    };

    // Generate PDF
    const pdfBuffer = await this.createProInvoicePDF(invoiceData);

    // Upload to S3
    const s3Key = `invoices/pro-subscription/${invoice.invoiceNumber}.pdf`;
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
   * Create PDF for Pro subscription invoice
   */
  private async createProInvoicePDF(invoiceData: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 50;

      // Header - Logo on left, INVOICE on right
      try {
        const logoPath = path.join(process.cwd(), 'src', 'assets', 'collabkaroo-logo.png');

        // Add logo on the left
        doc.image(logoPath, margin, 40, {
          fit: [180, 50]
        });
      } catch (logoError) {
        // Fallback to text if logo not found
        console.warn('Logo not found, using text fallback:', logoError.message);
        doc
          .fontSize(24)
          .fillColor('#4285F4')
          .font('Helvetica-Bold')
          .text('CollabKaroo', margin, 45, { width: 250 });
      }

      // INVOICE title and number on the right
      doc
        .fontSize(24)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('INVOICE', pageWidth - 250, 45, { width: 200, align: 'right' })
        .fontSize(14)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text(invoiceData.invoiceNumber, pageWidth - 250, 73, {
          width: 200,
          align: 'right'
        });

      // Issued, Billed To, and From section
      const detailsStartY = 110;

      // Calculate positions for space-between layout
      const contentWidth = pageWidth - 2 * margin;
      const col1X = margin;
      const col2X = margin + contentWidth * 0.35; // ~35% from left
      const col3X = pageWidth - 250;

      // Issued
      doc
        .fontSize(11)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Issued', col1X, detailsStartY)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#374151')
        .text(new Date(invoiceData.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }), col1X, detailsStartY + 18);

      // Billed to
      doc
        .fontSize(11)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('Billed to', col2X, detailsStartY)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#374151')
        .text(invoiceData.influencer.name, col2X, detailsStartY + 18)
        .text(invoiceData.influencer.phone || 'N/A', col2X, detailsStartY + 35);

      // From section (Company details)
      doc
        .fontSize(11)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('From', col3X, detailsStartY)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#374151')
        .text('Deshanta Marketing Solutions Pvt. Ltd', col3X, detailsStartY + 18, { width: 200 })
        .text('Plot A-18, Manjeet farm', col3X, detailsStartY + 31, { width: 200 })
        .text('Uttam Nagar, Delhi', col3X, detailsStartY + 44, { width: 200 })
        .text('West Delhi, Delhi, 110059, IN', col3X, detailsStartY + 57, { width: 200 })
        .text('GSTIN – 07AACD5691K1ZB', col3X, detailsStartY + 70, { width: 200 });

      // Table header (added inch spacing between metadata and table)
      const tableTop = 252;
      const colPositions = {
        service: margin,
        qty: margin + 180,
        rate: margin + 250,
        hscCode: margin + 330,
        taxes: margin + 410
      };

      doc
        .fontSize(11)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text('Service', colPositions.service, tableTop)
        .text('Qty', colPositions.qty, tableTop)
        .text('Rate', colPositions.rate, tableTop)
        .text('HSC Code', colPositions.hscCode, tableTop)
        .text('Taxes', colPositions.taxes, tableTop);

      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(margin, tableTop + 18)
        .lineTo(pageWidth - margin, tableTop + 18)
        .stroke();

      // Table row
      let yPosition = tableTop + 30;
      const item = invoiceData.items[0];

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#374151')
        .text('Maxx membership- Creator', colPositions.service, yPosition)
        .text(String(item.quantity), colPositions.qty, yPosition)
        .text(`Rs. ${item.rate.toFixed(2)}`, colPositions.rate, yPosition)
        .text(String(item.hscCode || 'N/A'), colPositions.hscCode, yPosition)
        .text(`Rs. ${item.taxes.toFixed(2)}`, colPositions.taxes, yPosition);

      // Separator line
      yPosition += 40;
      doc
        .strokeColor('#E0E0E0')
        .lineWidth(0.5)
        .moveTo(margin, yPosition)
        .lineTo(pageWidth - margin, yPosition)
        .stroke();

      // Totals section
      yPosition += 20;
      const totalsX = pageWidth - 240;
      const totalsValueX = pageWidth - 100;

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#374151')
        .text('Subtotal', totalsX, yPosition)
        .text(`Rs. ${invoiceData.subtotal.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

      yPosition += 25;
      doc
        .text('Tax (0%)', totalsX, yPosition)
        .text(`Rs. ${invoiceData.tax.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

      yPosition += 25;
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(totalsX, yPosition - 5)
        .lineTo(pageWidth - margin, yPosition - 5)
        .stroke();

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#374151')
        .text('Total', totalsX, yPosition)
        .text(`Rs. ${invoiceData.total.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

      yPosition += 25;
      doc
        .fontSize(11)
        .fillColor('#4285F4')
        .font('Helvetica-Bold')
        .text('Amount due', totalsX, yPosition)
        .text(`Rs. ${invoiceData.total.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

      // Footer
      const footerY = doc.page.height - 100;

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Thank you', margin, footerY)
        .text('For Query and help,', margin, footerY + 18)
        .text('Computer Generated Invoice', pageWidth - 250, footerY, {
          align: 'right',
          width: 200
        })
        .text('contact.us@gobuybill.com', pageWidth - 250, footerY + 18, {
          align: 'right',
          width: 200
        });

      doc.end();
    });
  }

  /**
   * Regenerate PDF for existing invoice
   */
  async regenerateInvoicePDF(invoiceId: number, influencerId: number) {
    const invoice = await this.proInvoiceModel.findOne({
      where: {
        id: invoiceId,
        influencerId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.paymentStatus !== InvoiceStatus.PAID) {
      throw new BadRequestException('Can only generate PDF for paid invoices');
    }

    // Regenerate invoice PDF
    await this.generateInvoicePDF(invoiceId);

    // Fetch updated invoice
    const updatedInvoice = await this.proInvoiceModel.findByPk(invoiceId);

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
   * Get invoice details by ID
   */
  async getInvoiceDetails(invoiceId: number, influencerId: number) {
    const invoice = await this.proInvoiceModel.findOne({
      where: {
        id: invoiceId,
        influencerId,
      },
      include: [
        {
          model: ProSubscription,
          as: 'subscription',
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
      billingPeriod: {
        start: toIST(invoice.billingPeriodStart),
        end: toIST(invoice.billingPeriodEnd),
      },
      paymentStatus: invoice.paymentStatus,
      paidAt: toIST(invoice.paidAt),
      invoiceUrl: invoice.invoiceUrl,
      razorpayPaymentId: invoice.razorpayPaymentId,
      razorpayOrderId: invoice.razorpayOrderId,
    };
  }

  /**
   * Handle Razorpay webhook for payment and subscription events
   */
  async handleWebhook(event: string, payload: any) {
    try {
      console.log('==========================================');
      console.log('🔔 RAZORPAY WEBHOOK RECEIVED!');
      console.log('Event:', event);
      console.log('Timestamp:', new Date().toISOString());
      console.log('Payload:', JSON.stringify(payload, null, 2));
      console.log('==========================================');

      // Handle subscription events
      if (event.startsWith('subscription.')) {
        return await this.handleSubscriptionWebhook(event, payload);
      }

      // Handle payment events
      if (event.startsWith('payment.')) {
        return await this.handlePaymentWebhook(event, payload);
      }

      console.log(`Unhandled webhook event type: ${event}`);
      return { success: true, message: 'Event type not handled' };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle subscription-specific webhooks
   */
  private async handleSubscriptionWebhook(event: string, payload: any) {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) {
      return { success: false, message: 'No subscription data in payload' };
    }

    const razorpaySubscriptionId = subscriptionEntity.id;

    // Find subscription by Razorpay subscription ID
    const subscription = await this.proSubscriptionModel.findOne({
      where: { razorpaySubscriptionId },
    });

    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID: ${razorpaySubscriptionId}`);
      return { success: false, message: 'Subscription not found' };
    }

    console.log(`Processing subscription event ${event} for subscription ${subscription.id}`);

    switch (event) {
      case 'subscription.authenticated':
        // UPI mandate authenticated but payment delayed (when start_at is in future)
        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
          upiMandateStatus: 'authenticated',
          mandateAuthenticatedAt: createDatabaseDate(),
          autoRenew: true, // Enable auto-renewal after authentication
        });

        console.log(`✅ Subscription ${subscription.id} authenticated - first charge scheduled for future date`);
        break;

      case 'subscription.activated':
        // UPI mandate authenticated and first payment successful
        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
          upiMandateStatus: 'authenticated',
          mandateAuthenticatedAt: createDatabaseDate(),
          autoRenew: true, // Enable auto-renewal after first payment
        });

        // Update influencer's pro status
        await this.influencerModel.update(
          {
            isPro: true,
            proActivatedAt: createDatabaseDate(),
            proExpiresAt: subscription.currentPeriodEnd,
          },
          { where: { id: subscription.influencerId } },
        );

        // Check if invoice already exists (prevent duplicates from race conditions)
        const razorpayPaymentId = subscriptionEntity.notes?.razorpay_payment_id || subscriptionEntity.id;
        const existingActivationInvoice = await this.proInvoiceModel.findOne({
          where: {
            [Op.or]: [
              { razorpayPaymentId },
              {
                subscriptionId: subscription.id,
                paymentStatus: 'paid',
                billingPeriodStart: subscription.currentPeriodStart,
                billingPeriodEnd: subscription.currentPeriodEnd,
              },
            ],
          },
        });

        if (existingActivationInvoice) {
          console.log(`✅ Invoice already exists for this period: ${existingActivationInvoice.invoiceNumber}`);
        } else {
          // Create invoice for first payment
          const activationAmount = subscriptionEntity.amount || this.PRO_SUBSCRIPTION_AMOUNT;
          const activationInvoiceNumber = await this.generateInvoiceNumber(subscription.influencerId);

          const activationInvoice = await this.proInvoiceModel.create({
            invoiceNumber: activationInvoiceNumber,
            subscriptionId: subscription.id,
            influencerId: subscription.influencerId,
            amount: activationAmount,
            tax: 0,
            totalAmount: activationAmount,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            paymentStatus: 'paid',
            paymentMethod: 'razorpay',
            razorpayPaymentId: subscriptionEntity.notes?.razorpay_payment_id || subscriptionEntity.id,
            paidAt: createDatabaseDate(),
          });

          console.log(`✅ Subscription ${subscription.id} activated with invoice ${activationInvoice.invoiceNumber}`);

          // Generate PDF for newly created invoice
          try {
            await this.generateInvoicePDF(activationInvoice.id);
            console.log(`📄 Invoice PDF generated for activation: ${activationInvoice.invoiceNumber}`);
          } catch (pdfError) {
            console.error('Failed to generate activation invoice PDF:', pdfError);
          } 
        }
        break;

      case 'subscription.charged':
        // Recurring payment successful
        console.log(`💰 Subscription ${subscription.id} charged successfully`);

        // Check if invoice already exists (prevent duplicates from race conditions)
        const existingChargeInvoice = await this.proInvoiceModel.findOne({
          where: {
            [Op.or]: [
              { razorpayPaymentId: subscriptionEntity.payment_id },
              {
                subscriptionId: subscription.id,
                paymentStatus: 'paid',
                billingPeriodStart: subscription.currentPeriodStart,
                billingPeriodEnd: subscription.currentPeriodEnd,
              },
            ],
          },
        });

        if (existingChargeInvoice) {
          console.log(`✅ Invoice already exists for this period: ${existingChargeInvoice.invoiceNumber}`);
        } else {
          // Create invoice for this charge
          const chargeAmount = subscriptionEntity.amount || this.PRO_SUBSCRIPTION_AMOUNT;
          const invoiceNumber = await this.generateInvoiceNumber(subscription.influencerId);

          const newInvoice = await this.proInvoiceModel.create({
            invoiceNumber,
            subscriptionId: subscription.id,
            influencerId: subscription.influencerId,
            amount: chargeAmount,
            tax: 0,
            totalAmount: chargeAmount,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            paymentStatus: 'paid',
            paymentMethod: 'razorpay',
            razorpayPaymentId: subscriptionEntity.payment_id,
            paidAt: createDatabaseDate(),
          });

          console.log(`✅ Recurring charge invoice created: ${newInvoice.invoiceNumber}`);

          // Generate invoice PDF
          try {
            await this.generateInvoicePDF(newInvoice.id);
            console.log(`📄 Invoice PDF generated for recurring charge: ${newInvoice.invoiceNumber}`);
          } catch (pdfError) {
            console.error('Failed to generate recurring charge invoice PDF:', pdfError);
          }
        }

        // Update subscription period
        const newPeriodStart = createDatabaseDate();
        const newPeriodEnd = addDaysForDatabase(newPeriodStart, this.SUBSCRIPTION_DURATION_DAYS);

        await subscription.update({
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          nextBillingDate: newPeriodEnd,
          lastAutoChargeAttempt: createDatabaseDate(),
          autoChargeFailures: 0, // Reset failures on success
        });

        // Update influencer expiry
        await this.influencerModel.update(
          { proExpiresAt: newPeriodEnd },
          { where: { id: subscription.influencerId } },
        );

        break;

      case 'subscription.paused':
        await subscription.update({
          status: SubscriptionStatus.PAUSED,
          upiMandateStatus: 'paused',
        });
        console.log(`⏸️ Subscription ${subscription.id} paused via webhook`);
        break;

      case 'subscription.resumed':
        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
          upiMandateStatus: 'authenticated',
        });
        console.log(`▶️ Subscription ${subscription.id} resumed via webhook`);
        break;

      case 'subscription.cancelled':
        await subscription.update({
          status: SubscriptionStatus.CANCELLED,
          upiMandateStatus: 'cancelled',
          autoRenew: false,
          cancelledAt: createDatabaseDate(),
        });
        console.log(`❌ Subscription ${subscription.id} cancelled via webhook`);
        break;

      case 'subscription.pending':
        // Mandate created but not yet authenticated
        console.log(`⏳ Subscription ${subscription.id} pending authentication`);
        break;

      case 'subscription.halted':
        // Subscription halted due to payment failures
        await subscription.update({
          upiMandateStatus: 'paused',
        });
        console.log(`⚠️ Subscription ${subscription.id} halted due to payment issues`);
        break;

      default:
        console.log(`Unhandled subscription event: ${event}`);
    }

    return { success: true, message: 'Subscription webhook processed' };
  }

  /**
   * Handle payment-specific webhooks
   */
  private async handlePaymentWebhook(event: string, payload: any) {
    // Find the invoice by razorpayPaymentId or razorpayOrderId
    const invoice = await this.proInvoiceModel.findOne({
      where: {
        [Op.or]: [
          { razorpayPaymentId: payload.payment?.entity?.id },
          { razorpayOrderId: payload.payment?.entity?.order_id },
        ],
      },
    });

    if (!invoice) {
      console.log('Invoice not found for webhook payload');
      return { success: false, message: 'Invoice not found' };
    }

    // Store transaction record
    await this.proPaymentTransactionModel.create({
      invoiceId: invoice.id,
      subscriptionId: invoice.subscriptionId,
      influencerId: invoice.influencerId,
      transactionType: event,
      amount: payload.payment?.entity?.amount || 0,
      status: payload.payment?.entity?.status || 'unknown',
      razorpayPaymentId: payload.payment?.entity?.id,
      razorpayOrderId: payload.payment?.entity?.order_id,
      paymentMethod: payload.payment?.entity?.method || 'unknown',
      webhookData: payload,
      webhookEvent: event,
      processedAt: new Date(),
    } as any);

    // Handle different payment events
    switch (event) {
      case 'payment.captured':
        // Payment successful - already handled in verifyAndActivateSubscription
        console.log(`✅ Payment captured for invoice ${invoice.id}`);
        break;

      case 'payment.failed':
        await invoice.update({ paymentStatus: 'failed' });

        // Increment failure count for subscription
        const subscription = await this.proSubscriptionModel.findByPk(invoice.subscriptionId);
        if (subscription) {
          await subscription.update({
            status: SubscriptionStatus.PAYMENT_FAILED,
            lastAutoChargeAttempt: createDatabaseDate(),
            autoChargeFailures: subscription.autoChargeFailures + 1,
          });

          // If too many failures, pause the subscription
          if (subscription.autoChargeFailures >= 3) {
            console.error(`⚠️ Subscription ${subscription.id} has ${subscription.autoChargeFailures} failures, consider manual intervention`);
          }
        }

        console.log(`❌ Payment failed for invoice ${invoice.id}`);
        break;

      case 'payment.authorized':
        console.log(`🔓 Payment authorized for invoice ${invoice.id}`);
        break;

      default:
        console.log(`Unhandled payment event: ${event}`);
    }

    return { success: true, message: 'Payment webhook processed' };
  }

  /**
   * [TEST MODE ONLY] Activate subscription without payment
   * Use this for testing without real Razorpay plan
   */
  async activateTestSubscription(influencerId: number) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Test mode activation not allowed in production');
    }

    const influencer = await this.influencerModel.findByPk(influencerId); 
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Check if already has active subscription
    const existingActiveSubscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingActiveSubscription) {
      throw new BadRequestException('You already have an active Pro subscription');
    }

    // Create subscription record
    const startDate = createDatabaseDate();
    const endDate = addDaysForDatabase(startDate, this.SUBSCRIPTION_DURATION_DAYS);

    const subscription = await this.proSubscriptionModel.create({
      influencerId,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      nextBillingDate: endDate,
      subscriptionAmount: this.PRO_SUBSCRIPTION_AMOUNT,
      paymentMethod: PaymentMethod.RAZORPAY,
      autoRenew: true,
      razorpaySubscriptionId: `test_sub_${Date.now()}`, // Dummy subscription ID
    });

    // Create test invoice
    const invoiceNumber = await this.generateInvoiceNumber(influencerId);
    const invoice = await this.proInvoiceModel.create({
      invoiceNumber,
      subscriptionId: subscription.id,
      influencerId,
      amount: this.PRO_SUBSCRIPTION_AMOUNT,
      tax: 0,
      totalAmount: this.PRO_SUBSCRIPTION_AMOUNT,
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      paymentStatus: InvoiceStatus.PAID,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayPaymentId: `test_pay_${Date.now()}`,
      razorpayOrderId: `test_order_${Date.now()}`,
      paidAt: startDate,
    });

    // Update influencer isPro status
    await this.influencerModel.update(
      {
        isPro: true,
        proActivatedAt: startDate,
        proExpiresAt: endDate,
      },
      {
        where: { id: influencerId },
      },
    );

    // Generate invoice PDF
    await this.generateInvoicePDF(invoice.id);

    return {
      success: true,
      message: '🧪 Test subscription activated (NO PAYMENT REQUIRED)',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        validUntil: toIST(endDate),
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      warning: 'This is a TEST subscription. Use real payment in production.',
    };
  }

  /**
   * Check and expire subscriptions (run this as a cron job)
   */
  async checkAndExpireSubscriptions() {
    const now = createDatabaseDate();

    const expiredSubscriptions = await this.proSubscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: {
          $lt: now,
        },
      },
    });

    for (const subscription of expiredSubscriptions) {
      await subscription.update({
        status: SubscriptionStatus.EXPIRED,
      });

      // Update influencer isPro status
      await this.influencerModel.update(
        {
          isPro: false,
        },
        {
          where: { id: subscription.influencerId },
        },
      );

      console.log(`Expired subscription ${subscription.id} for influencer ${subscription.influencerId}`);
    }

    return {
      expiredCount: expiredSubscriptions.length,
    };
  }

  /**
   * Setup Autopay for Pro subscription (supports all payment methods)
   * User can choose UPI, Card, or any other available payment method at checkout
   */
  async setupAutopay(influencerId: number) {
    // Get influencer details
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    // Check if already has subscription (including cancelled ones with remaining Pro access)
    const existingSubscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: {
          [Op.in]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAYMENT_PENDING, SubscriptionStatus.CANCELLED],
        },
      },
      order: [['createdAt', 'DESC']], // Get the most recent subscription
    });

    // Allow restarting autopay if:
    // 1. Mandate is cancelled, OR
    // 2. autoRenew is false (autopay was cancelled)
    if (
      existingSubscription &&
      existingSubscription.razorpaySubscriptionId &&
      existingSubscription.upiMandateStatus !== 'cancelled' &&
      existingSubscription.autoRenew === true
    ) {
      throw new BadRequestException('You already have an active autopay subscription');
    }

    // Use existing Razorpay plan from environment
    const planId = this.configService.get<string>('RAZORPAY_PRO_PLAN_ID');

    if (!planId) {
      throw new BadRequestException(
        'RAZORPAY_PRO_PLAN_ID is not configured. Please run the setup endpoint to create a plan first.'
      );
    }

    // Check if influencer still has active Pro access from previous subscription
    const influencerData = await this.influencerModel.findByPk(influencerId);
    const now = createDatabaseDate();
    const hasActivePro = influencerData?.isPro && influencerData?.proExpiresAt && influencerData.proExpiresAt > now;

    // Create Autopay subscription in Razorpay (supports all payment methods)
    const influencerEmail = (influencer as any).email || `influencer${influencerId}@collabkaroo.com`;

    // Calculate start_at timestamp to delay first charge if user has active Pro
    let startAtTimestamp: number | undefined;
    if (hasActivePro && existingSubscription) {
      // Convert endDate to Unix timestamp (seconds, not milliseconds)
      const endDateTime = existingSubscription.currentPeriodEnd.getTime();
      startAtTimestamp = Math.floor(endDateTime / 1000);
      console.log(`⏰ Delaying first charge until current period ends: ${toIST(existingSubscription.currentPeriodEnd)}`);
    }

    const subscriptionResult = await this.razorpayService.createAutopaySubscription(
      planId,
      influencerId,
      influencer.name,
      influencer.phone,
      influencerEmail,
      {
        influencerId,
        subscriptionType: 'pro_account',
      },
      startAtTimestamp,
    );

    if (!subscriptionResult.success) {
      throw new BadRequestException(`Failed to create autopay subscription: ${subscriptionResult.error}`);
    }

    console.log('🔍 DEBUG - Double payment prevention check:', {
      influencerId,
      isPro: influencerData?.isPro,
      proExpiresAt: influencerData?.proExpiresAt ? toIST(influencerData.proExpiresAt) : null,
      currentTime: toIST(now),
      hasActivePro,
      hasExistingSubscription: !!existingSubscription,
      existingPeriodStart: existingSubscription ? toIST(existingSubscription.currentPeriodStart) : null,
      existingPeriodEnd: existingSubscription ? toIST(existingSubscription.currentPeriodEnd) : null,
    });

    // If user has active Pro, use existing period dates to avoid double charging
    // Otherwise, start a new billing period
    let startDate: Date;
    let endDate: Date;

    if (hasActivePro && existingSubscription) {
      // User already paid for current period - use existing period dates
      startDate = existingSubscription.currentPeriodStart;
      endDate = existingSubscription.currentPeriodEnd;
      console.log(`✅ Reusing existing billing period to avoid double charging (ends: ${toIST(endDate)})`);
    } else {
      // New billing period starts now
      startDate = now;
      endDate = addDaysForDatabase(startDate, this.SUBSCRIPTION_DURATION_DAYS);
      console.log(`📅 Starting new billing period (ends: ${toIST(endDate)})`);
    }

    let subscription;
    if (existingSubscription) {
      // Update existing subscription (clear old cancellation data if restarting)
      subscription = await existingSubscription.update({
        razorpaySubscriptionId: subscriptionResult.subscriptionId,
        upiMandateStatus: 'pending',
        mandateCreatedAt: now,
        autoRenew: false, // Will be set to true by webhook when mandate is authenticated
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        nextBillingDate: endDate,
        cancelledAt: null,
        cancelReason: null,
        status: hasActivePro ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAYMENT_PENDING,
      });
    } else {
      // Create new subscription
      subscription = await this.proSubscriptionModel.create({
        influencerId,
        status: SubscriptionStatus.PAYMENT_PENDING,
        startDate,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        nextBillingDate: endDate,
        subscriptionAmount: this.PRO_SUBSCRIPTION_AMOUNT,
        paymentMethod: 'razorpay',
        razorpaySubscriptionId: subscriptionResult.subscriptionId,
        upiMandateStatus: 'pending',
        mandateCreatedAt: now,
        autoRenew: false, // Only enable after first payment is successful
      });
    }

    // Get Razorpay key for frontend checkout
    const razorpayKey = this.configService.get<string>('RAZORPAY_KEY_ID');

    return {
      success: true,
      message: hasActivePro
        ? 'Autopay setup initiated. You will NOT be charged again for the current period. Next payment will be charged after your current Pro access expires.'
        : 'Autopay setup initiated. Choose your preferred payment method (UPI, Card, etc.) to complete setup.',
      subscription: {
        id: subscription.id,
        razorpaySubscriptionId: subscriptionResult.subscriptionId,
        status: subscription.status,
        mandateStatus: subscription.upiMandateStatus,
      },
      // Razorpay checkout data for in-app payment
      razorpayCheckout: {
        key: razorpayKey,
        subscription_id: subscriptionResult.subscriptionId,
        name: 'CollabKaroo Pro',
        description: 'Pro Subscription - Monthly Auto-Renewal',
        prefill: {
          name: influencer.name,
          contact: influencer.phone || '',
          email: '', // Influencers don't have email
        },
        notes: {
          influencer_id: influencerId,
          subscription_type: 'pro_monthly',
        },
        theme: {
          color: '#3399cc',
        },
      },
      // Deprecated: Keep for backward compatibility (can be removed later)
      paymentLink: subscriptionResult.paymentLink,
      currentPeriodEnd: hasActivePro ? toIST(endDate) : undefined,
      nextBillingDate: toIST(endDate),
      instructions: hasActivePro
        ? [
            '1. Complete the payment in-app to setup autopay',
            '2. Choose your preferred payment method (UPI, Card, NetBanking, etc.)',
            '3. No charge now - your existing Pro access will continue',
            `4. Next payment will be auto-charged on ${toIST(endDate)}`,
            '5. You can pause or cancel anytime',
          ]
        : [
            '1. Complete the payment in-app to setup autopay',
            '2. Choose your preferred payment method (UPI, Card, NetBanking, etc.)',
            '3. First payment will be charged immediately',
            '4. Subsequent payments will be auto-charged every 30 days',
            '5. You can pause or cancel anytime',
          ],
    };
  }

  /**
   * Pause subscription
   * Pauses after current billing cycle ends, then resumes after specified days
   */
  async pauseSubscription(influencerId: number, pauseDurationDays: number, reason?: string) {
    if (pauseDurationDays < 1 || pauseDurationDays > 365) {
      throw new BadRequestException('Pause duration must be between 1 and 365 days');
    }

    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    if (subscription.isPaused) {
      throw new BadRequestException('Subscription is already paused');
    }

    // Don't allow pausing if subscription was cancelled (even if status was manually changed to active)
    if (subscription.cancelledAt) {
      throw new BadRequestException(
        'Cannot pause a subscription that was cancelled. Please create a new subscription instead.',
      );
    }

    // Don't allow pausing if autoRenew is disabled
    if (!subscription.autoRenew) {
      throw new BadRequestException(
        'Cannot pause a subscription with auto-renewal disabled. Enable auto-renewal first.',
      );
    }

    // Calculate resume date: current period end + pause duration
    const pauseStartDate = subscription.currentPeriodEnd;
    const resumeDate = addDaysForDatabase(pauseStartDate, pauseDurationDays);

    // If using Razorpay subscription, pause it there too
    if (subscription.razorpaySubscriptionId) {
      // First, fetch the subscription status from Razorpay
      const subscriptionDetails = await this.razorpayService.getSubscription(
        subscription.razorpaySubscriptionId,
      );

      if (!subscriptionDetails.success) {
        throw new BadRequestException(
          `Failed to fetch subscription details from Razorpay: ${subscriptionDetails.error}`,
        );
      }

      const razorpayStatus = subscriptionDetails.data?.status;

      // Check if subscription is in a state that can be paused
      if (razorpayStatus === 'created') {
        throw new BadRequestException(
          'Cannot pause subscription yet. The first payment is pending. Please complete the first payment before pausing.',
        );
      }

      if (razorpayStatus !== 'active' && razorpayStatus !== 'authenticated') {
        throw new BadRequestException(
          `Cannot pause subscription. Current status: ${razorpayStatus}. Only active subscriptions can be paused.`,
        );
      }

      // Now attempt to pause
      const pauseResult = await this.razorpayService.pauseSubscription(
        subscription.razorpaySubscriptionId,
      );

      if (!pauseResult.success) {
        throw new BadRequestException(`Failed to pause in Razorpay: ${pauseResult.error}`);
      }
    }

    // Update subscription with pause details
    await subscription.update({
      isPaused: true,
      pausedAt: createDatabaseDate(),
      pauseStartDate: pauseStartDate,
      pauseDurationDays,
      resumeDate,
      pauseReason: reason,
      pauseCount: subscription.pauseCount + 1,
      totalPausedDays: subscription.totalPausedDays + pauseDurationDays,
    });

    return {
      success: true,
      message: `Subscription will pause after current billing cycle ends on ${toIST(pauseStartDate)}`,
      details: {
        currentPeriodEnds: toIST(subscription.currentPeriodEnd),
        pauseStartsOn: toIST(pauseStartDate),
        pauseDurationDays,
        autoResumeOn: toIST(resumeDate),
        nextBillingAfterResume: toIST(resumeDate),
      },
    };
  }

  /**
   * Resume paused subscription
   * Can be called manually or automatically by cron job
   */
  async resumeSubscription(influencerId: number, isAutoResume: boolean = false) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        isPaused: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('No paused subscription found');
    }

    // If manual resume, allow anytime
    // If auto resume, only resume if resume date has passed
    if (isAutoResume) {
      const now = createDatabaseDate();
      if (subscription.resumeDate && subscription.resumeDate > now) {
        throw new BadRequestException('Auto-resume date has not arrived yet');
      }
    }

    const now = createDatabaseDate();

    // Check if pause has started yet
    const pauseHasStarted = subscription.currentPeriodEnd <= now;

    // If pause hasn't started yet, keep original billing period
    // If pause has started, create a new billing period
    let newPeriodStart = now;
    let newPeriodEnd = addDaysForDatabase(now, this.SUBSCRIPTION_DURATION_DAYS);

    if (!pauseHasStarted) {
      // Pause hasn't started yet - keep original billing period
      newPeriodStart = subscription.currentPeriodStart;
      newPeriodEnd = subscription.currentPeriodEnd;
    }

    // Resume in Razorpay if using autopay
    if (subscription.razorpaySubscriptionId) {
      // First, fetch the subscription status from Razorpay
      const subscriptionDetails = await this.razorpayService.getSubscription(
        subscription.razorpaySubscriptionId,
      );

      if (!subscriptionDetails.success) {
        console.warn(
          `Failed to fetch Razorpay subscription details: ${subscriptionDetails.error}. Proceeding with local-only resume.`,
        );
      } else {
        const razorpayStatus = subscriptionDetails.data?.status;

        // If Razorpay subscription is cancelled or doesn't exist, just update local state
        if (razorpayStatus === 'cancelled' || razorpayStatus === 'completed') {
          console.warn(
            `Razorpay subscription is ${razorpayStatus}. Resuming locally only. User may need to create new subscription for future billing.`,
          );
          // Don't throw error - allow local resume
        } else if (razorpayStatus === 'paused') {
          // Now attempt to resume in Razorpay
          const resumeResult = await this.razorpayService.resumeSubscription(
            subscription.razorpaySubscriptionId,
          );

          if (!resumeResult.success) {
            throw new BadRequestException(`Failed to resume in Razorpay: ${resumeResult.error}`);
          }
        } else {
          // For other statuses (active, authenticated, etc), just update local state
          console.warn(
            `Razorpay subscription status is ${razorpayStatus}. Resuming locally.`,
          );
        }
      }
    }

    // Update subscription - clear all pause AND cancellation data
    await subscription.update({
      isPaused: false,
      pausedAt: null,
      pauseDurationDays: null,
      resumeDate: null,
      pauseReason: null,
      cancelledAt: null, // Clear cancellation when resuming
      cancelReason: null, // Clear cancel reason
      autoRenew: true, // Re-enable auto-renewal
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      nextBillingDate: newPeriodEnd,
      status: SubscriptionStatus.ACTIVE,
    });

    // Update influencer's pro status
    await this.influencerModel.update(
      {
        isPro: true,
        proActivatedAt: now,
        proExpiresAt: newPeriodEnd,
      },
      {
        where: { id: influencerId },
      },
    );

    const message = pauseHasStarted
      ? 'Subscription resumed successfully! Your new billing period has started.'
      : 'Pause cancelled successfully! Your subscription remains active with the original billing period.';

    return {
      success: true,
      message,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: toIST(newPeriodStart),
        currentPeriodEnd: toIST(newPeriodEnd),
        nextBillingDate: toIST(newPeriodEnd),
      },
    };
  }

  /**
   * Cancel autopay (but keep subscription active until period end)
   * Cancels the subscription in Razorpay at cycle end
   */
  async cancelAutopay(influencerId: number, reason?: string) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: {
          [Op.in]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED],
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    // Cancel in Razorpay (at cycle end to allow Pro access until period ends)
    if (subscription.razorpaySubscriptionId) {
      // First check the current status in Razorpay to avoid unnecessary API calls
      const subscriptionDetails = await this.razorpayService.getSubscription(
        subscription.razorpaySubscriptionId,
      );

      if (subscriptionDetails.success) {
        const razorpayStatus = subscriptionDetails.data?.status;

        // Only attempt to cancel if not already cancelled
        if (razorpayStatus !== 'cancelled' && razorpayStatus !== 'completed') {
          const cancelResult = await this.razorpayService.cancelSubscription(
            subscription.razorpaySubscriptionId,
            true, // cancelAtCycleEnd = true (allows Pro access until period ends)
          );

          if (!cancelResult.success) {
            console.error(
              'Failed to cancel in Razorpay:',
              cancelResult.error,
            );
            // Continue anyway to update local DB
          } else {
            console.log('✅ Razorpay subscription cancelled at cycle end');
          }
        } else {
          console.log(`✅ Razorpay subscription already ${razorpayStatus} - skipping cancellation`);
        }
      } else {
        console.warn('Failed to fetch Razorpay subscription status:', subscriptionDetails.error);
        // Try to cancel anyway
        const cancelResult = await this.razorpayService.cancelSubscription(
          subscription.razorpaySubscriptionId,
          true,
        );
        if (!cancelResult.success) {
          console.error('Failed to cancel in Razorpay:', cancelResult.error);
        }
      }
    }

    // Update subscription - mark as cancelled and clear pause data
    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      autoRenew: false,
      cancelledAt: createDatabaseDate(),
      cancelReason: reason,
      upiMandateStatus: UpiMandateStatus.CANCELLED,
      // Clear pause flags since cancellation overrides pause
      isPaused: false,
      pausedAt: null,
      pauseStartDate: null,
      pauseDurationDays: null,
      resumeDate: null,
      pauseReason: null,
    });

    return {
      success: true,
      message: 'Autopay cancelled. Your Pro access will remain active until the end of current billing period.',
      validUntil: toIST(subscription.currentPeriodEnd),
      note: 'You can setup autopay again anytime to continue Pro benefits.',
    };
  }

  /**
   * Check and auto-resume paused subscriptions (run as cron job)
   */
  async checkAndAutoResumeSubscriptions() {
    const now = createDatabaseDate();

    const subscriptionsToResume = await this.proSubscriptionModel.findAll({
      where: {
        isPaused: true,
        resumeDate: {
          [Op.lte]: now,
        },
      },
    });

    const results: Array<{
      subscriptionId: number;
      influencerId: number;
      success: boolean;
      message?: string;
      error?: string;
    }> = [];

    for (const subscription of subscriptionsToResume) {
      try {
        const result = await this.resumeSubscription(subscription.influencerId, true);
        results.push({
          subscriptionId: subscription.id,
          influencerId: subscription.influencerId,
          success: true,
          message: result.message,
        });
      } catch (error) {
        console.error(`Failed to auto-resume subscription ${subscription.id}:`, error);
        results.push({
          subscriptionId: subscription.id,
          influencerId: subscription.influencerId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      resumedCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    };
  }
}
