import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InfluencerCredibilityScoringService } from './influencer-credibility-scoring.service';

@Injectable()
export class CredibilityScoreCronService {
  private readonly logger = new Logger(CredibilityScoreCronService.name);

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    private credibilityScoringService: InfluencerCredibilityScoringService,
  ) {}

  /**
   * Update credibility scores daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async updateCredibilityScoresDaily() {
    this.logger.log('🎯 Starting daily credibility score updates...');

    try {
      const influencers = await this.influencerModel.findAll({
        where: {
          instagramUserId: { $ne: null },
        },
      });

      this.logger.log(`Updating credibility scores for ${influencers.length} influencers`);

      let successCount = 0;
      let errorCount = 0;

      for (const influencer of influencers) {
        try {
          await this.credibilityScoringService.calculateCredibilityScore(influencer.id);
          successCount++;
        } catch (error) {
          this.logger.warn(`Failed to update score for influencer ${influencer.id}:`, error.message);
          errorCount++;
        }

        // Wait 2 seconds between calculations to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.logger.log(
        `✅ Credibility score updates completed! Success: ${successCount}, Errors: ${errorCount}`
      );
    } catch (error) {
      this.logger.error('❌ Error in credibility score cron:', error);
    }
  }
}
