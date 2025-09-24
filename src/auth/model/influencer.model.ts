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
} from 'sequelize-typescript';
import { Niche } from './niche.model';
import { InfluencerNiche } from './influencer-niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { GENDER_OPTIONS, OTHERS_GENDER_OPTIONS } from '../types/gender.enum';
import type { GenderType, OthersGenderType } from '../types/gender.enum';

@Table({
  tableName: 'influencers',
  timestamps: true,
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
    type: DataType.STRING,
    validate: {
      is: {
        args: /^\+91[6-9]\d{9}$/,
        msg: 'Phone number must be in format +91XXXXXXXXXX where X is a valid Indian mobile number',
      },
    },
  })
  declare phone: string;

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

  @ForeignKey(() => Country)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare countryId: number;

  @ForeignKey(() => City)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare cityId: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare whatsappNumber: string;

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

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastLoginAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare deviceToken: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsToMany(() => Niche, () => InfluencerNiche)
  declare niches: Niche[];

  @BelongsTo(() => Country)
  declare country: Country;

  @BelongsTo(() => City)
  declare city: City;
}
