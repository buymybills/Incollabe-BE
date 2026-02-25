import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { ProSubscription, SubscriptionStatus, PaymentMethod, UpiMandateStatus } from '../models/pro-subscription.model';
import { ProInvoice, InvoiceStatus } from '../models/pro-invoice.model';
import { ProPaymentTransaction, TransactionType, TransactionStatus } from '../models/pro-payment-transaction.model';
import { Influencer } from '../../auth/model/influencer.model';
import { City } from '../../shared/models/city.model';
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
    @InjectModel(City)
    private cityModel: typeof City,
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

    // Get influencer with city information
    const influencerWithCity = await this.influencerModel.findByPk(influencerId, {
      include: [
        {
          model: this.cityModel,
          as: 'city',
        },
      ],
    });

    // Calculate taxes
    // Total = 19900 paise (Rs 199)
    // Base = 168.64 (in paise: 16864)
    // IGST = 30.35 (in paise: 3035)
    // CGST = 30.35/2 = 15.175 (in paise: 1518)
    // SGST = 30.35/2 = 15.175 (in paise: 1517)
    const totalAmount = this.PRO_SUBSCRIPTION_AMOUNT; // 19900 paise
    const baseAmount = 16864; // Rs 168.64 in paise

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;

    // Check if influencer location is Delhi
    const cityName = influencerWithCity?.city?.name?.toLowerCase();
    const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

    if (isDelhi) {
      // For Delhi: CGST and SGST (total tax = 3035 paise = Rs 30.35)
      cgst = 1518; // Rs 15.18
      sgst = 1517; // Rs 15.17 (total: 3035 paise)
      totalTax = cgst + sgst; // 3035
    } else {
      // For other locations: IGST
      igst = 3035; // Rs 30.35
      totalTax = igst;
    }

    // Create invoice with tax breakdown (invoice number will be generated after payment)
    let invoice;
    try {
      invoice = await this.proInvoiceModel.create({
        invoiceNumber: null, // Will be generated after successful payment
        subscriptionId: subscription.id,
        influencerId,
        amount: baseAmount,
        tax: totalTax,
        cgst,
        sgst,
        igst,
        totalAmount: totalAmount,
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

    // Create Razorpay order (total remains 199)
    const razorpayOrder = await this.razorpayService.createOrder(
      totalAmount / 100, // Amount in Rs (199)
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

    // Idempotency check - if already paid, return success (webhook may have processed it)
    if (invoice.paymentStatus === InvoiceStatus.PAID) {
      console.log(
        `✅ Invoice ${invoice.id} already verified and paid, returning existing data`,
      );

      return {
        success: true,
        message: 'Subscription already activated',
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

    const now = createDatabaseDate();

    // Calculate Pro expiry: payment date + 30 days
    const calculatedExpiry = new Date(now);
    calculatedExpiry.setDate(calculatedExpiry.getDate() + 30);

    console.log(
      `📅 Calculated Pro expiry: ${now.toISOString()} + 30 days = ${calculatedExpiry.toISOString()}`,
    );

    // Generate invoice number now that payment is successful
    const invoiceNumber = await this.generateInvoiceNumber(invoice.influencerId);

    // Update invoice
    await invoice.update({
      invoiceNumber,
      paymentStatus: InvoiceStatus.PAID,
      razorpayPaymentId: paymentId,
      paidAt: now,
    });

    // Update subscription with correct period end
    await subscription.update({
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: calculatedExpiry,
    });

    // Update influencer isPro status with calculated expiry
    await this.influencerModel.update(
      {
        isPro: true,
        proActivatedAt: now,
        proExpiresAt: calculatedExpiry,
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
    // Exclude cancelled invoices that were never paid
    const allInvoices = await this.proInvoiceModel.findAll({
      where: { influencerId },
      include: [
        {
          model: this.proSubscriptionModel,
          as: 'subscription',
          attributes: ['razorpaySubscriptionId', 'autoRenew'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Filter out cancelled invoices that were never paid
    const filteredInvoices = allInvoices.filter((inv) => {
      // Exclude cancelled invoices only if they were never paid
      if (inv.paymentStatus === InvoiceStatus.CANCELLED && !inv.paidAt) {
        return false;
      }
      return true;
    });

    // Check if subscription had any paid invoices (was ever active)
    const hadPaidInvoices = allInvoices.some((inv) => inv.paymentStatus === InvoiceStatus.PAID && inv.paidAt);

    // User has Pro access if:
    // 1. Subscription is ACTIVE, OR
    // 2. Subscription is CANCELLED but current period hasn't ended yet AND was actually paid, OR
    // 3. Subscription is PAUSED:
    //    - Before currentPeriodEnd: isPro = true (paid period, pause hasn't started)
    //    - After resumeDate: isPro = true (pause ended)
    //    - Between currentPeriodEnd and resumeDate: isPro = false (pause active)
    const now = createDatabaseDate();
    let isPro = false;

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      // Guard against cron not running: if the period has ended, treat as expired
      isPro = subscription.currentPeriodEnd > now;
    } else if (subscription.status === SubscriptionStatus.CANCELLED) {
      // Only give Pro access if subscription was actually paid AND current period hasn't ended
      isPro = hadPaidInvoices && subscription.currentPeriodEnd > now;
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

    // Don't count subscriptions in failed/inactive states as having a subscription
    // Also don't count cancelled subscriptions that were never paid
    // NOTE: payment_pending subscriptions SHOULD show subscription details (so user can resume payment)
    const hasSubscription = !(
      subscription.status === SubscriptionStatus.PAYMENT_FAILED ||
      subscription.status === SubscriptionStatus.INACTIVE ||
      (subscription.status === SubscriptionStatus.CANCELLED && !hadPaidInvoices)
    );

    // Calculate display status dynamically based on current time
    let displayStatus = subscription.status;

    // If active but period has ended (cron hasn't run yet), show as expired
    if (subscription.status === SubscriptionStatus.ACTIVE && subscription.currentPeriodEnd <= now) {
      displayStatus = SubscriptionStatus.EXPIRED;
    }
    // If cancelled and current period has ended, show as expired ONLY if it was paid at some point
    // If never paid, keep status as cancelled
    else if (subscription.status === SubscriptionStatus.CANCELLED && subscription.currentPeriodEnd <= now && hadPaidInvoices) {
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

    // Helper function to format status (remove underscores, convert to camelCase)
    const formatStatus = (status: string): string => {
      return status.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };

    // Don't return subscription details if it's cancelled and never paid
    // This prevents showing confusing subscription data for abandoned payment attempts
    const subscriptionData = hasSubscription ? {
      id: subscription.id,
      status: formatStatus(displayStatus),
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
      // Autopay can be true if autoRenew is enabled OR razorpaySubscriptionId exists
      isAutopay: subscription.autoRenew || !!subscription.razorpaySubscriptionId,
      subscriptionType: (subscription.autoRenew || subscription.razorpaySubscriptionId) ? 'autopay' : 'monthly',
    } : null;

    return {
      hasSubscription,
      isPro,
      subscription: subscriptionData,
      invoices: filteredInvoices.map((inv) => {
        // For autopay detection, check the invoice's subscription (not the latest subscription)
        // 1. Check if invoice's subscription has razorpaySubscriptionId (autopay enabled)
        // 2. For paid invoices, can also verify via razorpayPaymentId
        const invoiceSubscription = inv.subscription || subscription;
        const isAutopay = invoiceSubscription?.razorpaySubscriptionId ? true :
                          (inv.razorpayPaymentId ? inv.razorpayPaymentId.includes('sub_') : false);

        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.totalAmount / 100,
          status: formatStatus(inv.paymentStatus),
          billingPeriod: {
            start: toIST(inv.billingPeriodStart),
            end: toIST(inv.billingPeriodEnd),
          },
          paidAt: toIST(inv.paidAt),
          invoiceUrl: inv.invoiceUrl,
          paymentMethod: inv.paymentMethod,
          isAutopay,
          paymentType: isAutopay ? 'Autopay' : 'Monthly',
        };
      }),
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

    // Filter out cancelled invoices that were never paid
    const filteredInvoices = allInvoices.filter((inv) => {
      // Exclude cancelled invoices only if they were never paid
      if (inv.paymentStatus === InvoiceStatus.CANCELLED && !inv.paidAt) {
        return false;
      }
      return true;
    });

    if (!filteredInvoices || filteredInvoices.length === 0) {
      return {
        invoices: [],
        totalInvoices: 0,
      };
    }

    // Helper function to format status (remove underscores, convert to camelCase)
    const formatStatus = (status: string): string => {
      return status.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };

    return {
      invoices: filteredInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount / 100, // Convert to Rs
        status: formatStatus(inv.paymentStatus),
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
      totalInvoices: filteredInvoices.length,
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

    // Get influencer with city information for tax calculation
    const influencerWithCity = await this.influencerModel.findByPk(influencerId, {
      include: [
        {
          model: this.cityModel,
          as: 'city',
        },
      ],
    });

    // Calculate taxes based on location
    const totalAmount = this.PRO_SUBSCRIPTION_AMOUNT; // 19900 paise
    const baseAmount = 16864; // Rs 168.64 in paise

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;

    // Check if influencer location is Delhi
    const cityName = influencerWithCity?.city?.name?.toLowerCase();
    const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

    if (isDelhi) {
      // For Delhi: CGST and SGST (total tax = 3035 paise = Rs 30.35)
      cgst = 1518; // Rs 15.18
      sgst = 1517; // Rs 15.17 (total: 3035 paise)
      totalTax = cgst + sgst; // 3035
    } else {
      // For other locations: IGST
      igst = 3035; // Rs 30.35
      totalTax = igst;
    }

    // Create invoice
    const invoiceNumber = await this.generateInvoiceNumber(influencerId);
    const invoice = await this.proInvoiceModel.create({
      invoiceNumber,
      subscriptionId: subscription.id,
      influencerId,
      amount: baseAmount,
      tax: totalTax,
      cgst,
      sgst,
      igst,
      totalAmount: totalAmount,
      billingPeriodStart: subscription.currentPeriodStart,
      billingPeriodEnd: subscription.currentPeriodEnd,
      paymentStatus: InvoiceStatus.PAID,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayPaymentId: subscription.razorpaySubscriptionId || `manual_${Date.now()}`,
      paidAt: createDatabaseDate(),
    });

    console.log(`✅ Manual invoice created: ${invoice.invoiceNumber} (CGST: ${cgst}, SGST: ${sgst}, IGST: ${igst})`);

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
   * Cancel pending payment subscription
   * This is useful for cleaning up orphaned payment_pending subscriptions
   * that were created with old/invalid payment gateway configurations
   */
  async cancelPendingSubscription(influencerId: number, reason?: string) {
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.PAYMENT_PENDING,
      },
      include: [
        {
          model: ProInvoice,
          as: 'invoices',
          where: { paymentStatus: InvoiceStatus.PENDING },
          required: false,
        },
      ],
    });

    if (!subscription) {
      throw new NotFoundException('No pending subscription found for this influencer');
    }

    // Update subscription to cancelled
    await subscription.update({
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: createDatabaseDate(),
      cancelReason: reason || 'Pending payment cancelled - gateway configuration issue',
    });

    // Cancel any pending invoices
    if (subscription.invoices && subscription.invoices.length > 0) {
      await this.proInvoiceModel.update(
        {
          paymentStatus: InvoiceStatus.CANCELLED,
          updatedAt: createDatabaseDate(),
        },
        {
          where: {
            subscriptionId: subscription.id,
            paymentStatus: InvoiceStatus.PENDING,
          },
        },
      );
    }

    console.log(`✅ Cancelled pending subscription ${subscription.id} for influencer ${influencerId}`);

    return {
      success: true,
      message: 'Pending subscription cancelled successfully. You can now create a new subscription.',
      cancelledSubscriptionId: subscription.id,
    };
  }

  /**
   * Resume pending payment for an incomplete subscription
   * Returns existing payment order details so user can complete payment
   */
  async resumePendingPayment(influencerId: number) {
    // Find pending subscription with invoice
    const subscription = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.PAYMENT_PENDING,
      },
      include: [
        {
          model: ProInvoice,
          as: 'invoices',
          where: { paymentStatus: InvoiceStatus.PENDING },
          required: true,
        },
      ],
    });

    if (!subscription) {
      throw new NotFoundException(
        'No pending payment found. Please create a new subscription.'
      );
    }

    const invoice = subscription.invoices[0];

    // Check if Razorpay order exists
    if (!invoice.razorpayOrderId) {
      throw new BadRequestException(
        'Payment order not found. Please cancel and create a new subscription.'
      );
    }

    // Get influencer details
    const influencer = await this.influencerModel.findByPk(influencerId);
    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    console.log(`📱 Resuming pending payment for influencer ${influencerId}, subscription ${subscription.id}`);

    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: toIST(subscription.startDate),
        endDate: toIST(subscription.currentPeriodEnd),
        amount: subscription.subscriptionAmount,
        createdAt: toIST(subscription.createdAt),
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
        status: invoice.paymentStatus,
      },
      payment: {
        orderId: invoice.razorpayOrderId,
        amount: invoice.totalAmount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
      },
      message: 'Complete this pending payment or cancel it to create a new subscription.',
    };
  }

  /**
   * Generate unique invoice number for Max influencer
   * Format: MAXXINV-YYYYMM-SEQ
   * Example: MAXXINV-202601-1 (1st invoice in Jan 2026)
   */
  /**
   * Generate unique invoice number for Pro Subscription
   * Format: INV-UYYMM-SEQ
   * Example: INV-U2602-1 (1st invoice in Feb 2026)
   */
  private async generateInvoiceNumber(influencerId: number): Promise<string> {
    const year = String(new Date().getFullYear()).slice(-2);
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    const currentPrefix = `INV-U${yearMonth}-`;

    // Legacy format for continuity
    const legacyPrefix = `MAXXINV-20${yearMonth}-`;

    const [currentInvoices, legacyInvoices] = await Promise.all([
      this.proInvoiceModel.findAll({
        where: { invoiceNumber: { [Op.like]: `${currentPrefix}%` } },
        attributes: ['invoiceNumber'],
      }),
      this.proInvoiceModel.findAll({
        where: { invoiceNumber: { [Op.like]: `${legacyPrefix}%` } },
        attributes: ['invoiceNumber'],
      }),
    ]);

    let nextNumber = 1;

    // Current format: INV-U2602-<seq>  → parts[2]
    for (const inv of currentInvoices) {
      const n = parseInt(inv.invoiceNumber.split('-')[2], 10);
      if (!isNaN(n)) nextNumber = Math.max(nextNumber, n + 1);
    }

    // Legacy format: MAXXINV-202602-<seq>  → parts[2]
    for (const inv of legacyInvoices) {
      const n = parseInt(inv.invoiceNumber.split('-')[2], 10);
      if (!isNaN(n)) nextNumber = Math.max(nextNumber, n + 1);
    }

    return `${currentPrefix}${nextNumber}`;
  }

  /**
   * Generate invoice PDF and upload to S3
   */
  private async generateInvoicePDF(invoiceId: number) {
    const invoice = await this.proInvoiceModel.findByPk(invoiceId, {
      include: [
        {
          model: Influencer,
          as: 'influencer',
          include: [
            {
              model: this.cityModel,
              as: 'city',
            },
          ],
        },
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

    // Format location as "City, State"
    const city = (invoice.influencer as any).city;
    const cityName = city?.name || '';
    const stateName = city?.state || '';
    const location = cityName && stateName
      ? `${cityName}, ${stateName}`
      : cityName || stateName || 'N/A';

    // Store invoice data with tax breakdown
    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.paidAt || invoice.createdAt,
      influencer: {
        name: invoice.influencer.name,
        phone: decryptedPhone || 'N/A',
        location: location,
      },
      items: [
        {
          description: 'Maxx Subscription - Creator',
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
        .text('Depshanta Marketing Solutions Pvt. Ltd', col3X, detailsStartY + 18, { width: 200 })
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
        .text('Maxx Subscription - Creator', colPositions.service, yPosition)
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

      // Show tax breakdown based on whether it's Delhi (CGST+SGST) or other location (IGST)
      const hasIgst = invoiceData.igst && invoiceData.igst > 0;
      const hasCgstSgst = (invoiceData.cgst && invoiceData.cgst > 0) || (invoiceData.sgst && invoiceData.sgst > 0);

      if (hasCgstSgst) {
        // For Delhi: Show CGST and SGST
        doc
          .text('CGST (9%)', totalsX, yPosition)
          .text(`Rs. ${invoiceData.cgst.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });

        yPosition += 25;
        doc
          .text('SGST (9%)', totalsX, yPosition)
          .text(`Rs. ${invoiceData.sgst.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });
      } else if (hasIgst) {
        // For other locations: Show IGST
        doc
          .text('IGST (18%)', totalsX, yPosition)
          .text(`Rs. ${invoiceData.igst.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });
      } else {
        // Fallback: Show total tax (for backward compatibility)
        doc
          .text('Tax (18%)', totalsX, yPosition)
          .text(`Rs. ${invoiceData.tax.toFixed(2)}`, totalsValueX, yPosition, { align: 'right', width: 80 });
      }

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

      // Location in footer (above Thank you)
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Location', margin, footerY - 50)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#6b7280')
        .text(invoiceData.influencer.location || 'N/A', margin, footerY - 32);

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
        .text('contact.us@collabkaroo.com', pageWidth - 250, footerY + 18, {
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

        // NOTE: Don't update influencer Pro status here
        // It will be updated by subscription.charged event which fires after this
        // This prevents duplicate updates on first payment

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
          // Get influencer with city information for tax calculation
          const influencerWithCity = await this.influencerModel.findByPk(subscription.influencerId, {
            include: [
              {
                model: this.cityModel,
                as: 'city',
              },
            ],
          });

          // Calculate taxes based on location
          const totalAmount = this.PRO_SUBSCRIPTION_AMOUNT; // 19900 paise
          const baseAmount = 16864; // Rs 168.64 in paise

          let cgst = 0;
          let sgst = 0;
          let igst = 0;
          let totalTax = 0;

          // Check if influencer location is Delhi
          const cityName = influencerWithCity?.city?.name?.toLowerCase();
          const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

          if (isDelhi) {
            // For Delhi: CGST and SGST (total tax = 3035 paise = Rs 30.35)
            cgst = 1518; // Rs 15.18
            sgst = 1517; // Rs 15.17 (total: 3035 paise)
            totalTax = cgst + sgst; // 3035
          } else {
            // For other locations: IGST
            igst = 3035; // Rs 30.35
            totalTax = igst;
          }

          const activationInvoiceNumber = await this.generateInvoiceNumber(subscription.influencerId);

          // Get payment ID from payload
          const activationPaymentId = payload.payment?.entity?.id;

          const activationInvoice = await this.proInvoiceModel.create({
            invoiceNumber: activationInvoiceNumber,
            subscriptionId: subscription.id,
            influencerId: subscription.influencerId,
            amount: baseAmount,
            tax: totalTax,
            cgst,
            sgst,
            igst,
            totalAmount: totalAmount,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            paymentStatus: 'paid',
            paymentMethod: 'razorpay',
            razorpayPaymentId: activationPaymentId, // Use payment ID from payload
            paidAt: createDatabaseDate(),
          });

          console.log(`✅ Subscription ${subscription.id} activated with invoice ${activationInvoice.invoiceNumber} (CGST: ${cgst}, SGST: ${sgst}, IGST: ${igst})`);

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

        // Get payment ID from payload (it's in payment.entity, not subscription.entity)
        const chargedPaymentId = payload.payment?.entity?.id;

        // Check if this is the first payment (already handled by subscription.activated)
        const paidCount = subscriptionEntity.paid_count || 0;

        if (paidCount === 1) {
          console.log(`✅ First payment - invoice already created by subscription.activated webhook, skipping`);
          break;
        }

        console.log(`📋 Recurring payment (payment ${paidCount}), creating invoice...`);

        // Build query conditions dynamically
        const orConditions: any[] = [
          {
            subscriptionId: subscription.id,
            paymentStatus: 'paid',
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
          },
        ];

        if (chargedPaymentId) {
          orConditions.push({ razorpayPaymentId: chargedPaymentId });
        }

        // Check if invoice already exists (prevent duplicates from race conditions)
        const existingChargeInvoice = await this.proInvoiceModel.findOne({
          where: {
            [Op.or]: orConditions,
          },
        });

        if (existingChargeInvoice) {
          console.log(`✅ Invoice already exists for this period: ${existingChargeInvoice.invoiceNumber}`);
        } else {
          // Get influencer with city information for tax calculation
          const influencerWithCity = await this.influencerModel.findByPk(subscription.influencerId, {
            include: [
              {
                model: this.cityModel,
                as: 'city',
              },
            ],
          });

          // Calculate taxes based on location
          // Total = 19900 paise (Rs 199)
          // Base = 168.64 (in paise: 16864)
          // IGST = 30.35 (in paise: 3035)
          // CGST = 30.35/2 = 15.175 (in paise: 1518)
          // SGST = 30.35/2 = 15.175 (in paise: 1517)
          const totalAmount = this.PRO_SUBSCRIPTION_AMOUNT; // 19900 paise
          const baseAmount = 16864; // Rs 168.64 in paise

          let cgst = 0;
          let sgst = 0;
          let igst = 0;
          let totalTax = 0;

          // Check if influencer location is Delhi
          const cityName = influencerWithCity?.city?.name?.toLowerCase();
          const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

          if (isDelhi) {
            // For Delhi: CGST and SGST (total tax = 3035 paise = Rs 30.35)
            cgst = 1518; // Rs 15.18
            sgst = 1517; // Rs 15.17 (total: 3035 paise)
            totalTax = cgst + sgst; // 3035
          } else {
            // For other locations: IGST
            igst = 3035; // Rs 30.35
            totalTax = igst;
          }

          const invoiceNumber = await this.generateInvoiceNumber(subscription.influencerId);

          const newInvoice = await this.proInvoiceModel.create({
            invoiceNumber,
            subscriptionId: subscription.id,
            influencerId: subscription.influencerId,
            amount: baseAmount,
            tax: totalTax,
            cgst,
            sgst,
            igst,
            totalAmount: totalAmount,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            paymentStatus: 'paid',
            paymentMethod: 'razorpay',
            razorpayPaymentId: chargedPaymentId, // Use payment ID from payload
            paidAt: createDatabaseDate(),
          });

          console.log(`✅ Recurring charge invoice created: ${newInvoice.invoiceNumber} (CGST: ${cgst}, SGST: ${sgst}, IGST: ${igst})`);

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

        // Update influencer expiry and ensure Pro status is enabled
        // Only set proActivatedAt if it's not already set (first payment)
        const influencer = await this.influencerModel.findByPk(subscription.influencerId, {
          attributes: ['proActivatedAt'],
        });

        const updateData: any = {
          isPro: true,
          proExpiresAt: newPeriodEnd,
        };

        // Set activation timestamp only on first payment
        if (!influencer?.proActivatedAt) {
          updateData.proActivatedAt = createDatabaseDate();
        }

        await this.influencerModel.update(
          updateData,
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
    // Skip events that don't have actual payment data (like payment.downtime.*)
    if (!payload.payment?.entity?.id && !payload.payment?.entity?.order_id) {
      console.log(`⏭️ Skipping ${event} - not a payment transaction event`);
      return { success: true, message: 'Event type not applicable to invoices' };
    }

    // Try to find invoice by payment ID or order ID first
    let invoice = await this.proInvoiceModel.findOne({
      where: {
        [Op.or]: [
          { razorpayPaymentId: payload.payment?.entity?.id },
          { razorpayOrderId: payload.payment?.entity?.order_id },
        ],
      },
    });

    // If not found and this is an autopay payment (has subscription_id), find by subscription
    if (!invoice && payload.payment?.entity?.subscription_id) {
      console.log(
        `📋 Invoice not found by payment/order ID, searching by subscription ID: ${payload.payment.entity.subscription_id}`,
      );

      // Find subscription by Razorpay subscription ID
      const subscription = await this.proSubscriptionModel.findOne({
        where: { razorpaySubscriptionId: payload.payment.entity.subscription_id },
      });

      if (subscription) {
        // Find the most recent PENDING or CANCELLED invoice for this subscription
        // This handles cases where payment was captured but webhook processing failed
        invoice = await this.proInvoiceModel.findOne({
          where: {
            subscriptionId: subscription.id,
            paymentStatus: { [Op.in]: [InvoiceStatus.PENDING, 'cancelled'] },
          },
          order: [['createdAt', 'DESC']], // Get the most recent one
        });

        if (invoice) {
          console.log(
            `✅ Found invoice ${invoice.id} via subscription ${subscription.id} (status: ${invoice.paymentStatus})`,
          );
        } else {
          // FALLBACK: No invoice found - create one from payment.captured webhook
          // This handles BOTH first payments (when subscription.activated missed) AND recurring payments (when subscription.charged missed)
          console.log(
            `⚠️ No invoice found for subscription ${subscription.id}, creating invoice from payment.captured webhook...`,
          );

          // Check if this is a first payment or recurring payment
          const existingInvoiceCount = await this.proInvoiceModel.count({
            where: {
              subscriptionId: subscription.id,
              paymentStatus: InvoiceStatus.PAID,
            },
          });

          const isFirstPayment = existingInvoiceCount === 0;
          console.log(
            isFirstPayment
              ? `🆕 First payment detected - subscription.activated webhook was missed`
              : `🔄 Recurring payment detected (${existingInvoiceCount} previous invoices) - subscription.charged webhook was missed`,
          );

            // Get influencer with city information for tax calculation
            const influencerWithCity = await this.influencerModel.findByPk(
              subscription.influencerId,
              {
                include: [
                  {
                    model: this.cityModel,
                    as: 'city',
                  },
                ],
              },
            );

            // Calculate taxes based on location
            const totalAmount = this.PRO_SUBSCRIPTION_AMOUNT; // 19900 paise
            const baseAmount = 16864; // Rs 168.64 in paise

            let cgst = 0;
            let sgst = 0;
            let igst = 0;
            let totalTax = 0;

            // Check if influencer location is Delhi
            const cityName = influencerWithCity?.city?.name?.toLowerCase();
            const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

            if (isDelhi) {
              // For Delhi: CGST and SGST (total tax = 3035 paise = Rs 30.35)
              cgst = 1518; // Rs 15.18
              sgst = 1517; // Rs 15.17 (total: 3035 paise)
              totalTax = cgst + sgst; // 3035
            } else {
              // For other locations: IGST
              igst = 3035; // Rs 30.35
              totalTax = igst;
            }

            // Calculate billing period (payment date + 30 days)
            const paymentDate = payload.payment?.entity?.created_at
              ? new Date(payload.payment.entity.created_at * 1000)
              : createDatabaseDate();
            const periodEnd = new Date(paymentDate);
            periodEnd.setDate(periodEnd.getDate() + 30);

            const invoiceNumber = await this.generateInvoiceNumber(subscription.influencerId);

            // Create invoice for recurring payment
            invoice = await this.proInvoiceModel.create({
              invoiceNumber,
              subscriptionId: subscription.id,
              influencerId: subscription.influencerId,
              amount: baseAmount,
              tax: totalTax,
              cgst,
              sgst,
              igst,
              totalAmount: totalAmount,
              billingPeriodStart: paymentDate,
              billingPeriodEnd: periodEnd,
              paymentStatus: InvoiceStatus.PENDING, // Will be marked as PAID by payment.captured handler below
              paymentMethod: 'razorpay',
              razorpayPaymentId: payload.payment?.entity?.id,
            });

            // Update subscription period
            await subscription.update({
              currentPeriodStart: paymentDate,
              currentPeriodEnd: periodEnd,
              nextBillingDate: periodEnd,
            });

            console.log(
              `✅ Created invoice ${invoice.invoiceNumber} (${invoice.id}) from payment.captured webhook (${isFirstPayment ? 'first payment' : 'recurring payment'}) (CGST: ${cgst}, SGST: ${sgst}, IGST: ${igst})`,
            );
        }
      }
    }

    if (!invoice) {
      console.log('❌ Invoice not found for webhook payload');
      console.log('Payment ID:', payload.payment?.entity?.id);
      console.log('Order ID:', payload.payment?.entity?.order_id);
      console.log('Subscription ID:', payload.payment?.entity?.subscription_id);
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
        try {
          // Find subscription
          const capturedSubscription = await this.proSubscriptionModel.findByPk(
            invoice.subscriptionId,
          );

          if (!capturedSubscription) {
            console.error(`❌ Subscription not found for invoice ${invoice.id}`);
            break;
          }

          // Idempotency check - prevent duplicate processing
          if (invoice.paymentStatus === InvoiceStatus.PAID) {
            console.log(
              `✅ Invoice ${invoice.id} already processed as PAID, skipping duplicate webhook`,
            );
            break;
          }

          console.log(`💰 Processing payment.captured for invoice ${invoice.id}`);

          const now = createDatabaseDate();

          // Calculate Pro expiry: payment date + 30 days (not subscription.currentPeriodEnd which may be wrong)
          const paymentDate = payload.payment?.entity?.created_at
            ? new Date(payload.payment.entity.created_at * 1000)
            : now;
          const calculatedExpiry = new Date(paymentDate);
          calculatedExpiry.setDate(calculatedExpiry.getDate() + 30);

          console.log(
            `📅 Calculated Pro expiry: ${paymentDate.toISOString()} + 30 days = ${calculatedExpiry.toISOString()}`,
          );

          // Generate invoice number if not present
          let invoiceNumber = invoice.invoiceNumber;
          if (!invoiceNumber) {
            invoiceNumber = await this.generateInvoiceNumber(invoice.influencerId);
          }

          // Update invoice to PAID
          await invoice.update({
            invoiceNumber,
            paymentStatus: InvoiceStatus.PAID,
            razorpayPaymentId: payload.payment?.entity?.id,
            paidAt: now,
          });

          console.log(`✅ Invoice ${invoice.id} marked as PAID`);

          // Update subscription status and period end
          // FIX: Also activate if status is PAYMENT_FAILED (race condition from payment.failed webhook)
          if (
            capturedSubscription.status === SubscriptionStatus.PAYMENT_PENDING ||
            capturedSubscription.status === SubscriptionStatus.PAYMENT_FAILED ||
            capturedSubscription.status === SubscriptionStatus.EXPIRED
          ) {
            await capturedSubscription.update({
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: paymentDate,
              currentPeriodEnd: calculatedExpiry, // Fix period end to correct value
            });
            console.log(`✅ Subscription ${capturedSubscription.id} activated (was ${capturedSubscription.status}) with period end ${calculatedExpiry.toISOString()}`);
          } else {
            // Even if not pending, update the period end to correct value
            await capturedSubscription.update({
              currentPeriodEnd: calculatedExpiry,
            });
            console.log(`✅ Subscription ${capturedSubscription.id} period end updated to ${calculatedExpiry.toISOString()}`);
          }

          // Update influencer Pro status with calculated expiry
          await this.influencerModel.update(
            {
              isPro: true,
              proActivatedAt: now,
              proExpiresAt: calculatedExpiry, // Use calculated expiry, not subscription.currentPeriodEnd
            },
            { where: { id: invoice.influencerId } },
          );

          console.log(
            `✅ Pro access granted to influencer ${invoice.influencerId} until ${calculatedExpiry.toISOString()}`,
          );

          // Generate invoice PDF
          try {
            await this.generateInvoicePDF(invoice.id);
            console.log(
              `📄 Invoice PDF generated for payment.captured: ${invoiceNumber}`,
            );
          } catch (pdfError) {
            console.error('Failed to generate invoice PDF:', pdfError);
            // Don't fail the webhook if PDF generation fails
          }

          console.log(
            `✅ Payment captured successfully processed for invoice ${invoice.id} (${invoiceNumber})`,
          );
        } catch (error) {
          console.error(`❌ Error processing payment.captured for invoice ${invoice.id}:`, error);
          console.error(error.stack);
          console.error('📋 Invoice details:', {
            invoiceId: invoice.id,
            influencerId: invoice.influencerId,
            subscriptionId: invoice.subscriptionId,
            paymentStatus: invoice.paymentStatus,
            razorpayPaymentId: payload.payment?.entity?.id,
          });
          // Don't throw - return success to Razorpay to prevent retries
          // Reconciliation cron will catch this later
          // TODO: Consider sending alert to monitoring service
        }
        break;

      case 'payment.failed':
        // FIX: Don't overwrite if invoice is already PAID (race condition protection)
        if (invoice.paymentStatus === InvoiceStatus.PAID) {
          console.log(
            `⚠️ Ignoring payment.failed for invoice ${invoice.id} - already marked as PAID (likely race condition with payment.captured)`,
          );
          break;
        }

        await invoice.update({ paymentStatus: 'failed' });

        // Increment failure count for subscription
        const subscription = await this.proSubscriptionModel.findByPk(invoice.subscriptionId);
        if (subscription) {
          // Don't mark as failed if already active (payment might have succeeded)
          if (subscription.status !== SubscriptionStatus.ACTIVE) {
            await subscription.update({
              status: SubscriptionStatus.PAYMENT_FAILED,
              lastAutoChargeAttempt: createDatabaseDate(),
              autoChargeFailures: subscription.autoChargeFailures + 1,
            });

            // If too many failures, pause the subscription
            if (subscription.autoChargeFailures >= 3) {
              console.error(`⚠️ Subscription ${subscription.id} has ${subscription.autoChargeFailures} failures, consider manual intervention`);
            }
          } else {
            console.log(
              `ℹ️ Subscription ${subscription.id} is already ACTIVE, not marking as failed`,
            );
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

    // Get influencer with city information for tax calculation
    const influencerWithCity = await this.influencerModel.findByPk(influencerId, {
      include: [
        {
          model: this.cityModel,
          as: 'city',
        },
      ],
    });

    // Calculate taxes based on location
    const totalAmount = this.PRO_SUBSCRIPTION_AMOUNT; // 19900 paise
    const baseAmount = 16864; // Rs 168.64 in paise

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;

    // Check if influencer location is Delhi
    const cityName = influencerWithCity?.city?.name?.toLowerCase();
    const isDelhi = cityName === 'delhi' || cityName === 'new delhi';

    if (isDelhi) {
      // For Delhi: CGST and SGST (total tax = 3035 paise = Rs 30.35)
      cgst = 1518; // Rs 15.18
      sgst = 1517; // Rs 15.17 (total: 3035 paise)
      totalTax = cgst + sgst; // 3035
    } else {
      // For other locations: IGST
      igst = 3035; // Rs 30.35
      totalTax = igst;
    }

    // Create test invoice
    const invoiceNumber = await this.generateInvoiceNumber(influencerId);
    const invoice = await this.proInvoiceModel.create({
      invoiceNumber,
      subscriptionId: subscription.id,
      influencerId,
      amount: baseAmount,
      tax: totalTax,
      cgst,
      sgst,
      igst,
      totalAmount: totalAmount,
      billingPeriodStart: startDate,
      billingPeriodEnd: endDate,
      paymentStatus: InvoiceStatus.PAID,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayPaymentId: `test_pay_${Date.now()}`,
      razorpayOrderId: `test_order_${Date.now()}`,
      paidAt: startDate,
    });

    console.log(`✅ Test invoice created: ${invoice.invoiceNumber} (CGST: ${cgst}, SGST: ${sgst}, IGST: ${igst})`);

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
    // Use new Date() for proper UTC comparison with database dates
    const now = new Date();

    console.log(`🔍 Checking for expired Pro subscriptions at ${now.toISOString()}`);
    console.log(`📊 Query: SELECT * FROM influencer WHERE isPro = true AND proExpiresAt < '${now.toISOString()}'`);

    // First, let's see ALL Pro users regardless of expiry
    const allProUsers = await this.influencerModel.findAll({
      where: {
        isPro: true,
      },
      attributes: ['id', 'username', 'proExpiresAt'],
      limit: 10,
    });

    console.log(`📈 Total Pro users: ${allProUsers.length}`);
    allProUsers.forEach(user => {
      const isExpired = user.proExpiresAt && user.proExpiresAt < now;
      console.log(`  - User ${user.id} (${user.username}): proExpiresAt = ${user.proExpiresAt?.toISOString()}, expired? ${isExpired}`);
    });

    // Step 1: Find all influencers with isPro = true but proExpiresAt has passed
    // This catches ALL expired Pro users, regardless of subscription status
    const expiredInfluencers = await this.influencerModel.findAll({
      where: {
        isPro: true,
        proExpiresAt: {
          [Op.lt]: now, // proExpiresAt < now
        },
      },
    });

    console.log(`Found ${expiredInfluencers.length} influencer(s) with expired Pro access`);

    let expiredCount = 0;

    for (const influencer of expiredInfluencers) {
      // Set isPro to false
      await influencer.update({
        isPro: false,
      });

      console.log(`⏱️ Expired Pro access for influencer ${influencer.id} (${influencer.username}) - expired at: ${influencer.proExpiresAt}`);
      expiredCount++;

      // Step 2: Also update any ACTIVE subscriptions for this influencer to EXPIRED
      const activeSubscriptions = await this.proSubscriptionModel.findAll({
        where: {
          influencerId: influencer.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: {
            [Op.lt]: now,
          },
        },
      });

      for (const subscription of activeSubscriptions) {
        await subscription.update({
          status: SubscriptionStatus.EXPIRED,
        });
        console.log(`  └─ Marked subscription ${subscription.id} as EXPIRED`);
      }
    }

    console.log(`✅ Expired ${expiredCount} Pro subscription(s)`);

    return {
      expiredCount,
    };
  }

  /**
   * Reconcile stuck payments - Fix cases where payment was captured but webhook was missed
   * This catches payments where money was deducted but Pro wasn't activated
   * Handles both PENDING and CANCELLED invoices with or without payment IDs
   */
  async reconcileStuckPayments() {
    const now = new Date();

    console.log(`💰 Starting comprehensive payment reconciliation...`);

    // Find ALL unpaid invoices (PENDING or cancelled) from last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Find ALL unpaid invoices (PENDING, cancelled, or failed) from last 30 days
    const unpaidInvoices = await this.proInvoiceModel.findAll({
      where: {
        paymentStatus: {
          [Op.in]: [InvoiceStatus.PENDING, 'cancelled', 'failed'],
        },
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
          [Op.lt]: fiveMinutesAgo, // Give webhooks 5 minutes to process
        },
      },
      include: [
        {
          model: this.proSubscriptionModel,
          as: 'subscription',
          required: false, // Include invoices even if subscription is missing
        },
      ],
      limit: 100, // Process max 100 at a time
      order: [['createdAt', 'DESC']],
    });

    console.log(`Found ${unpaidInvoices.length} unpaid invoice(s) to reconcile`);

    let reconciledCount = 0;
    let alreadyPaidCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const invoice of unpaidInvoices) {
      try {
        console.log(`\n📋 Processing invoice ${invoice.id} (${invoice.paymentStatus})`);

        // Check if invoice was already marked as PAID (race condition)
        await invoice.reload();
        if (invoice.paymentStatus === InvoiceStatus.PAID) {
          console.log(`  ✅ Already PAID, skipping`);
          alreadyPaidCount++;
          continue;
        }

        const subscription = invoice.subscription;
        if (!subscription) {
          console.log(`  ⚠️  No subscription found for invoice ${invoice.id}, skipping`);
          skippedCount++;
          continue;
        }

        let capturedPayment: any = null;
        let reconciliationStrategy = '';

        // ============================================================================
        // STRATEGY 1: If invoice has razorpayPaymentId, verify that specific payment
        // This handles race conditions where payment.failed webhook came after payment.captured
        // Invoice will have status 'failed' but razorpayPaymentId is already set
        // ============================================================================
        if (invoice.razorpayPaymentId) {
          console.log(`  🔍 Strategy 1: Checking existing payment ID ${invoice.razorpayPaymentId}`);
          console.log(`  📊 Invoice status: ${invoice.paymentStatus} (expected: pending/failed/cancelled)`);
          reconciliationStrategy = 'existing_payment_id';

          try {
            const response = await this.razorpayService.getPaymentDetails(invoice.razorpayPaymentId);
            if (response.success && response.data?.status === 'captured') {
              capturedPayment = response.data;
              console.log(`  ✅ Payment ${invoice.razorpayPaymentId} is captured on Razorpay`);
              if (invoice.paymentStatus === 'failed') {
                console.log(`  🔧 RACE CONDITION DETECTED: Invoice marked as failed but payment was captured!`);
              }
            } else {
              console.log(`  ⏸️  Payment status: ${response.data?.status || 'unknown'}, skipping`);
              continue;
            }
          } catch (error) {
            console.error(`  ❌ Failed to fetch payment:`, error.message);
            failedCount++;
            continue;
          }
        }
        // ============================================================================
        // STRATEGY 2: If subscription has Razorpay ID, query all subscription payments
        // ============================================================================
        else if (subscription.razorpaySubscriptionId && subscription.razorpaySubscriptionId !== '') {
          console.log(`  🔍 Strategy 2: Querying payments for subscription ${subscription.razorpaySubscriptionId}`);
          reconciliationStrategy = 'subscription_payment_search';

          try {
            const paymentsResponse = await this.razorpayService.getSubscriptionPayments(
              subscription.razorpaySubscriptionId,
            );
            const payments = paymentsResponse.items || [];

            console.log(`  📊 Found ${payments.length} payment(s) for subscription`);

            // Find captured payment matching invoice amount
            const matchingPayment = payments.find(
              (payment) =>
                payment.status === 'captured' &&
                payment.amount === invoice.totalAmount, // Amount in paise
            );

            if (matchingPayment) {
              // Check if this payment is already used by another invoice
              const existingInvoice = await this.proInvoiceModel.findOne({
                where: {
                  razorpayPaymentId: matchingPayment.id,
                  paymentStatus: InvoiceStatus.PAID,
                },
              });

              if (existingInvoice) {
                console.log(`  ⚠️  Payment ${matchingPayment.id} already used by invoice ${existingInvoice.id}, skipping`);
                continue;
              }

              capturedPayment = matchingPayment;
              console.log(`  ✅ Found matching payment: ${matchingPayment.id} for ${matchingPayment.amount} paise`);
            } else {
              console.log(`  ℹ️  No captured payment matching amount ${invoice.totalAmount} paise`);
              continue;
            }
          } catch (error) {
            console.error(`  ❌ Failed to fetch subscription payments:`, error.message);
            failedCount++;
            continue;
          }
        }
        // ============================================================================
        // STRATEGY 3: Check pro_payment_transactions table
        // Handles cases where webhook was received but failed to update invoice
        // ============================================================================
        else {
          console.log(`  🔍 Strategy 3: Checking pro_payment_transactions for captured webhook`);
          reconciliationStrategy = 'transaction_table_search';

          try {
            // Find captured payment transaction for this invoice
            const capturedTransaction = await this.proPaymentTransactionModel.findOne({
              where: {
                invoiceId: invoice.id,
                transactionType: 'payment.captured',
                status: 'captured',
              },
              order: [['createdAt', 'DESC']],
            });

            if (capturedTransaction && capturedTransaction.razorpayPaymentId) {
              // Check if this payment is already used by another invoice
              const existingInvoice = await this.proInvoiceModel.findOne({
                where: {
                  razorpayPaymentId: capturedTransaction.razorpayPaymentId,
                  paymentStatus: InvoiceStatus.PAID,
                },
              });

              if (existingInvoice) {
                console.log(
                  `  ⚠️  Payment ${capturedTransaction.razorpayPaymentId} already used by invoice ${existingInvoice.id}, skipping`,
                );
                continue;
              }

              capturedPayment = {
                id: capturedTransaction.razorpayPaymentId,
                status: 'captured',
                amount: capturedTransaction.amount,
                created_at: Math.floor(capturedTransaction.createdAt.getTime() / 1000),
              };
              console.log(
                `  ✅ Found captured payment in transaction log: ${capturedPayment.id}`,
              );
            } else {
              console.log(`  ℹ️  No captured transaction found in payment logs`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to check transaction table:`, error.message);
          }
        }

        // ============================================================================
        // STRATEGY 4: Check Razorpay order for payments
        // Handles cases where payment succeeded but webhook processing failed completely
        // ============================================================================
        if (!capturedPayment && invoice.razorpayOrderId) {
          console.log(`  🔍 Strategy 4: Querying Razorpay for order ${invoice.razorpayOrderId}`);
          reconciliationStrategy = 'order_payment_search';

          try {
            const orderResponse = await this.razorpayService.getOrderPayments(
              invoice.razorpayOrderId,
            );
            const payments = orderResponse.payments || [];

            console.log(`  📊 Found ${payments.length} payment(s) for order`);

            // Find captured payment matching invoice amount
            const matchingPayment = payments.find(
              (payment) =>
                payment.status === 'captured' &&
                payment.amount === invoice.totalAmount,
            );

            if (matchingPayment) {
              // Check if this payment is already used by another invoice
              const existingInvoice = await this.proInvoiceModel.findOne({
                where: {
                  razorpayPaymentId: matchingPayment.id,
                  paymentStatus: InvoiceStatus.PAID,
                },
              });

              if (existingInvoice) {
                console.log(
                  `  ⚠️  Payment ${matchingPayment.id} already used by invoice ${existingInvoice.id}, skipping`,
                );
              } else {
                capturedPayment = matchingPayment;
                console.log(
                  `  ✅ Found captured payment on order: ${matchingPayment.id} for ${matchingPayment.amount} paise`,
                );
              }
            } else {
              console.log(`  ℹ️  No captured payment matching amount ${invoice.totalAmount} paise on order`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to fetch order payments:`, error.message);
          }
        }

        // ============================================================================
        // STRATEGY 5: Still no payment found - cannot reconcile
        // ============================================================================
        if (!capturedPayment) {
          console.log(`  ⚠️  All strategies exhausted - cannot auto-reconcile`);
          console.log(
            `  📝 Manual review needed for invoice ${invoice.id}, influencer ${invoice.influencerId}, amount: ${invoice.totalAmount} paise`,
          );
          skippedCount++;
          continue;
        }

        // ============================================================================
        // If we found a captured payment, reconcile the invoice
        // ============================================================================

        console.log(`  💳 Reconciling invoice ${invoice.id} with payment ${capturedPayment.id}...`);

        // Generate invoice number if missing
        let invoiceNumber = invoice.invoiceNumber;
        if (!invoiceNumber) {
          invoiceNumber = await this.generateInvoiceNumber(invoice.influencerId);
        }

        // Update invoice to PAID
        await invoice.update({
          invoiceNumber,
          paymentStatus: InvoiceStatus.PAID,
          razorpayPaymentId: capturedPayment.id,
          paidAt: capturedPayment.created_at
            ? new Date(capturedPayment.created_at * 1000)
            : new Date(),
        });

        console.log(`  ✅ Invoice ${invoice.id} marked as PAID`);

        // Calculate Pro expiry as payment date + 30 days
        const paymentDate = capturedPayment.created_at
          ? new Date(capturedPayment.created_at * 1000)
          : new Date();
        const calculatedExpiry = new Date(paymentDate);
        calculatedExpiry.setDate(calculatedExpiry.getDate() + 30); // Add 30 days

        console.log(
          `  📅 Calculated expiry: Payment ${paymentDate.toISOString()} + 30 days = ${calculatedExpiry.toISOString()}`,
        );

        // Update subscription status and period based on current state
        // FIX: Also activate if PAYMENT_FAILED or EXPIRED (race condition from payment.failed webhook)
        if (
          subscription.status === SubscriptionStatus.PAYMENT_PENDING ||
          subscription.status === SubscriptionStatus.PAYMENT_FAILED ||
          subscription.status === SubscriptionStatus.EXPIRED
        ) {
          await subscription.update({
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: paymentDate,
            currentPeriodEnd: calculatedExpiry, // Fix period end
          });
          console.log(`  ✅ Subscription ${subscription.id} activated (was ${subscription.status}) with correct period end`);
        } else if (subscription.status === SubscriptionStatus.CANCELLED) {
          console.log(`  ⚠️  Subscription is CANCELLED - keeping as cancelled but activating Pro`);

          // Update the period end even though cancelled, for record accuracy
          await subscription.update({
            currentPeriodEnd: calculatedExpiry,
          });

          // Ensure Razorpay subscription is cancelled to prevent future charges
          if (subscription.razorpaySubscriptionId) {
            try {
              const subDetails = await this.razorpayService.getSubscription(
                subscription.razorpaySubscriptionId,
              );
              if (
                subDetails.success &&
                subDetails.data?.status !== 'cancelled' &&
                subDetails.data?.status !== 'completed'
              ) {
                await this.razorpayService.cancelSubscription(
                  subscription.razorpaySubscriptionId,
                  false,
                );
                console.log(`  ✅ Razorpay subscription cancelled`);
              }
              if (subscription.autoRenew !== false) {
                await subscription.update({ autoRenew: false });
              }
            } catch (cancelError) {
              console.error(`  ⚠️  Failed to verify/cancel Razorpay subscription:`, cancelError.message);
            }
          }
        }

        // Update influencer Pro status
        const currentProExpiry = await this.influencerModel.findByPk(invoice.influencerId, {
          attributes: ['proExpiresAt', 'username'],
        });

        // Use the calculated expiry from above (payment date + 30 days)
        const shouldUpdate = !currentProExpiry?.proExpiresAt || calculatedExpiry > currentProExpiry.proExpiresAt;

        if (shouldUpdate) {
          await this.influencerModel.update(
            {
              isPro: true,
              proActivatedAt: new Date(),
              proExpiresAt: calculatedExpiry,
            },
            { where: { id: invoice.influencerId } },
          );
          console.log(
            `  ✅ Pro access granted to ${currentProExpiry?.username || invoice.influencerId} until ${calculatedExpiry.toISOString()}`,
          );
        } else {
          console.log(
            `  ℹ️  Already has Pro until ${currentProExpiry.proExpiresAt.toISOString()}`,
          );
        }

        // Generate invoice PDF
        try {
          await this.generateInvoicePDF(invoice.id);
          console.log(`  📄 Invoice PDF generated: ${invoiceNumber}`);
        } catch (pdfError) {
          console.error('  ⚠️  Failed to generate PDF:', pdfError.message);
        }

        console.log(
          `  🎉 Successfully reconciled invoice ${invoice.id} using ${reconciliationStrategy}`,
        );
        reconciledCount++;

      } catch (error) {
        console.error(`  ❌ Error reconciling invoice ${invoice.id}:`, error.message);
        console.error(error.stack);
        failedCount++;
      }
    }


    // ============================================================================
    // ADDITIONAL CHECK: Fix subscriptions stuck in PAYMENT_PENDING/PAYMENT_FAILED
    // status but have PAID invoices (webhook race condition)
    // ============================================================================
    console.log(`\n🔧 Checking for subscriptions stuck in wrong status...`);

    const stuckSubscriptions = await this.proSubscriptionModel.findAll({
      where: {
        status: {
          [Op.in]: [SubscriptionStatus.PAYMENT_PENDING, SubscriptionStatus.PAYMENT_FAILED],
        },
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
      include: [
        {
          model: this.proInvoiceModel,
          as: 'invoices',
          where: {
            paymentStatus: InvoiceStatus.PAID,
          },
          required: true, // Only include subscriptions with at least one PAID invoice
        },
      ],
      limit: 50,
    });

    console.log(`Found ${stuckSubscriptions.length} subscription(s) with PAID invoices but wrong status`);

    let activatedCount = 0;
    for (const subscription of stuckSubscriptions) {
      try {
        console.log(`\n🔄 Activating subscription ${subscription.id} (status: ${subscription.status})`);

        // Find the most recent PAID invoice
        const latestPaidInvoice = await this.proInvoiceModel.findOne({
          where: {
            subscriptionId: subscription.id,
            paymentStatus: InvoiceStatus.PAID,
          },
          order: [['paidAt', 'DESC']],
        });

        if (!latestPaidInvoice || !latestPaidInvoice.paidAt) {
          console.log(`  ⚠️  No valid paid invoice found, skipping`);
          continue;
        }

        // Calculate expiry from payment date
        const paymentDate = latestPaidInvoice.paidAt;
        const calculatedExpiry = new Date(paymentDate);
        calculatedExpiry.setDate(calculatedExpiry.getDate() + 30);

        console.log(
          `  📅 Payment date: ${paymentDate.toISOString()}, Calculated expiry: ${calculatedExpiry.toISOString()}`,
        );

        // Activate subscription
        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: paymentDate,
          currentPeriodEnd: calculatedExpiry,
        });

        // Ensure influencer has Pro access
        await this.influencerModel.update(
          {
            isPro: true,
            proActivatedAt: paymentDate,
            proExpiresAt: calculatedExpiry,
          },
          { where: { id: subscription.influencerId } },
        );

        console.log(`  ✅ Subscription ${subscription.id} activated for influencer ${subscription.influencerId}`);
        activatedCount++;
      } catch (error) {
        console.error(`  ❌ Error activating subscription ${subscription.id}:`, error.message);
      }
    }

    console.log(`\n🎯 RECONCILIATION COMPLETE`);
    console.log(`  ✅ Reconciled invoices: ${reconciledCount}`);
    console.log(`  ✅ Activated stuck subscriptions: ${activatedCount}`);
    console.log(`  ℹ️  Already paid: ${alreadyPaidCount}`);
    console.log(`  ⏭️  Skipped (cannot auto-reconcile): ${skippedCount}`);
    console.log(`  ❌ Failed: ${failedCount}`);

    // ============================================================================
    // SECOND PASS: Fix database inconsistencies
    // Find PAID invoices where subscription is still PAYMENT_FAILED or EXPIRED
    // This catches cases where webhook race condition left subscription stuck
    // ============================================================================
    console.log(`\n🔧 Checking for database inconsistencies...`);

    const inconsistentInvoices = await this.proInvoiceModel.findAll({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
      include: [
        {
          model: this.proSubscriptionModel,
          as: 'subscription',
          required: true,
          where: {
            status: {
              [Op.in]: [SubscriptionStatus.PAYMENT_FAILED, SubscriptionStatus.EXPIRED],
            },
            currentPeriodEnd: {
              [Op.gt]: now, // Subscription should still be active
            },
          },
        },
      ],
      limit: 50,
    });

    console.log(`Found ${inconsistentInvoices.length} paid invoice(s) with stuck subscriptions`);

    let fixedSubscriptionsCount = 0;

    for (const invoice of inconsistentInvoices) {
      try {
        const subscription = invoice.subscription;
        console.log(`\n🔧 Fixing stuck subscription ${subscription.id} for invoice ${invoice.id}`);
        console.log(`  Current status: ${subscription.status}, should be: active`);

        const paymentDate = invoice.paidAt || invoice.createdAt;
        const calculatedExpiry = new Date(paymentDate);
        calculatedExpiry.setDate(calculatedExpiry.getDate() + 30);

        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: paymentDate,
          currentPeriodEnd: calculatedExpiry,
        });

        console.log(`  ✅ Subscription ${subscription.id} activated (was ${subscription.status})`);
        fixedSubscriptionsCount++;
      } catch (error) {
        console.error(`  ❌ Failed to fix subscription ${invoice.subscription?.id}:`, error.message);
      }
    }

    if (fixedSubscriptionsCount > 0) {
      console.log(`\n✅ Fixed ${fixedSubscriptionsCount} stuck subscription(s)`);
    } else {
      console.log(`\nℹ️  No stuck subscriptions found`);
    }

    return {
      reconciledCount,
      activatedSubscriptionsCount: activatedCount,
      alreadyPaidCount,
      skippedCount,
      failedCount,
      totalChecked: unpaidInvoices.length,
      stuckSubscriptionsChecked: stuckSubscriptions.length,
      fixedSubscriptionsCount,
    };
  }

  /**
   * Check and reconcile subscriptions with no invoices
   * Queries Razorpay to see if payments were made but webhooks were missed
   */
  async reconcileSubscriptionsWithoutInvoices() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log(`\n🔍 Checking for subscriptions without invoices...`);

    // Find subscriptions with razorpaySubscriptionId but no invoices
    const subscriptionsWithoutInvoices = await this.proSubscriptionModel.findAll({
      where: {
        razorpaySubscriptionId: {
          [Op.ne]: null,
        },
        createdAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
      include: [
        {
          model: ProInvoice,
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']], // Newest first
      limit: 200, // Increased from 50 to handle all subscriptions
    });

    console.log(`📊 Total subscriptions found: ${subscriptionsWithoutInvoices.length}`);
    console.log(
      `📋 Debug - Sample subscription data:`,
      subscriptionsWithoutInvoices.slice(0, 2).map((s) => ({
        id: s.id,
        razorpayId: s.razorpaySubscriptionId,
        invoicesLoaded: s.invoices !== undefined,
        invoiceCount: s.invoices ? s.invoices.length : 'undefined',
      })),
    );

    // Filter to only those with NO invoices
    const orphanedSubscriptions = subscriptionsWithoutInvoices.filter(
      (sub) => !sub.invoices || sub.invoices.length === 0,
    );

    console.log(`Found ${orphanedSubscriptions.length} subscription(s) without any invoices`);

    let reconciledCount = 0;
    let abandonedCount = 0;

    for (const subscription of orphanedSubscriptions) {
      try {
        console.log(
          `\n📋 Checking subscription ${subscription.id} (Razorpay: ${subscription.razorpaySubscriptionId})`,
        );

        // Query Razorpay for this subscription's payments
        const paymentsResponse = await this.razorpayService.getSubscriptionPayments(
          subscription.razorpaySubscriptionId,
        );
        const payments = paymentsResponse.items || [];

        console.log(`  📊 Found ${payments.length} payment(s) on Razorpay`);

        if (payments.length > 0) {
          // Log payment details for debugging
          payments.forEach((p: any, index: number) => {
            console.log(`    Payment ${index + 1}: ${p.id} - status: ${p.status}, amount: ${p.amount}, subscription_id: ${p.subscription_id || 'N/A'}`);
          });
        }

        // Find any captured payments
        const capturedPayments = payments.filter((p: any) => p.status === 'captured');

        console.log(`  💰 Found ${capturedPayments.length} captured payment(s)`);

        if (capturedPayments.length === 0) {
          console.log(`  ⚠️  No captured payments - subscription appears abandoned`);

          // Mark subscription as INACTIVE if it's been more than 24 hours
          const hoursSinceCreation =
            (now.getTime() - subscription.createdAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreation > 24) {
            await subscription.update({ status: SubscriptionStatus.INACTIVE });
            console.log(`  ✅ Marked subscription as INACTIVE (abandoned after 24h)`);
            abandonedCount++;
          } else {
            console.log(`  ⏳ Created less than 24h ago, keeping as PAYMENT_PENDING`);
          }
          continue;
        }

        // Found captured payment(s) - create invoice retroactively
        // Check if payment is already used by another invoice
        let unusedPayment: any = null;
        for (const payment of capturedPayments) {
          const existingInvoice = await this.proInvoiceModel.findOne({
            where: { razorpayPaymentId: (payment as any).id },
          });

          if (!existingInvoice) {
            unusedPayment = payment;
            break;
          } else {
            console.log(`  ⚠️  Payment ${(payment as any).id} already used by invoice ${existingInvoice.id}, skipping`);
          }
        }

        if (!unusedPayment) {
          console.log(`  ❌ All payments already used by other invoices, skipping`);
          continue;
        }

        const latestPayment = unusedPayment;
        console.log(
          `  ✅ Found unused captured payment: ${latestPayment.id} for ${latestPayment.amount} paise`,
        );

        // Get influencer details for tax calculation
        const influencer = await this.influencerModel.findByPk(subscription.influencerId, {
          include: [
            {
              model: this.cityModel,
              as: 'city',
            },
          ],
        });

        if (!influencer) {
          console.log(`  ❌ Influencer not found, skipping`);
          continue;
        }

        // Calculate tax breakdown (amount is already inclusive)
        const totalAmount = latestPayment.amount; // In paise
        const taxRate = 0.18;
        const baseAmount = Math.round(totalAmount / (1 + taxRate));
        const taxAmount = totalAmount - baseAmount;

        const headquarterCity = (influencer as any).city;
        let igst = 0;
        let cgst = 0;
        let sgst = 0;

        if (!headquarterCity || headquarterCity.state !== 'Delhi') {
          igst = taxAmount;
        } else {
          cgst = Math.round(taxAmount / 2);
          sgst = taxAmount - cgst;
        }

        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(influencer.id);

        // Create invoice
        const paymentDate = new Date(latestPayment.created_at * 1000);
        const calculatedExpiry = new Date(paymentDate);
        calculatedExpiry.setDate(calculatedExpiry.getDate() + 30);

        const invoice = await this.proInvoiceModel.create({
          subscriptionId: subscription.id,
          influencerId: subscription.influencerId,
          invoiceNumber,
          paymentStatus: InvoiceStatus.PAID,
          amount: baseAmount, // Base amount before tax
          tax: taxAmount, // Total tax amount
          totalAmount, // Final amount including tax
          igst,
          cgst,
          sgst,
          razorpayPaymentId: latestPayment.id,
          razorpayOrderId: latestPayment.order_id || null,
          paidAt: paymentDate,
          billingPeriodStart: paymentDate,
          billingPeriodEnd: calculatedExpiry,
        } as any);

        console.log(`  📄 Created invoice ${invoice.id} (${invoiceNumber})`);

        // Update subscription status
        await subscription.update({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: paymentDate,
          currentPeriodEnd: calculatedExpiry,
          autoRenew: true, // Enable auto-renewal since payment was successful
        });

        // Update influencer Pro status
        await this.influencerModel.update(
          {
            isPro: true,
            proActivatedAt: paymentDate,
            proExpiresAt: calculatedExpiry,
          },
          { where: { id: subscription.influencerId } },
        );

        console.log(`  ✅ Subscription ${subscription.id} activated for influencer ${subscription.influencerId}`);

        // Generate invoice PDF
        try {
          await this.generateInvoicePDF(invoice.id);
          console.log(`  📄 Invoice PDF generated`);
        } catch (pdfError) {
          console.error(`  ⚠️  Failed to generate PDF:`, pdfError.message);
        }

        reconciledCount++;
      } catch (error) {
        console.error(`  ❌ Error checking subscription ${subscription.id}:`, error.message);
      }
    }

    console.log(`\n🎯 ORPHANED SUBSCRIPTIONS CHECK COMPLETE`);
    console.log(`  ✅ Reconciled: ${reconciledCount}`);
    console.log(`  ⚠️  Marked as abandoned: ${abandonedCount}`);
    console.log(`  📊 Total checked: ${orphanedSubscriptions.length}`);

    return {
      reconciledCount,
      abandonedCount,
      totalChecked: orphanedSubscriptions.length,
    };
  }

  /**
   * Reconcile paid invoices where user doesn't have Pro access
   * Grants Pro access to users who paid but didn't get isPro flag set
   */
  async reconcilePaidInvoicesWithoutProAccess() {
    console.log(`\n🔍 Checking for paid invoices without Pro access granted...`);

    // Find all paid invoices where the influencer doesn't have Pro access
    // AND the subscription is still active (not expired)
    const paidInvoices = await this.proInvoiceModel.findAll({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: this.influencerModel,
          as: 'influencer',
          where: {
            isPro: false,
          },
          required: true,
        },
        {
          model: this.proSubscriptionModel,
          as: 'subscription',
          where: {
            currentPeriodEnd: {
              [Op.gt]: new Date(), // Only active subscriptions
            },
          },
          required: true,
        },
      ],
      order: [['paidAt', 'DESC']],
      limit: 100,
    });

    console.log(`📊 Found ${paidInvoices.length} active paid invoice(s) without Pro access`);

    let grantedCount = 0;
    let failedCount = 0;

    for (const invoice of paidInvoices) {
      try {
        const subscription = invoice.subscription;
        const influencer = invoice.influencer;
        const periodEnd = subscription.currentPeriodEnd;

        console.log(
          `\n📋 Processing invoice ${invoice.invoiceNumber} (${invoice.id}) for ${influencer.username}`,
        );
        console.log(`  ✅ Subscription valid until ${toIST(periodEnd)}`);

        // Grant Pro access
        await this.influencerModel.update(
          {
            isPro: true,
            proActivatedAt: invoice.paidAt || new Date(),
            proExpiresAt: periodEnd,
          },
          { where: { id: influencer.id } },
        );

        console.log(`  ✅ Pro access granted to ${influencer.username} until ${toIST(periodEnd)}`);
        grantedCount++;
      } catch (error) {
        console.error(
          `  ❌ Failed to grant Pro access for invoice ${invoice.id}:`,
          error.message,
        );
        failedCount++;
      }
    }

    console.log(`\n🎯 PAID INVOICES RECONCILIATION COMPLETE`);
    console.log(`  ✅ Pro access granted: ${grantedCount}`);
    if (failedCount > 0) {
      console.log(`  ❌ Failed: ${failedCount}`);
    }

    return {
      grantedCount,
      failedCount,
      totalChecked: paidInvoices.length,
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

    let subscription: ProSubscription;
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

    // Guard: if the influencer already has a different active subscription (e.g.
    // they bought a new plan while this one was paused), cancel the stale paused
    // subscription instead of resuming it. Without this check the cron would
    // violate the unique_active_subscription_per_influencer constraint every run.
    const existingActive = await this.proSubscriptionModel.findOne({
      where: {
        influencerId,
        status: SubscriptionStatus.ACTIVE,
        id: { [Op.ne]: subscription.id },
      },
    });

    if (existingActive) {
      await subscription.update({
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: createDatabaseDate(),
        cancelReason: 'Superseded by a newer active subscription',
        isPaused: false,
        pausedAt: null,
        resumeDate: null,
      });
      console.log(
        `Subscription ${subscription.id} (influencer ${influencerId}) cancelled — ` +
        `influencer already has active subscription ${existingActive.id}.`,
      );
      return {
        success: true,
        message: 'Previous paused subscription cancelled — influencer already has an active subscription.',
        subscription: { id: existingActive.id, status: existingActive.status },
      };
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
