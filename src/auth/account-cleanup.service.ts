import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from './model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { LoggerService } from '../shared/services/logger.service';
import { Op } from 'sequelize';

@Injectable()
export class AccountCleanupService {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    @InjectModel(ProfileReview)
    private readonly profileReviewModel: typeof ProfileReview,
    private readonly loggerService: LoggerService,
  ) {}

  // Run daily at 2:00 AM (cron: minute hour day month weekday)
  @Cron('0 2 * * *')
  async hardDeleteOldAccounts() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.loggerService.info('Starting hard deletion of accounts older than 30 days');

    try {
      // Find and hard delete influencers deleted more than 30 days ago
      const deletedInfluencers = await this.influencerModel.findAll({
        where: {
          deletedAt: {
            [Op.lte]: thirtyDaysAgo,
          },
        },
        paranoid: false, // Include soft-deleted records
      });

      for (const influencer of deletedInfluencers) {
        // Delete profile reviews first (polymorphic relationship - no CASCADE)
        await this.profileReviewModel.destroy({
          where: {
            profileId: influencer.id,
            profileType: 'influencer',
          },
          force: true,
        });

        // Now hard delete the influencer (CASCADE will handle other related records)
        await influencer.destroy({ force: true });
      }

      // Find and hard delete brands deleted more than 30 days ago
      const deletedBrands = await this.brandModel.findAll({
        where: {
          deletedAt: {
            [Op.lte]: thirtyDaysAgo,
          },
        },
        paranoid: false, // Include soft-deleted records
      });

      for (const brand of deletedBrands) {
        // Delete profile reviews first (polymorphic relationship - no CASCADE)
        await this.profileReviewModel.destroy({
          where: {
            profileId: brand.id,
            profileType: 'brand',
          },
          force: true,
        });

        // Now hard delete the brand (CASCADE will handle other related records)
        await brand.destroy({ force: true });
      }

      this.loggerService.info(
        `Hard deleted ${deletedInfluencers.length} influencers and ${deletedBrands.length} brands`,
      );
    } catch (error) {
      this.loggerService.error('Error during account cleanup', error);
    }
  }
}
