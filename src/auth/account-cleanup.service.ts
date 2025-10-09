import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Influencer } from './model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { LoggerService } from '../shared/services/logger.service';
import { Op } from 'sequelize';

@Injectable()
export class AccountCleanupService {
  constructor(
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private readonly brandModel: typeof Brand,
    private readonly loggerService: LoggerService,
  ) {}

  // Run daily at 2:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
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
        await influencer.destroy({ force: true }); // Hard delete
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
        await brand.destroy({ force: true }); // Hard delete
      }

      this.loggerService.info(
        `Hard deleted ${deletedInfluencers.length} influencers and ${deletedBrands.length} brands`,
      );
    } catch (error) {
      this.loggerService.error('Error during account cleanup', error);
    }
  }
}
