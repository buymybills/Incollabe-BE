import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ApiActivityLog } from '../models/api-activity-log.model';

@Injectable()
export class ApiLogCleanupCronService {
  private readonly logger = new Logger(ApiLogCleanupCronService.name);

  constructor(
    @InjectModel(ApiActivityLog)
    private apiActivityLogModel: typeof ApiActivityLog,
  ) {}

  /**
   * Delete api_activity_logs records older than 30 days
   * Runs every day at 2:00 AM IST
   */
  @Cron('0 0 2 * * *', { name: 'api-log-cleanup', timeZone: 'Asia/Kolkata' })
  async cleanupOldLogs() {
    this.logger.log('Starting API log cleanup cron job...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const deleted = await this.apiActivityLogModel.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate },
        },
      });

      this.logger.log(`API log cleanup completed: deleted ${deleted} records older than 30 days`);
    } catch (error) {
      this.logger.error('API log cleanup cron job failed:', error);
    }
  }
}
