import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Campaign } from '../models/campaign.model';
import { InvoiceStatus } from '../../influencer/models/payment-enums';
import { RazorpayService } from '../../shared/razorpay.service';

@Injectable()
export class PaymentStatusCheckerService {
  private readonly logger = new Logger(PaymentStatusCheckerService.name);

  constructor(
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Cron job: Runs every hour to check for stuck payments
   * Detects payments that are stuck in PROCESSING state for more than 24 hours
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkStuckPayments() {
    this.logger.log('🔍 Starting stuck payment check...');

    try {
      // Find campaigns with payments stuck in PROCESSING status
      const stuckCampaigns = await this.campaignModel.findAll({
        where: {
          [Op.or]: [
            { maxCampaignPaymentStatus: InvoiceStatus.PROCESSING },
            { inviteOnlyPaymentStatus: InvoiceStatus.PROCESSING },
          ],
          isActive: true,
        },
      });

      if (stuckCampaigns.length === 0) {
        this.logger.log('✅ No stuck payments found');
        return;
      }

      this.logger.log(`Found ${stuckCampaigns.length} campaigns in PROCESSING status`);

      let updatedCount = 0;
      let missedWebhookCount = 0;

      for (const campaign of stuckCampaigns) {
        const result = await this.checkAndUpdateStuckPayment(campaign);
        if (result.updated) updatedCount++;
        if (result.missedWebhook) missedWebhookCount++;
      }

      this.logger.log(`✅ Stuck payment check complete:
        - Checked: ${stuckCampaigns.length} campaigns
        - Updated to DEDUCTED_NOT_RECEIVED: ${updatedCount}
        - Missed webhooks caught: ${missedWebhookCount}`);
    } catch (error) {
      this.logger.error('❌ Error in stuck payment check:', error);
    }
  }

  /**
   * Check individual campaign payment and update if stuck
   */
  private async checkAndUpdateStuckPayment(campaign: Campaign): Promise<{
    updated: boolean;
    missedWebhook: boolean;
  }> {
    try {
      // Determine which payment to check
      const isMaxCampaign = campaign.maxCampaignPaymentStatus === InvoiceStatus.PROCESSING;
      const paymentId = isMaxCampaign
        ? campaign.maxCampaignPaymentId
        : campaign.inviteOnlyPaymentId;

      if (!paymentId) {
        this.logger.warn(`Campaign ${campaign.id} has no payment ID`);
        return { updated: false, missedWebhook: false };
      }

      // Calculate hours since status update
      const statusUpdatedAt = campaign.paymentStatusUpdatedAt || campaign.updatedAt;
      const hoursSinceUpdate =
        (Date.now() - new Date(statusUpdatedAt).getTime()) / (1000 * 60 * 60);

      // Only check if stuck for more than 24 hours
      if (hoursSinceUpdate <= 24) {
        return { updated: false, missedWebhook: false };
      }

      this.logger.log(
        `⚠️ Campaign ${campaign.id} payment stuck for ${Math.floor(hoursSinceUpdate)} hours - checking Razorpay status...`
      );

      // Fetch current status from Razorpay API
      const razorpayResponse = await this.razorpayService.getPaymentDetails(paymentId);

      if (!razorpayResponse.success || !razorpayResponse.data) {
        this.logger.error(
          `Failed to fetch payment details from Razorpay for campaign ${campaign.id}`
        );
        return { updated: false, missedWebhook: false };
      }

      const razorpayPayment = razorpayResponse.data;

      const statusField = isMaxCampaign
        ? 'maxCampaignPaymentStatus'
        : 'inviteOnlyPaymentStatus';
      const paidAtField = isMaxCampaign ? 'maxCampaignPaidAt' : 'inviteOnlyPaidAt';

      if (razorpayPayment.status === 'authorized') {
        // Payment still stuck in authorized state
        this.logger.warn(
          `🚨 Campaign ${campaign.id} payment still AUTHORIZED after ${Math.floor(hoursSinceUpdate)} hours - updating to DEDUCTED_NOT_RECEIVED`
        );

        await campaign.update({
          [statusField]: InvoiceStatus.DEDUCTED_NOT_RECEIVED,
          paymentStatusUpdatedAt: new Date(),
          razorpayLastWebhookAt: new Date(),
          paymentStatusMessage:
            'Payment verification taking longer than expected. Amount deducted but not received yet.',
        });

        return { updated: true, missedWebhook: false };
      } else if (razorpayPayment.status === 'captured') {
        // Payment was captured but we missed the webhook!
        this.logger.warn(
          `⚠️ Campaign ${campaign.id} payment already CAPTURED - missed webhook! Updating to PAID`
        );

        await campaign.update({
          [statusField]: InvoiceStatus.PAID,
          [paidAtField]: new Date(),
          paymentStatusUpdatedAt: new Date(),
          razorpayLastWebhookAt: new Date(),
          status: 'active' as any, // Activate campaign
          paymentStatusMessage: 'Payment successful',
        });

        return { updated: true, missedWebhook: true };
      } else if (razorpayPayment.status === 'failed') {
        // Payment failed but we missed the webhook
        this.logger.warn(
          `⚠️ Campaign ${campaign.id} payment already FAILED - missed webhook! Updating status`
        );

        await campaign.update({
          [statusField]: InvoiceStatus.FAILED,
          paymentStatusUpdatedAt: new Date(),
          razorpayLastWebhookAt: new Date(),
          paymentStatusMessage:
            razorpayPayment.error_description || 'Payment failed',
        });

        return { updated: true, missedWebhook: true };
      } else {
        this.logger.warn(
          `Campaign ${campaign.id} payment has unexpected status: ${razorpayPayment.status}`
        );
        return { updated: false, missedWebhook: false };
      }
    } catch (error) {
      this.logger.error(
        `Error checking campaign ${campaign.id} payment:`,
        error.message
      );
      return { updated: false, missedWebhook: false };
    }
  }

  /**
   * Manual trigger for checking stuck payments (for testing or admin use)
   */
  async checkStuckPaymentsManual() {
    this.logger.log('🔧 Manual stuck payment check triggered');
    await this.checkStuckPayments();
  }
}
