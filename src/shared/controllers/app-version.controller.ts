import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AppVersionService } from '../services/app-version.service';
import { PlatformType } from '../models/app-version.model';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('App Version')
@Controller('app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Public()
  @Get('check')
  @ApiOperation({
    summary: 'Check if app needs a mandatory update',
    description: 'Pass the device OS, version code, and app version. Returns whether a mandatory update is required.',
  })
  @ApiQuery({ name: 'deviceOs', required: true, enum: ['ios', 'android'] })
  @ApiQuery({ name: 'versionCode', required: true, type: Number, description: 'Numeric build ID (e.g. 7)' })
  @ApiQuery({ name: 'appVersion', required: true, type: String, description: 'Semantic version string (e.g. "5.0.2")' })
  @ApiResponse({
    status: 200,
    description:
      '`mandatoryUpdate: true` — block the app, force user to update.\n' +
      '`mandatoryUpdate: false, updateAvailable: true` — show a soft "Update available" banner, user can dismiss.\n' +
      '`mandatoryUpdate: false, updateAvailable: false` — app is up to date, do nothing.',
    schema: {
      type: 'object',
      properties: {
        mandatoryUpdate:  { type: 'boolean', example: false },
        updateAvailable:  { type: 'boolean', example: true },
        message:          { type: 'string',  example: 'A new version is available. Please update to get the latest features.' },
        latestVersion:    { type: 'string',  example: '5.1.0' },
        latestVersionCode: { type: 'number', example: 8 },
      },
    },
  })
  async checkVersion(
    @Query('deviceOs') deviceOs: string,
    @Query('versionCode') versionCodeStr: string,
    @Query('appVersion') appVersion: string,
  ) {
    if (!deviceOs || (deviceOs !== 'ios' && deviceOs !== 'android')) {
      throw new BadRequestException('deviceOs must be "ios" or "android"');
    }

    if (!versionCodeStr) {
      throw new BadRequestException('versionCode is required');
    }

    const versionCode = parseInt(versionCodeStr, 10);
    if (isNaN(versionCode) || versionCode < 0) {
      throw new BadRequestException('versionCode must be a valid number');
    }

    if (!appVersion) {
      throw new BadRequestException('appVersion is required');
    }

    const result = await this.appVersionService.checkVersionStatus(
      deviceOs as PlatformType,
      versionCode,
      appVersion,
    );

    return {
      mandatoryUpdate:   result.forceUpdate,
      updateAvailable:   result.updateAvailable,
      message:           result.updateMessage,
      latestVersion:     result.config?.latestVersion ?? null,
      latestVersionCode: result.config?.latestVersionCode ?? null,
    };
  }
}
