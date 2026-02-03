import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { ErrorLog } from '../models/error-log.model';
import { LoggerService } from '../services/logger.service';
import { Op } from 'sequelize';

/**
 * Error Cleanup Cron Service
 *
 * Automatically cleans up old error logs to prevent database bloat
 * Runs daily at 2:00 AM and deletes errors older than 30 days
 */
@Injectable()
export class ErrorCleanupCronService {
  private readonly RETENTION_DAYS = 30;

  constructor(
    @InjectModel(ErrorLog)
    private readonly errorLogModel: typeof ErrorLog,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Clean up errors older than 30 days
   * Runs every day at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleErrorCleanup() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      const deletedCount = await this.errorLogModel.destroy({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      this.loggerService.info(
        `🧹 Error cleanup completed: Deleted ${deletedCount} error logs older than ${this.RETENTION_DAYS} days`,
      );
    } catch (error) {
      this.loggerService.error('Error cleanup cron job failed:', error);
    }
  }
}
