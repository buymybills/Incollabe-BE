import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { PlatformType } from '../../shared/models/app-version.model';

export class CreateAppVersionDto {
  @IsEnum(['ios', 'android'])
  platform: PlatformType;

  @IsString()
  @Matches(/^\d+\.\d+\.\d+(\.\d+)?$/, {
    message: 'Version must be in format X.Y.Z or X.Y.Z.W',
  })
  version: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  versionCode: number;

  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isMandatory: boolean;

  @IsOptional()
  @IsString()
  updateMessage?: string;
}

export class UpdateAppVersionDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(\.\d+)?$/, {
    message: 'Version must be in format X.Y.Z or X.Y.Z.W',
  })
  version?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  versionCode?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsString()
  updateMessage?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}

export class GetVersionsQueryDto {
  @IsOptional()
  @IsEnum(['ios', 'android'])
  platform?: PlatformType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

export class AppVersionResponseDto {
  id: number;
  platform: PlatformType;
  version: string;
  versionCode: number;
  status: 'live' | 'down';
  updateType: 'mandatory' | 'optional';
  systemLive: number;
  penetration: number;
  liveDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ActivateVersionDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  versionId: number;

  @IsEnum(['ios', 'android'])
  platform: PlatformType;
}
