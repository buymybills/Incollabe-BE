import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApplicationStatus } from '../models/campaign-application.model';

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
