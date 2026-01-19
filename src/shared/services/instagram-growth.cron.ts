import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Influencer } from '../../auth/model/influencer.model';
import { InstagramProfileGrowth } from '../models/instagram-profile-growth.model';

@Injectable()
export class InstagramGrowthCronService {
  private readonly logger = new Logger(InstagramGrowthCronService.name);

  constructor(
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(InstagramProfileGrowth)
    private growthModel: typeof InstagramProfileGrowth,
  ) {}

  /**
   * Track follower growth daily at 1 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async trackFollowerGrowthDaily() {
    this.logger.log('📈 Starting daily follower growth tracking...');

    try {
      const influencers = await this.influencerModel.findAll({
        where: {
          instagramUserId: { [Op.ne]: null },
          instagramFollowersCount: { [Op.ne]: null },
        },
      });

      this.logger.log(`Tracking growth for ${influencers.length} influencers`);

      for (const influencer of influencers) {
        try {
          await this.growthModel.create({
            influencerId: influencer.id,
            instagramUserId: influencer.instagramUserId,
            instagramUsername: influencer.instagramUsername,
            followersCount: influencer.instagramFollowersCount,
            followsCount: influencer.instagramFollowsCount || 0,
            mediaCount: influencer.instagramMediaCount || 0,
            snapshotDate: new Date(),
          });
        } catch (error) {
          this.logger.warn(`Failed to track growth for influencer ${influencer.id}:`, error.message);
        }
      }

      this.logger.log('✅ Follower growth tracking completed!');
    } catch (error) {
      this.logger.error('❌ Error in growth tracking cron:', error);
    }
  }
}
