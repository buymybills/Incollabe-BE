import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppVersion, PlatformType } from '../models/app-version.model';

export interface AppVersionConfig {
  platform: PlatformType;
  latestVersion: string;
  latestVersionCode: number;
  minimumVersion: string;
  minimumVersionCode: number;
  forceUpdate: boolean;
  updateMessage: string;
  forceUpdateMessage: string;
}

@Injectable()
export class AppVersionService {
  private readonly logger = new Logger(AppVersionService.name);
  private versionCache: Map<PlatformType, AppVersionConfig> = new Map();
  private cacheExpiry: Map<PlatformType, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    @InjectModel(AppVersion)
    private readonly appVersionModel: typeof AppVersion,
  ) {}

  /**
   * Get active version configuration for a platform
   * Results are cached for 5 minutes to reduce database queries
   */
  async getVersionConfig(platform: PlatformType): Promise<AppVersionConfig | null> {
    // Check cache
    const cached = this.versionCache.get(platform);
    const cacheTime = this.cacheExpiry.get(platform);

    if (cached && cacheTime && Date.now() < cacheTime) {
      return cached;
    }

    // Fetch from database
    const config = await this.appVersionModel.findOne({
      where: {
        platform,
        isActive: true,
      },
    });

    if (!config) {
      this.logger.warn(`No active version configuration found for platform: ${platform}`);
      return null;
    }

    const versionConfig: AppVersionConfig = {
      platform: config.platform,
      latestVersion: config.latestVersion,
      latestVersionCode: config.latestVersionCode,
      minimumVersion: config.minimumVersion,
      minimumVersionCode: config.minimumVersionCode,
      forceUpdate: config.forceUpdate,
      updateMessage: config.updateMessage,
      forceUpdateMessage: config.forceUpdateMessage,
    };

    // Update cache
    this.versionCache.set(platform, versionConfig);
    this.cacheExpiry.set(platform, Date.now() + this.CACHE_TTL);

    return versionConfig;
  }

  /**
   * Get version info for both platforms (for admin/debugging purposes)
   */
  async getAllVersionConfigs(): Promise<AppVersionConfig[]> {
    const configs = await this.appVersionModel.findAll({
      where: {
        isActive: true,
      },
      order: [['platform', 'ASC']],
    });

    return configs.map(config => ({
      platform: config.platform,
      latestVersion: config.latestVersion,
      latestVersionCode: config.latestVersionCode,
      minimumVersion: config.minimumVersion,
      minimumVersionCode: config.minimumVersionCode,
      forceUpdate: config.forceUpdate,
      updateMessage: config.updateMessage,
      forceUpdateMessage: config.forceUpdateMessage,
    }));
  }

  /**
   * Check if an app version requires update
   */
  async checkVersionStatus(
    platform: PlatformType,
    installedVersionCode: number,
  ): Promise<{
    updateRequired: boolean;
    updateAvailable: boolean;
    forceUpdate: boolean;
    updateMessage: string;
    config: AppVersionConfig | null;
  }> {
    const config = await this.getVersionConfig(platform);

    if (!config) {
      return {
        updateRequired: false,
        updateAvailable: false,
        forceUpdate: false,
        updateMessage: '',
        config: null,
      };
    }

    const updateRequired = installedVersionCode < config.minimumVersionCode;
    const updateAvailable = installedVersionCode < config.latestVersionCode;
    const forceUpdate = config.forceUpdate && updateRequired;

    return {
      updateRequired,
      updateAvailable,
      forceUpdate,
      updateMessage: forceUpdate ? config.forceUpdateMessage : config.updateMessage,
      config,
    };
  }

  /**
   * Clear version cache (useful after updating version configs)
   */
  clearCache(platform?: PlatformType): void {
    if (platform) {
      this.versionCache.delete(platform);
      this.cacheExpiry.delete(platform);
      this.logger.log(`Version cache cleared for platform: ${platform}`);
    } else {
      this.versionCache.clear();
      this.cacheExpiry.clear();
      this.logger.log('All version caches cleared');
    }
  }

  /**
   * Update version configuration for a platform
   */
  async updateVersionConfig(
    platform: PlatformType,
    updates: Partial<Omit<AppVersionConfig, 'platform'>>,
  ): Promise<AppVersion> {
    const config = await this.appVersionModel.findOne({
      where: {
        platform,
        isActive: true,
      },
    });

    if (!config) {
      throw new Error(`No active version configuration found for platform: ${platform}`);
    }

    await config.update(updates);
    this.clearCache(platform);

    this.logger.log(`Version configuration updated for platform: ${platform}`);
    return config;
  }
}
