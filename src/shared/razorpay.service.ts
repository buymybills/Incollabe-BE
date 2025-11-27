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
}
