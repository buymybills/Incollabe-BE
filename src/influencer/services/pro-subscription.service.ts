import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProSubscription, SubscriptionStatus, PaymentMethod } from '../models/pro-subscription.model';
import { ProInvoice, InvoiceStatus } from '../models/pro-invoice.model';
import { ProPaymentTransaction, TransactionType, TransactionStatus } from '../models/pro-payment-transaction.model';
import { Influencer } from '../../auth/model/influencer.model';
import { RazorpayService } from '../../shared/razorpay.service';
import { S3Service } from '../../shared/s3.service';
import { Op } from 'sequelize';
import { toIST, createDatabaseDate, addDaysForDatabase } from '../../shared/utils/date.utils';
import PDFDocument from 'pdfkit';

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

    // Delete any old pending/failed subscriptions to avoid unique constraint violation
    await this.proSubscriptionModel.destroy({
      where: {
        influencerId,
        status: {
          [Op.in]: [SubscriptionStatus.PAYMENT_PENDING, SubscriptionStatus.PAYMENT_FAILED],
        },
      },
    });

    // Create subscription record with timezone-adjusted dates
    const startDate = createDatabaseDate();
    const endDate = addDaysForDatabase(startDate, this.SUBSCRIPTION_DURATION_DAYS);

    const subscription = await this.proSubscriptionModel.create({
      influencerId,
      status: SubscriptionStatus.PAYMENT_PENDING,
      startDate,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      nextBillingDate: endDate,
      subscriptionAmount: this.PRO_SUBSCRIPTION_AMOUNT,
      paymentMethod: PaymentMethod.RAZORPAY,
      autoRenew: true,
    });

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

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
    const subscription = await this.proSubscriptionModel.findOne({
      where: { influencerId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: ProInvoice,
          as: 'invoices',
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        isPro: false,
      };
    }

    return {
      hasSubscription: true,
      isPro: subscription.status === SubscriptionStatus.ACTIVE,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: toIST(subscription.startDate),
        currentPeriodStart: toIST(subscription.currentPeriodStart),
        currentPeriodEnd: toIST(subscription.currentPeriodEnd),
        nextBillingDate: toIST(subscription.nextBillingDate),
        amount: subscription.subscriptionAmount / 100, // Convert to Rs
        autoRenew: subscription.autoRenew,
      },
      invoices: subscription.invoices.map((inv) => ({
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
      })),
    };
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(influencerId: number, reason?: string) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      autoRenew: false,
      cancelledAt: createDatabaseDate(),
      cancelReason: reason,
    });

    return {
      success: true,
      message: 'Subscription cancelled. Pro access will remain active until the end of current billing period.',
      validUntil: toIST(subscription.currentPeriodEnd),
    };
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    // Get the latest invoice number for this month
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
      // Extract the number from the latest invoice (e.g., "INV-202512-00001" -> 1)
      const lastNumber = parseInt(latestInvoice.invoiceNumber.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
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

    // Store invoice data
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      influencer: {
        name: invoice.influencer.name,
        phone: invoice.influencer.phone,
      },
      items: [
        {
          description: 'Pro Account Subscription (30 days)',
          quantity: 1,
          rate: invoice.amount / 100,
          amount: invoice.amount / 100,
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
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .text('CollabKaroo', { align: 'center' })
        .fontSize(10)
        .text('Pro Subscription Invoice', { align: 'center' })
        .moveDown();

      // Invoice details
      doc
        .fontSize(12)
        .text(`Invoice Number: ${invoiceData.invoiceNumber}`, 50, 150)
        .text(`Date: ${new Date(invoiceData.date).toLocaleDateString('en-IN')}`, 50, 170)
        .moveDown();

      // Influencer details
      doc
        .fontSize(14)
        .text('Bill To:', 50, 210)
        .fontSize(10)
        .text(invoiceData.influencer.name, 50, 230)
        .text(invoiceData.influencer.phone, 50, 245)
        .moveDown();

      // Billing period
      doc
        .fontSize(12)
        .text('Billing Period:', 50, 280)
        .fontSize(10)
        .text(
          `From: ${new Date(invoiceData.billingPeriod.start).toLocaleDateString('en-IN')}`,
          50,
          300
        )
        .text(
          `To: ${new Date(invoiceData.billingPeriod.end).toLocaleDateString('en-IN')}`,
          50,
          315
        )
        .moveDown();

      // Table header
      const tableTop = 360;
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
          'Thank you for subscribing to CollabKaroo Pro!',
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
   * Handle Razorpay webhook for payment events
   */
  async handleWebhook(event: string, payload: any) {
    try {
      console.log(`Razorpay webhook received: ${event}`, payload);

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

      // Handle different events
      switch (event) {
        case 'payment.captured':
          // Payment successful - already handled in verifyAndActivateSubscription
          console.log(`Payment captured for invoice ${invoice.id}`);
          break;

        case 'payment.failed':
          await invoice.update({ paymentStatus: 'failed' });
          await this.proSubscriptionModel.update(
            { status: SubscriptionStatus.PAYMENT_FAILED },
            { where: { id: invoice.subscriptionId } },
          );
          break;

        case 'payment.authorized':
          console.log(`Payment authorized for invoice ${invoice.id}`);
          break;

        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // /**
  //  * [TEST MODE ONLY] Activate subscription without payment
  //  * Use this for testing without real Razorpay plan
  //  */
  // async activateTestSubscription(influencerId: number) {
  //   if (process.env.NODE_ENV === 'production') {
  //     throw new BadRequestException('Test mode activation not allowed in production');
  //   }

  //   const influencer = await this.influencerModel.findByPk(influencerId);
  //   if (!influencer) {
  //     throw new NotFoundException('Influencer not found');
  //   }

  //   // Check if already has active subscription
  //   const existingActiveSubscription = await this.proSubscriptionModel.findOne({
  //     where: {
  //       influencerId,
  //       status: SubscriptionStatus.ACTIVE,
  //     },
  //   });

  //   if (existingActiveSubscription) {
  //     throw new BadRequestException('You already have an active Pro subscription');
  //   }

  //   // Create subscription record
  //   const startDate = createDatabaseDate();
  //   const endDate = addDaysForDatabase(startDate, this.SUBSCRIPTION_DURATION_DAYS);

  //   const subscription = await this.proSubscriptionModel.create({
  //     influencerId,
  //     status: SubscriptionStatus.ACTIVE,
  //     startDate,
  //     currentPeriodStart: startDate,
  //     currentPeriodEnd: endDate,
  //     nextBillingDate: endDate,
  //     subscriptionAmount: this.PRO_SUBSCRIPTION_AMOUNT,
  //     paymentMethod: PaymentMethod.RAZORPAY,
  //     autoRenew: true,
  //     razorpaySubscriptionId: `test_sub_${Date.now()}`, // Dummy subscription ID
  //   });

  //   // Create test invoice
  //   const invoiceNumber = await this.generateInvoiceNumber();
  //   const invoice = await this.proInvoiceModel.create({
  //     invoiceNumber,
  //     subscriptionId: subscription.id,
  //     influencerId,
  //     amount: this.PRO_SUBSCRIPTION_AMOUNT,
  //     tax: 0,
  //     totalAmount: this.PRO_SUBSCRIPTION_AMOUNT,
  //     billingPeriodStart: startDate,
  //     billingPeriodEnd: endDate,
  //     paymentStatus: InvoiceStatus.PAID,
  //     paymentMethod: PaymentMethod.RAZORPAY,
  //     razorpayPaymentId: `test_pay_${Date.now()}`,
  //     razorpayOrderId: `test_order_${Date.now()}`,
  //     paidAt: startDate,
  //   });

  //   // Update influencer isPro status
  //   await this.influencerModel.update(
  //     {
  //       isPro: true,
  //       proActivatedAt: startDate,
  //       proExpiresAt: endDate,
  //     },
  //     {
  //       where: { id: influencerId },
  //     },
  //   );

  //   // Generate invoice PDF
  //   await this.generateInvoicePDF(invoice.id);

  //   return {
  //     success: true,
  //     message: '🧪 Test subscription activated (NO PAYMENT REQUIRED)',
  //     subscription: {
  //       id: subscription.id,
  //       status: subscription.status,
  //       validUntil: toIST(endDate),
  //     },
  //     invoice: {
  //       id: invoice.id,
  //       invoiceNumber: invoice.invoiceNumber,
  //     },
  //     warning: 'This is a TEST subscription. Use real payment in production.',
  //   };
  // }

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
}
