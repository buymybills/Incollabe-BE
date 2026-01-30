import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DeviceToken, UserType } from './models/device-token.model';
import { Op } from 'sequelize';

interface AddDeviceTokenParams {
  userId: number;
  userType: UserType;
  fcmToken: string;
  deviceId?: string;
  deviceName?: string;
  deviceOs?: 'ios' | 'android';
  appVersion?: string;
  versionCode?: number;
}

@Injectable()
export class DeviceTokenService {
  private readonly MAX_DEVICES_PER_USER = 5;

  constructor(
    @InjectModel(DeviceToken)
    private deviceTokenModel: typeof DeviceToken,
  ) {}

  /**
   * Add or update FCM token for a device
   * - If token already exists, update lastUsedAt and device info
   * - If user has >= 5 devices, remove the oldest one
   * - Add the new device token
   */
  async addOrUpdateDeviceToken(params: AddDeviceTokenParams): Promise<DeviceToken> {
    const { userId, userType, fcmToken, deviceId, deviceName, deviceOs, appVersion, versionCode } = params;

    // If deviceId is provided, use upsert pattern to prevent duplicates
    if (deviceId) {
      // Find existing device by userId + userType + deviceId
      let existingDevice = await this.deviceTokenModel.findOne({
        where: {
          userId,
          userType,
          deviceId,
        },
      });

      if (existingDevice) {
        // Device exists - update it with new data
        await existingDevice.update({
          fcmToken,
          deviceName: deviceName || existingDevice.deviceName,
          deviceOs: deviceOs || existingDevice.deviceOs,
          appVersion: appVersion || existingDevice.appVersion,
          versionCode: versionCode || existingDevice.versionCode,
          lastUsedAt: new Date(),
        });

        console.log(`✅ Updated device ${deviceId} for ${userType} ${userId}`);
        return existingDevice;
      }

      // Device doesn't exist - check if we need to remove old devices before creating
      const userDeviceCount = await this.deviceTokenModel.count({
        where: { userId, userType },
      });

      if (userDeviceCount >= this.MAX_DEVICES_PER_USER) {
        const oldestDevice = await this.deviceTokenModel.findOne({
          where: { userId, userType },
          order: [['lastUsedAt', 'ASC']],
        });

        if (oldestDevice) {
          await oldestDevice.destroy();
          console.log(`🗑️ Removed oldest device for ${userType} ${userId} (limit: ${this.MAX_DEVICES_PER_USER})`);
        }
      }

      // Create new device
      const newDevice = await this.deviceTokenModel.create({
        userId,
        userType,
        fcmToken,
        deviceId,
        deviceName,
        deviceOs,
        appVersion,
        versionCode,
        lastUsedAt: new Date(),
      });

      console.log(`🆕 Added new device ${deviceId} for ${userType} ${userId}`);
      return newDevice;
    }

    // Fallback: No deviceId provided - use old fcmToken-based logic
    const existingToken = await this.deviceTokenModel.findOne({
      where: { fcmToken },
    });

    if (existingToken) {
      await existingToken.update({
        userId,
        userType,
        deviceName: deviceName || existingToken.deviceName,
        deviceOs: deviceOs || existingToken.deviceOs,
        appVersion: appVersion || existingToken.appVersion,
        versionCode: versionCode || existingToken.versionCode,
        lastUsedAt: new Date(),
      });

      console.log(`✅ Updated FCM token for ${userType} ${userId}`);
      return existingToken;
    }

    // Create new token
    const newToken = await this.deviceTokenModel.create({
      userId,
      userType,
      fcmToken,
      deviceName,
      deviceOs,
      appVersion,
      versionCode,
      lastUsedAt: new Date(),
    });

    console.log(`🆕 Added new FCM token for ${userType} ${userId}`);
    return newToken;
  }

  /**
   * Get all active FCM tokens for a user
   * Returns array of token strings for sending notifications
   */
  async getAllUserTokens(userId: number, userType: UserType): Promise<string[]> {
    console.log(`🔍 Fetching device tokens for ${userType} ${userId}`);

    const tokens = await this.deviceTokenModel.findAll({
      where: {
        userId,
        userType,
      },
      attributes: ['fcmToken', 'deviceName', 'lastUsedAt'],
      order: [['lastUsedAt', 'DESC']],
    });

    const tokenStrings = tokens.map((t) => t.fcmToken);

    console.log(`📱 Found ${tokens.length} device(s) for ${userType} ${userId}:`);
    tokens.forEach((t, index) => {
      console.log(`   Device ${index + 1}: ${t.deviceName || 'Unknown'} (Last used: ${t.lastUsedAt})`);
    });
    console.log(`✅ Returning ${tokenStrings.length} token(s)`);

    return tokenStrings;
  }

  /**
   * Get all device info for a user
   * Useful for displaying logged-in devices in settings
   */
  async getUserDevices(userId: number, userType: UserType): Promise<DeviceToken[]> {
    return await this.deviceTokenModel.findAll({
      where: {
        userId,
        userType,
      },
      order: [['lastUsedAt', 'DESC']],
    });
  }

  /**
   * Remove a specific device token
   * Used when user logs out from a specific device
   */
  async removeDeviceToken(fcmToken: string): Promise<boolean> {
    const result = await this.deviceTokenModel.destroy({
      where: { fcmToken },
    });

    if (result > 0) {
      console.log(`🗑️ Removed device token: ${fcmToken.substring(0, 20)}...`);
      return true;
    }

    return false;
  }

  /**
   * Remove all devices for a user
   * Used when user logs out from all devices
   */
  async removeAllUserDevices(userId: number, userType: UserType): Promise<number> {
    const result = await this.deviceTokenModel.destroy({
      where: {
        userId,
        userType,
      },
    });

    console.log(`🗑️ Removed ${result} device(s) for ${userType} ${userId}`);
    return result;
  }

  /**
   * Clean up old/inactive tokens
   * Run as cron job to remove tokens not used in X days
   */
  async cleanupOldTokens(daysInactive: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const result = await this.deviceTokenModel.destroy({
      where: {
        lastUsedAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });

    if (result > 0) {
      console.log(`🧹 Cleaned up ${result} inactive device token(s) (older than ${daysInactive} days)`);
    }

    return result;
  }

  /**
   * Get device count for a user
   */
  async getUserDeviceCount(userId: number, userType: UserType): Promise<number> {
    return await this.deviceTokenModel.count({
      where: {
        userId,
        userType,
      },
    });
  }

  /**
   * Get user type from userId and deviceId
   * Returns the userType (influencer/brand) if device is found
   */
  async getUserTypeFromDevice(userId: number, deviceId: string): Promise<UserType | null> {
    const device = await this.deviceTokenModel.findOne({
      where: {
        userId,
        deviceId,
      },
      attributes: ['userType'],
    });

    return device ? device.userType : null;
  }
}
