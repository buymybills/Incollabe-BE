import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import {
  Platform,
  DeliverableType,
} from '../models/campaign-deliverable.model';

export class CreateCampaignDeliverableDto {
  @IsEnum(Platform)
  platform: Platform;

  @IsEnum(DeliverableType)
  type: DeliverableType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  specifications?: string;
}
