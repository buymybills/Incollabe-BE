import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
  HasMany,
  BeforeCreate,
  BeforeUpdate,
  AfterFind,
} from 'sequelize-typescript';
import { Niche } from '../../auth/model/niche.model';
import { BrandNiche } from './brand-niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { CompanyType } from '../../shared/models/company-type.model';
import { CustomNiche } from '../../auth/model/custom-niche.model';
import { EncryptionService } from '../../shared/services/encryption.service';

export interface BrandCreationAttributes {
  email: string;
  emailHash?: string;
  password?: string;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  brandName?: string;
  username?: string;
  legalEntityName?: string;
  companyTypeId?: number;
  brandEmailId?: string;
  pocName?: string;
  pocDesignation?: string;
  pocEmailId?: string;
  pocContactNumber?: string;
  brandBio?: string;
  profileImage?: string;
  profileBanner?: string;
  profileHeadline?: string;
  websiteUrl?: string;
  foundedYear?: number;
  headquarterCountryId?: number;
  headquarterCityId?: number;
  activeRegions?: string[];
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  incorporationDocument?: string;
  gstDocument?: string;
  panDocument?: string;
  isProfileCompleted?: boolean;
  isActive?: boolean;
  isVerified?: boolean;
  isTopBrand?: boolean;
}

@Table({ tableName: 'brands', timestamps: true, paranoid: true })
export class Brand extends Model<Brand, BrandCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare emailHash: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare password: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isEmailVerified: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare brandName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare username: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare legalEntityName: string;

  @ForeignKey(() => CompanyType)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare companyTypeId: number;

  @BelongsTo(() => CompanyType)
  declare companyType?: CompanyType;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare brandEmailId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pocName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pocDesignation: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare pocEmailId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare pocContactNumber: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare brandBio: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare profileImage: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare profileBanner: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare fcmToken: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare profileHeadline: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare websiteUrl: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare foundedYear: number;

  @ForeignKey(() => Country)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare headquarterCountryId: number;

  @ForeignKey(() => City)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare headquarterCityId: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare activeRegions: string[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare facebookUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare instagramUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare youtubeUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare linkedinUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare twitterUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare incorporationDocument: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare gstDocument: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare panDocument: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isProfileCompleted: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isVerified: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isTopBrand: boolean;

  @BelongsToMany(() => Niche, () => BrandNiche)
  declare niches: Niche[];

  @HasMany(() => CustomNiche, 'brandId')
  declare customNiches: CustomNiche[];

  @BelongsTo(() => Country, 'headquarterCountryId')
  declare headquarterCountry: Country;

  @BelongsTo(() => City, 'headquarterCityId')
  declare headquarterCity: City;

  // Encryption hooks
  @BeforeCreate
  @BeforeUpdate
  static async encryptSensitiveData(instance: Brand) {
    const encryptionService = new EncryptionService({
      get: (key: string) => process.env[key],
    } as any);

    // Encrypt email if it's been modified and not already encrypted
    if (instance.changed('email') && instance.email) {
      if (!instance.email.includes(':')) {
        const crypto = require('crypto');
        // Create hash for searching
        instance.emailHash = crypto
          .createHash('sha256')
          .update(instance.email)
          .digest('hex');
        instance.email = encryptionService.encrypt(instance.email);
      }
    }

    // Encrypt pocEmailId if it's been modified and not already encrypted
    if (instance.changed('pocEmailId') && instance.pocEmailId) {
      if (!instance.pocEmailId.includes(':')) {
        instance.pocEmailId = encryptionService.encrypt(instance.pocEmailId);
      }
    }

    // Encrypt pocContactNumber if it's been modified and not already encrypted
    if (instance.changed('pocContactNumber') && instance.pocContactNumber) {
      if (!instance.pocContactNumber.includes(':')) {
        instance.pocContactNumber = encryptionService.encrypt(
          instance.pocContactNumber,
        );
      }
    }

    // Encrypt incorporationDocument if it's been modified and not already encrypted
    if (
      instance.changed('incorporationDocument') &&
      instance.incorporationDocument
    ) {
      if (!instance.incorporationDocument.includes(':')) {
        instance.incorporationDocument = encryptionService.encrypt(
          instance.incorporationDocument,
        );
      }
    }

    // Encrypt gstDocument if it's been modified and not already encrypted
    if (instance.changed('gstDocument') && instance.gstDocument) {
      if (!instance.gstDocument.includes(':')) {
        instance.gstDocument = encryptionService.encrypt(instance.gstDocument);
      }
    }

    // Encrypt panDocument if it's been modified and not already encrypted
    if (instance.changed('panDocument') && instance.panDocument) {
      if (!instance.panDocument.includes(':')) {
        instance.panDocument = encryptionService.encrypt(instance.panDocument);
      }
    }
  }

  @AfterFind
  static async decryptSensitiveData(instances: Brand[] | Brand | null) {
    if (!instances) return;

    const encryptionService = new EncryptionService({
      get: (key: string) => process.env[key],
    } as any);

    const decrypt = (instance: Brand) => {
      if (instance.email) {
        instance.email = encryptionService.decrypt(instance.email);
      }
      if (instance.pocEmailId) {
        instance.pocEmailId = encryptionService.decrypt(instance.pocEmailId);
      }
      if (instance.pocContactNumber) {
        instance.pocContactNumber = encryptionService.decrypt(
          instance.pocContactNumber,
        );
      }
      if (instance.incorporationDocument) {
        instance.incorporationDocument = encryptionService.decrypt(
          instance.incorporationDocument,
        );
      }
      if (instance.gstDocument) {
        instance.gstDocument = encryptionService.decrypt(instance.gstDocument);
      }
      if (instance.panDocument) {
        instance.panDocument = encryptionService.decrypt(instance.panDocument);
      }
    };

    if (Array.isArray(instances)) {
      instances.forEach(decrypt);
    } else {
      decrypt(instances);
    }
  }
}
