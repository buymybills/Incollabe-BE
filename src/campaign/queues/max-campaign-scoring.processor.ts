import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/sequelize';
import { CampaignApplication } from '../models/campaign-application.model';
import { Campaign } from '../models/campaign.model';
import { Influencer } from '../../auth/model/influencer.model';
import { InfluencerProfileScoringService } from '../../shared/services/influencer-profile-scoring.service';
import { CampaignService } from '../campaign.service';
import { InstagramProfileAnalysis } from '../../shared/models/instagram-profile-analysis.model';
import { InstagramService } from '../../shared/services/instagram.service';

export interface MaxCampaignScoringJobData {
  campaignId: number;
  influencerIds?: number[]; // Optional: score only specific influencers in the campaign
}

interface InstagramSyncResult {
  synced: boolean;   // true = APIs were called and data was fetched
  failed: boolean;   // true = sync was attempted but threw an unexpected error
  reason: string;    // human-readable reason for log output
  hasInitialSnapshots: boolean; // whether syncNumber 1 & 2 exist (prerequisite for profile score)
}

@Processor('max-campaign-scoring')
export class MaxCampaignScoringProcessor {
  private readonly logger = new Logger(MaxCampaignScoringProcessor.name);

  constructor(
    @InjectModel(CampaignApplication)
    private readonly campaignApplicationModel: typeof CampaignApplication,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
    @InjectModel(Influencer)
    private readonly influencerModel: typeof Influencer,
    @InjectModel(InstagramProfileAnalysis)
    private readonly instagramProfileAnalysisModel: typeof InstagramProfileAnalysis,
    private readonly profileScoringService: InfluencerProfileScoringService,
    private readonly campaignService: CampaignService,
    private readonly instagramService: InstagramService,
  ) {}

  /**
   * Main job handler — processes all applicants for a MAX campaign.
   *
   * For each applicant:
   *   1. Fetch Instagram data via syncAllMediaInsights + syncAllInsights (if missing or stale)
   *   2. Calculate profile score (only when initial snapshots exist)
   *   3. Calculate AI matchability score (always attempted)
   *
   * Applicants are processed in parallel batches of 10 to balance throughput
   * and avoid overwhelming Instagram APIs or the DB.
   */
  @Process('score-campaign-applicants')
  async handleScoreCampaignApplicants(job: Job<MaxCampaignScoringJobData>) {
    const { campaignId, influencerIds } = job.data;

    this.logger.log(`[MAX Campaign Scoring] Starting job for campaign ${campaignId}`);

    try {
      const campaign = await this.campaignModel.findByPk(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (!campaign.isMaxCampaign) {
        this.logger.warn(`Campaign ${campaignId} is not a MAX campaign, skipping`);
        return { campaignId, skipped: true, reason: 'Not a MAX campaign' };
      }

      // Fetch all applications, optionally filtered to specific influencers
      const whereClause: any = { campaignId };
      if (influencerIds && influencerIds.length > 0) {
        whereClause.influencerId = influencerIds;
      }

      const applications = await this.campaignApplicationModel.findAll({
        where: whereClause,
        include: [{ model: Influencer, required: true }],
      });

      this.logger.log(
        `Found ${applications.length} applications to process for campaign ${campaignId}`,
      );

      if (applications.length === 0) {
        return { campaignId, totalApplications: 0, processed: 0, failed: 0 };
      }

      let processedCount = 0;
      let failedCount = 0;
      let syncedCount = 0;
      let syncSkippedCount = 0;
      let syncFailedCount = 0;

      const batchSize = 10;
      const totalBatches = Math.ceil(applications.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const batch = applications.slice(i * batchSize, (i + 1) * batchSize);

        this.logger.log(`Processing batch ${i + 1}/${totalBatches} (${batch.length} applications)`);

        // Report progress back to Bull so the job dashboard reflects current state
        await job.progress(Math.round(((i + 1) / totalBatches) * 100));

        const batchResults = await Promise.allSettled(
          batch.map(async (application) => {
            const influencerId = application.influencerId;

            // Step 1: Ensure Instagram data is available and not stale.
            // Returns a result object instead of throwing so one influencer's failure
            // does not block the rest of the batch.
            const syncResult = await this.ensureInstagramDataFetched(influencerId);

            if (syncResult.synced) {
              syncedCount++;
            } else if (syncResult.failed) {
              syncFailedCount++;
              this.logger.warn(
                `Instagram sync failed for influencer ${influencerId}: ${syncResult.reason}`,
              );
            } else {
              syncSkippedCount++;
              this.logger.debug(
                `Instagram sync skipped for influencer ${influencerId}: ${syncResult.reason}`,
              );
            }

            // Step 2: Calculate the 6-category profile score.
            // Skipped when initial snapshots are missing because the scoring service
            // depends on instagram_profile_analysis data being present.
            if (syncResult.hasInitialSnapshots) {
              await this.profileScoringService.getCompleteProfileScore(influencerId, false);
            } else {
              this.logger.warn(
                `Skipping profile score for influencer ${influencerId} — no Instagram snapshots available`,
              );
            }

            // Step 3: Calculate AI matchability score only if the brand has enabled AI scoring
            // on this campaign. Brands enable it explicitly (costs 1 AI credit) via the
            // enable-ai-score endpoint, so we must respect the flag here.
            if (campaign.aiScoreEnabled) {
              await this.calculateMatchabilityScore(application, campaign, true);
            }

            processedCount++;
          }),
        );

        // Count how many items in this batch rejected (threw past processedCount)
        for (const result of batchResults) {
          if (result.status === 'rejected') {
            failedCount++;
            this.logger.error(`Batch item failed: ${result.reason?.message || result.reason}`);
          }
        }

        // Brief pause between batches to avoid DB and API pressure
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.logger.log(`✅ MAX Campaign Scoring completed for campaign ${campaignId}`);
      this.logger.log(`   Total:             ${applications.length}`);
      this.logger.log(`   Processed:         ${processedCount}`);
      this.logger.log(`   Failed:            ${failedCount}`);
      this.logger.log(`   Instagram Synced:  ${syncedCount}`);
      this.logger.log(`   Instagram Skipped: ${syncSkippedCount}`);
      this.logger.log(`   Instagram Failed:  ${syncFailedCount}`);

      return {
        campaignId,
        totalApplications: applications.length,
        processed: processedCount,
        failed: failedCount,
        instagramSynced: syncedCount,
        instagramSkipped: syncSkippedCount,
        instagramFailed: syncFailedCount,
      };
    } catch (error) {
      this.logger.error(
        `MAX Campaign Scoring job failed for campaign ${campaignId}: ${error.message}`,
      );
      throw error; // Rethrow so Bull retries the job (up to 3 attempts with exponential backoff)
    }
  }

  /**
   * Ensures fresh Instagram data exists for the influencer before scoring.
   *
   * Prerequisites checked before syncing:
   *   - Influencer must be Instagram verified (instagramIsVerified = true)
   *   - Influencer must have Instagram connected (instagramAccessToken + instagramUserId present)
   *
   * Snapshot logic:
   *   - syncNumber 1 & 2 are the initial snapshots created during the very first sync.
   *     Their existence confirms Instagram data has been fetched at least once.
   *   - Each subsequent sync (every 15 days) creates a new snapshot with an incremented syncNumber.
   *   - If the latest snapshot is older than 15 days, a re-sync is triggered to keep
   *     profile scores and AI scores based on up-to-date metrics.
   *
   * Sync sequence (order matters):
   *   1. syncAllMediaInsights — fetches recent media posts and their insights
   *   2. syncAllInsights     — comprehensive sync: profile metrics, demographics, growth data
   *
   * Error handling:
   *   - Throttle errors (sync_throttled): logged as warning, existing data used as-is
   *   - Instagram API errors: logged as error, existing snapshots re-checked for usability
   *   - This method never throws — callers always receive a result object
   */
  private async ensureInstagramDataFetched(influencerId: number): Promise<InstagramSyncResult> {
    // Load only the fields needed to verify Instagram is connected and verified
    const influencer = await this.influencerModel.findByPk(influencerId, {
      attributes: ['id', 'instagramIsVerified', 'instagramAccessToken', 'instagramUserId'],
    });

    if (!influencer) {
      return { synced: false, failed: false, reason: 'influencer_not_found', hasInitialSnapshots: false };
    }

    if (!influencer.instagramIsVerified) {
      return { synced: false, failed: false, reason: 'not_instagram_verified', hasInitialSnapshots: false };
    }

    if (!influencer.instagramAccessToken || !influencer.instagramUserId) {
      return { synced: false, failed: false, reason: 'instagram_not_connected', hasInitialSnapshots: false };
    }

    // Fetch all snapshots sorted by id DESC so validSnapshots[0] is always the most recent.
    // Filtered in JS (not SQL WHERE) to match the same pattern used in profile-score APIs.
    const allSnapshots = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId },
      order: [['id', 'DESC']],
      attributes: ['id', 'syncNumber', 'analysisPeriodEnd', 'createdAt'],
    });

    const validSnapshots = allSnapshots.filter((s) => s.syncNumber != null);

    // syncNumber 1 & 2 are the initial pair created during the first-ever Instagram sync.
    // Both must exist before the profile scoring service can produce meaningful results.
    const hasInitialSnapshots =
      validSnapshots.filter((s) => s.syncNumber === 1 || s.syncNumber === 2).length >= 2;

    // If initial snapshots exist, check the age of the most recent snapshot.
    // Data older than 15 days is considered stale and needs a re-sync.
    if (hasInitialSnapshots && validSnapshots[0]) {
      const snapshotDate = validSnapshots[0].analysisPeriodEnd || validSnapshots[0].createdAt;
      const daysSinceLastSync =
        (Date.now() - new Date(snapshotDate).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastSync < 15) {
        return { synced: false, failed: false, reason: 'data_is_fresh', hasInitialSnapshots: true };
      }
    }

    // --- Sync required: either initial snapshots are missing or data is stale ---

    try {
      // Step 1: Fetch recent media posts and their individual insights
      await this.instagramService.syncAllMediaInsights(influencerId, 'influencer', 50);
    } catch (error) {
      const isThrottled =
        error?.response?.error === 'sync_throttled' ||
        error?.message?.includes('sync_throttled');

      if (isThrottled) {
        // The service enforces a 15-day minimum between syncs.
        // This means another process already synced recently — continue to syncAllInsights.
        this.logger.warn(
          `syncAllMediaInsights throttled for influencer ${influencerId}, continuing to syncAllInsights`,
        );
      } else {
        // Unexpected error (expired token, network failure, etc.)
        // Re-check what snapshots are available so profile scoring can still proceed if possible.
        this.logger.error(
          `syncAllMediaInsights failed for influencer ${influencerId}: ${error.message}`,
        );
        const remaining = await this.instagramProfileAnalysisModel.findAll({
          where: { influencerId },
          attributes: ['syncNumber'],
        });
        const hasExisting =
          remaining.filter((s) => s.syncNumber === 1 || s.syncNumber === 2).length >= 2;
        return { synced: false, failed: true, reason: error.message, hasInitialSnapshots: hasExisting };
      }
    }

    try {
      // Step 2: Comprehensive sync — profile metrics, audience demographics, growth data.
      // This creates or updates the instagram_profile_analysis snapshot.
      await this.instagramService.syncAllInsights(influencerId, 'influencer');
    } catch (error) {
      const isThrottled =
        error?.response?.error === 'sync_throttled' ||
        error?.message?.includes('sync_throttled');

      if (!isThrottled) {
        this.logger.error(
          `syncAllInsights failed for influencer ${influencerId}: ${error.message}`,
        );
      } else {
        this.logger.warn(
          `syncAllInsights throttled for influencer ${influencerId}`,
        );
      }

      // Re-check snapshots so we can still attempt profile scoring with existing data
      const remaining = await this.instagramProfileAnalysisModel.findAll({
        where: { influencerId },
        attributes: ['syncNumber'],
      });
      const hasExisting =
        remaining.filter((s) => s.syncNumber === 1 || s.syncNumber === 2).length >= 2;
      return {
        synced: false,
        failed: !isThrottled,
        reason: isThrottled ? 'insights_throttled' : error.message,
        hasInitialSnapshots: hasExisting,
      };
    }

    // Both syncs succeeded — confirm initial snapshots now exist
    const postSync = await this.instagramProfileAnalysisModel.findAll({
      where: { influencerId },
      attributes: ['syncNumber'],
    });
    const hasPostSyncInitial =
      postSync.filter((s) => s.syncNumber === 1 || s.syncNumber === 2).length >= 2;

    return { synced: true, failed: false, reason: 'full_sync_completed', hasInitialSnapshots: hasPostSyncInitial };
  }

  /**
   * Calculates and stores the AI matchability score for a campaign application.
   *
   * When forceRecalculate is true (default for background jobs), any existing score
   * is cleared so fresh data from the just-completed Instagram sync is used.
   */
  private async calculateMatchabilityScore(
    application: CampaignApplication,
    campaign: Campaign,
    forceRecalculate = false,
  ): Promise<void> {
    if (application.aiScore && !forceRecalculate) {
      return; // Score already exists and caller did not request a refresh
    }

    if (forceRecalculate && application.aiScore) {
      // Clear stale score so calculateAIScore computes from scratch
      await application.update({ aiScore: null, aiScoreData: null });
    }

    const result = await (this.campaignService as any).calculateAIScore(application, campaign);

    this.logger.debug(
      `AI score calculated for application ${application.id}: ${result.overallScore}`,
    );
  }
}
