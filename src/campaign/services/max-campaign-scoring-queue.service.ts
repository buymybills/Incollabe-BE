import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { MaxCampaignScoringJobData } from '../queues/max-campaign-scoring.processor';

@Injectable()
export class MaxCampaignScoringQueueService {
  private readonly logger = new Logger(MaxCampaignScoringQueueService.name);

  constructor(
    @InjectQueue('max-campaign-scoring')
    private readonly scoringQueue: Queue,
  ) {}

  /**
   * Queue scoring job for all applicants of a MAX campaign
   */
  async queueCampaignScoring(campaignId: number): Promise<void> {
    this.logger.log(
      `[Queue] Adding MAX campaign scoring job for campaign ${campaignId}`,
    );

    await this.scoringQueue.add(
      'score-campaign-applicants',
      {
        campaignId,
      } as MaxCampaignScoringJobData,
      {
        attempts: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay
        },
        removeOnComplete: true,
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    this.logger.log(
      `[Queue] Successfully queued scoring job for campaign ${campaignId}`,
    );
  }

  /**
   * Queue scoring job for specific influencers in a MAX campaign
   */
  async queueInfluencerScoring(
    campaignId: number,
    influencerIds: number[],
  ): Promise<void> {
    this.logger.log(
      `[Queue] Adding MAX campaign scoring job for ${influencerIds.length} influencers in campaign ${campaignId}`,
    );

    await this.scoringQueue.add(
      'score-campaign-applicants',
      {
        campaignId,
        influencerIds,
      } as MaxCampaignScoringJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `[Queue] Successfully queued scoring job for ${influencerIds.length} influencers`,
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.scoringQueue.getWaitingCount(),
      this.scoringQueue.getActiveCount(),
      this.scoringQueue.getCompletedCount(),
      this.scoringQueue.getFailedCount(),
      this.scoringQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clear all failed jobs
   */
  async clearFailedJobs(): Promise<void> {
    const failedJobs = await this.scoringQueue.getFailed();
    await Promise.all(failedJobs.map((job) => job.remove()));
    this.logger.log(`Cleared ${failedJobs.length} failed jobs`);
  }
}
