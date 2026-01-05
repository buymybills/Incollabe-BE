import { CampaignStatus, CampaignType } from '../models/campaign.model';

export class CityDto {
  id: number;
  name: string;
  tier: number;
}

export class BrandDto {
  id: number;
  brandName: string;
  profileImage: string;
  websiteUrl: string;
}

export class CampaignDeliverableDto {
  id: number;
  platform: string;
  type: string;
  budget: number;
  quantity: number;
  specifications: string;
}

export class CampaignInvitationDto {
  id: number;
  status: string;
  influencer: {
    id: number;
    name: string;
    username: string;
    profileImage: string;
  };
}

export class CampaignResponseDto {
  id: number;
  name: string;
  description?: string;
  category?: string;
  deliverableFormat?: string[]; // Array of deliverable type strings
  status: CampaignStatus;
  type: CampaignType;
  startDate?: Date;
  endDate?: Date;
  isPanIndia: boolean;
  minAge?: number;
  maxAge?: number;
  isOpenToAllAges: boolean;
  genderPreferences?: string[];
  isOpenToAllGenders: boolean;
  nicheIds?: number[];
  customInfluencerRequirements?: string;
  performanceExpectations?: string;
  brandSupport?: string;
  campaignBudget?: number;
  barterProductWorth?: number;
  additionalMonetaryPayout?: number;
  numberOfInfluencers?: number;
  isActive: boolean;
  isMaxCampaign?: boolean;
  isInviteOnly?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  brand?: BrandDto;
  cities?: CityDto[];
  deliverables?: CampaignDeliverableDto[]; // Full deliverable objects with budget/quantity
  invitations?: CampaignInvitationDto[];
  totalApplications?: number;
}
