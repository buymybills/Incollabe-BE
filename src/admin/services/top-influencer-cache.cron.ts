import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InfluencerScoringService } from './influencer-scoring.service';

@Injectable()
export class TopInfluencerCacheCronService {
  private readonly logger = new Logger(TopInfluencerCacheCronService.name);

  constructor(private readonly influencerScoringService: InfluencerScoringService) {}

  /**
   * Rebuild top influencer score cache every day at 2 AM.
   * The /api/influencer/top-influencers endpoint reads from this cache
   * instead of computing scores on every request.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async rebuildTopInfluencerScoreCache() {
    this.logger.log('🏆 Starting daily top influencer score cache rebuild...');

    try {
      const { updated, errors } = await this.influencerScoringService.refreshTopInfluencerScoreCache();
      this.logger.log(`✅ Top influencer score cache rebuilt — updated: ${updated}, errors: ${errors}`);
    } catch (error) {
      this.logger.error('❌ Failed to rebuild top influencer score cache:', error);
    }
  }
}
