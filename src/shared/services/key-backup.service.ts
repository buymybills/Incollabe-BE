import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { KeyBackup, UserType } from '../models/key-backup.model';
import { CreateKeyBackupDto, UpdateKeyBackupDto } from '../dto/key-backup.dto';

@Injectable()
export class KeyBackupService {
  constructor(
    @InjectModel(KeyBackup)
    private keyBackupModel: typeof KeyBackup,
  ) {}

  /**
   * Create or update key backup for a user
   */
  async createOrUpdateBackup(
    userId: number,
    userType: UserType,
    dto: CreateKeyBackupDto,
  ) {
    try {
      // Check if backup already exists
      const existingBackup = await this.keyBackupModel.findOne({
        where: {
          userId,
          userType,
        },
      });

      if (existingBackup) {
        // Update existing backup
        await existingBackup.update({
          encryptedPrivateKey: dto.encryptedPrivateKey,
          salt: dto.salt,
          publicKey: dto.publicKey,
          keyVersion: existingBackup.keyVersion + 1,
          deviceInfo: dto.deviceInfo,
          updatedAt: new Date(),
        });

        return {
          success: true,
          message: 'Key backup updated successfully',
          keyVersion: existingBackup.keyVersion,
        };
      } else {
        // Create new backup
        const backup = await this.keyBackupModel.create({
          userId,
          userType,
          encryptedPrivateKey: dto.encryptedPrivateKey,
          salt: dto.salt,
          publicKey: dto.publicKey,
          keyVersion: 1,
          deviceInfo: dto.deviceInfo,
        } as any);

        return {
          success: true,
          message: 'Key backup created successfully',
          keyVersion: backup.keyVersion,
        };
      }
    } catch (error) {
      console.error('Error creating/updating key backup:', error);
      throw new ConflictException('Failed to save key backup');
    }
  }

  /**
   * Get key backup for a user
   */
  async getBackup(userId: number, userType: UserType) {
    const backup = await this.keyBackupModel.findOne({
      where: {
        userId,
        userType,
      },
    });

    if (!backup) {
      throw new NotFoundException('Key backup not found');
    }

    // Update last accessed timestamp
    await backup.update({
      lastAccessedAt: new Date(),
    });

    return {
      success: true,
      data: {
        encryptedPrivateKey: backup.encryptedPrivateKey,
        salt: backup.salt,
        publicKey: backup.publicKey,
        keyVersion: backup.keyVersion,
        createdAt: backup.createdAt,
      },
    };
  }

  /**
   * Check if backup exists
   */
  async hasBackup(userId: number, userType: UserType): Promise<boolean> {
    const count = await this.keyBackupModel.count({
      where: {
        userId,
        userType,
      },
    });

    return count > 0;
  }

  /**
   * Delete key backup
   */
  async deleteBackup(userId: number, userType: UserType) {
    const result = await this.keyBackupModel.destroy({
      where: {
        userId,
        userType,
      },
    });

    if (result === 0) {
      throw new NotFoundException('Key backup not found');
    }

    return {
      success: true,
      message: 'Key backup deleted successfully',
    };
  }

  /**
   * Update key backup (for key rotation)
   */
  async updateBackup(
    userId: number,
    userType: UserType,
    dto: UpdateKeyBackupDto,
  ) {
    const backup = await this.keyBackupModel.findOne({
      where: {
        userId,
        userType,
      },
    });

    if (!backup) {
      throw new NotFoundException('Key backup not found');
    }

    await backup.update({
      encryptedPrivateKey: dto.encryptedPrivateKey,
      salt: dto.salt,
      publicKey: dto.publicKey || backup.publicKey,
      keyVersion: backup.keyVersion + 1,
      updatedAt: new Date(),
    });

    return {
      success: true,
      message: 'Key backup updated successfully',
      keyVersion: backup.keyVersion,
    };
  }
}
