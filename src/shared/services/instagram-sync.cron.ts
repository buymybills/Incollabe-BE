import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { InstagramService } from './instagram.service';

@Injectable()
export class InstagramSyncCronService {
  private readonly logger = new Logger(InstagramSyncCronService.name);

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    private instagramService: InstagramService,
  ) {}

  /**
   * Sync Instagram profiles for all connected users
   * Runs every day at 2:00 AM
   * Cron format: second minute hour day month dayOfWeek
   *
   * DISABLED: Instagram functionality commented out for production
   */
  @Cron('0 0 15 * * *', {
    name: 'instagram-profile-sync',
    timeZone: 'Asia/Kolkata',
  })
  async syncAllInstagramProfiles() {
    this.logger.log('🔄 Starting Instagram profile sync cron job...');

    try {
      // Sync influencers
      const influencerCount = await this.syncInfluencers();

      // Sync brands
      const brandCount = await this.syncBrands();

      this.logger.log(
        `✅ Instagram sync completed! Synced ${influencerCount} influencers and ${brandCount} brands`
      );
    } catch (error) {
      this.logger.error('❌ Instagram sync cron job failed:', error);
    }
  }

  /**
   * Sync Instagram profiles for all connected influencers
   */
  private async syncInfluencers(): Promise<number> {
    const influencers = await this.influencerModel.findAll({
      where: {
        instagramUserId: {
          [Op.ne]: null,
        },
        instagramAccessToken: {
          [Op.ne]: null,
        },
      } as WhereOptions,
    });

    this.logger.log(`Found ${influencers.length} influencers with connected Instagram`);

    let successCount = 0;
    let failCount = 0;

    for (const influencer of influencers) {
      try {
        await this.instagramService.syncInstagramProfile(influencer.id, 'influencer', true);
        successCount++;
        this.logger.debug(
          `✓ Synced influencer ${influencer.id} (@${influencer.instagramUsername})`
        );
      } catch (error: any) {
        failCount++;
        const isAuthError =
          error?.getResponse?.()?.error === 'OAuthException' ||
          (error?.message || '').includes('session has been invalidated');
        if (isAuthError) {
          this.logger.warn(
            `✗ Instagram reauth required for influencer ${influencer.id} (@${influencer.instagramUsername}) — session invalidated`
          );
        } else {
          this.logger.warn(
            `✗ Failed to sync influencer ${influencer.id}: ${error.message}`
          );
        }
      }
    }

    this.logger.log(
      `Influencers: ${successCount} succeeded, ${failCount} failed`
    );

    return successCount;
  }

  /**
   * Sync Instagram profiles for all connected brands
   */
  private async syncBrands(): Promise<number> {
    const brands = await this.brandModel.findAll({
      where: {
        instagramUserId: {
          [Op.ne]: null,
        },
        instagramAccessToken: {
          [Op.ne]: null,
        },
      } as WhereOptions,
    });

    this.logger.log(`Found ${brands.length} brands with connected Instagram`);

    let successCount = 0;
    let failCount = 0;

    for (const brand of brands) {
      try {
        await this.instagramService.syncInstagramProfile(brand.id, 'brand', true);
        successCount++;
        this.logger.debug(
          `✓ Synced brand ${brand.id} (@${brand.instagramUsername})`
        );
      } catch (error: any) {
        failCount++;
        const isAuthError =
          error?.getResponse?.()?.error === 'OAuthException' ||
          (error?.message || '').includes('session has been invalidated');
        if (isAuthError) {
          this.logger.warn(
            `✗ Instagram reauth required for brand ${brand.id} (@${brand.instagramUsername}) — session invalidated`
          );
        } else {
          this.logger.warn(
            `✗ Failed to sync brand ${brand.id}: ${error.message}`
          );
        }
      }
    }

    this.logger.log(
      `Brands: ${successCount} succeeded, ${failCount} failed`
    );

    return successCount;
  }

  /**
   * Manually trigger sync for testing
   * Can be called via API endpoint if needed
   */
  async manualSync() {
    this.logger.log('🔧 Manual Instagram sync triggered');
    return this.syncAllInstagramProfiles();
  }

  /** Sync a single influencer by ID — useful for one-off fixes. */
  async syncSingleInfluencer(influencerId: number): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🔧 Manual sync triggered for influencer #${influencerId}`);
    try {
      await this.instagramService.syncInstagramProfile(influencerId, 'influencer', true);
      this.logger.log(`✅ Synced influencer #${influencerId}`);
      return { success: true };
    } catch (error: any) {
      this.logger.warn(`✗ Failed to sync influencer #${influencerId}: ${error?.message}`);
      return { success: false, error: error?.message };
    }
  }

  /**
   * Sync only users with tokens expiring soon (within 7 days)
   * Runs every day at 1:00 AM
   *
   * DISABLED: Instagram functionality commented out for production
   */
  // @Cron(CronExpression.EVERY_DAY_AT_1AM, {
  //   name: 'instagram-token-refresh',
  //   timeZone: 'Asia/Kolkata',
  // })
  async refreshExpiringTokens() {
    this.logger.log('🔄 Starting Instagram token refresh cron job...');

    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Find influencers with expiring tokens (tokens expiring in next 7 days)
      const influencers = await this.influencerModel.findAll({
        where: {
          instagramTokenExpiresAt: {
            [Op.lte]: sevenDaysFromNow,
          },
          instagramAccessToken: {
            [Op.ne]: null,
          },
        } as WhereOptions,
      });

      // Find brands with expiring tokens (tokens expiring in next 7 days)
      const brands = await this.brandModel.findAll({
        where: {
          instagramTokenExpiresAt: {
            [Op.lte]: sevenDaysFromNow,
          },
          instagramAccessToken: {
            [Op.ne]: null,
          },
        } as WhereOptions,
      });

      this.logger.log(
        `Found ${influencers.length} influencers and ${brands.length} brands with tokens expiring soon`
      );

      let successCount = 0;
      let failCount = 0;

      // Refresh influencer tokens
      for (const influencer of influencers) {
        try {
          await this.instagramService.refreshUserInstagramToken(
            influencer.id,
            'influencer'
          );
          successCount++;
          this.logger.debug(
            `✓ Refreshed token for influencer ${influencer.id}`
          );
        } catch (error: any) {
          failCount++;
          const isAuthError =
            error?.getResponse?.()?.error === 'OAuthException' ||
            (error?.message || '').includes('session has been invalidated');
          if (isAuthError) {
            this.logger.warn(
              `✗ Instagram reauth required for influencer ${influencer.id} — session invalidated, token refresh failed`
            );
          } else {
            this.logger.warn(
              `✗ Failed to refresh token for influencer ${influencer.id}: ${error.message}`
            );
          }
        }
      }

      // Refresh brand tokens
      for (const brand of brands) {
        try {
          await this.instagramService.refreshUserInstagramToken(
            brand.id,
            'brand'
          );
          successCount++;
          this.logger.debug(`✓ Refreshed token for brand ${brand.id}`);
        } catch (error: any) {
          failCount++;
          const isAuthError =
            error?.getResponse?.()?.error === 'OAuthException' ||
            (error?.message || '').includes('session has been invalidated');
          if (isAuthError) {
            this.logger.warn(
              `✗ Instagram reauth required for brand ${brand.id} — session invalidated, token refresh failed`
            );
          } else {
            this.logger.warn(
              `✗ Failed to refresh token for brand ${brand.id}: ${error.message}`
            );
          }
        }
      }

      this.logger.log(
        `✅ Token refresh completed! ${successCount} succeeded, ${failCount} failed`
      );
    } catch (error) {
      this.logger.error('❌ Token refresh cron job failed:', error);
    }
  }
}
