import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayService {
  private razorpay: any;

  constructor(private configService: ConfigService) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get<string>('RAZORPAY_KEY_SECRET'),
    });
  }

  /**
   * Create a payout to transfer money to influencer's UPI ID
   */
  async createPayout(
    amount: number,
    upiId: string,
    referenceId: string,
    notes?: Record<string, any>,
  ) {
    try {
      const payout = await this.razorpay.payouts.create({
        account_number: this.configService.get<string>('RAZORPAY_ACCOUNT_NUMBER'), // Your Razorpay account number
        fund_account: {
          account_type: 'vpa',
          vpa: {
            address: upiId,
          },
          contact: {
            name: notes?.influencerName || 'Influencer',
            email: notes?.email || 'influencer@example.com',
            contact: notes?.phone || '9999999999',
            type: 'self',
          },
        },
        amount: amount * 100, // Convert to paise (Rs 100 = 10000 paise)
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: referenceId,
        narration: notes?.description || 'Referral Credit Payment',
        notes: notes || {},
      });

      return {
        success: true,
        payoutId: payout.id,
        status: payout.status,
        data: payout,
      };
    } catch (error) {
      console.error('Razorpay payout error:', error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  /**
   * Create a payment order (for receiving payments from brands)
   */
  async createOrder(
    amount: number,
    currency: string = 'INR',
    receipt: string,
    notes?: Record<string, any>,
  ) {
    try {
      const order = await this.razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        notes: notes || {},
      });

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        data: order,
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    try {
      const crypto = require('crypto');
      const text = orderId + '|' + paymentId;
      const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(text)
        .digest('hex');

      return generatedSignature === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');

      if (!webhookSecret) {
        console.error('RAZORPAY_WEBHOOK_SECRET not configured');
        return false;
      }

      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      return generatedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Get payout details
   */
  async getPayoutDetails(payoutId: string) {
    try {
      const payout = await this.razorpay.payouts.fetch(payoutId);
      return {
        success: true,
        data: payout,
      };
    } catch (error) {
      console.error('Error fetching payout:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentId: string) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      console.error('Error fetching payment:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer funds to influencer (simplified version)
   */
  async transferToInfluencer(
    influencerId: number,
    amount: number,
    upiId: string,
    transactionId: number,
  ) {
    return await this.createPayout(amount, upiId, `TXN_${transactionId}`, {
      influencerId,
      transactionId,
      description: `Payment for transaction ${transactionId}`,
    });
  }

  /**
   * Create a subscription plan
   * @param period - 'daily', 'weekly', 'monthly', 'yearly'
   * @param interval - Number of periods (e.g., 1 for monthly, 3 for quarterly)
   * @param amount - Amount in rupees (will be converted to paise)
   * @param currency - Currency code (default: INR)
   * @param name - Plan name
   * @param description - Plan description
   * @param notes - Additional notes
   */
  async createPlan(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number,
    amount: number,
    currency: string = 'INR',
    name: string,
    description?: string,
    notes?: Record<string, any>,
  ) {
    try {
      console.log('📝 Creating Razorpay plan with:', {
        period,
        interval,
        amount: amount * 100,
        currency,
        name,
        description,
      });

      const plan = await this.razorpay.plans.create({
        period,
        interval,
        item: {
          name,
          description: description || name,
          amount: amount * 100, // Convert to paise
          currency,
        },
        notes: notes || {},
      });

      console.log('✅ Plan created successfully:', plan.id);

      return {
        success: true,
        planId: plan.id,
        data: plan,
      };
    } catch (error) {
      console.error('❌ Razorpay plan creation error:', error);
      console.error('Error details:', {
        message: error.message,
        description: error.description,
        statusCode: error.statusCode,
        error: error.error,
        rawError: JSON.stringify(error, null, 2),
      });

      return {
        success: false,
        error: error.message || error.description || 'Unknown error',
        errorCode: error.statusCode,
        details: error.error || error,
      };
    }
  }

  /**
   * Get plan details
   */
  async getPlan(planId: string) {
    try {
      const plan = await this.razorpay.plans.fetch(planId);
      return {
        success: true,
        data: plan,
      };
    } catch (error) {
      console.error('Error fetching plan:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a subscription for auto-recurring payments
   */
  async createSubscription(
    planId: string,
    totalCount: number = 0, // 0 means until cancelled
    customerId?: string,
    notes?: Record<string, any>,
  ) {
    try {
      const subscriptionData: any = {
        plan_id: planId,
        total_count: totalCount, // 0 = until cancelled
        quantity: 1,
        customer_notify: 0, // Disabled: Do not send email/SMS to customer
        notes: notes || {},
      };

      // If you have existing customer, link it
      if (customerId) {
        subscriptionData.customer_id = customerId;
      }

      const subscription = await this.razorpay.subscriptions.create(subscriptionData);

      return {
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        shortUrl: subscription.short_url, // Payment link for customer
        data: subscription,
      };
    } catch (error) {
      console.error('Razorpay subscription creation error:', error);
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = false) {
    try {
      const subscription = await this.razorpay.subscriptions.cancel(
        subscriptionId,
        cancelAtCycleEnd, // If true, subscription ends at period end
      );

      return {
        success: true,
        data: subscription,
      };
    } catch (error) {
      console.error('Razorpay subscription cancellation error:', error);
      return {
        success: false,
        error: error.error?.description || error.message || 'Unknown error',
        errorCode: error.error?.code,
      };
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string) {
    try {
      const subscription = await this.razorpay.subscriptions.fetch(subscriptionId);
      return {
        success: true,
        data: subscription,
      };
    } catch (error) {
      console.error('Error fetching subscription:', error);
      const errorMessage = error?.message || error?.error?.description || JSON.stringify(error) || 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create Autopay subscription (supports all payment methods)
   * This creates a subscription that allows user to choose any payment method at checkout
   * @param startAt - Optional Unix timestamp for when to start billing (to avoid double charging)
   */
  async createAutopaySubscription(
    planId: string,
    influencerId: number,
    influencerName: string,
    influencerPhone: string,
    influencerEmail: string,
    notes?: Record<string, any>,
    startAt?: number,
  ) {
    try {
      console.log('💳 Creating Autopay subscription with:', {
        planId,
        influencerId,
        influencerName,
        startAt: startAt ? new Date(startAt * 1000).toISOString() : 'immediate',
      });

      const subscriptionData: any = {
        plan_id: planId,
        total_count: 12, // 12 months = 1 year (auto-renews for another year after)
        quantity: 1,
        customer_notify: 0, // Disabled: Do not send email/SMS to customer
        notes: {
          ...notes,
          influencerId,
          influencerName,
          subscriptionType: 'pro_account',
        },
        notify_info: {
          notify_phone: influencerPhone,
          notify_email: influencerEmail,
        },
      };

      // If startAt is provided, delay the first charge until that date
      if (startAt) {
        subscriptionData.start_at = startAt;
        console.log(`⏰ First charge will be delayed until: ${new Date(startAt * 1000).toISOString()}`);
      }

      const subscription = await this.razorpay.subscriptions.create(subscriptionData);

      console.log('✅ Autopay subscription created:', subscription.id);
      console.log('🔗 Payment link (user selects payment method):', subscription.short_url);

      return {
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        paymentLink: subscription.short_url, // User can choose any payment method
        data: subscription,
      };
    } catch (error) {
      console.error('❌ Autopay subscription creation error:', error);
      const errorMessage = error?.message || error?.error?.description || JSON.stringify(error);
      return {
        success: false,
        error: errorMessage,
        details: error,
      };
    }
  }

  /**
   * Pause UPI Autopay subscription
   * Note: Razorpay pauses from next billing cycle automatically
   */
  async pauseSubscription(subscriptionId: string) {
    try {
      // For Razorpay subscriptions, pause() doesn't accept parameters
      // It automatically pauses at the end of current billing cycle
      const subscription = await this.razorpay.subscriptions.pause(subscriptionId);

      return {
        success: true,
        data: subscription,
        message: 'Subscription will be paused at the end of current billing cycle',
      };
    } catch (error) {
      console.error('Razorpay subscription pause error:', error);
      const errorMessage = error?.message || error?.error?.description || JSON.stringify(error) || 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Resume paused UPI Autopay subscription
   */
  async resumeSubscription(subscriptionId: string) {
    try {
      // For Razorpay subscriptions, resume() doesn't accept parameters
      const subscription = await this.razorpay.subscriptions.resume(subscriptionId);

      return {
        success: true,
        data: subscription,
        message: 'Subscription resumed successfully',
      };
    } catch (error) {
      console.error('Razorpay subscription resume error:', error);
      const errorMessage = error?.message || error?.error?.description || JSON.stringify(error) || 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: {
      planId?: string;
      quantity?: number;
      scheduleChange?: boolean;
    },
  ) {
    try {
      const updateData: any = {};

      if (updates.planId) {
        updateData.plan_id = updates.planId;
      }

      if (updates.quantity) {
        updateData.quantity = updates.quantity;
      }

      if (updates.scheduleChange !== undefined) {
        updateData.schedule_change_at = updates.scheduleChange ? 'cycle_end' : 'now';
      }

      const subscription = await this.razorpay.subscriptions.update(
        subscriptionId,
        updateData,
      );

      return {
        success: true,
        data: subscription,
      };
    } catch (error) {
      console.error('Razorpay subscription update error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete/Cancel subscription permanently
   */
  async deleteSubscription(subscriptionId: string) {
    try {
      const subscription = await this.razorpay.subscriptions.delete(subscriptionId);

      return {
        success: true,
        data: subscription,
        message: 'Subscription deleted permanently',
      };
    } catch (error) {
      console.error('Razorpay subscription deletion error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all invoices for a subscription
   */
  async getSubscriptionInvoices(subscriptionId: string) {
    try {
      const invoices = await this.razorpay.invoices.all({
        subscription_id: subscriptionId,
      });

      return {
        success: true,
        data: invoices,
      };
    } catch (error) {
      console.error('Error fetching subscription invoices:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a payment link for one-time payment
   */
  async createPaymentLink(
    amount: number,
    description: string,
    customerName: string,
    customerPhone: string,
    customerEmail: string,
    referenceId?: string,
    notes?: Record<string, any>,
  ) {
    try {
      const paymentLink = await this.razorpay.paymentLink.create({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        description,
        customer: {
          name: customerName,
          contact: customerPhone,
          email: customerEmail,
        },
        notify: {
          sms: false, // Disabled: Do not send SMS
          email: false, // Disabled: Do not send email
        },
        reminder_enable: true,
        reference_id: referenceId,
        notes: notes || {},
        callback_url: this.configService.get<string>('PAYMENT_CALLBACK_URL'),
        callback_method: 'get',
      });

      return {
        success: true,
        paymentLinkId: paymentLink.id,
        shortUrl: paymentLink.short_url,
        data: paymentLink,
      };
    } catch (error) {
      console.error('Payment link creation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
