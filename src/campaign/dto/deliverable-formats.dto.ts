import { IsEnum, IsOptional } from 'class-validator';
import { CampaignType } from '../models/campaign.model';

export class GetDeliverableFormatsDto {
  @IsOptional()
  @IsEnum(CampaignType)
  campaignType?: CampaignType;
}

export interface DeliverableFormatOption {
  value: string;
  label: string;
  platform: string;
}

export class DeliverableFormatsResponseDto {
  campaignType: CampaignType;
  deliverableFormats: DeliverableFormatOption[];
}
