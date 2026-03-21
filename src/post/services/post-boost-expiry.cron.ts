import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostService } from '../post.service';

@Injectable()
export class PostBoostExpiryCronService {
  private readonly logger = new Logger(PostBoostExpiryCronService.name);

  constructor(private readonly postService: PostService) {}

  /**
   * Cron job to expire boosted posts
   * Runs every hour to check and expire posts that have exceeded 24 hours
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleBoostExpiry() {
    this.logger.log('⏰ Running boost expiry cron job...');

    try {
      await this.postService.expireBoostedPosts();
      this.logger.log('✅ Boost expiry check completed successfully');
    } catch (error) {
      this.logger.error('❌ Error in boost expiry cron job:', error);
    }
  }
}
