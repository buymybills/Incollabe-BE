import { Campaign } from '../models/campaign.model';
import { CampaignWithStats } from '../interfaces/campaign-with-stats.interface';

/**
 * Helper class for calculating campaign statistics
 */
export class CampaignStatsHelper {
  /**
   * Add application count to open campaign
   */
  static addApplicationCount(campaign: Campaign): CampaignWithStats {
    const campaignData = campaign.toJSON() as any;
    campaignData.totalApplications = campaign.applications?.length ?? 0;
    return campaignData as CampaignWithStats;
  }

  /**
   * Add invite count to invite-only campaign
   */
  static addInviteCount(campaign: Campaign): CampaignWithStats {
    const campaignData = campaign.toJSON() as any;
    campaignData.totalInvites = campaign.invitations?.length ?? 0;
    return campaignData as CampaignWithStats;
  }

  /**
   * Add appropriate stats based on campaign type
   */
  static addStatsBasedOnType(campaign: Campaign): CampaignWithStats {
    const campaignData = campaign.toJSON() as any;

    if (!campaign.isActive) {
      // Finished campaign - no extra count needed
      return campaignData as CampaignWithStats;
    }

    if (campaign.isInviteOnly) {
      campaignData.totalInvites = campaign.invitations?.length ?? 0;
    } else {
      campaignData.totalApplications = campaign.applications?.length ?? 0;
    }

    return campaignData as CampaignWithStats;
  }

  /**
   * Batch process campaigns with stats
   */
  static addStatsToCampaigns(
    campaigns: Campaign[],
    processor: (campaign: Campaign) => CampaignWithStats,
  ): CampaignWithStats[] {
    return campaigns.map(processor);
  }
}
