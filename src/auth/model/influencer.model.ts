import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  Unique,
  AllowNull,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  HasMany,
  BeforeCreate,
  BeforeUpdate,
  AfterFind,
} from 'sequelize-typescript';
import { Niche } from './niche.model';
import { InfluencerNiche } from './influencer-niche.model';
import { CustomNiche } from './custom-niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { GENDER_OPTIONS, OTHERS_GENDER_OPTIONS } from '../types/gender.enum';
import type { GenderType, OthersGenderType } from '../types/gender.enum';
import { EncryptionService } from '../../shared/services/encryption.service';

@Table({
  tableName: 'influencers',
  timestamps: true,
  paranoid: true,
})
export class Influencer extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare username: string;

  @AllowNull(false)
  @Unique
  @Column({
    type: DataType.TEXT,
  })
  declare phone: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    unique: true,
  })
  declare phoneHash: string;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  declare dateOfBirth: Date;

  @AllowNull(true)
  @Column(DataType.ENUM(...GENDER_OPTIONS))
  declare gender: GenderType;

  @AllowNull(true)
  @Column(DataType.ENUM(...OTHERS_GENDER_OPTIONS))
  declare othersGender: OthersGenderType;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare bio: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare profileImage: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare profileBanner: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare profileHeadline: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare fcmToken: string;

  @ForeignKey(() => Country)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare countryId: number;

  @ForeignKey(() => City)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare cityId: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare whatsappNumber: string;

  @AllowNull(true)
  @Column({
    type: DataType.STRING,
    unique: true,
  })
  declare whatsappHash: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isWhatsappVerified: boolean;

  // Social Media Links
  @AllowNull(true)
  @Column(DataType.STRING)
  declare instagramUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare youtubeUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare facebookUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare linkedinUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare twitterUrl: string;

  // Collaboration Costs (stored as JSON)
  @AllowNull(true)
  @Column(DataType.JSON)
  declare collaborationCosts: object;

  // Profile Completion Status
  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isProfileCompleted: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isPhoneVerified: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isVerified: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isTopInfluencer: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastLoginAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsToMany(() => Niche, () => InfluencerNiche)
  declare niches: Niche[];

  @HasMany(() => CustomNiche, 'influencerId')
  declare customNiches: CustomNiche[];

  @BelongsTo(() => Country)
  declare country: Country;

  @BelongsTo(() => City)
  declare city: City;

  // Encryption hooks
  @BeforeCreate
  @BeforeUpdate
  static async encryptSensitiveData(instance: Influencer) {
    const encryptionService = new EncryptionService({
      get: (key: string) => process.env[key],
    } as any);

    // Encrypt phone if it's been modified and not already encrypted
    if (instance.changed('phone') && instance.phone) {
      // Check if already encrypted (contains : separator)
      if (!instance.phone.includes(':')) {
        const crypto = require('crypto');
        // Create hash for searching
        instance.phoneHash = crypto
          .createHash('sha256')
          .update(instance.phone)
          .digest('hex');
        instance.phone = encryptionService.encrypt(instance.phone);
      }
    }

    // Encrypt whatsappNumber if it's been modified and not already encrypted
    if (instance.changed('whatsappNumber') && instance.whatsappNumber) {
      if (!instance.whatsappNumber.includes(':')) {
        const crypto = require('crypto');
        // Create hash for searching
        instance.whatsappHash = crypto
          .createHash('sha256')
          .update(instance.whatsappNumber)
          .digest('hex');
        instance.whatsappNumber = encryptionService.encrypt(
          instance.whatsappNumber,
        );
      }
    }
  }

  @AfterFind
  static async decryptSensitiveData(
    instances: Influencer[] | Influencer | null,
  ) {
    if (!instances) return;

    const encryptionService = new EncryptionService({
      get: (key: string) => process.env[key],
    } as any);

    const decrypt = (instance: Influencer) => {
      if (instance.phone) {
        instance.phone = encryptionService.decrypt(instance.phone);
      }
      if (instance.whatsappNumber) {
        instance.whatsappNumber = encryptionService.decrypt(
          instance.whatsappNumber,
        );
      }
    };

    if (Array.isArray(instances)) {
      instances.forEach(decrypt);
    } else {
      decrypt(instances);
    }
  }
}
