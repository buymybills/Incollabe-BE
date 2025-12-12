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
    const { userId, userType, fcmToken, deviceId, deviceName, deviceOs, appVersion } = params;

    // Check if this FCM token already exists
    const existingToken = await this.deviceTokenModel.findOne({
      where: { fcmToken },
    });

    if (existingToken) {
      // Update existing token with new device info and last used timestamp
      await existingToken.update({
        userId, // Update in case token was transferred to another account
        userType,
        deviceId: deviceId || existingToken.deviceId,
        deviceName: deviceName || existingToken.deviceName,
        deviceOs: deviceOs || existingToken.deviceOs,
        appVersion: appVersion || existingToken.appVersion,
        lastUsedAt: new Date(),
      });

      console.log(`✅ Updated existing FCM token for ${userType} ${userId}`);
      return existingToken;
    }

    // Check current device count for this user
    const userDeviceCount = await this.deviceTokenModel.count({
      where: {
        userId,
        userType,
      },
    });

    // If user has 5 or more devices, remove the oldest one
    if (userDeviceCount >= this.MAX_DEVICES_PER_USER) {
      const oldestDevice = await this.deviceTokenModel.findOne({
        where: {
          userId,
          userType,
        },
        order: [['lastUsedAt', 'ASC']],
      });

      if (oldestDevice) {
        await oldestDevice.destroy();
        console.log(`🗑️ Removed oldest device token for ${userType} ${userId} (limit: ${this.MAX_DEVICES_PER_USER})`);
      }
    }

    // Create new device token
    const newToken = await this.deviceTokenModel.create({
      userId,
      userType,
      fcmToken,
      deviceId,
      deviceName,
      deviceOs,
      appVersion,
      lastUsedAt: new Date(),
    });

    console.log(`🆕 Added new FCM token for ${userType} ${userId} (device: ${deviceName || 'Unknown'})`);
    return newToken;
  }

  /**
   * Get all active FCM tokens for a user
   * Returns array of token strings for sending notifications
   */
  async getAllUserTokens(userId: number, userType: UserType): Promise<string[]> {
    const tokens = await this.deviceTokenModel.findAll({
      where: {
        userId,
        userType,
      },
      attributes: ['fcmToken'],
      order: [['lastUsedAt', 'DESC']],
    });

    return tokens.map((t) => t.fcmToken);
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
}
