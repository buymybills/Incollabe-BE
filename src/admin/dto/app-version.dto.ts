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
import { ApiProperty } from '@nestjs/swagger';
import type { PlatformType } from '../../shared/models/app-version.model';

export class CreateAppVersionDto {
  @ApiProperty({
    description: 'Platform type',
    enum: ['ios', 'android'],
    example: 'android',
  })
  @IsEnum(['ios', 'android'])
  platform: PlatformType;

  @ApiProperty({
    description: 'Semantic version string',
    example: '5.0.0',
    pattern: '^\\d+\\.\\d+\\.\\d+(\\.\\d+)?$',
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(\.\d+)?$/, {
    message: 'Version must be in format X.Y.Z or X.Y.Z.W',
  })
  version: string;

  @ApiProperty({
    description: 'Numeric version code (build number)',
    example: 9,
    minimum: 1,
    type: Number,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  versionCode: number;

  @ApiProperty({
    description: 'Whether this update is mandatory (force update)',
    example: false,
    type: Boolean,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isMandatory: boolean;

  @ApiProperty({
    description: 'Optional custom update message',
    example: 'A new version is available. Please update to get the latest features.',
    required: false,
  })
  @IsOptional()
  @IsString()
  updateMessage?: string;
}

export class UpdateAppVersionDto {
  @ApiProperty({
    description: 'Semantic version string',
    example: '5.0.1',
    pattern: '^\\d+\\.\\d+\\.\\d+(\\.\\d+)?$',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(\.\d+)?$/, {
    message: 'Version must be in format X.Y.Z or X.Y.Z.W',
  })
  version?: string;

  @ApiProperty({
    description: 'Numeric version code (build number)',
    example: 10,
    minimum: 1,
    type: Number,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  versionCode?: number;

  @ApiProperty({
    description: 'Whether this update is mandatory (force update)',
    example: true,
    type: Boolean,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isMandatory?: boolean;

  @ApiProperty({
    description: 'Optional custom update message',
    example: 'A new version is available with bug fixes.',
    required: false,
  })
  @IsOptional()
  @IsString()
  updateMessage?: string;

  @ApiProperty({
    description: 'Whether this version is active/live',
    example: true,
    type: Boolean,
    required: false,
  })
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
  @ApiProperty({
    description: 'Platform type',
    enum: ['ios', 'android'],
    example: 'android',
  })
  @IsEnum(['ios', 'android'])
  platform: PlatformType;
}
