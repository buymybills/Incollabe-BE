import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppVersion, PlatformType } from '../models/app-version.model';
import { DeviceToken } from '../models/device-token.model';
import { isVersionLessThan } from '../utils/version-compare.util';
import { Op } from 'sequelize';

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
    @InjectModel(DeviceToken)
    private readonly deviceTokenModel: typeof DeviceToken,
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
      raw: true,
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
   *
   * Compares BOTH versionCode (numeric) and appVersion (semantic string)
   * Update is needed if EITHER check indicates an older version
   *
   * @param platform - 'ios' or 'android'
   * @param installedVersionCode - Numeric build code (e.g., 7)
   * @param installedAppVersion - Semantic version string (e.g., "4.0.0")
   * @returns Object with updateAvailable, forceUpdate flags
   */
  async checkVersionStatus(
    platform: PlatformType,
    installedVersionCode: number,
    installedAppVersion?: string,
  ): Promise<{
    updateAvailable: boolean;
    forceUpdate: boolean;
    updateMessage: string;
    config: AppVersionConfig | null;
  }> {
    const config = await this.getVersionConfig(platform);

    if (!config) {
      return {
        updateAvailable: false,
        forceUpdate: false,
        updateMessage: '',
        config: null,
      };
    }

    // Check 1: Compare numeric version codes
    const versionCodeNeedsUpdate = installedVersionCode < config.latestVersionCode;
    const versionCodeBelowMinimum = installedVersionCode < config.minimumVersionCode;

    // Check 2: Compare semantic version strings (if provided)
    let appVersionNeedsUpdate = false;
    let appVersionBelowMinimum = false;

    if (installedAppVersion) {
      appVersionNeedsUpdate = isVersionLessThan(installedAppVersion, config.latestVersion);
      appVersionBelowMinimum = isVersionLessThan(installedAppVersion, config.minimumVersion);
    }

    // Update available if EITHER check indicates older version
    const updateAvailable = versionCodeNeedsUpdate || appVersionNeedsUpdate;

    // Force update if:
    // 1. forceUpdate flag is enabled in database
    // 2. AND (versionCode OR appVersion is below minimum)
    const belowMinimum = versionCodeBelowMinimum || appVersionBelowMinimum;
    const forceUpdate = config.forceUpdate && belowMinimum;

    return {
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

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Create a new app version (Admin only)
   */
  async createVersion(data: {
    platform: PlatformType;
    version: string;
    versionCode: number;
    isMandatory: boolean;
    updateMessage?: string;
  }): Promise<AppVersion> {
    // Check if version already exists
    const existing = await this.appVersionModel.findOne({
      where: {
        platform: data.platform,
        [Op.or]: [
          { latestVersion: data.version },
          { latestVersionCode: data.versionCode },
        ],
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Version ${data.version} (code: ${data.versionCode}) already exists for ${data.platform}`,
      );
    }

    // Create new version (inactive by default)
    const newVersion = await this.appVersionModel.create({
      platform: data.platform,
      latestVersion: data.version,
      latestVersionCode: data.versionCode,
      minimumVersion: data.version,
      minimumVersionCode: data.versionCode,
      forceUpdate: data.isMandatory,
      updateMessage: data.updateMessage || 'A new version is available. Please update to get the latest features and improvements.',
      forceUpdateMessage: data.isMandatory
        ? 'This version is no longer supported. Please update to continue using the app.'
        : 'A new version is available. Please update to get the latest features and improvements.',
      isActive: false, // New versions are inactive by default
    } as any);

    this.logger.log(`New app version created: ${data.platform} ${data.version} (code: ${data.versionCode})`);
    return newVersion;
  }

  /**
   * Get all versions with metrics (Admin only)
   */
  async getAllVersionsWithMetrics(
    platform?: PlatformType,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    versions: Array<{
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
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: any = {};
    if (platform) {
      where.platform = platform;
    }

    const { count, rows } = await this.appVersionModel.findAndCountAll({
      where,
      order: [
        ['platform', 'ASC'],
        ['latestVersionCode', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset: (page - 1) * limit,
    });

    // Calculate metrics for each version
    const versionsWithMetrics = await Promise.all(
      rows.map(async (version) => {
        const metrics = await this.calculateVersionMetrics(
          version.platform,
          version.latestVersion,
          version.latestVersionCode,
        );

        return {
          id: version.id,
          platform: version.platform,
          version: version.latestVersion,
          versionCode: version.latestVersionCode,
          status: version.isActive ? ('live' as const) : ('down' as const),
          updateType: version.forceUpdate ? ('mandatory' as const) : ('optional' as const),
          systemLive: metrics.systemLive,
          penetration: metrics.penetration,
          liveDate: version.createdAt,
          createdAt: version.createdAt,
          updatedAt: version.updatedAt,
        };
      }),
    );

    return {
      versions: versionsWithMetrics,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  }

  /**
   * Calculate metrics for a specific version
   */
  private async calculateVersionMetrics(
    platform: PlatformType,
    version: string,
    versionCode: number,
  ): Promise<{ systemLive: number; penetration: number }> {
    const platformFilter = platform === 'ios' ? 'ios' : 'android';

    // Count devices on this specific version
    // Build OR conditions, filtering out null/undefined values
    const orConditions: Array<{ appVersion?: string; versionCode?: number }> = [];
    if (version) {
      orConditions.push({ appVersion: version });
    }
    if (versionCode) {
      orConditions.push({ versionCode: versionCode });
    }

    // If no valid version identifiers, return 0
    if (orConditions.length === 0) {
      return { systemLive: 0, penetration: 0 };
    }

    const systemLive = await this.deviceTokenModel.count({
      where: {
        deviceOs: platformFilter,
        [Op.or]: orConditions,
      },
    });

    // Count total active devices for this platform (used in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalDevices = await this.deviceTokenModel.count({
      where: {
        deviceOs: platformFilter,
        lastUsedAt: {
          [Op.gte]: thirtyDaysAgo,
        },
      },
    });

    const penetration = totalDevices > 0 ? (systemLive / totalDevices) * 100 : 0;

    return {
      systemLive,
      penetration: Math.round(penetration * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Activate a specific version (make it live)
   */
  async activateVersion(versionId: number, platform: PlatformType): Promise<AppVersion> {
    const version = await this.appVersionModel.findOne({
      where: {
        id: versionId,
        platform,
      },
    });

    if (!version) {
      throw new NotFoundException(`Version with ID ${versionId} not found for platform ${platform}`);
    }

    if (version.isActive) {
      throw new BadRequestException(`Version ${version.latestVersion} is already active`);
    }

    // Deactivate all other versions for this platform
    await this.appVersionModel.update(
      { isActive: false },
      {
        where: {
          platform,
          isActive: true,
        },
      },
    );

    // Activate this version
    await version.update({ isActive: true });

    // Clear cache
    this.clearCache(platform);

    this.logger.log(`Activated version: ${platform} ${version.latestVersion} (ID: ${versionId})`);
    return version;
  }

  /**
   * Deactivate a specific version
   */
  async deactivateVersion(versionId: number, platform: PlatformType): Promise<AppVersion> {
    const version = await this.appVersionModel.findOne({
      where: {
        id: versionId,
        platform,
      },
    });

    if (!version) {
      throw new NotFoundException(`Version with ID ${versionId} not found for platform ${platform}`);
    }

    if (!version.isActive) {
      throw new BadRequestException(`Version ${version.latestVersion} is already inactive`);
    }

    // Deactivate this version
    await version.update({ isActive: false });

    // Clear cache
    this.clearCache(platform);

    this.logger.log(`Deactivated version: ${platform} ${version.latestVersion} (ID: ${versionId})`);
    return version;
  }

  /**
   * Update version details (Admin only)
   */
  async updateVersion(
    versionId: number,
    updates: {
      version?: string;
      versionCode?: number;
      isMandatory?: boolean;
      updateMessage?: string;
    },
  ): Promise<AppVersion> {
    const version = await this.appVersionModel.findByPk(versionId);

    if (!version) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    const updateData: any = {};

    if (updates.version !== undefined) {
      updateData.latestVersion = updates.version;
      updateData.minimumVersion = updates.version;
    }

    if (updates.versionCode !== undefined) {
      updateData.latestVersionCode = updates.versionCode;
      updateData.minimumVersionCode = updates.versionCode;
    }

    if (updates.isMandatory !== undefined) {
      updateData.forceUpdate = updates.isMandatory;
    }

    if (updates.updateMessage !== undefined) {
      updateData.updateMessage = updates.updateMessage;
    }

    await version.update(updateData);

    // Clear cache if this version is active
    if (version.isActive) {
      this.clearCache(version.platform);
    }

    this.logger.log(`Updated version: ${version.platform} ${version.latestVersion} (ID: ${versionId})`);
    return version;
  }

  /**
   * Delete a version (Admin only)
   * Only inactive versions can be deleted
   */
  async deleteVersion(versionId: number): Promise<void> {
    const version = await this.appVersionModel.findByPk(versionId);

    if (!version) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    if (version.isActive) {
      throw new BadRequestException('Cannot delete an active version. Deactivate it first.');
    }

    await version.destroy();

    this.logger.log(`Deleted version: ${version.platform} ${version.latestVersion} (ID: ${versionId})`);
  }

  /**
   * Get current live versions for both platforms
   */
  async getCurrentVersions(): Promise<{
    ios: { version: string; liveDate: Date } | null;
    android: { version: string; liveDate: Date } | null;
  }> {
    const [iosVersion, androidVersion] = await Promise.all([
      this.appVersionModel.findOne({
        where: { platform: 'ios', isActive: true },
      }),
      this.appVersionModel.findOne({
        where: { platform: 'android', isActive: true },
      }),
    ]);

    return {
      ios: iosVersion
        ? {
            version: iosVersion.latestVersion,
            liveDate: iosVersion.createdAt,
          }
        : null,
      android: androidVersion
        ? {
            version: androidVersion.latestVersion,
            liveDate: androidVersion.createdAt,
          }
        : null,
    };
  }
}
