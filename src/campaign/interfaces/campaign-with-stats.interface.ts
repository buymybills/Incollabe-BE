import { Campaign } from '../models/campaign.model';

export interface CampaignWithApplicationStats extends Campaign {
  totalApplications: number;
}

export interface CampaignWithInviteStats extends Campaign {
  totalInvites: number;
}

export interface CampaignWithStats extends Campaign {
  totalApplications?: number;
  totalInvites?: number;
}

export interface CampaignsByCategoryResponse {
  campaigns: CampaignWithStats[];
}

export enum CampaignCategoryType {
  OPEN = 'open',
  INVITE = 'invite',
  FINISHED = 'finished',
}
