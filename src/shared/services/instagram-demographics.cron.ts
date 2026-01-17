import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { InstagramService } from './instagram.service';

@Injectable()
export class InstagramDemographicsCronService {
  private readonly logger = new Logger(InstagramDemographicsCronService.name);

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    private instagramService: InstagramService,
  ) {}

  /**
   * Sync Instagram demographics daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async syncDemographicsDaily() {
    this.logger.log('📊 Starting daily Instagram demographics sync...');

    try {
      // Sync for all influencers with connected Instagram accounts
      const influencers = await this.influencerModel.findAll({
        where: {
          instagramAccessToken: { $ne: null },
          instagramUserId: { $ne: null },
        },
      });

      this.logger.log(`Found ${influencers.length} influencers with Instagram connected`);

      let successCount = 0;
      let errorCount = 0;

      for (const influencer of influencers) {
        try {
          await this.instagramService.getAudienceDemographics(influencer.id, 'influencer');
          successCount++;
        } catch (error) {
          this.logger.warn(`Failed to sync demographics for influencer ${influencer.id}:`, error.message);
          errorCount++;
        }

        // Wait 1 second between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Sync for brands
      const brands = await this.brandModel.findAll({
        where: {
          instagramAccessToken: { $ne: null },
          instagramUserId: { $ne: null },
        },
      });

      this.logger.log(`Found ${brands.length} brands with Instagram connected`);

      for (const brand of brands) {
        try {
          await this.instagramService.getAudienceDemographics(brand.id, 'brand');
          successCount++;
        } catch (error) {
          this.logger.warn(`Failed to sync demographics for brand ${brand.id}:`, error.message);
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.log(
        `✅ Demographics sync completed! Success: ${successCount}, Errors: ${errorCount}`
      );
    } catch (error) {
      this.logger.error('❌ Error in demographics sync cron:', error);
    }
  }
}
