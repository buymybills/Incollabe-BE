import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppReviewRequest, UserType } from '../models/app-review-request.model';
import { CampaignInvitation, InvitationStatus } from '../../campaign/models/campaign-invitation.model';
import { Campaign, CampaignStatus } from '../../campaign/models/campaign.model';
import { Op } from 'sequelize';

@Injectable()
export class AppReviewService {
  private readonly logger = new Logger(AppReviewService.name);

  // Constants for review prompt logic
  private readonly CAMPAIGN_THRESHOLD = 5; // Show prompt after 5 campaigns
  private readonly WEEKS_BETWEEN_PROMPTS = 5; // Repeat every 5 weeks

  constructor(
    @InjectModel(AppReviewRequest)
    private readonly appReviewRequestModel: typeof AppReviewRequest,
    @InjectModel(CampaignInvitation)
    private readonly campaignInvitationModel: typeof CampaignInvitation,
    @InjectModel(Campaign)
    private readonly campaignModel: typeof Campaign,
  ) {}

  /**
   * Check if the user should be shown the review prompt
   * Returns shouldShow: boolean and reason: string
   */
  async shouldShowReviewPrompt(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<{ shouldShow: boolean; reason?: string; campaignCount?: number }> {
    try {
      // Check if user has already reviewed
      const existingRequest = await this.appReviewRequestModel.findOne({
        where: {
          userId,
          userType: userType as UserType,
        },
      });

      // If already reviewed, never show again
      if (existingRequest?.isReviewed) {
        return {
          shouldShow: false,
          reason: 'User has already provided a review',
        };
      }

      // Count campaigns based on user type
      let campaignCount = 0;
      if (userType === 'influencer') {
        campaignCount = await this.getInfluencerCampaignCount(userId);
      } else {
        campaignCount = await this.getBrandCampaignCount(userId);
      }

      // Check if user has reached the threshold
      if (campaignCount < this.CAMPAIGN_THRESHOLD) {
        return {
          shouldShow: false,
          reason: `User has only ${campaignCount} campaigns, need ${this.CAMPAIGN_THRESHOLD}`,
          campaignCount,
        };
      }

      // If no existing request, this is the first time - show prompt
      if (!existingRequest) {
        return {
          shouldShow: true,
          reason: 'First prompt - user has reached campaign threshold',
          campaignCount,
        };
      }

      // Check if enough time has passed since last prompt (5 weeks = 35 days)
      const daysSinceLastPrompt = this.getDaysSince(existingRequest.lastPromptedAt);
      const weeksSinceLastPrompt = daysSinceLastPrompt / 7;

      if (weeksSinceLastPrompt >= this.WEEKS_BETWEEN_PROMPTS) {
        return {
          shouldShow: true,
          reason: `${Math.floor(weeksSinceLastPrompt)} weeks have passed since last prompt`,
          campaignCount,
        };
      }

      return {
        shouldShow: false,
        reason: `Only ${Math.floor(weeksSinceLastPrompt)} weeks since last prompt, need ${this.WEEKS_BETWEEN_PROMPTS}`,
        campaignCount,
      };
    } catch (error) {
      this.logger.error(
        `Error checking review prompt for ${userType} ${userId}: ${error.message}`,
        error.stack,
      );
      return {
        shouldShow: false,
        reason: 'Error occurred while checking eligibility',
      };
    }
  }

  /**
   * Get the count of campaigns an influencer has been selected in (invitation accepted)
   */
  private async getInfluencerCampaignCount(influencerId: number): Promise<number> {
    return await this.campaignInvitationModel.count({
      where: {
        influencerId,
        status: InvitationStatus.ACCEPTED,
      },
    });
  }

  /**
   * Get the count of campaigns a brand has posted (active or completed)
   */
  private async getBrandCampaignCount(brandId: number): Promise<number> {
    return await this.campaignModel.count({
      where: {
        brandId,
        status: {
          [Op.in]: [CampaignStatus.ACTIVE, CampaignStatus.COMPLETED],
        },
      },
    });
  }

  /**
   * Calculate days since a given date
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  }

  /**
   * Record that the review prompt was shown to the user
   * This creates or updates the record
   */
  async recordPromptShown(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<AppReviewRequest> {
    try {
      const existingRequest = await this.appReviewRequestModel.findOne({
        where: {
          userId,
          userType: userType as UserType,
        },
      });

      if (existingRequest) {
        // Update existing record
        existingRequest.lastPromptedAt = new Date();
        existingRequest.promptCount += 1;
        await existingRequest.save();

        this.logger.log(
          `Updated review prompt record for ${userType} ${userId}. Prompt count: ${existingRequest.promptCount}`,
        );

        return existingRequest;
      } else {
        // Create new record
        const newRequest = await this.appReviewRequestModel.create({
          userId,
          userType: userType as UserType,
          firstPromptedAt: new Date(),
          lastPromptedAt: new Date(),
          promptCount: 1,
          isReviewed: false,
        });

        this.logger.log(
          `Created first review prompt record for ${userType} ${userId}`,
        );

        return newRequest;
      }
    } catch (error) {
      this.logger.error(
        `Error recording prompt for ${userType} ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark the user as having completed the review
   */
  async markAsReviewed(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<AppReviewRequest> {
    try {
      let request = await this.appReviewRequestModel.findOne({
        where: {
          userId,
          userType: userType as UserType,
        },
      });

      if (!request) {
        // Create a new record if it doesn't exist
        request = await this.appReviewRequestModel.create({
          userId,
          userType: userType as UserType,
          firstPromptedAt: new Date(),
          lastPromptedAt: new Date(),
          promptCount: 0,
          isReviewed: true,
          reviewedAt: new Date(),
        });
      } else {
        // Update existing record
        request.isReviewed = true;
        request.reviewedAt = new Date();
        await request.save();
      }

      this.logger.log(
        `Marked ${userType} ${userId} as having completed app review`,
      );

      return request;
    } catch (error) {
      this.logger.error(
        `Error marking review as completed for ${userType} ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get review request status for a user
   */
  async getReviewStatus(
    userId: number,
    userType: 'influencer' | 'brand',
  ): Promise<AppReviewRequest | null> {
    return await this.appReviewRequestModel.findOne({
      where: {
        userId,
        userType: userType as UserType,
      },
    });
  }
}
