import { IsOptional, IsEnum, IsString, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { CampaignStatus, CampaignType } from '../models/campaign.model';

export class GetCampaignsDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @IsOptional()
  @IsString()
  search?: string;
}
