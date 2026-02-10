import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramService } from './instagram.service';

@Injectable()
export class InstagramTokenRefreshCronService {
  private readonly logger = new Logger(InstagramTokenRefreshCronService.name);

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    private instagramService: InstagramService,
  ) {}

  /**
   * Refresh Instagram access tokens that are about to expire
   * Runs every day at 3:00 AM
   *
   * Instagram long-lived tokens expire after 60 days
   * This job refreshes tokens that will expire within 7 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'instagram-token-refresh',
    timeZone: 'Asia/Kolkata',
  })
  async refreshExpiringTokens() {
    this.logger.log('🔄 Starting Instagram token refresh cron job...');

    try {
      // Calculate date threshold (7 days from now)
      const expiryThreshold = new Date();
      expiryThreshold.setDate(expiryThreshold.getDate() + 7);

      this.logger.log(`Refreshing tokens expiring before: ${expiryThreshold.toISOString()}`);

      // Refresh influencer tokens
      const influencerCount = await this.refreshInfluencerTokens(expiryThreshold);

      this.logger.log(
        `✅ Token refresh completed! Refreshed ${influencerCount.success} influencer tokens (${influencerCount.failed} failed)`
      );
    } catch (error) {
      this.logger.error('❌ Instagram token refresh cron job failed:', error);
    }
  }

  /**
   * Refresh Instagram tokens for influencers
   */
  private async refreshInfluencerTokens(expiryThreshold: Date): Promise<{ success: number; failed: number }> {
    const influencers = await this.influencerModel.findAll({
      where: {
        instagramAccessToken: {
          [Op.ne]: null,
        },
        instagramTokenExpiresAt: {
          [Op.lte]: expiryThreshold, // Expires on or before threshold
        },
      } as WhereOptions,
    });

    this.logger.log(`Found ${influencers.length} influencers with expiring tokens`);

    let successCount = 0;
    let failCount = 0;

    for (const influencer of influencers) {
      try {
        // Use the same service method as the refresh-user-token API
        const updatedUser = await this.instagramService.refreshUserInstagramToken(
          influencer.id,
          'influencer' as any,
        );

        successCount++;
        this.logger.debug(
          `✓ Refreshed token for influencer ${influencer.id} (@${influencer.instagramUsername}), new expiry: ${updatedUser.instagramTokenExpiresAt?.toISOString()}`
        );
      } catch (error) {
        failCount++;
        this.logger.warn(
          `✗ Failed to refresh token for influencer ${influencer.id}: ${error.message}`
        );

        // Optional: Notify admin or user that token refresh failed
        // Could add logic here to send notification
      }
    }

    return { success: successCount, failed: failCount };
  }


  /**
   * Manual trigger to refresh all expiring tokens
   * Can be called from admin API if needed
   */
  async manualRefreshExpiringTokens(): Promise<{
    influencers: { success: number; failed: number };
  }> {
    this.logger.log('🔧 Manual token refresh triggered');

    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + 7);

    const influencerResult = await this.refreshInfluencerTokens(expiryThreshold);

    return {
      influencers: influencerResult,
    };
  }

  /**
   * Get count of tokens expiring soon
   * Useful for monitoring
   */
  async getExpiringTokensCount(): Promise<{
    influencers: number;
  }> {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + 7);

    const influencerCount = await this.influencerModel.count({
      where: {
        instagramAccessToken: {
          [Op.ne]: null,
        },
        instagramTokenExpiresAt: {
          [Op.lte]: expiryThreshold,
        },
      } as WhereOptions,
    });

    return {
      influencers: influencerCount,
    };
  }
}
